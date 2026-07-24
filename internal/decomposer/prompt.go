package decomposer

import (
	"fmt"
	"strings"

	"github.com/farmtable-io/farmtable/internal/decomposer/prompts"
)

// BuildPrompt constructs the []Message for an LLM decomposition call.
// The message sequence is:
//  1. System message: the decomposition instructions (from file or embedded default).
//  2. User message: context chain (accumulated parent task descriptions) + current task.
func BuildPrompt(systemPrompt string, contextChain []string, taskText string, depth int) []Message {
	if systemPrompt == "" {
		systemPrompt = prompts.Default()
	}

	var msgs []Message

	// System message with decomposition instructions.
	msgs = append(msgs, Message{
		Role:    "system",
		Content: systemPrompt,
	})

	// User message: context chain + current task.
	var userParts []string

	if len(contextChain) > 0 {
		userParts = append(userParts, "## Parent Task Chain (for context)\n")
		for i, parent := range contextChain {
			userParts = append(userParts, fmt.Sprintf("### Level %d\n%s\n", i, parent))
		}
		userParts = append(userParts, "---\n")
	}

	userParts = append(userParts, fmt.Sprintf("## Task to Decompose (depth %d)\n\n%s", depth, taskText))

	msgs = append(msgs, Message{
		Role:    "user",
		Content: strings.Join(userParts, "\n"),
	})

	return msgs
}
