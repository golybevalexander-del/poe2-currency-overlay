'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { score, search } = require('../renderer/direct-barter-search');
const catalog = require('../cx-catalog.json'), mapping = require('../cx-map.json');
const items = Object.entries(mapping).map(([id, apiId]) => ({ id, apiId, text: catalog[apiId]?.text || id }));
const names = (query) => search(items, query).map((entry) => entry.item.text);
test('Unc 8 and Unc8 find all level-8 uncut gems, never 18 or numeric metadata substrings', () => {
  for (const query of ['Unc 8', 'unc8', '8 UNC', 'Gem 8 unc']) {
    const result = names(query);
    assert.ok(result.includes('Uncut Skill Gem (Level 8)'));
    assert.ok(result.includes('Uncut Spirit Gem (Level 8)'));
    assert.ok(result.every((name) => /\b8\b/.test(name) && !/\b18\b/.test(name)));
  }
  assert.equal(score({ text: 'Rune', id: 'Metadata/Items/Thing8' }, '8'), null);
  assert.equal(score({ text: 'Uncut Gem (Level 18)' }, 'unc8'), null);
});
test('generic partial/reordered/case-insensitive/typo matching across catalog categories', () => {
  for (const [query, expected] of [
    ['iron gre run', 'Greater Iron Rune'], ['rune IRON greater', 'Greater Iron Rune'],
    ['exalt orb', 'Exalted Orb'], ['exaltde orb', 'Exalted Orb'],
    ['opiloti soul core', 'Soul Core of Opiloti'], ['core soul opiltoi', 'Soul Core of Opiloti'],
    ['barter omen', 'Omen of Bartering'], ['essence haste', 'Essence of Haste']
  ]) assert.ok(names(query).includes(expected), query);
  assert.equal(search(items, 'Exalted Orb')[0].item.text, 'Exalted Orb');
  assert.ok(names('Rune').length > 1);
  assert.ok(search(items, 'exaltde orb')[0].score > 1); // no low-confidence Enter selection
});
test('raw Metadata IDs remain literal and distinguish complete level suffixes', () => {
  const item = items.find((item) => item.apiId === 'uncut-spirit-gem-8');
  assert.equal(search(items, item.id)[0].item.id, item.id);
  assert.equal(score(item, 'Metadata/Items/Gems/NotReal8'), null);
  assert.equal(score({ text: 'Level 18', id: 'Metadata/Items/Gems/Thing18' }, 'level8'), null);
});
