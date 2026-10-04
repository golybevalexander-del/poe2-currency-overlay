'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { icon, clipboardMatches, routeToBarter } = require('../renderer/exchange-item-lookup');
const entries = fs.readFileSync(path.join(__dirname, '../renderer/vendor/ee2/data/en/items.ndjson'), 'utf8')
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const database = { ready: true, itemByRef: (_ns, name) => entries.filter((entry) => entry.refName === name) };
test('shared main-app EE2 database resolves actual level-8 Spirit and level-14 Skill icons', () => {
  for (const [name, id] of [['Uncut Spirit Gem (Level 8)', 'uncut-spirit-gem-8'], ['Uncut Skill Gem (Level 14)', 'uncut-skill-gem-14']]) {
    const url = icon(name, id, database, 'broken');
    assert.match(url, /^https:\/\/web\.poecdn\.com\/gen\/image\//);
    assert.equal(url, entries.find((entry) => entry.refName === name && entry.tradeTag === id).icon);
  }
  assert.equal(icon('Unknown', null, database, null), '');
});
test('capture matches exact exchange names and gem level without fuzzy identity guesses', () => {
  const items = [
    { text: 'Uncut Spirit Gem (Level 8)' }, { text: 'Uncut Spirit Gem (Level 18)' },
    { text: 'Greater Iron Rune' }, { text: 'Iron Rune' }
  ];
  assert.deepEqual(clipboardMatches('Item Class: Currency\nRarity: Currency\nUncut Spirit Gem\n--------\nLevel: 8', items), [items[0]]);
  assert.deepEqual(clipboardMatches('Rarity: Currency\nGreater Iron Rune\n--------', items), [items[2]]);
  assert.deepEqual(clipboardMatches('Rarity: Rare\nFancy Helmet\n--------', items), []);
  assert.deepEqual(clipboardMatches('Uncut Spirit Gem (Level 8)', items), []);
  assert.deepEqual(clipboardMatches('Rarity: Currency\nUncut Spirit Gem\n--------\nLevel: 8 (Max)', items), [items[0]]);
  assert.equal(routeToBarter('barter'), true);
  for (const tab of ['items', 'currency', 'desec', 'networth']) assert.equal(routeToBarter(tab), false);
});
