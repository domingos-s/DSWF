// Relationship profile readability hardening.
// Loaded after positive-reinforcement.js so these rules intentionally override
// the translucent profile backdrop/header styles.

const profileOpaqueStyle = document.createElement('style');
profileOpaqueStyle.textContent = `
.person-profile-backdrop{
  background:var(--paper) !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
}
.person-profile-page{
  min-height:100vh !important;
  background:var(--paper) !important;
  box-shadow:none !important;
  opacity:1 !important;
}
.profile-nav{
  z-index:20 !important;
  background:var(--paper) !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
}
.profile-section,
.profile-hero,
.profile-stats{
  position:relative;
  z-index:1;
}
`;
document.head.appendChild(profileOpaqueStyle);
