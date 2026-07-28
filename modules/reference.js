// modules/reference.js — placeholder. Implements the shared module contract.
import { t } from '../i18n.js';

export default {
  id: 'reference',
  title: () => t('reference.title'),
  sub: () => t('reference.sub'),
  async render(root) {
    root.innerHTML = `
      <h1>${t('reference.title')}</h1>
      <p class="sub">${t('reference.sub')}</p>
      <div class="panel"><p class="stub">${t('stub.empty')} <code>modules/reference.js</code></p></div>`;
  },
};
