// modules/techniques.js — placeholder. Implements the shared module contract.
import { t } from '../i18n.js';

export default {
  id: 'techniques',
  title: () => t('techniques.title'),
  sub: () => t('techniques.sub'),
  async render(root) {
    root.innerHTML = `
      <h1>${t('techniques.title')}</h1>
      <p class="sub">${t('techniques.sub')}</p>
      <div class="panel"><p class="stub">${t('stub.empty')} <code>modules/techniques.js</code></p></div>`;
  },
};
