'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scan, neighbors, valuation, sortRows, quantity, ratio } = require('./scanner');
const map = { A: 'rune-a', B: 'rune-b', E: 'exalted', D: 'divine', C: 'chaos', X: 'rune-x' };
const catalog = { 'rune-a': { text: 'Rune A' }, 'rune-b': { text: 'Rune B' }, 'rune-x': { text: 'Rune X' } };
const market = (a, b, qa, qb, league = 'League', extra = {}) => ({
  league, market_id: `${a}-${b}`, market_pair: [a, b], volume_traded: { [a]: qa, [b]: qb }, ...extra
});
const hour = (markets, time = 3600) => ({ hour: time, fetchedAt: 12345, markets });
const graph = (...markets) => scan([hour(markets)], 'League', map, catalog);

test('only detected neighbors: Exalted cross paths and catalog never invent membership', () => {
  const g = graph(market('A', 'E', 2, 20), market('B', 'E', 1, 5), market('A', 'X', 1, 2));
  assert.deepEqual(neighbors(g, 'A', map).map((r) => r.target.id).sort(), ['E', 'X']);
  assert.ok(!neighbors(g, 'A', map).some((r) => r.target.id === 'B'));
  assert.equal(neighbors(g, 'A', map).find((r) => r.target.id === 'X').valuation.value, null);
});

test('reverse orientation, historical rate and target unit valuation are independent', () => {
  const g = graph(market('B', 'A', '6', '2'), market('E', 'B', '30', '6'));
  const row = neighbors(g, 'A', map)[0];
  assert.equal(row.rateBPerA, 3);
  assert.equal(row.valuation.value, 5); // NOT the 15 Exalted proceeds from 1 A.
  assert.equal(row.quantityA, 2);
  assert.equal(row.quantityB, 6);
  assert.equal(neighbors(g, 'B', map).find((r) => r.target.id === 'A').rateBPerA, 1 / 3);
  assert.equal(row.valuation.kind, 'direct');
});

test('zero-volume, unknown IDs and missing metadata remain detected without fabricated rates', () => {
  const g = graph(market('A', 'Unknown/Metadata', 0, 0), market('A', 'B', 0, 7));
  const rows = neighbors(g, 'A', map);
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.rateBPerA === null && r.activity === 'recorded'));
  const unknown = rows.find((r) => !r.target.resolved);
  assert.equal(unknown.target.text, 'Unknown/Metadata');
  assert.equal(unknown.quantityA, 0);
  assert.equal(unknown.valuation.kind, 'unpriced');
});

test('catalog and bucket configuration are not required; same pair merges hours, retains raw data', () => {
  const first = market('A', 'B', 2, 4, 'League', { highest_stock: { A: 900 }, lowest_ratio: { A: 1, B: 2 } });
  const g = scan([hour([first, first]), hour([market('B', 'A', 6, 3)], 7200)], 'League', {}, {});
  const row = neighbors(g, 'A', map)[0];
  assert.equal(row.quantityA, 5);
  assert.equal(row.quantityB, 10);
  assert.equal(row.records.length, 2);
  assert.equal(row.latestObservationAt, 7200000);
  assert.equal(row.records[1].market.highest_stock.A, 900);
  assert.equal(row.target.apiId, null);
});

test('league isolation, bad records and invalid numeric rates/inversions', () => {
  const g = graph(market('A', 'B', 1, 1, 'Different'), market('A', 'A', 1, 1), market('A', 'X', null, 4));
  assert.equal(g.pairs.length, 1);
  assert.equal(neighbors(g, 'A', map)[0].rateBPerA, null);
  for (const n of [null, '', ' ', true, {}, -1, Infinity, 'bad']) assert.equal(quantity(n), null);
  for (const [a, b] of [[0, 1], [1, 0], [-1, 1], [1e-320, 1e300], [1e300, 1e-320]]) assert.equal(ratio(a, b), null);
});

test('one-sided and invalid records cannot fabricate or skew rates from valid trades', () => {
  const g = scan([
    hour([market('A', 'B', 1, 2)]),
    hour([market('A', 'B', 0, 100)], 7200),
    hour([market('A', 'B', null, 50)], 10800)
  ], 'League', map, catalog);
  const row = neighbors(g, 'A', map)[0];
  assert.equal(row.rateBPerA, 2);
  assert.equal(row.quantityA, null);
  assert.equal(row.quantityB, 152);
  assert.equal(row.records.length, 3);
});

test('direct historical valuation wins; Chaos/Divine fallback is estimated, never a pair', () => {
  const g = graph(market('A', 'B', 1, 2), market('B', 'D', 2, 1), market('D', 'E', 1, 100));
  assert.equal(valuation('B', g, map).value, 50);
  assert.equal(valuation('B', g, map).kind, 'estimated');
  assert.equal(valuation('E', g, map).value, 1);
  g.pairs.push(...graph(market('B', 'E', 1, 40)).pairs);
  assert.equal(valuation('B', g, map).value, 40);
  assert.equal(valuation('B', g, map).kind, 'direct');
  assert.equal(neighbors(g, 'A', map).length, 1);
});

test('sort both ways keeps unpriced last and deterministic ties; JSON preserves null', () => {
  const row = (id, value) => ({ target: { id, text: id }, valuation: { value } });
  const rows = [row('Z', null), row('B', 4), row('A', 4), row('C', 1), row('Y', null)];
  assert.deepEqual(sortRows(rows).map((r) => r.target.id), ['C', 'A', 'B', 'Y', 'Z']);
  assert.deepEqual(sortRows(rows, 'desc').map((r) => r.target.id), ['A', 'B', 'C', 'Y', 'Z']);
  assert.equal(JSON.parse(JSON.stringify(rows))[0].valuation.value, null);
});

test('Standard Iron Rune / Opiloti real recorded identity appears only when its older hour is covered', () => {
  const mapping = require('../cx-map.json'), catalog = require('../cx-catalog.json');
  const iron = 'Metadata/Items/SoulCores/RuneEnhanceGreater';
  const soul = 'Metadata/Items/SoulCores/SoulCoreBleed';
  const recent = [
    hour([market(iron, 'Metadata/Items/Currency/CurrencyModValues', 162, 41, 'Standard')], 1791126000),
    hour([market(iron, 'Metadata/Items/Currency/CurrencyAddModToMagic', 0, 0, 'Standard')], 1791122400),
    hour([], 1791118800)
  ];
  // Public GGG digest at 2026-10-03 23:00 UTC: 1 unit on each side.
  const old = hour([market(iron, soul, 1, 1, 'Standard', {
    market_id: `${iron}|${soul}`, lowest_ratio: { [iron]: 1, [soul]: 1 },
    highest_ratio: { [iron]: 1, [soul]: 1 }, lowest_stock: { [iron]: 0, [soul]: 1 },
    highest_stock: { [iron]: 0, [soul]: 1 }
  })], 1791068400);
  const short = neighbors(scan(recent, 'Standard', mapping, catalog), iron, mapping);
  assert.ok(!short.some((row) => row.target.id === soul));
  const longGraph = scan([...recent, old], 'Standard', mapping, catalog);
  const row = neighbors(longGraph, iron, mapping).find((row) => row.target.id === soul);
  assert.equal(row.target.text, 'Soul Core of Opiloti');
  assert.equal(row.target.apiId, 'soul-core-of-opiloti');
  assert.equal(row.rateBPerA, 1);
  assert.equal(row.latestObservationAt, 1791068400000);
  assert.equal(neighbors(longGraph, soul, mapping).find((row) => row.target.id === iron).rateBPerA, 1);
  assert.equal(row.records.length, 1);
  assert.equal(neighbors(scan([old], 'Forbidden Rites', mapping, catalog), iron, mapping).length, 0);
});
