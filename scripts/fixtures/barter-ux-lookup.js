'use strict';
window.ItemTab = {
  prepareExchangeLookup: () => window.EE2.init('en'),
  async exchangeClipboardName(raw) {
    await window.EE2.init('en');
    const parsed = window.EE2.parse(raw);
    return parsed.ok && parsed.item.info ? parsed.item.info.refName || parsed.item.info.name : null;
  }
};
