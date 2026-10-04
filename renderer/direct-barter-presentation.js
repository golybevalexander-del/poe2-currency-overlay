'use strict';
(function (root) {
  function formatQuantity(value, locale) {
    return new Intl.NumberFormat(locale, { maximumSignificantDigits: 6 }).format(value);
  }

  function exchangeQuantities(rate) {
    if (!Number.isFinite(rate) || rate <= 0) return null;
    // Prefer small whole-item equivalents only when exactly supported by the rate.
    const inverse = 1 / rate;
    if (Number.isInteger(inverse) && inverse <= 1000 && 1 / inverse === rate) {
      return { pay: inverse, receive: 1, approximate: false };
    }
    return { pay: 1, receive: rate, approximate: Number(rate.toPrecision(6)) !== rate };
  }

  function rateText(rate, translate, locale) {
    return exchangeQuantities(rate) ? formatQuantity(rate, locale) : translate('no_history');
  }

  function rateTooltip(rate, selectedName, targetName, translate, locale, mode = 'sell') {
    const quantities = exchangeQuantities(rate);
    if (!quantities) return translate('no_rate', { selected: selectedName, target: targetName });
    if (mode === 'buy') return translate(quantities.approximate ? 'buy_exchange_approx' : 'buy_exchange', {
      pay: formatQuantity(quantities.receive, locale), payment: targetName,
      bought: formatQuantity(quantities.pay, locale), selected: selectedName
    });
    return translate(quantities.approximate ? 'exchange_approx' : 'exchange', {
      pay: formatQuantity(quantities.pay, locale), selected: selectedName,
      receive: formatQuantity(quantities.receive, locale), target: targetName
    });
  }
  function rowView(row, mode) {
    // Both views use neighbor units per selected unit. Buying reverses who pays/receives,
    // not this stored orientation; its reciprocal is selected units per neighbor unit.
    return {
      rate: Number.isFinite(row.rateBPerA) && row.rateBPerA > 0 ? row.rateBPerA : null,
      firstQuantity: mode === 'buy' ? row.quantityB : row.quantityA,
      secondQuantity: mode === 'buy' ? row.quantityA : row.quantityB
    };
  }
  function averageRatio(row, mode, locale) {
    const selected = row.quantityA, neighbor = row.quantityB;
    if (!Number.isFinite(selected) || !Number.isFinite(neighbor) || selected <= 0 || neighbor <= 0 ||
        !Number.isFinite(row.rateBPerA) || row.rateBPerA <= 0) return null;
    const buying = mode === 'buy' ? selected : neighbor;
    const selling = mode === 'buy' ? neighbor : selected;
    const minimum = Math.min(buying, selling);
    const format = (n) => Number.isFinite(n)
      ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n)
      : null;
    const first = format(buying / minimum), second = format(selling / minimum);
    if (first == null || second == null) return null;
    return { first, second, buying, selling, approximate: buying / minimum !== Math.round(buying / minimum * 100) / 100 ||
      selling / minimum !== Math.round(selling / minimum * 100) / 100 };
  }

  const api = { formatQuantity, exchangeQuantities, rateText, rateTooltip, rowView, averageRatio };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BarterPresentation = api;
})(typeof window === 'object' ? window : globalThis);
