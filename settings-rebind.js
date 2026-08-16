// Ensure the Settings gear always calls the final enhanced openSettings function.
// app.js binds the initial button before later feature modules wrap openSettings.
(function bindEnhancedSettingsButton() {
  function bind() {
    const button = document.querySelector('#settingsBtn');
    if (!button) return;
    button.onclick = () => openSettings();
  }

  bind();

  const app = document.querySelector('#app');
  if (!app) return;

  const observer = new MutationObserver(() => queueMicrotask(bind));
  observer.observe(app, { childList: true, subtree: false });
})();
