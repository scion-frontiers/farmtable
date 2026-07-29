import { Platform } from '../gen/types.js';

export function platformLabel(platform: Platform): string {
  switch (platform) {
    case Platform.FARMTABLE:
      return 'Farm Table';
    case Platform.GITHUB:
      return 'GitHub';
    case Platform.LINEAR:
      return 'Linear';
    case Platform.JIRA:
      return 'Jira';
    case Platform.ASANA:
      return 'Asana';
    case Platform.BEADS:
      return 'Beads';
    default:
      return 'Unknown platform';
  }
}

/**
 * Returns a Bootstrap Icons name suitable for `<sl-icon name="...">` for a
 * given platform.  Falls back to a generic globe icon for unknown platforms.
 */
export function platformIcon(platform: Platform): string {
  switch (platform) {
    case Platform.FARMTABLE:
      return 'table';
    case Platform.GITHUB:
      return 'github';
    case Platform.LINEAR:
      return 'lightning';
    case Platform.JIRA:
      return 'kanban';
    case Platform.ASANA:
      return 'clipboard-check';
    case Platform.BEADS:
      return 'circle';
    default:
      return 'globe';
  }
}

/**
 * Builds a display name for a collection, incorporating the platform and
 * remote identifier for external (non-Farm Table) collections.
 *
 * Examples:
 *   - Farm Table collection named "My Project" -> "My Project"
 *   - GitHub collection with remoteId "owner/repo" -> "GitHub: owner/repo"
 *   - GitHub collection without remoteId -> "My Project"
 */
export function collectionDisplayName(
  name: string,
  platform: Platform,
  remoteId?: string,
): string {
  if (platform !== Platform.FARMTABLE && remoteId) {
    return `${platformLabel(platform)}: ${remoteId}`;
  }
  return name;
}
