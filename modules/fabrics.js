// modules/fabrics.js — placeholder. Implements the shared module contract.
import { t } from '../i18n.js';

export default {
  id: 'fabrics',
  title: () => t('fabrics.title'),
  sub: () => t('fabrics.sub'),
  async render(root) {
    root.innerHTML = `
      <h1>${t('fabrics.title')}</h1>
      <p class="sub">${t('fabrics.sub')}</p>
      <div class="panel"><p class="stub">${t('stub.empty')} <code>modules/fabrics.js</code></p></div>`;
  },
};
