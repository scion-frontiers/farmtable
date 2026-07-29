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
export const ALL_ENABLED: Readonly<CollectionCapabilities> = Object.freeze({
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
});

/** GitHub-specific capabilities — true for mappable operations, false for unmappable. */
export const GITHUB_CAPABILITIES: Readonly<CollectionCapabilities> = Object.freeze({
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
});

/** All capabilities disabled — used for unknown platforms or read-only external collections. */
export const ALL_DISABLED: Readonly<CollectionCapabilities> = Object.freeze({
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
});

/** Tooltip messages for disabled capabilities, keyed by capability name. */
export const CAPABILITY_TOOLTIPS: Partial<Record<keyof CollectionCapabilities, string>> = {
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
  // SECURITY CONTROL -- CONJUNCT B OF TWO, AND IT RUNS IN THE BROWSER ONLY.
  //
  // READ THIS BEFORE TREATING THE LABEL AS AN ENFORCEMENT CLAIM. Nothing in Go
  // enforces any of this. There is no server-side notion of a read-only
  // collection, so the nine write operations this function gates are gated
  // here and nowhere else. A caller holding a token and using curl is not
  // subject to this check at all. "SECURITY CONTROL" here means "this decides
  // what the dashboard offers", not "this decides what the server permits" --
  // the two were not distinguished when the label was added, and the label is
  // the more visible half.
  //
  // Counterpart, which names this one:
  // the "SECURITY CONTROL, CONJUNCT A OF TWO" comment in ImportCollection, in
  // internal/server/export_import.go. Cited by identifier and not by line
  // number: an annotation displaces the line it cites, so a line number in a
  // cross-file citation is stale from the commit that writes it.
  //
  // THE ORDER OF THE TWO PLATFORM CHECKS BELOW IS LOAD-BEARING, AND IT IS NOT A
  // STYLE CHOICE. Import copies an uploaded document's collection remoteData
  // into storage with no key validation, so a caller with admin scope can plant
  // writable: true on it. Conjunct A forces every imported collection to the
  // FARMTABLE platform; this early return means the FARMTABLE path never
  // consults the planted key. Both are needed. Moving the writable read above
  // the platform check arms them together and turns an unvalidated uploaded map
  // into a privilege grant.
  //
  // The GITHUB branch is separately unreachable-with-a-value today, and the
  // reason is a CONJUNCTION, not a count: the GitHub capability set is
  // reachable only by a collection object carrying platform GITHUB *and* a
  // remote_data map containing writable=true, TOGETHER, IN ONE OBJECT. No
  // producer in this tree yields both. See the WRITE-AUTHORIZATION GATE block
  // in collectionToProto, in internal/server/convert.go, which enumerates the
  // producers under a SHA as an as-of-that-commit observation.
  //
  // NO NUMBER HERE ON PURPOSE. This sentence used to say "the two producers
  // ... and why both currently yield null". That was wrong twice over.
  //
  // First, as a matter of fact: the census it points at names three producers
  // whose platform can be GITHUB -- the CreateCollection RPC and
  // EntStore.ImportCollection (both caller-controlled) and syntheticCollection
  // (always GITHUB) -- so "two" and "both" were each false. That count is an
  // observation of the census as it reads at the SHA the census stamps itself
  // with, not an independent enumeration of this tree, and it is written here
  // only to record what the old sentence got wrong.
  //
  // Second, and the reason no corrected number replaces it: a count is a
  // population claim with nothing guarding it. The day someone adds a producer
  // the sentence is false and no test goes red. The convert.go block states
  // this rule for itself and asks callers not to reintroduce a count. This is
  // that same rule, in the other language.
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
