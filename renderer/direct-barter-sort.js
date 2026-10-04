'use strict';
(function (root) {
  function sortRows(rows, direction = 'asc') {
    return [...rows].sort((a, b) => {
      const x = a.valuation.value, y = b.valuation.value;
      if (x == null && y != null) return 1;
      if (y == null && x != null) return -1;
      const delta = x == null ? 0 : (x - y) * (direction === 'desc' ? -1 : 1);
      return delta || a.target.text.localeCompare(b.target.text) || a.target.id.localeCompare(b.target.id);
    });
  }
  if (typeof module === 'object' && module.exports) module.exports = { sortRows };
  else root.BarterSort = { sortRows };
})(typeof window === 'object' ? window : globalThis);
