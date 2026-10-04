'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const SOURCE = 'https://web.poecdn.com/api/currency-exchange/poe2/';
const UA = 'POE2-Direct-Barter-Fork (+https://github.com/golybevalexander-del/poe2-currency-overlay)';
const KEEP_HOURS = 72;

class HourProvider {
  constructor(directory, { fetchImpl = fetch, now = Date.now } = {}) {
    this.directory = directory;
    this.fetch = fetchImpl;
    this.now = now;
    this.memory = new Map();
    this.pending = new Map();
    this.queue = [];
    this.active = 0;
    this.cooldownUntil = 0;
    this.retryUntil = new Map();
  }

  async cached(hour) {
    if (this.memory.has(hour)) return this.memory.get(hour);
    try {
      const data = JSON.parse(await fs.readFile(path.join(this.directory, `${hour}.json`), 'utf8'));
      if (data.hour !== hour || !Array.isArray(data.markets) || !Number.isFinite(data.fetchedAt)) {
        throw new Error(`Invalid cached GGG hour ${hour}`);
      }
      this.memory.set(hour, data);
      return data;
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw new Error(`Cannot read Direct Barter cache: ${err.message}`);
    }
  }

  limited(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.drain();
    });
  }

  drain() {
    while (this.active < 2 && this.queue.length) {
      const job = this.queue.shift();
      this.active++;
      Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => {
        this.active--;
        this.drain();
      });
    }
  }

  async download(hour) {
    const blocked = Math.max(this.cooldownUntil, this.retryUntil.get(hour) || 0);
    if (blocked > this.now()) throw new Error(`GGG retry delayed until ${new Date(blocked).toISOString()}`);
    const res = await this.fetch(SOURCE + hour, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000)
    });
    const retry = res.headers.get('retry-after');
    const delay = retry == null ? 0 : (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - this.now());
    // Rate-limit state is count:period:ban; pause when any advertised bucket is exhausted.
    for (const name of ['x-rate-limit-ip', 'x-rate-limit-account']) {
      const rules = (res.headers.get(name) || '').split(',');
      const states = (res.headers.get(`${name}-state`) || '').split(',');
      rules.forEach((rule, i) => {
        const [limit, period] = rule.split(':').map(Number);
        const [count, , ban] = (states[i] || '').split(':').map(Number);
        if (limit > 0 && count >= limit) this.cooldownUntil = Math.max(this.cooldownUntil, this.now() + Math.max(period, ban || 0) * 1000);
      });
    }
    if (delay > 0 || res.status === 429) this.cooldownUntil = Math.max(this.cooldownUntil, this.now() + (delay > 0 ? delay : 60_000));
    if (!res.ok) {
      this.retryUntil.set(hour, this.now() + Math.max(delay || 0, res.status === 404 ? 60_000 : 30_000));
      throw new Error(`GGG HTTP ${res.status} for ${hour}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.markets)) throw new Error(`GGG invalid markets for ${hour}`);
    const entry = { hour, fetchedAt: this.now(), markets: data.markets, nextChangeId: data.next_change_id };
    await fs.mkdir(this.directory, { recursive: true });
    const file = path.join(this.directory, `${hour}.json`);
    await fs.writeFile(`${file}.tmp`, JSON.stringify(entry), 'utf8');
    await fs.rename(`${file}.tmp`, file);
    this.memory.set(hour, entry);
    return entry;
  }

  hour(hour) {
    const completed = Math.floor(this.now() / 3600000) * 3600;
    if (!Number.isInteger(hour) || hour % 3600 || hour >= completed || hour < completed - KEEP_HOURS * 3600) {
      return Promise.reject(new Error('Only recent completed GGG hours may be requested'));
    }
    if (this.pending.has(hour)) return this.pending.get(hour);
    const pending = this.cached(hour).then((hit) => hit || this.limited(() => this.download(hour)));
    this.pending.set(hour, pending);
    pending.finally(() => this.pending.delete(hour)).catch(() => {});
    return pending;
  }

  async prune() {
    await fs.mkdir(this.directory, { recursive: true });
    const cutoff = Math.floor(this.now() / 3600000) * 3600 - KEEP_HOURS * 3600;
    for (const file of await fs.readdir(this.directory)) {
      if (!/^\d+\.json$/.test(file)) continue;
      const hour = Number(file.slice(0, -5));
      if (hour < cutoff) {
        await fs.unlink(path.join(this.directory, file));
        this.memory.delete(hour);
      }
    }
    for (const hour of this.retryUntil.keys()) if (hour < cutoff) this.retryUntil.delete(hour);
  }
}

module.exports = { HourProvider, SOURCE, UA };
