// modules/materials.js — the old Stock addresses, kept alive (§11b).
//
// Stock is no longer a screen. The jars live inside the material that owns
// them, at `#/substances/<substanceId>/jar/<jarId>`, and "what is running low"
// is a filter over the materials list rather than a second list of the same
// jars in a different order.
//
// This module remains registered because addresses already saved must not
// break: `#/materials` goes to the materials list, and `#/materials/<jarId>`
// finds the jar's material and opens the jar there. A redirect, not a screen —
// it renders nothing of its own.

import { get } from '../db.js';
import { t } from '../i18n.js';
import { navigate } from '../ui.js';

let openId = null;

export default {
  id: 'materials',
  title: () => t('substances.title'),
  sub: () => t('substances.sub'),

  open(first) { openId = first || null; },
  reset() { openId = null; },

  async render() {
    if (!openId || openId === 'new') return navigate('#/substances');
    const jar = await get('stock', openId);
    // A jar whose material was deleted, or an address that never named one.
    // Sending the person to the list is honest; inventing a record is not.
    if (!jar?.substanceId) return navigate('#/substances');
    return navigate(`#/substances/${jar.substanceId}/jar/${jar.id}`);
  },
};
