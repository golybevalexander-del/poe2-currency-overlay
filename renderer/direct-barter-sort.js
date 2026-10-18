'use strict';
(function (root) {
  function sortRows(rows, direction = 'asc', key = 'value') {
    const volume = (row) => Number.isFinite(row.tradedQuantityB) && row.tradedQuantityB >= 0 ? row.tradedQuantityB : null;
    return [...rows].sort((a, b) => {
      if (key === 'target') {
        return a.target.text.localeCompare(b.target.text) * (direction === 'desc' ? -1 : 1) ||
          a.target.id.localeCompare(b.target.id);
      }
      const x = key === 'trading_volume' ? volume(a) : a.valuation.value;
      const y = key === 'trading_volume' ? volume(b) : b.valuation.value;
      if (x == null && y != null) return 1;
      if (y == null && x != null) return -1;
      const delta = x == null ? 0 : (x - y) * (direction === 'desc' ? -1 : 1);
      return delta || a.target.text.localeCompare(b.target.text) || a.target.id.localeCompare(b.target.id);
    });
  }
  if (typeof module === 'object' && module.exports) module.exports = { sortRows };
  else root.BarterSort = { sortRows };
})(typeof window === 'object' ? window : globalThis);
