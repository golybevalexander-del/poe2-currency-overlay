'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const presentation = require('../renderer/direct-barter-presentation');
const search = require('../renderer/direct-barter-search');
const sort = require('../renderer/direct-barter-sort');
const tradeVolume = require('../renderer/trade-volume');

function fixture() {
  const nodes = new Map(), calls = [], blobs = [];
  const focusSearchCallbacks = [];
  let focused = null;
  let held = null, hold = false, failure = false;
  function element(tag) {
    const classes = new Set();
    return {
      tag, children: [], listeners: {}, value: '', textContent: '',
      style: {}, dataset: {}, attributes: {},
      classList: {
        contains: (name) => classes.has(name), add: (name) => classes.add(name),
        toggle: (name, on) => { if (on) classes.add(name); else classes.delete(name); }
      },
      set id(id) { this._id = id; nodes.set(id, this); },
      get id() { return this._id; },
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; this.textContent = ''; },
      addEventListener(event, fn) { this.listeners[event] = fn; },
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name]; },
      removeAttribute(name) { delete this.attributes[name]; },
      querySelectorAll(tag) { return this.children.filter((node) => node.tag === tag); },
      scrollIntoView() { this.scrolled = true; },
      remove() {}, focus() { focused = this; }, select() {},
      click() { return this.listeners.click?.(); }
    };
  }
  for (const id of ['barter-root', 'tab-barter']) { const node = element('div'); node.id = id; }
  nodes.get('tab-barter').classList.add('active');
  const selected = { id: 'Selected', text: 'Selected Rune' };
  const targets = [
    { id: 'Below', text: 'Below Rune' }, { id: 'Equal', text: 'Equal Rune' },
    { id: 'Above', text: 'Above Rune' }, { id: 'Missing', text: 'Missing Rune' }
  ];
  const rows = targets.map((target, i) => ({
    target, quantityA: [2, 1, 1, 0][i], quantityB: [1, 1, 2, 0][i],
    rateBPerA: [0.5, 1, 2, null][i],
    tradedQuantityA: [2000, 1000000, 1, 0][i], tradedQuantityB: [1000, 1000000, 2, 0][i],
    valuation: { value: i === 3 ? null : i + 1, kind: i === 3 ? 'unpriced' : 'direct' },
    activity: i === 3 ? 'recorded' : 'traded'
  }));
  const window = {
    I18N_CATALOGS: { en: {} }, BarterPresentation: presentation, BarterSearch: search, BarterSort: sort,
    TradeVolume: tradeVolume,
    ExchangeItemLookup: require('../renderer/exchange-item-lookup'),
    exchangeItemIconUrl: () => null,
    api: {
      async getConfig() { return { barterMode: 'sell' }; },
      async setBarterMode() {},
      async directBarter(args) {
        calls.push({ ...args });
        if (hold) await new Promise((resolve) => { held = resolve; });
        if (failure) throw new Error('fixture unavailable');
        return { ...args, items: [selected, ...targets], rows: args.selectedId ? rows : [],
          fetchedAt: Date.now(), league: 'Standard', errors: [], unavailable: false };
      },
      onLeagueAutoChanged() {}, onShown() {},
      onBarterFocusSearch(fn) { focusSearchCallbacks.push(fn); }
    }
  };
  window.t = (key, vars = {}) => {
    const text = window.I18N_CATALOGS.en[key];
    assert.equal(typeof text, 'string', `missing translation ${key}`);
    return text.replace(/\{(\w+)\}/g, (_, key) => vars[key]);
  };
  const context = vm.createContext({
    window, document: { createElement: element, getElementById: (id) => nodes.get(id),
      addEventListener() {}, body: element('body') },
    Intl, Date, Blob, URL: { createObjectURL(blob) { blobs.push(blob); return 'blob:fixture'; }, revokeObjectURL() {} },
    setTimeout() {}
  });
  for (const file of ['i18n/en.js', 'i18n/barter-en.js', 'direct-barter.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../renderer', file), 'utf8'), context);
  }
  const change = (id, value, event = 'change') => {
    const node = nodes.get(id); node.value = value; return node.listeners[event]();
  };
  const toggleRecorded = (checked) => {
    const node = nodes.get('barter-show-recorded'); node.checked = checked; node.listeners.change();
  };
  const key = (key) => {
    let prevented = false;
    nodes.get('barter-search').listeners.keydown({ key, preventDefault() { prevented = true; }, stopPropagation() {} });
    return prevented;
  };
  const visibleNames = () => {
    const table = nodes.get('barter-results').children.find((node) => node.tag === 'table');
    return table ? table.children[1].children.map((tr) => tr.children[0].children.at(-1).textContent) : [];
  };
  return { window, nodes, calls, blobs, change, visibleNames, toggleRecorded, key,
    focusSearch() { focusSearchCallbacks.forEach((fn) => fn()); }, focused: () => focused,
    hold() { hold = true; }, release() { hold = false; held(); },
    fail() { failure = true; } };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
async function select(f) {
  await f.window.DirectBarter.refresh();
  f.change('barter-search', 'Selected', 'input');
  f.nodes.get('barter-choices').children[0].click();
  await settle();
}

test('controller ratio dropdown composes with text, sorting, direction, and unfiltered JSON export', async () => {
  const f = fixture();
  await select(f);
  assert.deepEqual(f.nodes.get('barter-ratio-filter').children.map((option) => option.value),
    ['all', 'below', 'equal', 'above', 'no_history']);
  assert.equal(f.visibleNames().length, 3);
  assert.equal(f.nodes.get('barter-show-recorded').checked, false);
  const before = f.calls.length;
  f.change('barter-ratio-filter', 'above');
  assert.deepEqual(f.visibleNames(), ['Above Rune']);
  f.change('barter-mode', 'buy');
  assert.deepEqual(f.visibleNames(), ['Below Rune']);
  f.change('barter-ratio-filter', 'equal');
  assert.deepEqual(f.visibleNames(), ['Equal Rune']);
  f.change('barter-filter', 'Above', 'input');
  assert.deepEqual(f.visibleNames(), []);
  f.change('barter-ratio-filter', 'below');
  assert.deepEqual(f.visibleNames(), ['Above Rune']);
  f.change('barter-filter', '', 'input');
  f.change('barter-ratio-filter', 'no_history');
  assert.deepEqual(f.visibleNames(), []);
  f.toggleRecorded(true);
  assert.deepEqual(f.visibleNames(), ['Missing Rune']);
  f.nodes.get('barter-export').click();
  const exported = JSON.parse(await f.blobs[0].text());
  assert.equal(exported.averageRatioFilter, 'no_history');
  assert.equal(exported.rows.length, 4);
  assert.equal(exported.showRecordedWithoutTrades, true);
  assert.equal(exported.sortKey, 'value');
  f.change('barter-ratio-filter', 'all');
  const table = f.nodes.get('barter-results').children[0];
  table.children[0].children[0].children[2].children[0].click();
  assert.deepEqual(f.visibleNames(), ['Above Rune', 'Equal Rune', 'Below Rune', 'Missing Rune']);
  assert.equal(f.calls.length, before, 'filter/sort/mode must not rescan');
});

test('background refresh retains selections and coalesces repeated requests; clear still wins', async () => {
  const f = fixture();
  await select(f);
  f.change('barter-history', '24');
  await settle();
  f.change('barter-mode', 'buy');
  f.change('barter-filter', 'Rune', 'input');
  f.change('barter-ratio-filter', 'above');
  f.hold();
  const count = f.calls.length;
  const pending = f.window.DirectBarter.refresh();
  f.window.DirectBarter.refresh();
  assert.equal(f.calls.length, count + 1);
  assert.equal(f.calls.at(-1).selectedId, 'Selected');
  assert.equal(f.calls.at(-1).hours, 24);
  f.release(); await pending;
  assert.equal(f.nodes.get('barter-mode').value, 'buy');
  assert.equal(f.nodes.get('barter-filter').value, 'Rune');
  assert.equal(f.nodes.get('barter-ratio-filter').value, 'above');
  assert.deepEqual(f.visibleNames(), ['Below Rune']);
  f.nodes.get('barter-refresh').click(); await settle();
  assert.equal(f.calls.length, count + 2, 'tab-specific refresh still works');
  f.hold();
  const late = f.window.DirectBarter.refresh();
  f.nodes.get('barter-clear').click();
  f.release(); await late;
  assert.deepEqual(f.visibleNames(), []);
  assert.equal(f.nodes.get('barter-ratio-filter').value, 'all');
  assert.equal(f.nodes.get('barter-show-recorded').checked, false);
  assert.equal(f.nodes.get('barter-export').disabled, true);
});

test('background refresh errors remain visible and release busy state', async () => {
  const f = fixture();
  await select(f);
  f.fail();
  await f.window.DirectBarter.refresh();
  assert.match(f.nodes.get('barter-errors').textContent, /fixture unavailable/);
  assert.equal(f.nodes.get('barter-refresh').disabled, false);
  assert.equal(f.nodes.get('barter-export').disabled, true);
  const count = f.calls.length;
  await f.window.DirectBarter.refresh();
  assert.equal(f.calls.length, count + 1);
});

test('target header sorts Pay with/Receive item names and persists across refresh and mode', async () => {
  const f = fixture();
  await select(f);
  f.toggleRecorded(true);
  const header = () => f.nodes.get('barter-results').children[0].children[0].children[0];
  header().children[0].children[0].click();
  assert.deepEqual(f.visibleNames(), ['Above Rune', 'Below Rune', 'Equal Rune', 'Missing Rune']);
  assert.equal(header().children[0].getAttribute('aria-sort'), 'ascending');
  assert.equal(header().children[2].getAttribute('aria-sort'), 'none');
  header().children[0].children[0].click();
  assert.deepEqual(f.visibleNames(), ['Missing Rune', 'Equal Rune', 'Below Rune', 'Above Rune']);
  f.change('barter-mode', 'buy');
  assert.match(header().children[0].children[0].textContent, /^Pay with/);
  await f.window.DirectBarter.refresh();
  assert.deepEqual(f.visibleNames(), ['Missing Rune', 'Equal Rune', 'Below Rune', 'Above Rune']);
  assert.equal(f.nodes.get('barter-show-recorded').checked, true);
  f.nodes.get('barter-export').click();
  const exported = JSON.parse(await f.blobs[0].text());
  assert.equal(exported.sortKey, 'target');
  assert.equal(exported.sortDirection, 'desc');
});

test('trade volume uses shared compact quantities, named context and historical activity copy', async () => {
  const f = fixture();
  await select(f);
  f.toggleRecorded(true);
  const body = () => f.nodes.get('barter-results').children[0].children[1];
  const cells = () => body().children.map((row) => row.children[4]);
  assert.deepEqual(cells().map((cell) => cell.textContent), ['1.0k', '1.0m', '2', '0']);
  assert.match(cells()[0].title, /1.0k Below Rune changed hands/);
  assert.match(cells()[0].title, /against 2.0k Selected Rune/);
  assert.match(cells()[0].title, /not number of trades/);
  assert.equal(cells()[0].classList.contains('hot'), true);
  assert.deepEqual(body().children.map((row) => row.children[5].textContent),
    ['Item was traded', 'Item was traded', 'Item was traded', 'Item listed']);
  f.change('barter-mode', 'buy');
  assert.deepEqual(cells().map((cell) => cell.textContent), ['1.0k', '1.0m', '2', '0']);
});

test('search arrow navigation wraps, announces the active option, and Enter selects explicitly', async () => {
  const f = fixture();
  await f.window.DirectBarter.refresh();
  f.change('barter-search', 'Rune', 'input');
  const input = f.nodes.get('barter-search'), choices = f.nodes.get('barter-choices');
  assert.equal(input.getAttribute('role'), 'combobox');
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  assert.equal(f.key('Enter'), false, 'ambiguous query must not automatically select');
  assert.equal(f.key('ArrowDown'), true);
  assert.equal(input.getAttribute('aria-activedescendant'), choices.children[0].id);
  assert.equal(choices.children[0].getAttribute('aria-selected'), 'true');
  assert.equal(choices.children[0].scrolled, true);
  f.key('ArrowUp');
  assert.equal(input.getAttribute('aria-activedescendant'), choices.children.at(-1).id);
  const selected = choices.children.at(-1).title;
  assert.equal(f.key('Enter'), true);
  await settle();
  assert.equal(f.calls.at(-1).selectedId, selected);
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  assert.equal(input.getAttribute('aria-activedescendant'), undefined);
  assert.equal(choices.children.length, 0);
});

test('search edits and Escape clear keyboard selection; fuzzy Enter requires explicit navigation', async () => {
  const f = fixture();
  await f.window.DirectBarter.refresh();
  f.change('barter-search', 'Rune', 'input');
  f.key('ArrowUp');
  f.change('barter-search', 'Selectde', 'input');
  const choices = f.nodes.get('barter-choices');
  assert.equal(choices.children.length, 1);
  assert.ok(Number(choices.children[0].dataset.matchScore) > 1);
  assert.equal(f.key('Enter'), false);
  f.key('ArrowDown');
  assert.equal(f.key('Escape'), true);
  assert.equal(choices.children.length, 0);
  assert.equal(f.nodes.get('barter-search').value, 'Selectde');
  assert.equal(f.key('Enter'), false);
  f.change('barter-search', 'Selectde', 'input');
  f.key('ArrowDown'); f.key('Enter'); await settle();
  assert.equal(f.calls.at(-1).selectedId, 'Selected');
  f.change('barter-search', 'nonexistentmatch', 'input');
  assert.equal(f.key('ArrowDown'), false);
});

test('compact toolbar hides result-only controls until selection and restores them after clearing', async () => {
  const f = fixture();
  await f.window.DirectBarter.refresh();
  assert.equal(f.nodes.get('barter-result-controls').hidden, true);
  assert.equal(f.nodes.get('barter-export').hidden, true);
  assert.equal(f.nodes.get('barter-selected').hidden, true);
  assert.equal(f.nodes.get('barter-search').hidden, false);
  assert.equal(f.nodes.get('barter-suggestions').hidden, true);
  await select(f);
  assert.equal(f.nodes.get('barter-result-controls').hidden, false);
  assert.equal(f.nodes.get('barter-export').hidden, false);
  assert.equal(f.nodes.get('barter-selected').hidden, false);
  assert.equal(f.nodes.get('barter-search').hidden, true);
  const primary = f.nodes.get('barter-primary');
  assert.ok(primary.children.includes(f.nodes.get('barter-item-picker')));
  assert.ok(primary.children.includes(f.nodes.get('barter-export')));
  f.nodes.get('barter-clear').click();
  assert.equal(f.nodes.get('barter-result-controls').hidden, true);
  assert.equal(f.nodes.get('barter-export').hidden, true);
  assert.equal(f.nodes.get('barter-search').hidden, false);
  assert.equal(f.focused().id, 'barter-search');
});

test('Change and Ctrl+F reveal search without losing the selected item or rescanning', async () => {
  const f = fixture();
  await select(f);
  const before = f.calls.length;
  f.nodes.get('barter-change').click();
  assert.equal(f.nodes.get('barter-search').hidden, false);
  assert.equal(f.nodes.get('barter-selected').hidden, true);
  assert.equal(f.focused().id, 'barter-search');
  assert.equal(f.calls.length, before);
  f.change('barter-search', 'Rune', 'input');
  assert.equal(f.nodes.get('barter-suggestions').hidden, false);
  f.key('Escape');
  assert.equal(f.nodes.get('barter-search').hidden, true);
  assert.equal(f.nodes.get('barter-selected').hidden, false);
  assert.equal(f.nodes.get('barter-suggestions').hidden, true);
  assert.equal(f.nodes.get('barter-result-controls').hidden, false);
  f.focusSearch();
  assert.equal(f.nodes.get('barter-search').hidden, false);
  assert.equal(f.focused().id, 'barter-search');
  assert.equal(f.calls.length, before);
});

test('captured items and failed-copy guidance reveal the search even when selection replaces it', async () => {
  const f = fixture();
  await select(f);
  await f.window.DirectBarter.capture('Rarity: Currency\nAbove Rune\n--------');
  assert.equal(f.nodes.get('barter-search').hidden, false);
  assert.equal(f.nodes.get('barter-search').value, 'Above Rune');
  assert.equal(f.nodes.get('barter-suggestions').hidden, false);
  f.key('Escape');
  assert.equal(f.nodes.get('barter-search').hidden, true);
  f.window.DirectBarter.copyFailed();
  assert.equal(f.nodes.get('barter-search').hidden, false);
  assert.match(f.nodes.get('barter-errors').textContent, /game did not provide/);
});

test('trading volume header toggles raw quantities and persists through mode, filters, refresh and export', async () => {
  const f = fixture();
  await select(f); f.toggleRecorded(true);
  const header = () => f.nodes.get('barter-results').children[0].children[0].children[0];
  const before = f.calls.length;
  header().children[4].children[0].click();
  assert.deepEqual(f.visibleNames(), ['Equal Rune', 'Below Rune', 'Above Rune', 'Missing Rune']);
  assert.equal(header().children[4].getAttribute('aria-sort'), 'descending');
  assert.equal(header().children[2].getAttribute('aria-sort'), 'none');
  header().children[4].children[0].click();
  assert.deepEqual(f.visibleNames(), ['Missing Rune', 'Above Rune', 'Below Rune', 'Equal Rune']);
  f.change('barter-mode', 'buy');
  assert.deepEqual(f.visibleNames(), ['Missing Rune', 'Above Rune', 'Below Rune', 'Equal Rune']);
  f.change('barter-filter', 'Equal', 'input');
  assert.deepEqual(f.visibleNames(), ['Equal Rune']);
  f.change('barter-filter', '', 'input');
  assert.equal(f.calls.length, before);
  await f.window.DirectBarter.refresh();
  assert.deepEqual(f.visibleNames(), ['Missing Rune', 'Above Rune', 'Below Rune', 'Equal Rune']);
  f.nodes.get('barter-export').click();
  const exported = JSON.parse(await f.blobs[0].text());
  assert.equal(exported.sortKey, 'trading_volume');
  assert.equal(exported.sortDirection, 'asc');
});
