'use strict';
const { app, BrowserWindow, globalShortcut, session } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { setTimeout: delay } = require('node:timers/promises');
const errors = [];
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (_event, details) => {
    if (details.level === 'error') errors.push(details.message);
  });
  contents.on('render-process-gone', (_event, details) => errors.push(`Renderer exited: ${details.reason}`));
});
require('../main');

async function waitFor(check, label, timeout = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await check();
    if (value) return value;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

app.whenReady().then(async () => {
  const exportPath = path.join(app.getPath('temp'), `direct-barter-smoke-${process.pid}.json`);
  let originalMode = 'sell';
  let restoreMode = null;
  try {
    const win = await waitFor(() => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('index.html')), 'overlay');
    const js = (code) => win.webContents.executeJavaScript(code);
    await waitFor(() => js(`!!window.DirectBarter && !!document.querySelector('#tab-currency .tab-x') === false && !!document.getElementById('tab-barter') && document.querySelector('#tabs .tab.active') && document.getElementById('league-select').options.length > 1`), 'renderer setup');
    assert.equal(app.getPath('userData'), path.join(app.getPath('appData'), 'POE2 Direct Barter Fork'));
    originalMode = await js(`window.api.getConfig().then(c=>c.barterMode || 'sell')`);
    restoreMode = () => js(`window.api.setBarterMode(${JSON.stringify(originalMode)})`);
    await js(`document.getElementById('notes-modal').classList.add('hidden'); document.getElementById('tab-barter').click();`);
    await waitFor(() => js(`document.getElementById('barter-search') && !document.getElementById('barter-refresh').disabled`), 'GGG coverage');
    await js(`document.getElementById('barter-mode').value='sell'; document.getElementById('barter-mode').dispatchEvent(new Event('change'))`);
    const coverage = await js(`({errors: document.getElementById('barter-errors').textContent, league: document.getElementById('barter-league').textContent})`);
    assert.equal(await js(`!!document.getElementById('barter-coverage') || !!document.getElementById('barter-hours')`), false);
    win.webContents.send('item-copied', 'Item Class: Stackable Currency\nRarity: Currency\nGreater Iron Rune\n--------');
    await waitFor(() => js(`document.getElementById('barter-search').value === 'Greater Iron Rune'`), 'Barter item-copied route');
    assert.equal(await js(`document.getElementById('tab-barter').classList.contains('active')`), true);
    win.webContents.send('item-copy-failed');
    await waitFor(() => js(`document.getElementById('barter-errors').textContent.includes('Could not capture')`), 'Barter copy failure');
    assert.equal(await js(`document.getElementById('tab-barter').classList.contains('active')`), true);
    win.webContents.send('barter-focus-search');
    await waitFor(() => js(`document.activeElement.id === 'barter-search'`), 'local focus IPC');
    await js(`document.getElementById('barter-search').value = 'Rune'; document.getElementById('barter-search').dispatchEvent(new Event('input'));`);
    assert.ok(await js(`document.querySelectorAll('.barter-choice').length > 1`), 'Rune must remain ambiguous');
    await js(`document.getElementById('barter-search').value = 'Greater Iron Rune'; document.getElementById('barter-search').dispatchEvent(new Event('input')); document.querySelector('.barter-choice').click();`);
    await waitFor(() => js(`!document.getElementById('barter-refresh').disabled && !!document.querySelector('.barter-table')`), 'direct targets');
    const targetNames = await js(`Array.from(document.querySelectorAll('.barter-table tbody tr td:first-child')).map(n=>n.textContent)`);
    assert.ok(targetNames.length > 0, JSON.stringify(targetNames));
    assert.ok(await js(`document.getElementById('barter-selected').textContent.includes('Selling: Greater Iron Rune')`));
    assert.equal(await js(`!!document.querySelector('#barter-selected .barter-icon')`), true);
    const tooltips = await js(`Array.from(document.querySelectorAll('.barter-rate')).map(n=>({value:n.textContent,tooltip:n.title}))`);
    assert.ok(tooltips.every((r) => r.tooltip.includes('Greater Iron Rune') && r.tooltip.includes('historical') ||
      r.value === 'No Historical record' && r.tooltip.includes('current availability is unknown')));
    assert.ok(await js(`!Array.from(document.querySelectorAll('.barter-table th')).some(n=>/\\b[AB]\\b/.test(n.textContent))`));
    await js(`document.querySelector('#barter-selected .barter-icon').dispatchEvent(new Event('error'))`);
    assert.equal(await js(`!!document.querySelector('#barter-selected .barter-icon')`), false);
    assert.ok(await js(`document.getElementById('barter-selected').textContent.includes('Selling: Greater Iron Rune')`));
    assert.equal(await js(`document.querySelector('.barter-table th[aria-sort]').getAttribute('aria-sort')`), 'ascending');
    await js(`document.querySelector('.barter-table th button').click()`);
    assert.equal(await js(`document.querySelector('.barter-table th[aria-sort]').getAttribute('aria-sort')`), 'descending');
    await js(`document.getElementById('barter-filter').value = ${JSON.stringify(targetNames[0])}; document.getElementById('barter-filter').dispatchEvent(new Event('input'));`);
    assert.equal(await js(`document.querySelectorAll('#barter-results details').length`), 0);
    const download = new Promise((resolve, reject) => {
      session.defaultSession.once('will-download', (_event, item) => {
        item.setSavePath(exportPath);
        item.once('done', (_e, state) => state === 'completed' ? resolve() : reject(new Error(`Export download ${state}`)));
      });
    });
    await js(`document.getElementById('barter-export').click()`);
    await Promise.race([download, delay(10000).then(() => { throw new Error('Export download timed out'); })]);
    const exported = JSON.parse(await fs.readFile(exportPath, 'utf8'));
    assert.equal(exported.schemaVersion, 1);
    assert.ok(exported.requestedHours.length === 3);
    assert.ok(exported.coveredHours.length > 0);
    assert.ok(exported.fetchedAt > 0);
    assert.equal(exported.targetFilter, targetNames[0]);
    assert.ok(exported.rows.some((row) => row.target.text === targetNames[0]));
    assert.ok(exported.rows.every((row) => row.records.every((record) => record.market.league === exported.league)));
    assert.ok(exported.rows.every((row) => row.records.every((record) => record.market.volume_traded)));
    await fs.unlink(exportPath);
    await js(`document.getElementById('settings').classList.remove('hidden')`);
    assert.equal(await js(`getComputedStyle(document.getElementById('barter-root')).display`), 'none');
    await js(`document.getElementById('settings').classList.add('hidden'); document.getElementById('tab-currency').click();`);
    assert.equal(await js(`document.getElementById('barter-root').classList.contains('hidden')`), true);
    win.webContents.send('item-copied', 'Item Class: Stackable Currency\nRarity: Currency\nDivine Orb\n--------\nStack Size: 1/10');
    await waitFor(() => js(`document.getElementById('tab-items').classList.contains('active') &&
      document.getElementById('item-root').textContent.includes('Divine Orb')`), 'original Price Check item-copied routing');
    await js(`document.getElementById('tab-items').click()`);
    assert.equal(await js(`document.getElementById('item-root').classList.contains('hidden')`), false);
    await js(`document.getElementById('tab-barter').click()`);
    await js(`document.getElementById('tab-barter').querySelector('.tab-x').click()`);
    assert.equal(await js(`document.getElementById('tab-currency').classList.contains('active')`), true);
    await js(`window.setTabVisibility('barter', true); window.api.setTabShown('barter', true); document.getElementById('tab-barter').click()`);
    const hotkey = await js(`window.api.getConfig().then(c=>c.hotkey)`);
    assert.equal(globalShortcut.isRegistered(hotkey), true);
    assert.deepEqual(errors, []);
    await restoreMode();
    console.log(JSON.stringify({ status: 'PASS', profile: app.getPath('userData'), coverage, directTargets: targetNames, tooltips, selectedIconFallback: 'PASS', exportRows: exported.rows.length, hotkey, rendererErrors: errors, note: 'DOM/IPC startup smoke only; no visual or in-game verification' }, null, 2));
    app.exit(0);
  } catch (err) {
    if (restoreMode) {
      try { await restoreMode(); } catch (restoreErr) { console.error('Mode restore failed:', restoreErr.message); }
    }
    try { await fs.unlink(exportPath); } catch (cleanupErr) { if (cleanupErr.code !== 'ENOENT') console.error(cleanupErr.message); }
    console.error(err.stack);
    console.error('Renderer errors:', errors);
    app.exit(1);
  }
});
