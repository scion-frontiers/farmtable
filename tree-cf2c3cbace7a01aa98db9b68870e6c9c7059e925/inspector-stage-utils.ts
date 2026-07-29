import { RelationshipType } from '../../gen/types.js';

export const REL_GROUP_LABEL: Record<number, string> = {
  [RelationshipType.BLOCKED_BY]: 'Blocked by',
  [RelationshipType.BLOCKS]: 'Blocks',
  [RelationshipType.RELATED]: 'Related',
  [RelationshipType.DUPLICATE]: 'Duplicate of',
};

export const REL_GROUP_ORDER = [
  RelationshipType.BLOCKED_BY,
  RelationshipType.BLOCKS,
  RelationshipType.RELATED,
  RelationshipType.DUPLICATE,
];
