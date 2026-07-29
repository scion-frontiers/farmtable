export const UNASSIGNED_FILTER_VALUE = '__unassigned';
export function matchesTaskFilters(task, phaseFilter, assigneeFilter) {
    if (phaseFilter !== null && task.phase !== phaseFilter) {
        return false;
    }
    if (!assigneeFilter) {
        return true;
    }
    if (assigneeFilter === UNASSIGNED_FILTER_VALUE) {
        return task.assignees.length === 0;
    }
    return task.assignees.some((assignee) => assignee.id === assigneeFilter);
}
//# sourceMappingURL=task-filters.js.map