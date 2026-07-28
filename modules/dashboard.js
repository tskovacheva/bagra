// modules/dashboard.js — placeholder. Implements the shared module contract.
import { t } from '../i18n.js';

export default {
  id: 'dashboard',
  title: () => t('dashboard.title'),
  sub: () => t('dashboard.sub'),
  async render(root) {
    root.innerHTML = `
      <h1>${t('dashboard.title')}</h1>
      <p class="sub">${t('dashboard.sub')}</p>
      <div class="panel"><p class="stub">${t('stub.empty')} <code>modules/dashboard.js</code></p></div>`;
  },
};
