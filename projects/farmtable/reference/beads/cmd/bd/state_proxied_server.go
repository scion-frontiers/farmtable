package main

import (
	"context"
	"fmt"
	"strings"

	"github.com/steveyegge/beads/internal/storage/uow"
	"github.com/steveyegge/beads/internal/ui"
)

func proxiedStateLabels(ctx context.Context, uw uow.UnitOfWork, issueID string) (string, []string, error) {
	issue, isWisp, err := proxiedGetIssueOrWisp(ctx, uw, issueID)
	if err != nil {
		return "", nil, HandleErrorRespectJSON("resolving %s: %v", issueID, err)
	}
	if issue == nil {
		return "", nil, HandleErrorRespectJSON("resolving %s: not found", issueID)
	}
	var labels []string
	if isWisp {
		labels, err = uw.LabelUseCase().GetWispLabels(ctx, issue.ID)
	} else {
		labels, err = uw.LabelUseCase().GetLabels(ctx, issue.ID)
	}
	if err != nil {
		return "", nil, HandleErrorRespectJSON("%v", err)
	}
	return issue.ID, labels, nil
}

func runStateProxiedServer(ctx context.Context, issueID, dimension string) error {
	uw, err := proxiedOpenReadUOW(ctx)
	if err != nil {
		return err
	}
	defer uw.Close(ctx)

	fullID, labels, err := proxiedStateLabels(ctx, uw, issueID)
	if err != nil {
		return err
	}

	prefix := dimension + ":"
	var value string
	for _, label := range labels {
		if strings.HasPrefix(label, prefix) {
			value = strings.TrimPrefix(label, prefix)
			break
		}
	}

	if jsonOutput {
		result := map[string]interface{}{
			"issue_id":  fullID,
			"dimension": dimension,
			"value":     value,
		}
		if value == "" {
			result["value"] = nil
		}
		return outputJSON(result)
	}

	if value == "" {
		fmt.Printf("(no %s state set)\n", dimension)
	} else {
		fmt.Println(value)
	}
	return nil
}

func runStateListProxiedServer(ctx context.Context, issueID string) error {
	uw, err := proxiedOpenReadUOW(ctx)
	if err != nil {
		return err
	}
	defer uw.Close(ctx)

	fullID, labels, err := proxiedStateLabels(ctx, uw, issueID)
	if err != nil {
		return err
	}

	states := make(map[string]string)
	for _, label := range labels {
		if idx := strings.Index(label, ":"); idx > 0 {
			states[label[:idx]] = label[idx+1:]
		}
	}

	if jsonOutput {
		return outputJSON(map[string]interface{}{
			"issue_id": fullID,
			"states":   states,
		})
	}

	if len(states) == 0 {
		fmt.Printf("\n%s has no state labels\n", fullID)
		return nil
	}

	fmt.Printf("\n%s State for %s:\n", ui.RenderAccent("📊"), fullID)
	for dimension, value := range states {
		fmt.Printf("  %s: %s\n", dimension, value)
	}
	fmt.Println()
	return nil
}
