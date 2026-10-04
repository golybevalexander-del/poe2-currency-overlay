'use strict';
const { scan, neighbors, sortRows, resolveItem } = require('./scanner');
const { UA } = require('./provider');
const mapping = require('../cx-map.json');
const catalog = require('../cx-catalog.json');

class BarterService {
  constructor(provider, { now = Date.now, fetchImpl = fetch } = {}) {
    this.provider = provider;
    this.now = now;
    this.fetch = fetchImpl;
    this.metadata = new Map();
    this.metadataPending = new Map();
  }

  async enrich(league) {
    const hit = this.metadata.get(league);
    if (hit && this.now() - hit.at < 3600000) return hit;
    if (this.metadataPending.has(league)) return this.metadataPending.get(league);
    const task = (async () => {
      try {
        const res = await this.fetch(`https://api.poe2scout.com/poe2/Leagues/${encodeURIComponent(league)}/SnapshotPairs`, {
          headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000)
        });
        if (!res.ok) throw new Error(`Scout metadata HTTP ${res.status}`);
        const pairs = await res.json();
        if (!Array.isArray(pairs)) throw new Error('Invalid Scout metadata response');
        const items = {};
        for (const p of pairs) for (const item of [p.CurrencyOne, p.CurrencyTwo]) {
          if (item && typeof item.ApiId === 'string' && typeof item.Text === 'string') {
            const info = { apiId: item.ApiId, text: item.Text, icon: item.IconUrl, category: item.CategoryApiId };
            items[item.ApiId] = info;
            if (typeof item.BaseItemTypeId === 'string' && item.BaseItemTypeId.startsWith('Metadata/')) {
              items[item.BaseItemTypeId] = info;
            }
          }
        }
        const result = { at: this.now(), fetchedAt: this.now(), items, warning: null };
        this.metadata.set(league, result);
        return result;
      } catch (err) {
        const result = {
          at: this.now(), fetchedAt: hit ? hit.fetchedAt : null, items: hit ? hit.items : {},
          warning: `${err.message}; bundled or stale metadata used (not market evidence)`
        };
        this.metadata.set(league, result);
        return result;
      }
    })();
    this.metadataPending.set(league, task);
    try { return await task; } finally { this.metadataPending.delete(league); }
  }

  async query({ league, hours = 3, selectedId = null, direction = 'asc' }) {
    if (typeof league !== 'string' || !league.trim() || league.length > 150) throw new Error('A specific league is required');
    if (![3, 24].includes(hours)) throw new Error('History must be 3 or 24 completed hours');
    if (selectedId != null && (typeof selectedId !== 'string' || selectedId.length > 500)) throw new Error('Invalid item identity');
    const nowHour = Math.floor(this.now() / 3600000) * 3600;
    const requestedHours = Array.from({ length: hours }, (_, i) => nowHour - (i + 1) * 3600);
    const [results, metadata] = await Promise.all([
      Promise.allSettled(requestedHours.map((hour) => this.provider.hour(hour))),
      this.enrich(league)
    ]);
    let covered = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const errors = results.flatMap((r, i) => r.status === 'rejected' ? [{ hour: requestedHours[i], error: r.reason.message }] : []);
    if (metadata.warning) errors.push({ source: 'metadata', error: metadata.warning });
    let stale = false;
    if (!covered.length) {
      // Offline fallback retains an older covered window, NEVER masquerading as the requested one.
      for (let i = hours + 1; i <= 72 && covered.length < hours; i++) {
        try {
          const hit = await this.provider.cached(nowHour - i * 3600);
          if (hit) covered.push(hit);
        } catch (err) { errors.push({ source: 'cache', error: err.message }); }
      }
      stale = covered.length > 0;
    }
    try { await this.provider.prune(); } catch (err) { errors.push({ source: 'cache', error: `Cache pruning failed: ${err.message}` }); }
    const graph = scan(covered, league, mapping, catalog, metadata.items);
    const items = new Map(Object.keys(mapping).map((id) => [id, resolveItem(id, mapping, catalog, metadata.items)]));
    for (const item of graph.items) items.set(item.id, item);
    return {
      schemaVersion: 1, source: 'GGG historical Currency Exchange digests',
      league, windowHours: hours, fetchedAt: this.now(), requestedHours,
      coveredHours: covered.map((h) => h.hour).sort((a, b) => a - b),
      stale, partial: errors.some((e) => e.hour != null), unavailable: !covered.length, errors,
      metadata: {
        source: 'Scout SnapshotPairs (names/icons only; no membership or prices)',
        checkedAt: metadata.at, fetchedAt: metadata.fetchedAt
      },
      items: [...items.values()].sort((a, b) => a.text.localeCompare(b.text) || a.id.localeCompare(b.id)),
      selectedId, rows: selectedId ? sortRows(neighbors(graph, selectedId, mapping), direction) : [],
      notice: 'Historical / Recent recorded markets. Current availability is unknown. No indirect routes were considered for membership.'
    };
  }
}

module.exports = { BarterService };
