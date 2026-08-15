// Relationship profile readability hardening.
// Loaded after positive-reinforcement.js so these rules intentionally override
// the translucent profile backdrop/header styles.
// NOTE: the app theme token is --bg (not --paper), so use an explicit opaque
// fallback to guarantee the dashboard cannot bleed through.

const profileOpaqueStyle = document.createElement('style');
profileOpaqueStyle.textContent = `
.person-profile-backdrop{
  position:fixed !important;
  inset:0 !important;
  z-index:9500 !important;
  background:#f4f1e9 !important;
  background:var(--bg,#f4f1e9) !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
  opacity:1 !important;
  overflow:auto !important;
  isolation:isolate !important;
}
.person-profile-page{
  position:relative !important;
  z-index:1 !important;
  width:min(720px,100%) !important;
  min-height:100vh !important;
  margin:0 auto !important;
  background:#f4f1e9 !important;
  background:var(--bg,#f4f1e9) !important;
  box-shadow:none !important;
  opacity:1 !important;
}
.profile-nav{
  position:sticky !important;
  top:0 !important;
  z-index:20 !important;
  background:#f4f1e9 !important;
  background:var(--bg,#f4f1e9) !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
  opacity:1 !important;
}
.profile-hero,
.profile-stats,
.profile-recognize-hero,
.profile-section{
  position:relative !important;
  z-index:2 !important;
}
`;
document.head.appendChild(profileOpaqueStyle);
