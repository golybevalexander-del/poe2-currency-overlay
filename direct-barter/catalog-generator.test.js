'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('catalog regeneration retains items absent from the latest hour and existing API identities', () => {
  const mapping = require('../cx-map.json'), catalog = require('../cx-catalog.json');
  const source = fs.readFileSync(path.join(__dirname, '../scripts/gen-cx-map.mjs'), 'utf8');
  const generated = {};
  const files = { 'cx-map.json': mapping, 'cx-catalog.json': catalog };
  const existing = 'Metadata/Items/Currency/CurrencyAddModToRare';
  const context = {
    fs: {
      readFileSync: (file) => JSON.stringify(files[path.basename(file)]),
      writeFileSync: (file, data) => { generated[path.basename(file)] = JSON.parse(data); }
    },
    path, ROOT: '.', console: { log() {} },
    traded: new Set([existing]),
    baseItems: { [existing]: { name: 'Exalted Orb', item_class: 'StackableCurrency' } },
    nameToApi: new Map([['exalted orb', { apiId: 'different-api-id', category: 'currency' }]]),
    norm: (s) => s.toLowerCase(), slug: (s) => s.toLowerCase().replaceAll(' ', '-'),
    CLASS_LABEL: { StackableCurrency: 'currency' }
  };
  vm.runInNewContext(source.slice(source.indexOf('const map = JSON.parse')), context);
  assert.equal(generated['cx-map.json'][existing], 'exalted');
  assert.deepEqual(generated['cx-map.json'], mapping);
  for (const id of ['lesser-essence-of-the-mind', 'lesser-rebirth-rune']) {
    assert.deepEqual(generated['cx-catalog.json'][id], catalog[id]);
  }
});
