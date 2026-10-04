'use strict';
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const os = require('node:os');
const { setTimeout: delay } = require('node:timers/promises');
const { BarterService } = require('../direct-barter/service');
let mode = 'sell', queries = 0, holding = false;
let warning = '';
protocol.registerSchemesAsPrivileged([{ scheme: 'ee2', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
const pending = [];
const selected = 'Metadata/Items/Gems/ReservationGemUncut8';
const skill = 'Metadata/Items/Gems/SkillGemUncut14';
const divine = 'Metadata/Items/Currency/CurrencyModValues';
const exalted = 'Metadata/Items/Currency/CurrencyAddModToRare';
function market(a, b, qa, qb) {
  return { league: 'Standard', market_id: `${a}|${b}`, market_pair: [a, b], volume_traded: { [a]: qa, [b]: qb } };
}
const service = new BarterService({
  async hour(hour) {
    return { hour, fetchedAt: Date.now(), markets: [
      market(selected, divine, 4, 137), market(selected, skill, 0, 0), market(divine, exalted, 1, 300)
    ] };
  },
  async prune() {}
}, { fetchImpl: async () => ({ ok: true, json: async () => [] }) });
ipcMain.handle('fixture-config', () => ({ barterMode: mode }));
ipcMain.handle('fixture-mode', (_e, next) => { mode = next; return next; });
ipcMain.handle('fixture-query', async (_e, args) => {
  queries++;
  if (holding) await new Promise((resolve) => pending.push(resolve));
  const result = await service.query({ ...args, league: 'Standard' });
  if (warning) { result.partial = warning === 'partial'; result.stale = warning === 'stale'; result.errors.push({ error: 'fixture provider unavailable' }); }
  return result;
});
ipcMain.handle('fixture-control', (_e, command) => {
  if (command === 'hold') holding = true;
  if (command === 'release') { holding = false; pending.splice(0).forEach((resolve) => resolve()); }
  if (['partial', 'stale', ''].includes(command)) warning = command;
  return { queries, pending: pending.length, mode };
});
async function waitFor(fn, description, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return; await delay(50); }
  throw new Error(`Timed out: ${description}`);
}
app.whenReady().then(async () => {
  const root = path.resolve(__dirname, '..', 'renderer', 'vendor', 'ee2', 'data');
  protocol.handle('ee2', async (request) => {
    const relative = decodeURIComponent(new URL(request.url).pathname.replace(/^\/data\//, ''));
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return new Response('forbidden', { status: 403 });
    return new Response(await fs.readFile(file), { headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'barter-ux-'));
  app.setPath('userData', directory);
  let win;
  try {
    win = new BrowserWindow({ show: false, webPreferences: {
      preload: path.join(__dirname, 'fixtures', 'barter-ux-preload.js'), contextIsolation: true, nodeIntegration: false
    } });
    await win.loadFile(path.join(__dirname, 'fixtures', 'barter-ux.html'));
    const js = (code) => win.webContents.executeJavaScript(code);
    await js('window.DirectBarter.render()');
    await waitFor(() => js(`document.getElementById('barter-refresh') && !document.getElementById('barter-refresh').disabled`), 'initial data');
    await js(`document.getElementById('barter-search').value='Unc 8'; document.getElementById('barter-search').dispatchEvent(new Event('input'))`);
    const names = await js(`Array.from(document.querySelectorAll('.barter-choice')).map(n=>n.textContent)`);
    assert.equal(names.length, 2);
    assert.ok(names.every((name) => name.includes('(Level 8)') && !name.includes('(Level 18)')));
    await js(`Array.from(document.querySelectorAll('.barter-choice')).find(n=>n.textContent.includes('Spirit')).click()`);
    await waitFor(() => js(`!!document.querySelector('.barter-table') && !document.getElementById('barter-refresh').disabled`), 'selected markets');
    await waitFor(() => js(`Array.from(document.querySelectorAll('#barter-selected img, .barter-table img')).filter(n=>n.src.includes('Uncut')).every(n=>n.complete && n.naturalWidth>0)`), 'official gem PNG decoding');
    const icons = await js(`Array.from(document.querySelectorAll('#barter-selected img, .barter-table img')).map(n=>({url:n.src,width:n.naturalWidth}))`);
    assert.ok(icons.filter((icon) => icon.url.includes('Uncut')).length >= 2);
    assert.equal(await js(`document.querySelectorAll('#barter-results details, #barter-results summary').length`), 0);
    assert.equal(await js(`Array.from(document.querySelectorAll('.barter-rate')).find(n=>n.textContent==='34.25').title`),
      '1 Uncut Spirit Gem (Level 8) for 34.25 Divine Orb (historical)');
    const before = queries;
    await js(`document.getElementById('barter-mode').value='buy'; document.getElementById('barter-mode').dispatchEvent(new Event('change'))`);
    assert.equal(queries, before);
    assert.equal(await js(`Array.from(document.querySelectorAll('.barter-rate')).find(n=>n.textContent==='34.25').title`),
      'Pay 34.25 Divine Orb for 1 Uncut Spirit Gem (Level 8) (historical)');
    assert.equal(await js(`document.querySelector('.barter-table tbody tr').children[3].textContent`), '1 : 34.25');
    assert.equal(await js(`document.querySelector('.barter-table tbody tr').children[3].title`),
      '1 Uncut Spirit Gem (Level 8) received : 34.25 Divine Orb paid (historical average, buying:selling).');
    assert.equal(await js(`!!document.getElementById('barter-coverage') || !!document.getElementById('barter-hours')`), false);
    assert.equal(await js(`document.querySelectorAll('.barter-table th').length`), 5);
    assert.ok(await js(`!document.getElementById('barter-root').textContent.includes('Choose a specific item')`));
    await js(`document.dispatchEvent(new KeyboardEvent('keydown', {ctrlKey:true,key:'f',bubbles:true}))`);
    assert.equal(await js(`document.activeElement.id`), 'barter-search');
    await js(`window.DirectBarter.capture('Item Class: Stackable Currency\\nRarity: Currency\\nUncut Spirit Gem\\n--------\\nLevel: 8')`);
    assert.equal(await js(`document.getElementById('barter-search').value`), 'Uncut Spirit Gem (Level 8)');
    assert.equal(await js(`document.getElementById('barter-mode').value`), 'buy');
    await js(`window.DirectBarter.capture('Item Class: Helmets\\nRarity: Rare\\nFancy Helmet\\n--------')`);
    assert.ok(await js(`document.getElementById('barter-errors').textContent.includes('not a recognized exchange item')`));
    assert.equal(await js(`document.querySelector('.barter-table th button').textContent.startsWith('Exalted per payment item')`), true);
    await js(`document.querySelector('.barter-table th button').click()`);
    assert.equal(await js(`document.querySelector('.barter-table tbody tr:last-child td:nth-child(3)').textContent`), 'Unpriced');
    await js(`document.getElementById('barter-filter').value='unc14'; document.getElementById('barter-filter').dispatchEvent(new Event('input'))`);
    assert.equal(await js(`document.querySelectorAll('.barter-table tbody tr').length`), 1);
    assert.equal(await js(`document.querySelector('.barter-rate').textContent`), 'No Historical record');
    assert.equal(await js(`document.querySelector('.barter-average-ratio').textContent`), 'No Historical record');
    await js(`document.getElementById('barter-filter').value=''; document.getElementById('barter-filter').dispatchEvent(new Event('input')); window.fixture.control('hold')`);
    await js(`void window.DirectBarter.refresh()`);
    await waitFor(() => Promise.resolve(pending.length > 0), 'held response');
    await js(`window.DirectBarter.capture('Rarity: Currency\\nUncut Spirit Gem\\n--------\\nLevel: 8')`);
    await js(`document.getElementById('barter-clear').click()`);
    assert.equal(queries, before + 1);
    assert.equal(await js(`document.getElementById('barter-selected').textContent`), '');
    assert.equal(await js(`document.getElementById('barter-search').value`), '');
    assert.equal(await js(`document.getElementById('barter-filter').value`), '');
    assert.equal(await js(`document.getElementById('barter-export').disabled`), true);
    assert.equal(await js(`document.activeElement.id`), 'barter-search');
    await js(`window.fixture.control('release')`); await delay(250);
    assert.equal(await js(`document.querySelectorAll('.barter-table').length`), 0);
    assert.equal(await js(`document.getElementById('barter-selected').textContent`), '');
    assert.equal(queries, before + 1); // clearing did not rescan
    await js(`document.getElementById('barter-search').value='unc spirit 8'; document.getElementById('barter-search').dispatchEvent(new Event('input')); window.fixture.control('hold'); document.querySelector('.barter-choice').click(); document.getElementById('barter-mode').value='sell'; document.getElementById('barter-mode').dispatchEvent(new Event('change'));`);
    await waitFor(() => Promise.resolve(pending.length > 0), 'held mode response');
    await js(`window.fixture.control('release')`);
    await waitFor(() => js(`!!document.querySelector('.barter-table') && !document.getElementById('barter-refresh').disabled`), 'latest-mode response');
    assert.ok(await js(`document.getElementById('barter-selected').textContent.startsWith('Selling:')`));
    assert.equal(await js(`Array.from(document.querySelectorAll('.barter-rate')).find(n=>n.textContent==='34.25').title`),
      '1 Uncut Spirit Gem (Level 8) for 34.25 Divine Orb (historical)');
    assert.equal(await js(`document.querySelector('.barter-average-ratio').textContent`), '34.25 : 1');
    await js(`window.fixture.control('hold'); void window.DirectBarter.refresh()`);
    await waitFor(() => Promise.resolve(pending.length > 0), 'capture during fetch');
    await js(`window.DirectBarter.capture('Rarity: Currency\\nUncut Spirit Gem\\n--------\\nLevel: 8'); window.fixture.control('release')`);
    await waitFor(() => js(`document.getElementById('barter-search').value === 'Uncut Spirit Gem (Level 8)'`), 'deferred capture exact level');
    for (const warning of ['partial', 'stale']) {
      await js(`window.fixture.control('${warning}'); window.DirectBarter.refresh()`);
      assert.ok(await js(`document.getElementById('barter-errors').textContent.includes('${warning === 'partial' ? 'PARTIAL COVERAGE' : 'STALE CACHE'}')`));
      await js(`window.DirectBarter.capture('Rarity: Currency\\nUncut Spirit Gem\\n--------\\nLevel: 8')`);
      assert.ok(await js(`document.getElementById('barter-errors').textContent.includes('fixture provider unavailable')`));
    }
    await js(`window.fixture.control('')`);
    await js(`document.getElementById('barter-mode').value='buy'; document.getElementById('barter-mode').dispatchEvent(new Event('change'))`);
    const reloaded = new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
    win.reload(); await reloaded;
    await js('window.DirectBarter.render()');
    assert.equal(await js(`document.getElementById('barter-mode').value`), 'buy');
    assert.ok(await js(`document.getElementById('barter-filter').placeholder.includes('payment')`));
    console.log(JSON.stringify({ status: 'PASS', names, icons, buySell: 'correct rate/quantities/unit valuation',
      details: 'hidden', clearDuringLoad: 'PASS, no extra request or stale repopulation', lateMode: 'PASS',
      modeRestoration: 'PASS', note: 'Isolated real-Electron fixture; no user profile/hotkey changes' }, null, 2));
    win.destroy(); await fs.rm(directory, { recursive: true, force: true }); app.exit(0);
  } catch (err) {
    console.error(err.stack);
    if (win && !win.isDestroyed()) win.destroy();
    try { await fs.rm(directory, { recursive: true, force: true }); } catch (cleanup) { console.error(cleanup.message); }
    app.exit(1);
  }
});
