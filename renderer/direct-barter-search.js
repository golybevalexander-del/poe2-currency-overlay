'use strict';
(function (root) {
  function tokens(value) {
    return String(value || '').toLowerCase().match(/[a-z]+|\d+/g) || [];
  }
  function distance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let previous = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = old;
      }
    }
    return row[b.length];
  }
  function score(item, query) {
    const raw = String(query || '').trim().toLowerCase();
    if (!raw) return 0;
    // Raw IDs are explicit literal lookups, never fuzzy numeric substrings in name search.
    if (raw.startsWith('metadata/') || raw.startsWith('metadata\\')) {
      const id = String(item.id || '').replace(/\\/g, '/').toLowerCase();
      return id.includes(raw.replace(/\\/g, '/')) ? 0 : null;
    }
    const words = tokens(item.text), wanted = tokens(raw);
    if (!wanted.length) return null;
    let total = 0;
    for (const token of wanted) {
      if (/^\d+$/.test(token)) {
        if (!words.includes(token)) return null;
        continue;
      }
      let best = Infinity;
      for (const word of words.filter((w) => !/^\d+$/.test(w))) {
        if (word === token) best = Math.min(best, 0);
        else if (word.startsWith(token)) best = Math.min(best, 1);
        else if (token.length >= 3 && word.includes(token)) best = Math.min(best, 2);
        else if (token.length >= 4 && word.length >= 4) {
          const d = distance(token, word);
          if (d <= (token.length >= 7 ? 2 : 1)) best = Math.min(best, 3 + d);
        }
      }
      if (!Number.isFinite(best)) return null;
      total += best;
    }
    return total;
  }
  function search(items, query) {
    return items.map((item) => ({ item, score: score(item, query) }))
      .filter((entry) => entry.score != null)
      .sort((a, b) => a.score - b.score || a.item.text.localeCompare(b.item.text) || a.item.id.localeCompare(b.item.id));
  }
  const api = { tokens, score, search };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BarterSearch = api;
})(typeof window === 'object' ? window : globalThis);
