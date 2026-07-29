package decomposer

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"os"
	"sync"
	"sync/atomic"
	"time"
)

// Engine orchestrates recursive task decomposition using an LLM and writes
// the resulting task DAG to Farmtable.
type Engine struct {
	llm          Inferencer
	writer       TaskWriter
	systemPrompt string
	maxDepth     int
	concurrency  int
	verbose      bool
	sem          chan struct{} // semaphore for bounding concurrent LLM calls

	// Stats tracked atomically for the summary.
	totalTasks    atomic.Int32
	terminalTasks atomic.Int32
	maxDepthSeen  atomic.Int32

	logger *log.Logger
}

// EngineConfig holds configuration for creating a new Engine.
type EngineConfig struct {
	LLM          Inferencer
	Writer       TaskWriter
	SystemPrompt string
	MaxDepth     int
	Concurrency  int
	Verbose      bool
}

// NewEngine creates a new decomposition engine.
func NewEngine(cfg EngineConfig) *Engine {
	if cfg.MaxDepth <= 0 {
		cfg.MaxDepth = 3
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 4
	}

	return &Engine{
		llm:          cfg.LLM,
		writer:       cfg.Writer,
		systemPrompt: cfg.SystemPrompt,
		maxDepth:     cfg.MaxDepth,
		concurrency:  cfg.Concurrency,
		verbose:      cfg.Verbose,
		sem:          make(chan struct{}, cfg.Concurrency),
		logger:       log.New(os.Stderr, "", 0),
	}
}

// createdTask pairs a subtask with its Farmtable task ID.
type createdTask struct {
	subtask Subtask
	taskID  string
}

// Run starts the decomposition from the root input text.
// It creates a root task on Farmtable and recursively decomposes it.
func (e *Engine) Run(ctx context.Context, collectionID, inputText, rootTitle string) error {
	// Create root task.
	rootID, err := e.writer.CreateTask(ctx, rootTitle, inputText, "", nil)
	if err != nil {
		return fmt.Errorf("creating root task: %w", err)
	}
	e.totalTasks.Add(1)
	e.logf("Created root task: %s (id: %s)", rootTitle, rootID)

	// Decompose starting from the root.
	return e.decompose(ctx, inputText, nil, rootID, 0)
}

// Stats returns the current decomposition statistics.
func (e *Engine) Stats() (total, terminal, maxDepth int) {
	return int(e.totalTasks.Load()), int(e.terminalTasks.Load()), int(e.maxDepthSeen.Load())
}

// decompose is the recursive core. It calls the LLM to decompose taskText,
// creates tasks on Farmtable, and recurses into non-terminal subtasks.
//
// CRITICAL: The semaphore is acquired around the LLM Complete() call ONLY,
// released immediately after. NOT around the entire recursive decompose() call.
// Wrapping the full recursion would deadlock when there are more non-terminal
// tasks than semaphore slots.
func (e *Engine) decompose(ctx context.Context, taskText string, contextChain []string, parentTaskID string, depth int) error {
	// Update max depth seen.
	for {
		old := e.maxDepthSeen.Load()
		if int32(depth) <= old || e.maxDepthSeen.CompareAndSwap(old, int32(depth)) {
			break
		}
	}

	// Force terminal at max depth — don't even call the LLM.
	if depth >= e.maxDepth {
		e.logf("[depth=%d] Max depth reached, forcing terminal for parent %s", depth, parentTaskID)
		return nil
	}

	// Check context cancellation.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// 1. Build prompt.
	messages := BuildPrompt(e.systemPrompt, contextChain, taskText, depth)

	if e.verbose {
		e.logf("[depth=%d] LLM prompt for parent %s:", depth, parentTaskID)
		for _, m := range messages {
			e.logf("  [%s] %s", m.Role, truncate(m.Content, 200))
		}
	}

	// 2. Call LLM with retry and semaphore.
	response, err := e.callLLMWithRetry(ctx, messages)
	if err != nil {
		return fmt.Errorf("[depth=%d] LLM call failed: %w", depth, err)
	}

	if e.verbose {
		e.logf("[depth=%d] LLM response: %s", depth, truncate(response, 500))
	}

	// 5. Parse response.
	result, err := ParseResult(response)
	if err != nil {
		// Corrective retry: re-prompt asking for valid JSON.
		e.logf("[depth=%d] Parse error: %v — retrying with corrective prompt", depth, err)
		result, err = e.correctiveRetry(ctx, messages, depth)
		if err != nil {
			// Force terminal on second parse failure.
			e.logf("[depth=%d] Corrective retry failed: %v — forcing terminal", depth, err)
			return nil
		}
	}

	// Terminal response from LLM — this task is a leaf.
	if result.Terminal != nil && *result.Terminal {
		e.logf("[depth=%d] LLM judged task as terminal (parent %s)", depth, parentTaskID)
		return nil
	}

	// 6. Create ALL subtasks on Farmtable, wire BLOCKED_BY between groups.
	var allCreated []createdTask
	var prevGroupTaskIDs []string

	for _, group := range result.Groups {
		var currentGroupTaskIDs []string
		for _, st := range group.Tasks {
			taskID, err := e.writer.CreateTask(ctx, st.Title, st.Description, parentTaskID, prevGroupTaskIDs)
			if err != nil {
				return fmt.Errorf("[depth=%d] creating task %q: %w", depth, st.Slug, err)
			}
			e.totalTasks.Add(1)
			if st.Terminal {
				e.terminalTasks.Add(1)
			}

			e.logf("[depth=%d] Created %02d-%s (group %d, %s, id: %s)",
				depth, group.GroupNum, st.Slug,
				group.GroupNum, terminalStr(st.Terminal), taskID)

			currentGroupTaskIDs = append(currentGroupTaskIDs, taskID)
			allCreated = append(allCreated, createdTask{subtask: st, taskID: taskID})
		}
		prevGroupTaskIDs = currentGroupTaskIDs
	}

	// 7. Recurse into ALL non-terminal tasks concurrently (no group barriers).
	var wg sync.WaitGroup
	var firstErr error
	var errOnce sync.Once

	for _, ct := range allCreated {
		if ct.subtask.Terminal {
			continue
		}
		wg.Add(1)
		go func(st Subtask, taskID string) {
			defer wg.Done()
			childContext := make([]string, len(contextChain)+1)
			copy(childContext, contextChain)
			childContext[len(contextChain)] = taskText
			if err := e.decompose(ctx, st.Description, childContext, taskID, depth+1); err != nil {
				errOnce.Do(func() { firstErr = err })
			}
		}(ct.subtask, ct.taskID)
	}
	wg.Wait()

	return firstErr
}

// callLLMWithRetry calls the LLM with exponential backoff retry for transient
// errors. The semaphore is acquired only around the actual LLM call and released
// immediately after — NOT held during backoff sleep. This ensures a stalled
// retry does not block other goroutines from making LLM calls.
func (e *Engine) callLLMWithRetry(ctx context.Context, messages []Message) (string, error) {
	const maxRetries = 3

	var response string
	var err error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Sleep BEFORE re-acquiring the semaphore so the slot is free
			// for other goroutines during the backoff window.
			backoff := time.Duration(math.Pow(2, float64(attempt-1))) * time.Second
			e.logf("Retrying LLM call (attempt %d/%d) after %v...", attempt+1, maxRetries+1, backoff)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return "", ctx.Err()
			}
		}

		// Acquire semaphore — bounds concurrent LLM calls globally.
		select {
		case e.sem <- struct{}{}:
		case <-ctx.Done():
			return "", ctx.Err()
		}

		response, err = e.llm.Complete(ctx, messages)

		// Release semaphore IMMEDIATELY after LLM call returns.
		<-e.sem

		if err == nil {
			return response, nil
		}

		// Check if error is transient.
		var llmErr *LLMError
		if errors.As(err, &llmErr) && llmErr.IsTransient() {
			e.logf("Transient LLM error (HTTP %d), will retry", llmErr.StatusCode)
			continue
		}
		// Non-transient error — don't retry.
		break
	}

	return response, err
}

// correctiveRetry re-prompts the LLM after a parse failure.
func (e *Engine) correctiveRetry(ctx context.Context, originalMessages []Message, depth int) (*DecompositionResult, error) {
	corrective := make([]Message, len(originalMessages))
	copy(corrective, originalMessages)
	corrective = append(corrective, Message{
		Role:    "user",
		Content: "Your previous response was not valid JSON. Please respond with ONLY the JSON object as specified in the system prompt, with no other text, markdown fences, or commentary.",
	})

	response, err := e.callLLMWithRetry(ctx, corrective)
	if err != nil {
		return nil, fmt.Errorf("corrective LLM call failed: %w", err)
	}

	if e.verbose {
		e.logf("[depth=%d] Corrective retry response: %s", depth, truncate(response, 500))
	}

	return ParseResult(response)
}

func (e *Engine) logf(format string, args ...interface{}) {
	e.logger.Printf(format, args...)
}

func terminalStr(terminal bool) string {
	if terminal {
		return "terminal"
	}
	return "non-terminal"
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
