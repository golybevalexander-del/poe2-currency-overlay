'use strict';
(function (root) {
  function shouldAutoStart(config, active) {
    return !!config && !config.tutorialDone && !config.tutorialDismissed && !active;
  }
  function dismiss(config) {
    if (config) config.tutorialDismissed = true;
  }
  const api = { shouldAutoStart, dismiss };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TutorialStartPolicy = api;
})(typeof window === 'object' ? window : globalThis);
