package decomposer

import (
	"encoding/json"
	"fmt"
	"strings"
)

// DecompositionResult is the top-level JSON structure returned by the LLM.
// When the LLM judges the current task as terminal (not decomposable),
// it returns {"terminal": true}. When it decomposes, it returns the groups array.
type DecompositionResult struct {
	Terminal *bool   `json:"terminal,omitempty"`
	Groups   []Group `json:"groups,omitempty"`
}

// Group represents a parallel group of subtasks. Tasks within the same group
// can be done in any order; tasks in higher-numbered groups depend on all tasks
// in the previous group completing first.
type Group struct {
	GroupNum int       `json:"group"`
	Tasks    []Subtask `json:"tasks"`
}

// Subtask represents a single decomposed task within a group.
type Subtask struct {
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Terminal    bool   `json:"terminal"`
}

// ParseResult extracts JSON from the LLM response and unmarshals it into a
// DecompositionResult. The LLM often wraps JSON in markdown code fences or adds
// commentary; this function finds the first '{' to last '}' span.
func ParseResult(raw string) (*DecompositionResult, error) {
	jsonStr, err := extractJSON(raw)
	if err != nil {
		return nil, fmt.Errorf("extracting JSON: %w", err)
	}

	var result DecompositionResult
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return nil, fmt.Errorf("unmarshaling JSON: %w", err)
	}

	if err := validateResult(&result); err != nil {
		return nil, fmt.Errorf("validating result: %w", err)
	}

	return &result, nil
}

// extractJSON finds the outermost JSON object in the raw string (first '{' to
// last '}'). This handles markdown code fences, commentary before/after, etc.
func extractJSON(raw string) (string, error) {
	first := strings.IndexByte(raw, '{')
	if first < 0 {
		return "", fmt.Errorf("no JSON object found in response")
	}
	last := strings.LastIndexByte(raw, '}')
	if last < 0 || last <= first {
		return "", fmt.Errorf("no closing brace found in response")
	}
	return raw[first : last+1], nil
}

// validateResult checks semantic validity of a parsed DecompositionResult.
func validateResult(r *DecompositionResult) error {
	// Terminal response is valid as-is.
	if r.Terminal != nil && *r.Terminal {
		return nil
	}

	if len(r.Groups) == 0 {
		return fmt.Errorf("no groups in decomposition result")
	}

	slugs := make(map[string]bool)
	prevGroupNum := -1

	for i, g := range r.Groups {
		if g.GroupNum < prevGroupNum {
			return fmt.Errorf("groups not in ascending order: group %d after group %d", g.GroupNum, prevGroupNum)
		}
		prevGroupNum = g.GroupNum

		if len(g.Tasks) == 0 {
			return fmt.Errorf("group %d (index %d) has no tasks", g.GroupNum, i)
		}

		for _, t := range g.Tasks {
			if t.Slug == "" {
				return fmt.Errorf("task in group %d has empty slug", g.GroupNum)
			}
			if slugs[t.Slug] {
				return fmt.Errorf("duplicate slug %q", t.Slug)
			}
			slugs[t.Slug] = true

			if t.Title == "" {
				return fmt.Errorf("task %q has empty title", t.Slug)
			}
			if t.Description == "" {
				return fmt.Errorf("task %q has empty description", t.Slug)
			}
		}
	}

	return nil
}
