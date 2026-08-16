// Visible activity log for completed Simmer Down interventions.
// The underlying sessions are written by simmer-down.js; this file only surfaces them in the UI.

function simmerHistoryOutcomeLabel(session) {
  if (session.outcome === 'cooled') return ['🧯', 'Fire put out', 'cooled'];
  if (session.outcome === 'tense') return ['😮‍💨', 'No fight · still tense', 'tense'];
  if (session.outcome === 'fought') return ['💥', 'Fight followed', 'fought'];
  return ['⏳', 'Check-in pending', 'pending'];
}

function simmerHistoryWhen(session) {
  const value = session.completedAt || session.startedAt || Date.now();
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function completedSimmerHistory() {
  if (typeof simmerHistory !== 'function') return [];
  return simmerHistory()
    .filter(session => session.completed)
    .sort((a, b) => (b.completedAt || b.startedAt || 0) - (a.completedAt || a.startedAt || 0));
}

function simmerHistoryRow(session, compact = false) {
  const person = typeof simmerPerson === 'function' ? simmerPerson(session) : null;
  const [emoji, label, status] = simmerHistoryOutcomeLabel(session);
  const trigger = session.trigger || 'Trigger not recorded';
  const move = session.move || 'Response not recorded';
  return `<article class="simmer-history-row ${compact ? 'compact' : ''}">
    <div class="simmer-history-main">
      <div class="simmer-history-avatar">${person && typeof avatar === 'function' ? avatar(person, 'sm') : '<span>🔥</span>'}</div>
      <div class="simmer-history-copy">
        <div class="simmer-history-title"><strong>${typeof escapeHtml === 'function' ? escapeHtml(person?.name || 'Simmer Down') : (person?.name || 'Simmer Down')}</strong><span>${simmerHistoryWhen(session)}</span></div>
        <div class="simmer-history-detail">${typeof escapeHtml === 'function' ? escapeHtml(trigger) : trigger} · ${typeof escapeHtml === 'function' ? escapeHtml(move) : move}</div>
      </div>
    </div>
    <div class="simmer-history-status ${status}">${emoji} ${label}</div>
    ${!session.outcome ? `<button type="button" class="simmer-history-checkin" data-simmer-history-checkin="${session.id}">Check in now</button>` : ''}
  </article>`;
}

function bindSimmerHistoryActions(root) {
  root?.querySelectorAll('[data-simmer-history-checkin]').forEach(button => {
    button.onclick = () => {
      if (typeof openSimmerCheckIn === 'function') openSimmerCheckIn(button.dataset.simmerHistoryCheckin);
    };
  });
}

function openSimmerHistory() {
  const sessions = completedSimmerHistory();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop journal-backdrop';
  modal.innerHTML = `<div class="modal journal-browser simmer-history-modal">
    <button class="modal-close" aria-label="Close">×</button>
    <p class="eyebrow">SIMMER DOWN LOG</p>
    <h2>Interventions</h2>
    <p class="journal-intro">Every completed Simmer Down is recorded here, whether or not it ultimately prevented a fight.</p>
    <div class="simmer-history-list">${sessions.length ? sessions.map(session => simmerHistoryRow(session)).join('') : '<div class="empty-state">No completed Simmer Down sessions yet.</div>'}</div>
  </div>`;
  document.body.append(modal);
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = event => { if (event.target === modal) modal.remove(); };
  bindSimmerHistoryActions(modal);
}

function renderSimmerHistoryUI() {
  if (typeof state === 'undefined' || !state.onboardingComplete) return;
  const sessions = completedSimmerHistory();
  let section = document.querySelector('#simmerHistorySection');

  if (!sessions.length) {
    section?.remove();
    return;
  }

  const launch = document.querySelector('#simmerLaunchSection');
  if (!launch) return;

  if (!section) {
    section = document.createElement('section');
    section.id = 'simmerHistorySection';
    section.className = 'simmer-history-section';
    launch.insertAdjacentElement('afterend', section);
  }

  const latest = sessions[0];
  const signature = sessions.map(x => [x.id, x.completedAt, x.outcome || '', x.outcomeAt || ''].join(':')).join('|');
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;

  section.innerHTML = `<div class="simmer-history-heading">
      <div><p class="eyebrow">SIMMER DOWN LOG</p><h3>${sessions.length} intervention${sessions.length === 1 ? '' : 's'} recorded</h3></div>
      <button type="button" class="text-btn" id="viewSimmerHistory">View all</button>
    </div>
    <div class="simmer-history-list dashboard">${sessions.slice(0, 2).map(session => simmerHistoryRow(session, true)).join('')}</div>
    ${!latest.outcome ? '<div class="simmer-history-note">This intervention is saved now. “Fires Put Out” only increases after you confirm the outcome.</div>' : ''}`;

  section.querySelector('#viewSimmerHistory').onclick = openSimmerHistory;
  bindSimmerHistoryActions(section);
}

// Refresh immediately whenever Simmer Down writes or updates a session.
if (typeof upsertSimmer === 'function') {
  const baseUpsertSimmerHistory = upsertSimmer;
  upsertSimmer = function upsertSimmerWithVisibleHistory(entry) {
    const result = baseUpsertSimmerHistory(entry);
    queueMicrotask(renderSimmerHistoryUI);
    return result;
  };
}

if (typeof updateSimmer === 'function') {
  const baseUpdateSimmerHistory = updateSimmer;
  updateSimmer = function updateSimmerWithVisibleHistory(sessionId, patch) {
    const result = baseUpdateSimmerHistory(sessionId, patch);
    queueMicrotask(renderSimmerHistoryUI);
    return result;
  };
}

const simmerHistoryStyle = document.createElement('style');
simmerHistoryStyle.textContent = `
.simmer-history-section{margin:-12px 0 34px}.simmer-history-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:0 2px 10px}.simmer-history-heading h3{margin:0;font-size:18px;letter-spacing:-.025em}.simmer-history-heading .eyebrow{margin-bottom:3px}.simmer-history-list{display:grid;gap:8px}.simmer-history-row{background:var(--card);border:1px solid var(--line);border-radius:17px;padding:13px}.simmer-history-main{display:flex;align-items:center;gap:11px;min-width:0}.simmer-history-avatar{flex:0 0 auto}.simmer-history-avatar>span{width:40px;height:40px;border-radius:50%;background:#fff1ea;display:grid;place-items:center}.simmer-history-copy{min-width:0;flex:1}.simmer-history-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.simmer-history-title strong{font-size:14px}.simmer-history-title span{font-size:10px;color:var(--muted);white-space:nowrap}.simmer-history-detail{font-size:11px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.simmer-history-status{display:inline-flex;align-items:center;margin:10px 0 0 51px;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:850;background:#eee9df;color:#625e56}.simmer-history-status.cooled{background:#e9f4ec;color:#286245}.simmer-history-status.tense{background:#fff3d9;color:#7e5a11}.simmer-history-status.fought{background:#fff0ed;color:var(--accent-dark)}.simmer-history-checkin{display:block;margin:8px 0 0 51px;border:0;background:transparent;padding:0;color:var(--accent-dark);font-size:11px;font-weight:900;text-decoration:underline;text-underline-offset:2px}.simmer-history-note{font-size:10px;line-height:1.45;color:var(--muted);text-align:center;margin-top:8px}.simmer-history-modal .simmer-history-row{background:#fff}.simmer-history-modal .simmer-history-list{margin-top:18px}@media(max-width:520px){.simmer-history-section{margin-top:-14px}.simmer-history-title{display:block}.simmer-history-title span{display:block;margin-top:1px}.simmer-history-status,.simmer-history-checkin{margin-left:51px}}
`;
document.head.appendChild(simmerHistoryStyle);

const simmerHistoryObserver = new MutationObserver(() => renderSimmerHistoryUI());
simmerHistoryObserver.observe(document.querySelector('#app'), { childList: true, subtree: true });
renderSimmerHistoryUI();
