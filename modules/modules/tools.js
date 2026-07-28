// modules/tools.js — placeholder. Implements the shared module contract.
import { t } from '../i18n.js';

export default {
  id: 'tools',
  title: () => t('tools.title'),
  sub: () => t('tools.sub'),
  async render(root) {
    root.innerHTML = `
      <h1>${t('tools.title')}</h1>
      <p class="sub">${t('tools.sub')}</p>
      <div class="panel"><p class="stub">${t('stub.empty')} <code>modules/tools.js</code></p></div>`;
  },
};
