'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
const handler = source.slice(source.indexOf('async function onItemHotkey('), source.indexOf('// see the is-dev-build handler'));
const oldText = 'Rarity: Currency\nExalted Orb\n--------';
const freshText = 'Rarity: Currency\nDivine Orb\n--------';

function fixture(activeTab, fresh = false, focused = false) {
  let clipboardText = oldText;
  const events = [];
  const context = vm.createContext({
    itemHotkeyBusy: false, activeUiTab: activeTab, lastConsumedItemText: '', overlayShown: true,
    config: { itemHotkey: 'Control+F' }, hookListening: false, heldMods: new Set(),
    process: { platform: 'win32' }, logToggle() {}, focusGame: async () => {},
    setTimeout(fn) { fn(); }, showOverlay() {}, looksLikeItemText: (text) => text.includes('Rarity:'),
    win: { isFocused: () => focused, webContents: { send: (...args) => events.push(args) } },
    require: () => ({ clipboard: { readText: () => clipboardText, writeText: (text) => { clipboardText = text; } } }),
    loadHook: () => fresh ? {
      uIOhook: { keyTap() { clipboardText = freshText; }, keyToggle() {} },
      UiohookKey: { Ctrl: 'Ctrl', C: 'C' }
    } : null
  });
  vm.runInContext(handler, context);
  return { context, events, clipboard: () => clipboardText };
}
test('failed Barter capture never reuses an old inventory clipboard item', async () => {
  const f = fixture('barter');
  await vm.runInContext('onItemHotkey()', f.context);
  assert.ok(f.events.some(([name]) => name === 'item-copy-failed'));
  assert.ok(!f.events.some(([name]) => name === 'item-copied'));
  assert.equal(f.clipboard(), oldText);
  assert.equal(f.context.itemHotkeyBusy, false);
});
test('other tabs retain the existing manual-clipboard fallback', async () => {
  const f = fixture('items');
  await vm.runInContext('onItemHotkey()', f.context);
  assert.ok(f.events.some(([name, text]) => name === 'item-copied' && text === oldText));
});
test('fresh copied item text still reaches Barter and focused-overlay Ctrl+F only focuses search', async () => {
  const fresh = fixture('barter', true);
  await vm.runInContext('onItemHotkey()', fresh.context);
  assert.ok(fresh.events.some(([name, text]) => name === 'item-copied' && text === freshText));
  const focused = fixture('barter', false, true);
  await vm.runInContext('onItemHotkey()', focused.context);
  assert.deepEqual(focused.events, [['barter-focus-search']]);
  assert.equal(focused.clipboard(), oldText);
});
