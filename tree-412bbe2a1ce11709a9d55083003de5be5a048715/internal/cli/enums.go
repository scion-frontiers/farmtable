package cli

import (
	"fmt"
	"strings"

	pb "github.com/farmtable-io/farmtable/api/farmtable/v1"
)

var phaseNames = map[pb.TaskPhase]string{
	pb.TaskPhase_TASK_PHASE_OPEN:        "OPEN",
	pb.TaskPhase_TASK_PHASE_IN_PROGRESS: "IN_PROGRESS",
	pb.TaskPhase_TASK_PHASE_ON_HOLD:     "ON_HOLD",
	pb.TaskPhase_TASK_PHASE_CLOSED:      "CLOSED",
}

var stageNames = map[pb.TaskStage]string{
	pb.TaskStage_TASK_STAGE_TRIAGE:           "triage",
	pb.TaskStage_TASK_STAGE_BACKLOG:          "backlog",
	pb.TaskStage_TASK_STAGE_READY:            "ready",
	pb.TaskStage_TASK_STAGE_WORKING:          "working",
	pb.TaskStage_TASK_STAGE_IN_REVIEW:        "in_review",
	pb.TaskStage_TASK_STAGE_IN_QA:            "in_qa",
	pb.TaskStage_TASK_STAGE_DEPLOYING:        "deploying",
	pb.TaskStage_TASK_STAGE_BLOCKED:          "blocked",
	pb.TaskStage_TASK_STAGE_WAITING_FOR_INPUT: "waiting_for_input",
	pb.TaskStage_TASK_STAGE_DEFERRED:         "deferred",
	pb.TaskStage_TASK_STAGE_SCHEDULED:        "scheduled",
	pb.TaskStage_TASK_STAGE_COMPLETED:        "completed",
	pb.TaskStage_TASK_STAGE_WONT_FIX:         "wont_fix",
	pb.TaskStage_TASK_STAGE_DUPLICATE:        "duplicate",
	pb.TaskStage_TASK_STAGE_CANCELLED:        "cancelled",
}

var stageValues = map[string]pb.TaskStage{
	"triage":            pb.TaskStage_TASK_STAGE_TRIAGE,
	"backlog":           pb.TaskStage_TASK_STAGE_BACKLOG,
	"ready":             pb.TaskStage_TASK_STAGE_READY,
	"working":           pb.TaskStage_TASK_STAGE_WORKING,
	"in_review":         pb.TaskStage_TASK_STAGE_IN_REVIEW,
	"in_qa":             pb.TaskStage_TASK_STAGE_IN_QA,
	"deploying":         pb.TaskStage_TASK_STAGE_DEPLOYING,
	"blocked":           pb.TaskStage_TASK_STAGE_BLOCKED,
	"waiting_for_input": pb.TaskStage_TASK_STAGE_WAITING_FOR_INPUT,
	"deferred":          pb.TaskStage_TASK_STAGE_DEFERRED,
	"scheduled":         pb.TaskStage_TASK_STAGE_SCHEDULED,
	"completed":         pb.TaskStage_TASK_STAGE_COMPLETED,
	"wont_fix":          pb.TaskStage_TASK_STAGE_WONT_FIX,
	"duplicate":         pb.TaskStage_TASK_STAGE_DUPLICATE,
	"cancelled":         pb.TaskStage_TASK_STAGE_CANCELLED,
}

var priorityNames = map[pb.TaskPriority]string{
	pb.TaskPriority_TASK_PRIORITY_URGENT: "URGENT",
	pb.TaskPriority_TASK_PRIORITY_HIGH:   "HIGH",
	pb.TaskPriority_TASK_PRIORITY_NORMAL: "NORMAL",
	pb.TaskPriority_TASK_PRIORITY_LOW:    "LOW",
}

var priorityValues = map[string]pb.TaskPriority{
	"URGENT": pb.TaskPriority_TASK_PRIORITY_URGENT,
	"HIGH":   pb.TaskPriority_TASK_PRIORITY_HIGH,
	"NORMAL": pb.TaskPriority_TASK_PRIORITY_NORMAL,
	"LOW":    pb.TaskPriority_TASK_PRIORITY_LOW,
}

var platformNames = map[pb.Platform]string{
	pb.Platform_PLATFORM_FARMTABLE: "farmtable",
	pb.Platform_PLATFORM_GITHUB:    "github",
	pb.Platform_PLATFORM_LINEAR:    "linear",
	pb.Platform_PLATFORM_JIRA:      "jira",
	pb.Platform_PLATFORM_ASANA:     "asana",
	pb.Platform_PLATFORM_BEADS:     "beads",
}

var platformValues = map[string]pb.Platform{
	"farmtable": pb.Platform_PLATFORM_FARMTABLE,
	"github":    pb.Platform_PLATFORM_GITHUB,
	"linear":    pb.Platform_PLATFORM_LINEAR,
	"jira":      pb.Platform_PLATFORM_JIRA,
	"asana":     pb.Platform_PLATFORM_ASANA,
	"beads":     pb.Platform_PLATFORM_BEADS,
}

var userTypeNames = map[pb.UserType]string{
	pb.UserType_USER_TYPE_HUMAN:           "HUMAN",
	pb.UserType_USER_TYPE_AGENT:           "AGENT",
	pb.UserType_USER_TYPE_SERVICE_ACCOUNT: "SERVICE_ACCOUNT",
}

var sortFieldValues = map[string]pb.SortField{
	"created":  pb.SortField_SORT_FIELD_CREATED,
	"updated":  pb.SortField_SORT_FIELD_UPDATED,
	"priority": pb.SortField_SORT_FIELD_PRIORITY,
	"due_date": pb.SortField_SORT_FIELD_DUE_DATE,
}

var sortOrderValues = map[string]pb.SortOrder{
	"asc":  pb.SortOrder_SORT_ORDER_ASC,
	"desc": pb.SortOrder_SORT_ORDER_DESC,
}

var ciStatusValues = map[string]pb.CIStatus{
	"pending": pb.CIStatus_CI_STATUS_PENDING,
	"running": pb.CIStatus_CI_STATUS_RUNNING,
	"passed":  pb.CIStatus_CI_STATUS_PASSED,
	"failed":  pb.CIStatus_CI_STATUS_FAILED,
}

var prStatusValues = map[string]pb.PullRequestStatus{
	"open":   pb.PullRequestStatus_PULL_REQUEST_STATUS_OPEN,
	"merged": pb.PullRequestStatus_PULL_REQUEST_STATUS_MERGED,
	"closed": pb.PullRequestStatus_PULL_REQUEST_STATUS_CLOSED,
}

func parseStage(s string) (pb.TaskStage, error) {
	v, ok := stageValues[strings.ToLower(s)]
	if !ok {
		return 0, fmt.Errorf("invalid stage %q; valid stages: %s", s, validStages())
	}
	return v, nil
}

func parsePriority(s string) (pb.TaskPriority, error) {
	v, ok := priorityValues[strings.ToUpper(s)]
	if !ok {
		return 0, fmt.Errorf("invalid priority %q; valid priorities: URGENT, HIGH, NORMAL, LOW", s)
	}
	return v, nil
}

func parsePlatform(s string) (pb.Platform, error) {
	v, ok := platformValues[strings.ToLower(s)]
	if !ok {
		return 0, fmt.Errorf("invalid platform %q; valid platforms: farmtable, github, linear, jira, asana, beads", s)
	}
	return v, nil
}

func parsePhase(s string) (pb.TaskPhase, error) {
	switch strings.ToUpper(s) {
	case "OPEN":
		return pb.TaskPhase_TASK_PHASE_OPEN, nil
	case "IN_PROGRESS":
		return pb.TaskPhase_TASK_PHASE_IN_PROGRESS, nil
	case "ON_HOLD":
		return pb.TaskPhase_TASK_PHASE_ON_HOLD, nil
	case "CLOSED":
		return pb.TaskPhase_TASK_PHASE_CLOSED, nil
	default:
		return 0, fmt.Errorf("invalid phase %q; valid phases: OPEN, IN_PROGRESS, ON_HOLD, CLOSED", s)
	}
}

func validStages() string {
	stages := make([]string, 0, len(stageValues))
	for k := range stageValues {
		stages = append(stages, k)
	}
	return strings.Join(stages, ", ")
}
