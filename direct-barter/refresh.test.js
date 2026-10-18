'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../renderer/renderer.js'), 'utf8');
const handler = source.match(/\$\('btn-refresh'\)\.addEventListener\('click', \(\) => \{([\s\S]*?)\n  \}\);/);

for (const activeTab of ['currency', 'barter', 'items', 'settings']) {
  test(`general refresh updates Currency and Direct Barter while ${activeTab} is active`, () => {
    assert.ok(handler, 'actual general refresh handler must exist');
    const calls = [];
    vm.runInNewContext(handler[1], {
      $: () => ({ classList: { contains: () => activeTab === 'barter' } }),
      logAction: (message) => calls.push(message),
      refresh: (force) => { calls.push(['prices', force]); return new Promise(() => {}); },
      window: { DirectBarter: { refresh: () => calls.push('barter') } }
    });
    assert.deepEqual(calls, ['refresh (manual)', ['prices', true], 'barter']);
  });
}

test('general refresh still works when Direct Barter is not loaded', () => {
  let forced = false;
  vm.runInNewContext(handler[1], {
    logAction() {}, refresh(force) { forced = force; }, window: {}
  });
  assert.equal(forced, true);
});
