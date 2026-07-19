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
