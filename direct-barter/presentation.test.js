'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { exchangeQuantities, rateText, rateTooltip, rowView, averageRatio } = require('../renderer/direct-barter-presentation');
const window = { I18N_CATALOGS: { en: {} } };
new Function('window', fs.readFileSync(path.join(__dirname, '../renderer/i18n/barter-en.js'), 'utf8'))(window);
const translate = (key, vars = {}) => window.I18N_CATALOGS.en[`barter.${key}`]
  .replace(/\{(\w+)\}/g, (_, name) => vars[name]);

test('missing historical rates use exact requested copy without changing unknown quantities/availability', () => {
  for (const rate of [null, undefined, 0, -1, NaN, Infinity]) {
    assert.equal(rateText(rate, translate, 'en-US'), 'No Historical record');
    const tooltip = rateTooltip(rate, 'Greater Iron Rune', 'Orb of Augmentation', translate, 'en-US');
    assert.match(tooltip, /^No Historical record:/);
    assert.match(tooltip, /market itself was recorded; current availability is unknown/);
  }
  assert.equal(translate('unknown'), 'Unknown');
  assert.match(translate('disclaimer'), /Current availability is unknown/);
});
test('average ratio is buying:selling with actual 2-decimal arithmetic and no invalid division', () => {
  const row = { quantityA: 512, quantityB: 6488, rateBPerA: 6488 / 512 };
  assert.deepEqual([averageRatio(row, 'buy', 'en-US').first, averageRatio(row, 'buy', 'en-US').second], ['1', '12.67']);
  assert.deepEqual([averageRatio(row, 'sell', 'en-US').first, averageRatio(row, 'sell', 'en-US').second], ['12.67', '1']);
  assert.equal(averageRatio(row, 'buy').approximate, true);
  const reversed = { quantityA: 6488, quantityB: 512, rateBPerA: 512 / 6488 };
  assert.deepEqual([averageRatio(reversed, 'sell', 'en-US').first, averageRatio(reversed, 'sell', 'en-US').second], ['1', '12.67']);
  assert.equal(averageRatio({ quantityA: 1, quantityB: 2, rateBPerA: 2 }, 'buy').second, '2');
  assert.equal(averageRatio({ quantityA: 5, quantityB: 6, rateBPerA: 1.2 }, 'buy', 'en-US').second, '1.2');
  const tiny = averageRatio({ quantityA: 1, quantityB: 1e-9, rateBPerA: 1e-9 }, 'sell', 'en-US');
  assert.equal(tiny.first, '1');
  assert.equal(tiny.second, '1,000,000,000');
  for (const quantityA of [0, null, Infinity, -1]) assert.equal(averageRatio({ quantityA, quantityB: 2, rateBPerA: 2 }, 'buy'), null);
});

test('buy payment orientation is reciprocal of selected received per payment, not a double inversion', () => {
  const row = { rateBPerA: 41 / 162, quantityA: 162, quantityB: 41, valuation: { value: 237.198 } };
  const sell = rowView(row, 'sell'), buy = rowView(row, 'buy');
  assert.equal(sell.rate, 41 / 162);
  assert.equal(buy.rate, 1 / (162 / 41));
  assert.deepEqual([sell.firstQuantity, sell.secondQuantity], [162, 41]);
  assert.deepEqual([buy.firstQuantity, buy.secondQuantity], [41, 162]);
  assert.equal(rateTooltip(buy.rate, 'Greater Iron Rune', 'Divine Orb', translate, 'en-US', 'buy'),
    'Pay approximately 0.253086 Divine Orb for 1 Greater Iron Rune (historical; rounded)');
  assert.equal(row.valuation.value, 237.198); // always one row item, independent of mode
  assert.equal(rateTooltip(0.5, 'Rune', 'Divine Orb', translate, 'en-US', 'buy'),
    'Pay 1 Divine Orb for 2 Rune (historical)');
  assert.equal(rowView({ rateBPerA: null, quantityA: 0, quantityB: 0 }, 'buy').rate, null);
});

test('screenshot rate uses actual item names and accurate rounded quantities, never fabricated 1:1', () => {
  const rate = 41 / 162;
  assert.equal(rateText(rate, translate, 'en-US'), '0.253086');
  assert.equal(rateTooltip(rate, 'Greater Iron Rune', 'Divine Orb', translate, 'en-US'),
    '1 Greater Iron Rune for approximately 0.253086 Divine Orb (historical; rounded)');
  assert.deepEqual(exchangeQuantities(rate), { pay: 1, receive: rate, approximate: true });
  const reverse = rateTooltip(162 / 41, 'Divine Orb', 'Greater Iron Rune', translate, 'en-US');
  assert.match(reverse, /1 Divine Orb for approximately 3.95122 Greater Iron Rune/);
});

test('whole item equivalents require exact supported rate and preserve direction', () => {
  assert.equal(rateTooltip(1, 'Greater Iron Rune', 'Soul Core of Opiloti', translate, 'en-US'),
    '1 Greater Iron Rune for 1 Soul Core of Opiloti (historical)');
  assert.equal(rateTooltip(0.5, 'Rune', 'Divine Orb', translate, 'en-US'),
    '2 Rune for 1 Divine Orb (historical)');
  assert.equal(rateTooltip(2, 'Divine Orb', 'Rune', translate, 'en-US'),
    '1 Divine Orb for 2 Rune (historical)');
  assert.equal(exchangeQuantities(0.4999999).pay, 1);
  assert.equal(exchangeQuantities(1 / 1001).pay, 1);
});

test('visible column/help copy is plain language and distinguishes receive-item unit valuation', () => {
  for (const key of ['select', 'filter', 'target', 'rate', 'value', 'volume', 'selected', 'no_route']) {
    assert.doesNotMatch(translate(key, { name: 'Rune' }), /\b[AB]\b|A\/B/);
  }
  assert.match(translate('value_help'), /ONE receive item, not the total proceeds/);
  assert.equal(translate('selected', { name: 'Greater Iron Rune' }), 'Selling: Greater Iron Rune');
});
