// dirty.js — one guard over every form in the application.
//
// With forms this long, one stray click costs an afternoon. The protection has
// to be global, because the ways out of a form are global: the sidebar, the
// phone bar, Back, opening another record, the browser's own back button, and
// closing the tab.
//
// It is written as a single pair of document-level listeners rather than as a
// call each module makes, for one reason: a rule every module has to remember
// is a rule that will be forgotten in the eleventh module. Nothing in any
// module knows this file exists.
//
// How it knows a form is being edited: a Save button is on screen and the thing
// that changed is a control the person can type into.
//
// The first attempt matched the data attributes readForm uses — `[data-f]`,
// `[data-comp]` and so on. It was quietly wrong: the real attributes are
// `data-comp-pct`, `data-place-photo`, `data-step-del`, and CSS cannot match a
// prefix of an attribute NAME, only of its value. Roughly half the fields in
// the application went unwatched, and the fields it missed were the nested
// ones — the composition rows, the placements, the steps — which is to say the
// long parts, which is to say the ones worth protecting.
//
// A Save button is a far better signal than any list of attributes: it is
// present when and only when a form is open, it needs no maintenance as
// modules grow, and it cannot fall out of step with the markup.

const CONTROL = 'input, select, textarea';
const SAVE = '[data-save]';

// The ways out. Filters and tabs are not here: they belong to a list, and a
// list is not showing while a form is.
const LEAVE_SELECTOR = '[data-go],[data-back],[data-open],[data-new],[data-refmode]';

let dirty = false;
let ask = () => true;          // replaced at install; kept injectable for tests

// How many times the person has been asked whether to discard work.
//
// Counted because "did the application ask?" is a thing the checks have to be
// able to assert, and it cannot be observed from outside: `ask` is injected, so
// counting calls to the global `confirm` misses it, and reading `dirty`
// afterwards misses it too — the guard clears itself the moment the question is
// answered, which makes a broken handoff look identical to a correct one. Both
// of those were tried and both passed against code known to be wrong.
let asks = 0;
export const askCount = () => asks;
const askOnce = () => { asks++; return ask(); };

export const isDirty = () => dirty;
export function markClean() { dirty = false; }
export function markDirty() { dirty = true; }

/**
 * Install the guard. Called once, from app.js.
 *
 * @param confirmLeave  () => boolean — asks the person. Injected rather than
 *                      called directly so the pre-deploy check can drive it.
 */
export function install(confirmLeave) {
  ask = confirmLeave;

  // Typing, ticking or choosing anything inside a form marks the work unsaved.
  // Capture phase, so it is seen before a module's own handler redraws.
  const touched = (e) => {
    if (!document.querySelector(SAVE)) return;      // no form open, nothing to protect
    if (e.target.matches?.(CONTROL)) dirty = true;
  };
  document.addEventListener('input', touched, true);
  document.addEventListener('change', touched, true);

  document.addEventListener('click', (e) => {
    // Saving ends the unsaved state — but only if it really saved. A save can
    // be declined mid-way (a composition that does not total 100), and the
    // person is then still in the form with the same unsaved work.
    //
    // So the state is not cleared on the click. It is cleared when the form
    // is observed to have gone, which is the only reliable evidence that the
    // save went through: modules save asynchronously and then re-render into
    // the read view. Clearing first and undoing it on a timer was tried and is
    // a race — whichever way it is tuned, one of the two answers is sometimes
    // wrong, and the wrong answer here is silently discarded work.
    if (e.target.closest('[data-save]')) {
      clearWhenFormCloses();
      return;
    }

    // Deleting a record is a decision about the record, not about the draft.
    if (e.target.closest('[data-delete]')) { dirty = false; return; }

    const leaving = e.target.closest(LEAVE_SELECTOR);
    if (!leaving || !dirty) return;

    if (askOnce()) { dirty = false; return; }

    // Declined: the click never reaches the module, so nothing is discarded.
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);

  // Closing the tab, reloading, or a phone reclaiming memory. The browser
  // shows its own wording here and ignores ours; what matters is that it asks.
  window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

/**
 * Watch for the form leaving the screen after a save, and only then call the
 * work saved. Polls briefly rather than once: `put` is asynchronous and a slow
 * device can take a moment. If the form is still there when the attempts run
 * out, the save was refused and the work is still unsaved — which is exactly
 * the state to keep.
 */
function clearWhenFormCloses(attempt = 0) {
  if (!document.querySelector(SAVE)) { dirty = false; return; }
  if (attempt >= 12) return;                       // ~600 ms, then leave it alone
  setTimeout(() => clearWhenFormCloses(attempt + 1), 50);
}

/**
 * Guard the browser's own back button, which fires hashchange without a click.
 *
 * Returns true when the navigation may proceed. When it may not, the caller
 * puts the previous hash back — the only way to refuse a hashchange, since by
 * the time it fires the address has already moved.
 */
export function allowRouteChange() {
  if (!dirty) return true;
  if (askOnce()) { dirty = false; return true; }
  return false;
}
