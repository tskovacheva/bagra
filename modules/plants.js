// modules/plants.js — placeholder. Implements the shared module contract.
import { t } from '../i18n.js';

export default {
  id: 'plants',
  title: () => t('plants.title'),
  sub: () => t('plants.sub'),
  async render(root) {
    root.innerHTML = `
      <h1>${t('plants.title')}</h1>
      <p class="sub">${t('plants.sub')}</p>
      <div class="panel"><p class="stub">${t('stub.empty')} <code>modules/plants.js</code></p></div>`;
  },
};
