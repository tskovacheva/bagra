// modules/materials.js — placeholder. Implements the shared module contract.
import { t } from '../i18n.js';

export default {
  id: 'materials',
  title: () => t('materials.title'),
  sub: () => t('materials.sub'),
  async render(root) {
    root.innerHTML = `
      <h1>${t('materials.title')}</h1>
      <p class="sub">${t('materials.sub')}</p>
      <div class="panel"><p class="stub">${t('stub.empty')} <code>modules/materials.js</code></p></div>`;
  },
};
