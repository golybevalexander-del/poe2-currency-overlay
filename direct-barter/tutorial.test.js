'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldAutoStart, dismiss } = require('../renderer/tutorial-start-policy');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
test('welcome dismissal suppresses every subsequent F6 show including a previously queued start', () => {
  const config = { tutorialDone: false };
  assert.equal(shouldAutoStart(config, false), true);
  dismiss(config);
  for (let i = 0; i < 5; i++) assert.equal(shouldAutoStart(config, false), false);
  assert.equal(config.tutorialDone, false); // explicit replay/completion flow remains separate
});

test('actual tutorial dismissal handler persists and actual overlay-shown callback honors it after restart', async () => {
  let saved = { tutorialDone: false };
  function renderer(config) {
    const shown = [], scheduled = [], replay = [];
    const context = vm.createContext({
      config, console, clearInterval() {}, setTimeout(fn) { scheduled.push(fn); },
      document: {
        body: { classList: { remove() {} } }, getElementById() { return null; },
        querySelectorAll(selector) {
          return selector === '.tut-chip' ? [{ dataset: { tut: 'currency' }, addEventListener(_event, fn) { replay.push(fn); } }] : [];
        }
      },
      $() { return { classList: { add() {} } }; },
      window: {
        TutorialStartPolicy: { shouldAutoStart, dismiss },
        api: {
          onShown(fn) { shown.push(fn); }, itemPeekHide() {},
          async setTutorialDismissed() { saved.tutorialDismissed = true; }
        }
      }
    });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../renderer/tutorial.js'), 'utf8'), context);
    vm.runInContext('tutShieldsOff = () => {}; tutRestoreDemo = () => {}; starts = 0; startTutorial = () => { starts++; };', context);
    return { context, show() { shown.forEach((fn) => fn()); scheduled.splice(0).forEach((fn) => fn()); }, replay };
  }
  const first = renderer({ ...saved });
  vm.runInContext("tutActive = true; endTutorial('later');", first.context);
  await Promise.resolve();
  first.show(); first.show();
  assert.equal(first.context.starts, 0);
  assert.equal(saved.tutorialDismissed, true);
  const restarted = renderer(JSON.parse(JSON.stringify(saved)));
  restarted.show();
  assert.equal(restarted.context.starts, 0);
  restarted.replay[0]();
  assert.equal(restarted.context.starts, 1); // explicit Settings replay still opens
});
test('saved dismissal suppresses restart; undismissed first run still starts, completed run does not', () => {
  const config = { tutorialDone: false };
  dismiss(config);
  const reloaded = JSON.parse(JSON.stringify(config));
  assert.equal(shouldAutoStart(reloaded, false), false);
  assert.equal(shouldAutoStart({ tutorialDone: false }, true), false);
  assert.equal(shouldAutoStart({ tutorialDone: true }, false), false);
  assert.equal(shouldAutoStart({ tutorialDone: false }, false), true);
});
