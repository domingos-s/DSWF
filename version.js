// DSWF release/version footer.
const DSWF_VERSION = '1.4';
const DSWF_LATEST_FEATURE = 'Simmer Down: cool-down game, outcome tracking, and intervention insights';

function renderVersionFooter() {
  if (!state.onboardingComplete) return;
  const footer = document.querySelector('.app-shell footer');
  if (!footer || footer.querySelector('.footer-version-row')) return;

  const row = document.createElement('div');
  row.className = 'footer-version-row';
  row.innerHTML = `
    <span>Version ${DSWF_VERSION}</span>
    <span aria-hidden="true">·</span>
    <button type="button" class="footer-update-link" id="updateAppLink">Update App</button>
  `;
  footer.append(row);

  footer.querySelector('#updateAppLink').onclick = refreshDSWFApp;
}

async function refreshDSWFApp() {
  const button = document.querySelector('#updateAppLink');
  if (button) {
    button.disabled = true;
    button.textContent = 'Updating…';
  }

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) await registration.unregister();
    }

    const url = new URL(window.location.href);
    url.searchParams.set('update', Date.now().toString());
    window.location.replace(url.toString());
  } catch (error) {
    console.error('DSWF update failed', error);
    if (button) {
      button.disabled = false;
      button.textContent = 'Update App';
    }
    toast('Could not update the app. Check your connection and try again.');
  }
}

const versionStyle = document.createElement('style');
versionStyle.textContent = `
.footer-version-row{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:7px;font-size:10px;color:var(--muted)}
.footer-update-link{appearance:none;border:0;background:transparent;padding:0;color:var(--accent-dark);font:inherit;font-weight:850;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
.footer-update-link:disabled{opacity:.55;cursor:default;text-decoration:none}
`;
document.head.append(versionStyle);

const versionObserver = new MutationObserver(renderVersionFooter);
versionObserver.observe(document.querySelector('#app'), { childList: true, subtree: true });
renderVersionFooter();