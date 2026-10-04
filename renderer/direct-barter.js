'use strict';
(function () {
  const $ = (id) => document.getElementById(id);
  const text = (key, vars) => window.t(`barter.${key}`, vars);
  let data = null, selectedId = null, history = 3, direction = 'asc', requestId = 0, mounted = false;
  let busy = false, captureId = 0, pendingCapture = null;
  let mode = 'sell', modeTouched = false;
  const modeKey = (key) => mode === 'buy' ? `buy_${key}` : key;
  const fmt = (n) => n == null ? text('unknown') : new Intl.NumberFormat(undefined, { maximumSignificantDigits: 6 }).format(n);
  const utc = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', ' UTC');
  function el(tag, content, className) {
    const node = document.createElement(tag);
    if (content != null) node.textContent = content;
    if (className) node.className = className;
    return node;
  }
  function image(item) {
    const slot = el('span', '?', 'barter-icon-slot');
    slot.title = text('icon_missing'); slot.setAttribute('aria-label', text('icon_missing'));
    const url = window.exchangeItemIconUrl ? window.exchangeItemIconUrl(item) :
      window.ExchangeItemLookup.icon(item.text, item.apiId, window.EE2, item.icon);
    if (!url || !/^https:\/\/web\.poecdn\.com\//.test(url)) return slot;
    const img = el('img', null, 'barter-icon');
    img.src = url;
    img.alt = '';
    img.addEventListener('error', () => {
      img.remove(); slot.textContent = '?'; slot.title = text('icon_missing');
      slot.setAttribute('aria-label', text('icon_missing'));
    }, { once: true });
    slot.replaceChildren(img); slot.removeAttribute('aria-label'); slot.title = '';
    return slot;
  }
  function showSelected(item) {
    const selected = $('barter-selected');
    selected.replaceChildren();
    const icon = image(item);
    if (icon) selected.append(icon);
    selected.append(el('span', text(modeKey('selected'), { name: item.text })));
    const clear = el('button', '×', 'mini-btn barter-clear'); clear.type = 'button';
    clear.id = 'barter-clear'; clear.title = text('clear'); clear.setAttribute('aria-label', text('clear'));
    clear.addEventListener('click', clearSelection); selected.append(clear);
    selected.title = item.id;
  }
  function clearSelection() {
    ++requestId; ++captureId; pendingCapture = null; selectedId = null; busy = false;
    if (data) data = { ...data, selectedId: null, rows: [] };
    $('barter-selected').replaceChildren(); $('barter-results').replaceChildren();
    $('barter-filter').value = ''; $('barter-export').disabled = true;
    $('barter-refresh').disabled = false; $('barter-errors').textContent = dataWarnings();
    $('barter-search').value = ''; showChoices(); $('barter-search').focus();
  }
  function paintMode() {
    if (!mounted) return;
    $('barter-mode').value = mode;
    $('barter-search-label').textContent = text(modeKey('select'));
    $('barter-filter').placeholder = text(modeKey('filter'));
    $('barter-filter').setAttribute('aria-label', text(modeKey('filter')));
    if (selectedId && data) {
      const item = data.items.find((item) => item.id === selectedId);
      showSelected(item || { id: selectedId, text: selectedId });
    }
    showRows();
  }
  function mount() {
    if (mounted) return;
    mounted = true;
    const root = $('barter-root');
    root.append(el('h2', text('title'), 'barter-heading'), el('p', text('disclaimer'), 'barter-note'));
    const league = el('p', '', 'barter-note'); league.id = 'barter-league';
    root.append(league);
    const modeBar = el('div', null, 'barter-toolbar');
    const modeLabel = el('label', text('mode')); modeLabel.htmlFor = 'barter-mode';
    const modeSelect = el('select'); modeSelect.id = 'barter-mode';
    for (const value of ['sell', 'buy']) {
      const option = el('option', text(value)); option.value = value; modeSelect.append(option);
    }
    modeSelect.value = mode;
    modeSelect.addEventListener('change', async () => {
      modeTouched = true; mode = modeSelect.value; paintMode();
      try { await window.api.setBarterMode(mode); }
      catch (err) { $('barter-errors').textContent = text('error', { error: err.message }); }
    });
    modeBar.append(modeLabel, modeSelect); root.append(modeBar);
    const label = el('label', text(modeKey('select'))); label.htmlFor = 'barter-search'; label.id = 'barter-search-label';
    const search = el('input', null, 'barter-search');
    search.id = 'barter-search'; search.placeholder = text('search'); search.autocomplete = 'off';
    const count = el('p', '', 'barter-note'); count.id = 'barter-match-count';
    const choices = el('div', null, 'barter-choices'); choices.id = 'barter-choices';
    root.append(label, search, count, choices);
    search.addEventListener('input', showChoices);
    search.addEventListener('keydown', (e) => {
      const buttons = choices.querySelectorAll('button');
      if (e.key === 'Enter' && buttons.length === 1 && Number(buttons[0].dataset.matchScore) <= 1) buttons[0].click();
    });
    const selected = el('p', '', 'barter-selected'); selected.id = 'barter-selected';
    selected.setAttribute('aria-live', 'polite'); root.append(selected);
    const toolbar = el('div', null, 'barter-toolbar');
    const historyLabel = el('label', text('history')); historyLabel.htmlFor = 'barter-history';
    const select = el('select'); select.id = 'barter-history';
    for (const [value, key] of [[3, 'three'], [24, 'day']]) {
      const option = el('option', text(key)); option.value = String(value); select.append(option);
    }
    select.addEventListener('change', () => { history = Number(select.value); data = null; load(); });
    const refresh = el('button', text('refresh'), 'mini-btn'); refresh.id = 'barter-refresh'; refresh.addEventListener('click', load);
    const exportButton = el('button', text('export'), 'mini-btn'); exportButton.id = 'barter-export'; exportButton.disabled = true;
    exportButton.addEventListener('click', exportJson);
    toolbar.append(historyLabel, select, refresh, exportButton); root.append(toolbar);
    const filter = el('input', null, 'barter-search'); filter.id = 'barter-filter'; filter.placeholder = text(modeKey('filter'));
    filter.setAttribute('aria-label', text(modeKey('filter')));
    filter.addEventListener('input', showRows);
    root.append(filter);
    for (const [id, className] of [['barter-errors', 'barter-warning'], ['barter-results', 'barter-table-wrap']]) {
      const node = el('div', '', className); node.id = id; root.append(node);
    }
    $('barter-errors').setAttribute('role', 'status');
  }
  function showChoices() {
    const query = $('barter-search').value.trim().toLowerCase();
    const choices = $('barter-choices'); choices.replaceChildren();
    if (!query || !data) { $('barter-match-count').textContent = ''; return; }
    const matches = window.BarterSearch.search(data.items, query);
    $('barter-match-count').textContent = text('matches', { n: matches.length });
    for (const { item, score } of matches) {
      const button = el('button', null, 'barter-choice');
      button.dataset.matchScore = String(score);
      const icon = image(item); if (icon) button.append(icon);
      button.append(el('span', `${item.text} (${item.apiId || item.id})`));
      if (item.apiId) button.append(el('small', item.id, 'barter-choice-id'));
      button.title = item.id;
      button.addEventListener('click', () => {
        selectedId = item.id;
        $('barter-search').value = '';
        choices.replaceChildren();
        showSelected(item);
        load();
      });
      choices.append(button);
    }
  }
  function showRows() {
    const root = $('barter-results'); root.replaceChildren();
    if (!data || !selectedId || data.unavailable || busy || data.selectedId !== selectedId) return;
    const query = $('barter-filter').value.trim().toLowerCase();
    const rows = window.BarterSort.sortRows(data.rows.filter((row) =>
      window.BarterSearch.score(row.target, query) != null), direction);
    const selected = data.items.find((item) => item.id === selectedId);
    const selectedName = selected ? selected.text : selectedId;
    if (!rows.length) { root.append(el('p', text(data.rows.length ? 'filtered' : 'empty'), 'barter-empty')); return; }
    const table = el('table', null, 'barter-table'), head = el('thead'), header = el('tr');
    for (const key of ['target', 'rate', 'value', 'average_ratio', 'activity']) {
      const th = el('th');
      if (key === 'value') {
        th.setAttribute('aria-sort', direction === 'asc' ? 'ascending' : 'descending');
        const sort = el('button', `${text(modeKey(key))} ${direction === 'asc' ? '↑' : '↓'}`, 'mini-btn');
        sort.addEventListener('click', () => { direction = direction === 'asc' ? 'desc' : 'asc'; showRows(); });
        sort.title = text(modeKey('value_help'));
        th.append(sort);
      } else th.textContent = text(['target', 'rate'].includes(key) ? modeKey(key) : key);
      if (key === 'rate') th.title = text(modeKey('rate_help'), { selected: selectedName });
      header.append(th);
    }
    head.append(header); table.append(head);
    const body = el('tbody');
    for (const row of rows) {
      const tr = el('tr'), name = el('td'), icon = image(row.target);
      if (icon) name.append(icon);
      name.append(el('span', row.target.text)); name.title = row.target.id;
      const value = el('td', row.valuation.value == null ? text('unpriced') : fmt(row.valuation.value));
      if (row.valuation.value != null) value.append(el('span', text(row.valuation.kind), `barter-badge barter-${row.valuation.kind}`));
      value.title = row.valuation.source || text('unpriced');
      const view = window.BarterPresentation.rowView(row, mode);
      const rate = el('td', window.BarterPresentation.rateText(view.rate, text), 'barter-rate');
      rate.title = window.BarterPresentation.rateTooltip(view.rate, selectedName, row.target.text, text, undefined, mode);
      rate.setAttribute('aria-label', rate.title);
      const ratio = window.BarterPresentation.averageRatio(row, mode);
      const volume = el('td', ratio ? `${ratio.first} : ${ratio.second}` : text('no_history'), 'barter-average-ratio');
      volume.title = ratio ? text('ratio_tooltip', {
        buying: ratio.first, selling: ratio.second,
        received: mode === 'buy' ? selectedName : row.target.text,
        paid: mode === 'buy' ? row.target.text : selectedName,
        rounded: ratio.approximate ? text('rounded') : ''
      }) : rate.title;
      tr.append(name, rate, value, volume, el('td', text(row.activity)));
      body.append(tr);
    }
    table.append(body); root.append(table);
  }
  async function load() {
    mount();
    const token = ++requestId;
    busy = true;
    $('barter-refresh').disabled = true;
    $('barter-export').disabled = true;
    $('barter-errors').textContent = text('loading');
    $('barter-results').replaceChildren();
    try {
      const result = await window.api.directBarter({ hours: history, selectedId, direction });
      if (token !== requestId) return;
      if (result.error) throw new Error(result.error);
      if (window.ItemTab && window.ItemTab.prepareExchangeLookup) await window.ItemTab.prepareExchangeLookup();
      if (token !== requestId) return;
      data = result;
      $('barter-league').textContent = text('league', { league: data.league });
      $('barter-errors').textContent = dataWarnings();
      if (selectedId) {
        const selected = data.items.find((item) => item.id === selectedId);
        showSelected(selected || { id: selectedId, text: selectedId });
      }
      $('barter-export').disabled = data.unavailable || !selectedId;
      busy = false;
      showChoices(); showRows();
      const captured = pendingCapture; pendingCapture = null;
      if (captured) void capture(captured);
    } catch (err) {
      if (token !== requestId) return;
      data = null;
      pendingCapture = null;
      $('barter-errors').textContent = text('error', { error: err.message });
      $('barter-choices').replaceChildren();
    } finally {
      if (token === requestId) { busy = false; $('barter-refresh').disabled = false; }
    }
  }
  function exportJson() {
    if (!data || !selectedId || busy) return;
    try {
      const blob = new Blob([JSON.stringify({
        ...data, mode, exportedAt: Date.now(), targetFilter: $('barter-filter').value, sortDirection: direction,
        displayOrientation: mode === 'buy' ? 'rate: row paid per selected bought; average ratio: selected bought : row paid' :
          'rate: row received per selected sold; average ratio: row received : selected sold'
      }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = el('a');
      link.href = url; link.download = `direct-barter-${data.league.replace(/[^a-z0-9-]/gi, '_')}-${history}h.json`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { $('barter-errors').textContent = text('export_error', { error: err.message }); }
  }
  function dataWarnings() {
    if (!data) return '';
    const warnings = [];
    if (data.unavailable) warnings.push(text('unavailable'));
    else if (data.stale) warnings.push(text('stale'));
    else if (data.partial) warnings.push(text('partial'));
    warnings.push(...data.errors.map((e) => `${e.hour ? utc(e.hour * 1000) + ': ' : ''}${e.error}`));
    return warnings.join('\n');
  }
  function captureNotice(message) {
    $('barter-errors').textContent = [dataWarnings(), message].filter(Boolean).join('\n');
  }
  async function capture(raw) {
    mount();
    if (busy) { pendingCapture = raw; return; }
    const token = requestId, copyToken = ++captureId;
    try {
      let parsedName = null;
      if (window.ItemTab && window.ItemTab.exchangeClipboardName) parsedName = await window.ItemTab.exchangeClipboardName(raw);
      if (token !== requestId || copyToken !== captureId || !window.DirectBarter.active()) return;
      if (!data) throw new Error(text('copy_failed'));
      const matches = window.ExchangeItemLookup.clipboardMatches(raw, data.items, parsedName);
      if (!matches.length) { captureNotice(text('copy_unsupported')); return; }
      $('barter-search').value = matches.length === 1 ? matches[0].text : parsedName || matches[0].text.replace(/ \(Level \d+\)$/, '');
      $('barter-search').focus(); showChoices();
      captureNotice(matches.length > 1 ? text('copy_ambiguous') : '');
    } catch (err) {
      if (token === requestId && copyToken === captureId) captureNotice(text('error', { error: err.message }));
    }
  }
  window.DirectBarter = {
    active: () => $('tab-barter').classList.contains('active'),
    capture,
    copyFailed() { mount(); captureNotice(text('copy_failed')); },
    render() {
      mount();
      if (!busy && (!data || Math.floor(data.fetchedAt / 3600000) !== Math.floor(Date.now() / 3600000))) load();
    },
    refresh: load,
    leagueChanged() {
      ++requestId; pendingCapture = null; data = null; busy = false;
      if (mounted) {
        $('barter-results').replaceChildren(); $('barter-choices').replaceChildren();
        $('barter-league').textContent = '';
        $('barter-export').disabled = true;
        $('barter-errors').textContent = '';
        if (!$('barter-root').classList.contains('hidden')) load();
      }
    }
  };
  if (window.api.onBarterFocusSearch) window.api.onBarterFocusSearch(() => {
    if (window.DirectBarter.active()) { mount(); $('barter-search').focus(); }
  });
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key.toLowerCase() === 'f' && window.DirectBarter.active()) {
      event.preventDefault(); mount(); $('barter-search').focus();
    }
  });
  document.addEventListener('paste', (event) => {
    if (!window.DirectBarter.active()) return;
    const raw = event.clipboardData && event.clipboardData.getData('text');
    if (raw && /(?:Item Class|Rarity):/.test(raw)) { event.preventDefault(); capture(raw); }
  });
  window.api.onLeagueAutoChanged(() => window.DirectBarter.leagueChanged());
  window.api.getConfig().then((config) => {
    if (!modeTouched) { mode = config.barterMode === 'buy' ? 'buy' : 'sell'; paintMode(); }
  }).catch((err) => {
    mount(); $('barter-errors').textContent = text('error', { error: err.message });
  });
  window.api.onShown(() => {
    if ($('tab-barter').classList.contains('active')) window.DirectBarter.render();
  });
})();
