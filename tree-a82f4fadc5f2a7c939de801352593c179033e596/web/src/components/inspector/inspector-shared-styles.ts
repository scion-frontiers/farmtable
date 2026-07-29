import { css } from 'lit';

export const iconButtonFocusStyles = css`
  sl-icon-button {
    --sl-focus-ring: 2px solid var(--sl-color-primary-500);
    --sl-focus-ring-offset: 2px;
  }

  sl-icon-button::part(base):focus-visible {
    border-radius: var(--sl-border-radius-medium);
  }
`;
