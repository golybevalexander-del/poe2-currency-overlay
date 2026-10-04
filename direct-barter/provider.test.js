'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { HourProvider } = require('./provider');
const { BarterService } = require('./service');
const mapping = require('../cx-map.json');
const NOW = 100 * 3600000;
const response = (body, status = 200, headers = {}) => ({
  ok: status === 200, status, headers: new Headers(headers), json: async () => body
});
const setup = async (t, fetchImpl) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'barter-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return new HourProvider(directory, { fetchImpl, now: () => NOW });
};

test('persistent immutable cache, in-flight deduplication, at most two simultaneous fetches', async (t) => {
  let calls = 0, active = 0, max = 0;
  const fetchImpl = async () => {
    calls++; active++; max = Math.max(max, active);
    await new Promise((resolve) => setTimeout(resolve, 5)); active--;
    return response({ markets: [], next_change_id: 42 });
  };
  const provider = await setup(t, fetchImpl);
  const hours = [99, 98, 97, 96].map((n) => n * 3600);
  await Promise.all([...hours, ...hours].map((hour) => provider.hour(hour)));
  assert.equal(calls, 4); assert.equal(max, 2);
  const reloaded = new HourProvider(provider.directory, { fetchImpl, now: () => NOW });
  assert.equal((await reloaded.hour(hours[0])).nextChangeId, 42);
  assert.equal(calls, 4);
  await assert.rejects(provider.hour(100 * 3600), /completed/);
  await fs.writeFile(path.join(provider.directory, '3600.json'), '{}');
  await provider.prune();
  await assert.rejects(fs.stat(path.join(provider.directory, '3600.json')), /ENOENT/);
});

test('Retry-After, rate limit headers, and malformed responses surface errors', async (t) => {
  let calls = 0;
  const provider = await setup(t, async () => { calls++; return response({}, 429, { 'retry-after': '120' }); });
  await assert.rejects(provider.hour(99 * 3600), /HTTP 429/);
  await assert.rejects(provider.hour(98 * 3600), /retry delayed/);
  assert.equal(calls, 1);
  const limited = await setup(t, async () => response({ markets: [] }, 200, {
    'x-rate-limit-ip': '2:60:120', 'x-rate-limit-ip-state': '2:60:0'
  }));
  await limited.hour(99 * 3600);
  await assert.rejects(limited.hour(98 * 3600), /retry delayed/);
  const invalid = await setup(t, async () => response({ notMarkets: [] }));
  await assert.rejects(invalid.hour(99 * 3600), /invalid markets/);
});

test('partial API failure reports exact coverage; cached hours not falsely called stale', async (t) => {
  const provider = await setup(t, async (url) => url.endsWith(String(98 * 3600))
    ? response({}, 503) : response({ markets: [] }));
  const service = new BarterService(provider, { now: () => NOW, fetchImpl: async () => response([]) });
  const data = await service.query({ league: 'Specific' });
  assert.deepEqual(data.coveredHours, [97 * 3600, 99 * 3600]);
  assert.equal(data.partial, true); assert.equal(data.stale, false);
  assert.equal(data.errors.length, 1);
  assert.equal(data.rows.length, 0); assert.equal(data.unavailable, false);
  await assert.rejects(service.query({ league: 'Specific', hours: 4 }), /3 or 24/);
});

test('complete outage shows labeled older persistent cache, or unavailable, never Scout membership', async (t) => {
  const provider = await setup(t, async () => response({}, 503));
  await fs.mkdir(provider.directory, { recursive: true });
  const a = Object.keys(mapping).find((key) => mapping[key] === 'greater-storm-rune');
  const b = Object.keys(mapping).find((key) => mapping[key] === 'greater-iron-rune');
  const entry = {
    hour: 96 * 3600, fetchedAt: NOW - 100000,
    markets: [{ league: 'Specific', market_pair: [a, b], volume_traded: { [a]: 1, [b]: 1 } }]
  };
  await fs.writeFile(path.join(provider.directory, `${entry.hour}.json`), JSON.stringify(entry));
  const service = new BarterService(provider, { now: () => NOW, fetchImpl: async () => { throw new Error('Scout offline'); } });
  const data = await service.query({ league: 'Specific', selectedId: a });
  assert.equal(data.stale, true); assert.equal(data.partial, true); assert.equal(data.rows.length, 1);
  assert.equal(data.rows[0].rateBPerA, 1);
  assert.equal(data.rows[0].records[0].fetchedAt, entry.fetchedAt);
  assert.equal(data.rows[0].records[0].observedAt, entry.hour * 1000);
  assert.equal(data.rows[0].valuation.value, null);
  assert.ok(data.errors.some((e) => e.error.includes('Scout offline')));
  assert.equal(data.metadata.fetchedAt, null);
  const exported = JSON.parse(JSON.stringify(data));
  assert.equal(exported.schemaVersion, 1);
  assert.deepEqual(exported.requestedHours, [99, 98, 97].map((h) => h * 3600));
  const other = await service.query({ league: 'Other', selectedId: a });
  assert.equal(other.rows.length, 0);
  const emptyProvider = await setup(t, async () => response({}, 503));
  const empty = await new BarterService(emptyProvider, { now: () => NOW, fetchImpl: async () => response([]) }).query({ league: 'Specific' });
  assert.equal(empty.unavailable, true); assert.equal(empty.stale, false);
});

test('3/24 hours stay bounded and isolated; metadata cannot introduce direct edges', async (t) => {
  let calls = 0;
  const provider = await setup(t, async () => { calls++; return response({ markets: [] }); });
  const service = new BarterService(provider, {
    now: () => NOW, fetchImpl: async () => response([{ CurrencyOne: { ApiId: 'new', Text: 'Synthetic Rune' }, CurrencyTwo: { ApiId: 'exalted', Text: 'Exalted Orb' } }])
  });
  const short = await service.query({ league: 'Specific' });
  const long = await service.query({ league: 'Specific', hours: 24 });
  await service.query({ league: 'Specific' });
  assert.equal(short.coveredHours.length, 3);
  assert.equal(long.coveredHours.length, 24);
  assert.equal(calls, 24);
  assert.equal(long.rows.length, 0);
  assert.ok(!long.items.some((i) => i.text === 'Synthetic Rune'));
});
