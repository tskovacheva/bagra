// modules/recipes.js — placeholder. Implements the shared module contract.
import { t } from '../i18n.js';

export default {
  id: 'recipes',
  title: () => t('recipes.title'),
  sub: () => t('recipes.sub'),
  async render(root) {
    root.innerHTML = `
      <h1>${t('recipes.title')}</h1>
      <p class="sub">${t('recipes.sub')}</p>
      <div class="panel"><p class="stub">${t('stub.empty')} <code>modules/recipes.js</code></p></div>`;
  },
};
