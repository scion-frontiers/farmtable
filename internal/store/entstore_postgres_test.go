//go:build integration

package store_test

import (
	"testing"

	"github.com/farmtable-io/farmtable/internal/testutil"
)

func TestPostgres_CreateAndGetTask(t *testing.T) {
	runCreateAndGetTask(t, testutil.NewTestStorePostgres)
}

func TestPostgres_GetTask_NotFound(t *testing.T) {
	runGetTaskNotFound(t, testutil.NewTestStorePostgres)
}

func TestPostgres_ListTasks_Filters(t *testing.T) {
	runListTasksFilters(t, testutil.NewTestStorePostgres)
}

func TestPostgres_UpdateTask_CAS(t *testing.T) {
	runUpdateTaskCAS(t, testutil.NewTestStorePostgres)
}

func TestPostgres_ClaimTask(t *testing.T) {
	runClaimTask(t, testutil.NewTestStorePostgres)
}

func TestPostgres_ClaimTask_ClosedTask(t *testing.T) {
	runClaimTaskClosedTask(t, testutil.NewTestStorePostgres)
}

func TestPostgres_VersionIncrement(t *testing.T) {
	runVersionIncrement(t, testutil.NewTestStorePostgres)
}

func TestPostgres_CloseTask(t *testing.T) {
	runCloseTask(t, testutil.NewTestStorePostgres)
}

func TestPostgres_CreateTask_WithLabelsAndDates(t *testing.T) {
	runCreateTaskWithLabelsAndDates(t, testutil.NewTestStorePostgres)
}

func TestPostgres_UpdateTask_Labels(t *testing.T) {
	runUpdateTaskLabels(t, testutil.NewTestStorePostgres)
}

func TestPostgres_UpdateTask_Dates(t *testing.T) {
	runUpdateTaskDates(t, testutil.NewTestStorePostgres)
}

func TestPostgres_UpdateTask_Relationships(t *testing.T) {
	runUpdateTaskRelationships(t, testutil.NewTestStorePostgres)
}

func TestPostgres_UpdateTask_ChangesRecorded(t *testing.T) {
	runUpdateTaskChangesRecorded(t, testutil.NewTestStorePostgres)
}

func TestPostgres_CreateTask_WithRelationships(t *testing.T) {
	runCreateTaskWithRelationships(t, testutil.NewTestStorePostgres)
}

func TestPostgres_CloseTask_AlreadyClosed(t *testing.T) {
	runCloseTaskAlreadyClosed(t, testutil.NewTestStorePostgres)
}

func TestPostgres_Relationship_DuplicateIgnored(t *testing.T) {
	runRelationshipDuplicateIgnored(t, testutil.NewTestStorePostgres)
}

func TestPostgres_ListTasks_Sort(t *testing.T) {
	runListTasksSort(t, testutil.NewTestStorePostgres)
}

func TestPostgres_DeleteTask(t *testing.T) {
	runDeleteTask(t, testutil.NewTestStorePostgres)
}
