import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';

import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/radio-group/radio-group.js';
import '@shoelace-style/shoelace/dist/components/radio-button/radio-button.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';

import './styles/theme.css';
import './components/ft-connection-badge.js';
import './components/ft-toolbar.js';
import './components/ft-app.js';

setBasePath(import.meta.env.BASE_URL + 'shoelace');
