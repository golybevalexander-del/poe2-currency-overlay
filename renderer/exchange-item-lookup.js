'use strict';
(function (root) {
  function icon(name, apiId, database, catalogIcon) {
    if (database && database.ready) {
      const entries = database.itemByRef('ITEM', name) || [];
      const entry = entries.find((item) => !apiId || item.tradeTag === apiId) || entries[0];
      if (entry && entry.icon) return entry.icon;
    }
    return catalogIcon || '';
  }
  function clipboardMatches(raw, items, parsedName) {
    const lines = String(raw || '').split(/\r?\n/).map((line) => line.trim());
    const currency = lines.some((line) => /^Rarity:\s*Currency$/i.test(line));
    if (!parsedName && !currency) return [];
    const rarity = lines.findIndex((line) => /^Rarity:/.test(line));
    const names = new Set([parsedName, currency && lines[rarity + 1]].filter(Boolean).map((name) => name.toLowerCase()));
    const levelLine = lines.find((line) => /^Level:\s*\d+(?:\s+\(Max\))?\s*$/i.test(line));
    const level = levelLine && Number(levelLine.match(/\d+/)[0]);
    return items.filter((item) => {
      const exact = names.has(item.text.toLowerCase());
      const gem = /^(Uncut (?:Skill|Spirit|Support) Gem) \(Level (\d+)\)$/i.exec(item.text);
      if (gem) {
        if (exact) return true;
        return level != null && Number(gem[2]) === level && names.has(gem[1].toLowerCase());
      }
      return exact;
    });
  }
  function routeToBarter(activeTab) { return activeTab === 'barter'; }
  const api = { icon, clipboardMatches, routeToBarter };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ExchangeItemLookup = api;
})(typeof window === 'object' ? window : globalThis);
