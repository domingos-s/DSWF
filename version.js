// DSWF release note shown in Settings.
const DSWF_VERSION = '1.2';
const DSWF_LATEST_FEATURE = 'Insights Engine, Structured Journaling, Trends, and Experiments';

const baseOpenSettingsWithVersion = openSettings;
openSettings = function openSettingsWithVersion() {
  baseOpenSettingsWithVersion();
  const modal = [...document.querySelectorAll('.modal-backdrop .modal')].at(-1);
  if (!modal || modal.querySelector('.version-note')) return;

  const note = document.createElement('div');
  note.className = 'version-note';
  note.innerHTML = `
    <div class="version-note-top">
      <span class="version-badge">VERSION ${DSWF_VERSION}</span>
      <span class="version-new">LATEST UPDATE</span>
    </div>
    <strong>${DSWF_LATEST_FEATURE}</strong>
    <small>New in Version ${DSWF_VERSION}</small>
  `;
  modal.append(note);
};

const versionStyle = document.createElement('style');
versionStyle.textContent = `
.version-note{margin-top:22px;padding:15px 16px;border:1px solid var(--line);border-radius:18px;background:#f3ede2}.version-note-top{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.version-badge,.version-new{font-size:9px;font-weight:950;letter-spacing:.12em}.version-badge{color:var(--ink)}.version-new{color:var(--accent-dark)}.version-note strong{display:block;font-size:14px;line-height:1.35}.version-note small{display:block;color:var(--muted);font-size:10px;margin-top:5px}
`;
document.head.append(versionStyle);
