// Dashboard + full-history log for positive recognitions.
// Recognition data is owned by positive-reinforcement.js; this file only presents it.

function completedRecognitionHistory() {
  const rows = Array.isArray(state?.recognitions) ? state.recognitions : [];
  return [...rows].sort((a, b) => (b.at || 0) - (a.at || 0));
}

function recognitionLogWhen(recognition) {
  try {
    return new Date(recognition.at || Date.now()).toLocaleDateString(undefined, {
      month:'short', day:'numeric', hour:'numeric', minute:'2-digit'
    });
  } catch {
    return '';
  }
}

function recognitionLogCategory(recognition) {
  if (typeof recognitionCategory === 'function') return recognitionCategory(recognition.category);
  return ['⭐', recognition.category || 'Recognition'];
}

function recognitionLogPerson(recognition) {
  return state.people.find(person => person.id === recognition.personId) || null;
}

function recognitionLogRow(recognition, compact = false) {
  const person = recognitionLogPerson(recognition);
  const [emoji, label] = recognitionLogCategory(recognition);
  const safe = value => typeof escapeHtml === 'function' ? escapeHtml(String(value || '')) : String(value || '');
  const note = recognition.note?.trim() || 'Positive moment recorded';
  const points = typeof RECOGNITION_PEACE_POINTS === 'number' ? RECOGNITION_PEACE_POINTS : 2;

  return `<article class="recognition-log-row ${compact ? 'compact' : ''}">
    <div class="recognition-log-main">
      <div class="recognition-log-avatar">${person && typeof avatar === 'function' ? avatar(person, 'sm') : `<span>${emoji}</span>`}</div>
      <div class="recognition-log-copy">
        <div class="recognition-log-title"><strong>${safe(person?.name || 'Family member')}</strong><span>${recognitionLogWhen(recognition)}</span></div>
        <div class="recognition-log-detail"><b>${emoji} ${safe(label)}</b><span>${safe(note)}</span></div>
      </div>
    </div>
    <div class="recognition-log-status">⭐ +${points} peace points</div>
  </article>`;
}

function openRecognitionHistory() {
  const recognitions = completedRecognitionHistory();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop journal-backdrop';
  modal.innerHTML = `<div class="modal journal-browser recognition-log-modal">
    <button class="modal-close" aria-label="Close">×</button>
    <p class="eyebrow">RECOGNITION LOG</p>
    <h2>Good things noticed</h2>
    <p class="journal-intro">Every recognition is kept here as a reminder of the positive things your family members have done. Each recognition contributes rehabilitation credit to Peace Score, subject to the 100-point cap.</p>
    <div class="recognition-log-list">${recognitions.length ? recognitions.map(recognition => recognitionLogRow(recognition)).join('') : '<div class="empty-state">No recognitions recorded yet.</div>'}</div>
  </div>`;
  document.body.append(modal);
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = event => { if (event.target === modal) modal.remove(); };
}

function renderRecognitionLogUI() {
  if (typeof state === 'undefined' || !state.onboardingComplete) return;

  const recognitions = completedRecognitionHistory();
  let section = document.querySelector('#recognitionLogSection');

  if (!recognitions.length) {
    section?.remove();
    return;
  }

  const simmerHistorySection = document.querySelector('#simmerHistorySection');
  const simmerLaunchSection = document.querySelector('#simmerLaunchSection');
  const anchor = simmerHistorySection || simmerLaunchSection;
  if (!anchor) return;

  if (!section) {
    section = document.createElement('section');
    section.id = 'recognitionLogSection';
    section.className = 'recognition-log-section';
    anchor.insertAdjacentElement('afterend', section);
  } else if (section.previousElementSibling !== anchor) {
    anchor.insertAdjacentElement('afterend', section);
  }

  const signature = recognitions.map(r => [r.id, r.personId, r.category || '', r.note || '', r.at || ''].join(':')).join('|');
  if (section.dataset.signature === signature) return;
  section.dataset.signature = signature;

  section.innerHTML = `<div class="recognition-log-heading">
      <div><p class="eyebrow">RECOGNITION LOG</p><h3>${recognitions.length} recognition${recognitions.length === 1 ? '' : 's'} recorded</h3></div>
      <button type="button" class="text-btn" id="viewRecognitionHistory">View all</button>
    </div>
    <div class="recognition-log-list dashboard">${recognitions.slice(0, 2).map(recognition => recognitionLogRow(recognition, true)).join('')}</div>`;

  section.querySelector('#viewRecognitionHistory').onclick = openRecognitionHistory;
}

const recognitionLogStyle = document.createElement('style');
recognitionLogStyle.textContent = `
.recognition-log-section{margin:-14px 0 34px}.recognition-log-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:0 2px 10px}.recognition-log-heading h3{margin:0;font-size:18px;letter-spacing:-.025em}.recognition-log-heading .eyebrow{margin-bottom:3px}.recognition-log-list{display:grid;gap:8px}.recognition-log-row{background:var(--card);border:1px solid var(--line);border-radius:17px;padding:13px}.recognition-log-main{display:flex;align-items:center;gap:11px;min-width:0}.recognition-log-avatar{flex:0 0 auto}.recognition-log-avatar>span{width:40px;height:40px;border-radius:50%;background:#fff5c9;display:grid;place-items:center}.recognition-log-copy{min-width:0;flex:1}.recognition-log-title{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.recognition-log-title strong{font-size:14px}.recognition-log-title span{font-size:10px;color:var(--muted);white-space:nowrap}.recognition-log-detail{font-size:11px;color:var(--muted);margin-top:3px;display:flex;gap:5px;min-width:0}.recognition-log-detail b{color:var(--ink);font-weight:800;white-space:nowrap}.recognition-log-detail span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.recognition-log-status{display:inline-flex;align-items:center;margin:10px 0 0 51px;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:850;background:#fff4bd;color:#725d10}.recognition-log-modal .recognition-log-row{background:#fff}.recognition-log-modal .recognition-log-list{margin-top:18px}.recognition-log-modal .recognition-log-detail span{white-space:normal;overflow:visible;text-overflow:clip}@media(max-width:520px){.recognition-log-section{margin-top:-14px}.recognition-log-title{display:block}.recognition-log-title span{display:block;margin-top:1px}.recognition-log-status{margin-left:51px}.recognition-log-detail{display:block}.recognition-log-detail b{display:block;margin-bottom:1px}}
`;
document.head.appendChild(recognitionLogStyle);

// render() replaces the direct child of #app. Observing only that level avoids
// feedback loops when this module inserts its own section inside .app-shell.
const recognitionLogObserver = new MutationObserver(() => queueMicrotask(renderRecognitionLogUI));
recognitionLogObserver.observe(document.querySelector('#app'), { childList:true, subtree:false });
renderRecognitionLogUI();
