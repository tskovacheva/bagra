// modules/trials.js — placeholder. Implements the shared module contract.
import { t } from '../i18n.js';

export default {
  id: 'trials',
  title: () => t('trials.title'),
  sub: () => t('trials.sub'),
  async render(root) {
    root.innerHTML = `
      <h1>${t('trials.title')}</h1>
      <p class="sub">${t('trials.sub')}</p>
      <div class="panel"><p class="stub">${t('stub.empty')} <code>modules/trials.js</code></p></div>`;
  },
};
