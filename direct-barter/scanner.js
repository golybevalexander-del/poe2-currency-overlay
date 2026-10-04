'use strict';
const { sortRows } = require('../renderer/direct-barter-sort');

function quantity(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function ratio(a, b) {
  return a > 0 && b > 0 && Number.isFinite(b / a) && b / a > 0 ? b / a : null;
}

function resolveItem(id, mapping, catalog, enrichment = {}) {
  const enriched = enrichment[id] || enrichment[mapping[id]] || {};
  const apiId = mapping[id] || enriched.apiId || null;
  const bundled = catalog[apiId] || {};
  const info = { ...bundled, ...enriched };
  return {
    id, apiId, text: info.text || bundled.text || id, icon: enriched.icon || bundled.icon || null,
    category: info.category || null, resolved: !!info.text,
    metadataSource: enriched.text ? 'Scout metadata' : info.text ? 'Bundled catalog' : 'Unresolved Metadata ID'
  };
}

// Pair identity is ALWAYS the original Metadata ID, never a valuation/catalog key.
function scan(hours, league, mapping, catalog, enrichment) {
  const pairs = new Map();
  const items = new Map();
  for (const hour of hours) {
    const seen = new Set();
    for (const market of hour.markets) {
      if (market.league !== league || !Array.isArray(market.market_pair) ||
          market.market_pair.length !== 2 || market.market_pair.some((id) => typeof id !== 'string')) continue;
      const [a, b] = [...market.market_pair].sort();
      if (a === b) continue;
      const key = JSON.stringify([a, b]);
      const recordKey = JSON.stringify([key, market.market_id]);
      if (seen.has(recordKey)) continue;
      seen.add(recordKey);
      for (const id of [a, b]) {
        if (!items.has(id)) items.set(id, resolveItem(id, mapping, catalog, enrichment));
      }
      if (!pairs.has(key)) pairs.set(key, {
        ids: [a, b], quantities: { [a]: 0, [b]: 0 }, completeQuantities: { [a]: true, [b]: true },
        tradedQuantities: { [a]: 0, [b]: 0 }, records: []
      });
      const pair = pairs.get(key);
      const quantities = {};
      for (const id of [a, b]) {
        const q = quantity(market.volume_traded && market.volume_traded[id]);
        quantities[id] = q;
        if (q == null) pair.completeQuantities[id] = false;
        else if (Number.isFinite(pair.quantities[id] + q)) pair.quantities[id] += q;
        else pair.completeQuantities[id] = false;
      }
      // One-sided/invalid records remain visible, but cannot skew a traded rate.
      if (ratio(quantities[a], quantities[b]) != null) {
        for (const id of [a, b]) pair.tradedQuantities[id] += quantities[id];
      }
      pair.records.push({
        hour: hour.hour, observedAt: hour.hour * 1000, fetchedAt: hour.fetchedAt,
        source: `https://web.poecdn.com/api/currency-exchange/poe2/${hour.hour}`,
        market
      });
    }
  }
  return { items: [...items.values()], pairs: [...pairs.values()] };
}

function rate(pair, a, b) {
  return pair ? ratio(pair.tradedQuantities[a], pair.tradedQuantities[b]) : null;
}

function valuation(id, graph, mapping) {
  const exIds = Object.keys(mapping).filter((meta) => mapping[meta] === 'exalted');
  if (exIds.includes(id)) return { value: 1, kind: 'denomination', source: 'Exalted unit identity', hours: [] };
  const find = (a, b) => graph.pairs.find((p) => p.ids.includes(a) && p.ids.includes(b));
  const result = (value, kind, source, pairs) => ({
    value, kind, source,
    hours: [...new Set(pairs.flatMap((p) => p.records.map((r) => r.hour)))].sort((a, b) => a - b)
  });
  for (const ex of exIds) {
    const pair = find(id, ex);
    const value = rate(pair, id, ex);
    if (value != null) return result(value, 'direct', 'GGG direct historical receive-item/Exalted traded quantities', [pair]);
  }
  // Same fallback as existing cxValueEx, but explicitly estimated and valuation-only.
  for (const mid of Object.keys(mapping).filter((meta) => ['divine', 'chaos'].includes(mapping[meta]))) {
    for (const ex of exIds) {
      if (mid === id) continue;
      const first = find(id, mid), second = find(mid, ex);
      const a = rate(first, id, mid), b = rate(second, mid, ex);
      if (a != null && b != null && Number.isFinite(a * b) && a * b > 0) {
        return result(a * b, 'estimated', `GGG historical estimate via ${mapping[mid]} (cxValueEx fallback)`, [first, second]);
      }
    }
  }
  return { value: null, kind: 'unpriced', source: null, hours: [] };
}

function neighbors(graph, selectedId, mapping) {
  const itemById = new Map(graph.items.map((item) => [item.id, item]));
  return graph.pairs.filter((p) => p.ids.includes(selectedId)).map((pair) => {
    const targetId = pair.ids.find((id) => id !== selectedId);
    const records = [...pair.records].sort((a, b) => b.hour - a.hour);
    const rateBPerA = rate(pair, selectedId, targetId);
    return {
      target: itemById.get(targetId), rateBPerA,
      quantityA: pair.completeQuantities[selectedId] ? pair.quantities[selectedId] : null,
      quantityB: pair.completeQuantities[targetId] ? pair.quantities[targetId] : null,
      latestObservationAt: records[0].observedAt,
      activity: rateBPerA == null ? 'recorded' : 'traded',
      valuation: valuation(targetId, graph, mapping), records
    };
  });
}

module.exports = { quantity, ratio, resolveItem, scan, valuation, neighbors, sortRows };
