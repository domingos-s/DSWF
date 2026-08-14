// 4-digit PIN protection for DSWF journal content.
// The PIN itself is never stored; only a SHA-256 hash is persisted in local state.

if (!state.settings || typeof state.settings !== 'object') state.settings = {};
if (typeof state.settings.journalPinHash !== 'string') state.settings.journalPinHash = '';

let journalUnlocked = false;

async function journalPinHash(pin) {
  const bytes = new TextEncoder().encode(`dswf-journal:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function journalPinIsSet() {
  return /^([a-f0-9]{64})$/.test(state.settings.journalPinHash || '');
}

function pinModal({ mode = 'unlock', onSuccess }) {
  const setting = mode === 'setup' || mode === 'change';
  const title = mode === 'setup' ? 'Create Journal PIN' : mode === 'change' ? 'Change Journal PIN' : 'Journal locked';
  const intro = mode === 'setup'
    ? 'Choose a 4-digit PIN to protect your journal, calendar, and reflection details on this device.'
    : mode === 'change'
      ? 'Enter a new 4-digit PIN for your journal.'
      : 'Enter your 4-digit PIN to view private journal content.';
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop journal-pin-backdrop';
  modal.innerHTML = `<div class="modal journal-pin-modal">
    <button class="modal-close" aria-label="Close">×</button>
    <p class="eyebrow">PRIVATE JOURNAL</p>
    <div class="journal-pin-lock">🔒</div>
    <h2>${title}</h2>
    <p class="journal-pin-intro">${intro}</p>
    <input class="journal-pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="4-digit journal PIN" placeholder="••••" />
    ${setting ? '<input class="journal-pin-input journal-pin-confirm" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="Confirm 4-digit journal PIN" placeholder="Confirm PIN" />' : ''}
    <div class="journal-pin-error" role="alert"></div>
    <button class="btn btn-primary journal-pin-submit">${setting ? 'Save PIN' : 'Unlock journal'}</button>
    <p class="journal-pin-note">Your PIN cannot be recovered if you forget it. It only protects access inside DSWF on this device.</p>
  </div>`;
  document.body.append(modal);
  const input = modal.querySelector('.journal-pin-input');
  const confirmInput = modal.querySelector('.journal-pin-confirm');
  const error = modal.querySelector('.journal-pin-error');
  const submit = modal.querySelector('.journal-pin-submit');
  const clean = el => { el.value = el.value.replace(/\D/g, '').slice(0, 4); };
  input.addEventListener('input', () => clean(input));
  confirmInput?.addEventListener('input', () => clean(confirmInput));
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  const execute = async () => {
    const pin = input.value;
    if (!/^\d{4}$/.test(pin)) { error.textContent = 'Enter exactly 4 digits.'; input.focus(); return; }
    if (setting) {
      if (confirmInput.value !== pin) { error.textContent = 'PINs do not match.'; confirmInput.focus(); return; }
      state.settings.journalPinHash = await journalPinHash(pin);
      saveState();
      journalUnlocked = true;
      modal.remove();
      toast(mode === 'change' ? 'Journal PIN changed.' : 'Journal PIN created. 🔒');
      onSuccess?.();
      return;
    }
    const hash = await journalPinHash(pin);
    if (hash !== state.settings.journalPinHash) {
      error.textContent = 'Incorrect PIN.';
      input.value = '';
      input.focus();
      return;
    }
    journalUnlocked = true;
    modal.remove();
    onSuccess?.();
  };
  submit.onclick = execute;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !confirmInput) execute(); });
  confirmInput?.addEventListener('keydown', e => { if (e.key === 'Enter') execute(); });
  setTimeout(() => input.focus(), 50);
}

function requireJournalUnlock(action) {
  if (journalUnlocked) { action(); return; }
  if (!journalPinIsSet()) { pinModal({ mode: 'setup', onSuccess: action }); return; }
  pinModal({ mode: 'unlock', onSuccess: action });
}

// Lock whenever the app leaves the foreground.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') journalUnlocked = false;
});
window.addEventListener('pagehide', () => { journalUnlocked = false; });

// Protect registry, calendar, detail views, and edits of existing reflections.
const _openJournalRegistry = openJournalRegistry;
openJournalRegistry = function protectedJournalRegistry(...args) {
  requireJournalUnlock(() => _openJournalRegistry(...args));
};

const _openJournalCalendar = openJournalCalendar;
openJournalCalendar = function protectedJournalCalendar(...args) {
  requireJournalUnlock(() => _openJournalCalendar(...args));
};

const _openJournalEntry = openJournalEntry;
openJournalEntry = function protectedJournalEntry(...args) {
  requireJournalUnlock(() => _openJournalEntry(...args));
};

const _openJournalFlow = openJournalFlow;
openJournalFlow = function protectedJournalFlow(personId, fightEventId, fightAt, existingEntry = null) {
  if (!existingEntry) return _openJournalFlow(personId, fightEventId, fightAt, existingEntry);
  requireJournalUnlock(() => _openJournalFlow(personId, fightEventId, fightAt, existingEntry));
};

// Insights evidence may expose journal text, so protect that route too.
if (typeof openInsightEvidence === 'function') {
  const _openInsightEvidence = openInsightEvidence;
  openInsightEvidence = function protectedInsightEvidence(...args) {
    requireJournalUnlock(() => _openInsightEvidence(...args));
  };
}

// Add Journal PIN management to Settings without changing app.js.
const _openSettingsWithJournalPin = openSettings;
openSettings = function journalPinSettingsWrapper(...args) {
  _openSettingsWithJournalPin(...args);
  const modal = [...document.querySelectorAll('.modal-backdrop .modal')].at(-1);
  if (!modal || modal.querySelector('#journalPinSetting')) return;
  const reset = modal.querySelector('#resetAll');
  const row = document.createElement('button');
  row.className = 'setting-row';
  row.id = 'journalPinSetting';
  row.innerHTML = `<span><strong>Journal PIN</strong><small>${journalPinIsSet() ? 'Change your 4-digit privacy PIN' : 'Protect reflections with a 4-digit PIN'}</small></span><b>→</b>`;
  (reset || modal.querySelector('.setting-row:last-of-type'))?.before(row);
  row.onclick = () => {
    if (!journalPinIsSet()) { pinModal({ mode: 'setup' }); return; }
    requireJournalUnlock(() => pinModal({ mode: 'change' }));
  };
};

const journalPinStyle = document.createElement('style');
journalPinStyle.textContent = `
.journal-pin-modal{text-align:center}
.journal-pin-lock{font-size:38px;margin:4px 0 10px}
.journal-pin-intro{color:var(--muted);line-height:1.5;margin:0 auto 18px;max-width:390px}
.journal-pin-input{display:block;width:min(100%,250px);margin:10px auto;border:1px solid var(--line);background:white;border-radius:16px;padding:15px;text-align:center;font-size:25px;font-weight:900;letter-spacing:.38em;color:var(--ink);outline:none;font-variant-numeric:tabular-nums}
.journal-pin-input:focus{border-color:var(--ink);box-shadow:0 0 0 3px rgba(23,23,23,.08)}
.journal-pin-confirm{font-size:18px;letter-spacing:.08em}
.journal-pin-error{min-height:20px;color:var(--accent-dark);font-size:12px;font-weight:800;margin:4px 0 8px}
.journal-pin-submit{max-width:320px;margin:0 auto}
.journal-pin-note{font-size:10px;color:var(--muted);line-height:1.4;margin:14px auto 0;max-width:360px}
`;
document.head.append(journalPinStyle);
