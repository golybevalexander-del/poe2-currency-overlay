'use strict';
(function (root) {
  function formatQuantity(q, translate) {
    if (q == null) return '-';
    if (q >= 1e6) return translate('currency.fmt.million_suffix', { value: (q / 1e6).toFixed(1) });
    if (q >= 1e3) return translate('currency.fmt.thousand_suffix', { value: (q / 1e3).toFixed(1) });
    return String(q);
  }
  const api = { formatQuantity };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TradeVolume = api;
})(typeof window === 'object' ? window : globalThis);
