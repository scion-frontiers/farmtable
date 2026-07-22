import { Platform, type Collection } from './gen/types.js';

/** Per-operation capability flags for a collection. */
export interface CollectionCapabilities {
  canEditTitle: boolean;
  canEditDescription: boolean;
  canChangeStage: boolean;
  canChangePriority: boolean;
  canChangeAssignee: boolean;
  canChangeParent: boolean;
  canAddComment: boolean;
  canCloseTask: boolean;
  canCreateTask: boolean;
  canDeleteTask: boolean;
  canEditDates: boolean;
  canEditAcceptance: boolean;
  canEditRelationships: boolean;
  canEditCodeContext: boolean;
  canDragReorder: boolean;
}

/** All capabilities enabled — used for Farmtable-platform collections. */
export const ALL_ENABLED: CollectionCapabilities = {
  canEditTitle: true,
  canEditDescription: true,
  canChangeStage: true,
  canChangePriority: true,
  canChangeAssignee: true,
  canChangeParent: true,
  canAddComment: true,
  canCloseTask: true,
  canCreateTask: true,
  canDeleteTask: true,
  canEditDates: true,
  canEditAcceptance: true,
  canEditRelationships: true,
  canEditCodeContext: true,
  canDragReorder: true,
};

/** GitHub-specific capabilities — true for mappable operations, false for unmappable. */
export const GITHUB_CAPABILITIES: CollectionCapabilities = {
  canEditTitle: true,
  canEditDescription: true,
  canChangeStage: true,
  canChangePriority: true,
  canChangeAssignee: true,
  canChangeParent: true,
  canAddComment: true,
  canCloseTask: true,
  canCreateTask: true,
  canDeleteTask: false,
  canEditDates: false,
  canEditAcceptance: false,
  canEditRelationships: false,
  canEditCodeContext: false,
  canDragReorder: false,
};

/** All capabilities disabled — used for unknown platforms or read-only external collections. */
export const ALL_DISABLED: CollectionCapabilities = {
  canEditTitle: false,
  canEditDescription: false,
  canChangeStage: false,
  canChangePriority: false,
  canChangeAssignee: false,
  canChangeParent: false,
  canAddComment: false,
  canCloseTask: false,
  canCreateTask: false,
  canDeleteTask: false,
  canEditDates: false,
  canEditAcceptance: false,
  canEditRelationships: false,
  canEditCodeContext: false,
  canDragReorder: false,
};

/** Tooltip messages for disabled capabilities, keyed by capability name. */
export const CAPABILITY_TOOLTIPS: Record<string, string> = {
  canDeleteTask: 'GitHub does not support deleting issues',
  canEditDates: 'No native date fields on GitHub issues',
  canEditAcceptance: 'No acceptance criteria field on GitHub issues',
  canEditRelationships: 'GitHub only supports parent-child, not blocks/blocked-by',
  canEditCodeContext: 'Not available for GitHub collections',
  canDragReorder: 'GitHub issues have no ordering',
};

/**
 * Derive per-operation capabilities for a collection based on its platform
 * and writable status.
 */
export function getCapabilities(collection: Collection): CollectionCapabilities {
  if (collection.platform === Platform.FARMTABLE) {
    return ALL_ENABLED;
  }
  if (collection.platform === Platform.GITHUB) {
    const rd = collection.remoteData;
    if (rd && typeof rd === 'object' && 'writable' in rd && rd.writable === true) {
      return GITHUB_CAPABILITIES;
    }
  }
  // Unknown platforms or non-writable external collections: fully disabled.
  return ALL_DISABLED;
}
