import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';

import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';
import '@shoelace-style/shoelace/dist/components/radio-button/radio-button.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/card/card.js';
import '@shoelace-style/shoelace/dist/components/badge/badge.js';
import '@shoelace-style/shoelace/dist/components/tag/tag.js';
import '@shoelace-style/shoelace/dist/components/avatar/avatar.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/divider/divider.js';
import '@shoelace-style/shoelace/dist/components/details/details.js';

import './styles/theme.css';
import './components/ft-connection-badge.js';
import './components/ft-toolbar.js';
import './components/kanban/ft-task-card.js';
import './components/kanban/ft-kanban-column.js';
import './components/kanban/ft-kanban-view.js';
import './components/tree/ft-tree-node.js';
import './components/tree/ft-hierarchy-nav.js';
import './components/tree/ft-tree-view.js';
import './components/inspector/ft-inspector-header.js';
import './components/inspector/ft-inspector-meta.js';
import './components/inspector/ft-inspector-desc.js';
import './components/inspector/ft-inspector-relations.js';
import './components/inspector/ft-inspector-code.js';
import './components/inspector/ft-inspector-comments.js';
import './components/inspector/ft-inspector-changes.js';
import './components/inspector/ft-inspector.js';
import './components/ft-app.js';

setBasePath(import.meta.env.BASE_URL + 'shoelace');
