'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { formatQuantity } = require('../renderer/trade-volume');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../renderer/i18n/en.js'), 'utf8'), { window });
const translate = (key, vars) => window.I18N_CATALOGS.en[key].replace('{value}', vars.value);

test('trade volume retains the main app quantity presentation and localization', () => {
  for (const [quantity, expected] of [
    [null, '-'], [undefined, '-'], [0, '0'], [2, '2'], [999, '999'],
    [1000, '1.0k'], [2500, '2.5k'], [999999, '1000.0k'], [1000000, '1.0m'], [2500000, '2.5m']
  ]) assert.equal(formatQuantity(quantity, translate), expected);
  assert.equal(formatQuantity(1000, (key, vars) => `${key}:${vars.value}`), 'currency.fmt.thousand_suffix:1.0');
});

test('Currency volume formatter calls the same helper and both entry points load it', () => {
  const source = fs.readFileSync(path.join(__dirname, '../renderer/renderer.js'), 'utf8');
  const handler = source.match(/function fmtQty\(q\) \{([\s\S]*?)\n\}/);
  const quantity = new Function('window', 't', 'q', handler[1]);
  assert.equal(quantity({ TradeVolume: { formatQuantity } }, translate, 1234), '1.2k');
  for (const file of ['../renderer/index.html', '../scripts/fixtures/barter-ux.html']) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(html.indexOf('trade-volume.js') >= 0);
    assert.ok(html.indexOf('trade-volume.js') < html.indexOf('direct-barter.js'));
  }
});
