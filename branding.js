const DSWF_ICON_URL = '../icons/DSWF.png';

const manifestLink = document.querySelector('link[rel="manifest"]');
if (manifestLink) manifestLink.setAttribute('href', './manifest.webmanifest');

function renderDSWFBranding() {
  const onboardingMark = document.querySelector('.onboarding .brand-mark');
  if (onboardingMark && !onboardingMark.querySelector('.dswf-app-logo')) {
    onboardingMark.innerHTML = `<img class="dswf-app-logo onboarding-logo" src="${DSWF_ICON_URL}" alt="Days Since We Fought" />`;
  }

  const topbar = document.querySelector('.app-shell .topbar');
  if (topbar && !topbar.querySelector('.dswf-header-logo')) {
    const logo = document.createElement('img');
    logo.className = 'dswf-header-logo';
    logo.src = DSWF_ICON_URL;
    logo.alt = 'Days Since We Fought';
    topbar.prepend(logo);
  }
}

const brandingStyle = document.createElement('style');
brandingStyle.textContent = `
.dswf-app-logo{display:block;object-fit:contain}
.onboarding .brand-mark{width:86px;height:86px;padding:0;border:0;background:transparent;box-shadow:none;transform:none}
.onboarding-logo{width:86px;height:86px}
.dswf-header-logo{width:58px;height:58px;object-fit:contain;flex:0 0 auto}
.app-shell .topbar{gap:14px}
.app-shell .topbar>div{flex:1;min-width:0}
@media(max-width:520px){.dswf-header-logo{width:48px;height:48px}.app-shell .topbar{gap:10px}}
`;
document.head.append(brandingStyle);

const brandingObserver = new MutationObserver(renderDSWFBranding);
brandingObserver.observe(document.querySelector('#app'), { childList: true, subtree: true });
renderDSWFBranding();
