// DSWF positive reinforcement + relationship profiles.
// Keeps a visible record of good moments alongside streaks, fights, and reflections.

if (!Array.isArray(state.recognitions)) {
  state.recognitions = [];
  saveState();
}

const RECOGNITION_CATEGORIES = [
  ['👂','Great Listening'],
  ['💛','Kindness'],
  ['🤝','Helped Out'],
  ['🧠','Good Choice'],
  ['🧘','Self-Control'],
  ['💪','Kept Trying'],
  ['🌟','Something Else']
];

const PERSON_PEACE_BADGES = [
  [1,'🌤️','First Day'],
  [3,'✨','Good Start'],
  [7,'🧊','Cool Head'],
  [10,'🙌','Double Digits'],
  [14,'🤝','Diplomat'],
  [21,'🌿','Three Weeks'],
  [30,'🕊️','Peacemaker']
];

const RECOGNITION_BADGES = [
  [1,'⭐','Bright Start'],
  [5,'🙌','High Five'],
  [10,'💛','Ten Good Things'],
  [25,'🌟','Bright Spot'],
  [50,'🏆','Good Stuff Legend']
];

function recognitionsFor(personId) {
  return [...state.recognitions]
    .filter(r => r.personId === personId)
    .sort((a,b) => b.at - a.at);
}

function recognitionCategory(key) {
  return RECOGNITION_CATEGORIES.find(([,label]) => label === key) || ['⭐', key || 'Recognition'];
}

function formatProfileDate(value, withTime=false) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    month:'short', day:'numeric', year:'numeric',
    ...(withTime ? {hour:'numeric',minute:'2-digit'} : {})
  });
}

function personPeaceBadgeHistory(person) {
  const intervals = (person.completedStreaks || []).map(s => ({
    start:s.startedAt,
    end:s.endedAt || (s.startedAt + (s.durationMs || 0))
  }));
  if (person.startedAt) intervals.push({start:person.startedAt,end:now()});

  return PERSON_PEACE_BADGES.map(([days,emoji,name]) => {
    const reached = intervals
      .map(i => i.start + days * DAY)
      .filter(at => Number.isFinite(at) && intervals.some(i => i.start + days * DAY === at && at <= i.end))
      .sort((a,b) => a-b)[0];
    return reached ? {kind:'Peace badge',days,emoji,name,earnedAt:reached} : null;
  }).filter(Boolean);
}

function recognitionBadgeHistory(personId) {
  const rows = recognitionsFor(personId).sort((a,b) => a.at - b.at);
  return RECOGNITION_BADGES.map(([count,emoji,name]) => rows.length >= count ? {
    kind:'Recognition badge',count,emoji,name,earnedAt:rows[count-1].at
  } : null).filter(Boolean);
}

function personBadgeHistory(person) {
  return [...personPeaceBadgeHistory(person), ...recognitionBadgeHistory(person.id)]
    .sort((a,b) => b.earnedAt - a.earnedAt);
}

function topRecognitionCategories(personId) {
  const counts = {};
  recognitionsFor(personId).forEach(r => counts[r.category] = (counts[r.category] || 0) + 1);
  return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,4);
}

function closePersonProfile() {
  document.querySelector('#personProfilePage')?.remove();
}

function openPersonProfile(personId) {
  const person = state.people.find(p => p.id === personId);
  if (!person) return;
  closePersonProfile();

  const rows = recognitionsFor(personId);
  const badges = personBadgeHistory(person);
  const categories = topRecognitionCategories(personId);
  const current = streakFor(person);
  const [levelName,levelEmoji] = level(currentDays(person));

  const page = document.createElement('div');
  page.id = 'personProfilePage';
  page.className = 'person-profile-backdrop';
  page.innerHTML = `<article class="person-profile-page">
    <header class="profile-nav"><button class="profile-back" id="closePersonProfile" aria-label="Back">←</button><span>RELATIONSHIP PROFILE</span><button class="profile-edit" id="editProfilePerson">Edit</button></header>
    <section class="profile-hero">
      ${avatar(person,'xl')}
      <div><h1>${escapeHtml(person.name)}</h1><p>${levelEmoji} ${escapeHtml(levelName)}</p></div>
    </section>
    <section class="profile-stats">
      <div><strong>${current ? current.days : 0}</strong><span>current streak</span></div>
      <div><strong>${bestDays(person)}</strong><span>best streak</span></div>
      <div><strong>${rows.length}</strong><span>good things logged</span></div>
    </section>
    <button class="profile-recognize-hero" id="profileGiveRecognition"><span>⭐</span><span><strong>Give recognition</strong><small>Record something good you noticed</small></span><b>＋</b></button>

    <section class="profile-section">
      <div class="profile-section-heading"><div><p class="eyebrow">THE GOOD STUFF</p><h2>What you've noticed.</h2></div></div>
      ${categories.length ? `<div class="positive-summary">${categories.map(([label,count]) => { const [emoji] = recognitionCategory(label); return `<span>${emoji} ${escapeHtml(label)} <b>${count}</b></span>`; }).join('')}</div>` : ''}
      <div class="recognition-timeline">
        ${rows.length ? rows.map(r => { const [emoji,label] = recognitionCategory(r.category); return `<article class="recognition-entry" data-recognition-id="${r.id}"><div class="recognition-icon">${emoji}</div><div><strong>${escapeHtml(label)}</strong><small>${formatProfileDate(r.at,true)}</small>${r.note ? `<p>${escapeHtml(r.note)}</p>` : ''}</div><button class="recognition-delete" data-delete-recognition="${r.id}" aria-label="Delete recognition">×</button></article>`; }).join('') : `<div class="positive-empty"><span>💛</span><strong>No good moments logged yet.</strong><p>When you notice ${escapeHtml(person.name)} doing something worth remembering, record it here.</p></div>`}
      </div>
    </section>

    <section class="profile-section">
      <div class="profile-section-heading"><div><p class="eyebrow">BADGE HISTORY</p><h2>Earned along the way.</h2></div></div>
      <div class="profile-badges">
        ${badges.length ? badges.map(b => `<div class="profile-badge-row"><span>${b.emoji}</span><div><strong>${escapeHtml(b.name)}</strong><small>${escapeHtml(b.kind)} · earned ${formatProfileDate(b.earnedAt)}</small></div></div>`).join('') : `<div class="positive-empty compact"><span>🏅</span><p>Peace-streak and recognition badges will be logged here as they are earned.</p></div>`}
      </div>
    </section>
  </article>`;
  document.body.append(page);

  page.querySelector('#closePersonProfile').onclick = closePersonProfile;
  page.querySelector('#profileGiveRecognition').onclick = () => openRecognitionModal(person.id);
  page.querySelector('#editProfilePerson').onclick = () => { closePersonProfile(); editPerson(person.id); };
  page.querySelectorAll('[data-delete-recognition]').forEach(btn => btn.onclick = () => {
    const recognition = state.recognitions.find(r => r.id === btn.dataset.deleteRecognition);
    if (!recognition) return;
    if (!confirm('Delete this positive recognition?')) return;
    state.recognitions = state.recognitions.filter(r => r.id !== recognition.id);
    saveState();
    openPersonProfile(person.id);
    decoratePositiveProfiles();
    toast('Recognition deleted.');
  });
}

function openRecognitionModal(personId) {
  const person = state.people.find(p => p.id === personId);
  if (!person) return;
  document.querySelector('#recognitionModal')?.remove();

  let selected = '';
  const modal = document.createElement('div');
  modal.id = 'recognitionModal';
  modal.className = 'modal-backdrop positive-modal-backdrop';
  modal.innerHTML = `<div class="modal positive-recognition-modal">
    <button class="modal-close" aria-label="Close">×</button>
    <div class="positive-modal-person">${avatar(person,'lg')}<div><p class="eyebrow">POSITIVE REINFORCEMENT</p><h2>What did ${escapeHtml(person.name)} do well?</h2></div></div>
    <p class="positive-modal-intro">Notice it. Name it. Keep a record of the good stuff, too.</p>
    <div class="recognition-choices">${RECOGNITION_CATEGORIES.map(([emoji,label]) => `<button type="button" data-recognition-category="${escapeHtml(label)}"><span>${emoji}</span><strong>${escapeHtml(label)}</strong></button>`).join('')}</div>
    <label class="field-label positive-note-label">What happened? <small>Optional</small><textarea id="recognitionNote" maxlength="300" placeholder="Example: Put the tablet down the first time I asked and came to dinner without arguing."></textarea></label>
    <div class="modal-actions"><button class="btn btn-ghost" id="cancelRecognition">Cancel</button><button class="btn btn-primary" id="saveRecognition" disabled>Save recognition ⭐</button></div>
  </div>`;
  document.body.append(modal);

  const saveButton = modal.querySelector('#saveRecognition');
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.querySelector('#cancelRecognition').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  modal.querySelectorAll('[data-recognition-category]').forEach(btn => btn.onclick = () => {
    selected = btn.dataset.recognitionCategory;
    modal.querySelectorAll('[data-recognition-category]').forEach(x => x.classList.toggle('selected',x === btn));
    saveButton.disabled = false;
  });
  saveButton.onclick = () => {
    if (!selected) return;
    const before = recognitionsFor(person.id).length;
    const note = modal.querySelector('#recognitionNote').value.trim();
    state.recognitions.push({id:id(),personId:person.id,category:selected,note,at:now()});
    saveState();
    modal.remove();
    const after = before + 1;
    const earned = RECOGNITION_BADGES.find(([count]) => count === after);
    if (document.querySelector('#personProfilePage')) openPersonProfile(person.id);
    decoratePositiveProfiles();
    if (earned) toast(`${person.name} earned the ${earned[2]} badge! ${earned[1]}`);
    else toast(`Good thing logged for ${person.name}. ⭐`);
  };
}

function decoratePositiveProfiles() {
  if (!state.onboardingComplete) return;
  document.querySelectorAll('.person-card').forEach(card => {
    const personId = card.querySelector('[data-edit]')?.dataset.edit || card.querySelector('[data-fight]')?.dataset.fight || card.querySelector('[data-start]')?.dataset.start;
    if (!personId) return;
    const person = state.people.find(p => p.id === personId);
    if (!person) return;
    const count = recognitionsFor(personId).length;

    let actions = card.querySelector('.positive-card-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'positive-card-actions';
      const primary = card.querySelector('[data-fight],[data-start]');
      primary?.insertAdjacentElement('beforebegin',actions);
    }
    const signature = `${personId}|${count}`;
    if (actions.dataset.signature !== signature) {
      actions.dataset.signature = signature;
      actions.innerHTML = `<button type="button" class="positive-quick" data-positive-recognize="${personId}">⭐ Recognize</button><button type="button" class="profile-quick" data-open-profile="${personId}">Profile${count ? ` · ${count} good` : ''} →</button>`;
      actions.querySelector('[data-positive-recognize]').onclick = () => openRecognitionModal(personId);
      actions.querySelector('[data-open-profile]').onclick = () => openPersonProfile(personId);
    }

    const identity = card.querySelector('.person-id');
    if (identity && !identity.dataset.profileBound) {
      identity.dataset.profileBound = '1';
      identity.classList.add('person-id-profile-link');
      identity.setAttribute('role','button');
      identity.setAttribute('tabindex','0');
      identity.setAttribute('aria-label',`Open ${person.name} profile`);
      identity.onclick = () => openPersonProfile(personId);
      identity.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPersonProfile(personId); } };
    }
  });
}

const positiveStyle = document.createElement('style');
positiveStyle.textContent = `
.positive-card-actions{display:flex;gap:8px;margin:12px 0}.positive-card-actions button{flex:1;border:1px solid var(--line);background:#fffdf7;border-radius:12px;padding:10px 8px;font-size:11px;font-weight:850;color:var(--ink)}.positive-card-actions .positive-quick{background:#fff8dc;border-color:#ead991}.person-id-profile-link{cursor:pointer}.person-id-profile-link:hover h3{text-decoration:underline;text-underline-offset:3px}
.person-profile-backdrop{position:fixed;inset:0;z-index:9500;background:rgba(20,18,15,.55);backdrop-filter:blur(7px);overflow:auto}.person-profile-page{width:min(720px,100%);min-height:100%;margin:0 auto;background:var(--paper);padding:0 22px 54px;box-shadow:0 0 80px rgba(0,0,0,.24)}.profile-nav{position:sticky;top:0;z-index:2;display:grid;grid-template-columns:44px 1fr 54px;align-items:center;height:64px;background:rgba(244,241,233,.94);backdrop-filter:blur(12px);border-bottom:1px solid var(--line);font-size:10px;font-weight:950;letter-spacing:.12em}.profile-nav span{text-align:center}.profile-back,.profile-edit{border:0;background:transparent;font:inherit;color:var(--ink);padding:10px}.profile-back{font-size:22px;text-align:left}.profile-edit{font-size:11px;text-align:right;color:var(--accent-dark)}.profile-hero{display:flex;align-items:center;gap:18px;padding:28px 4px 20px}.profile-hero h1{font-size:38px;line-height:1;margin:0 0 7px}.profile-hero p{margin:0;color:var(--muted);font-weight:800}.profile-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:0 0 18px}.profile-stats div{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 10px;text-align:center}.profile-stats strong{display:block;font-size:24px}.profile-stats span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:850}.profile-recognize-hero{width:100%;border:0;border-radius:18px;padding:15px 16px;background:#fff1b8;color:var(--ink);display:flex;align-items:center;gap:12px;text-align:left;box-shadow:0 7px 18px rgba(87,67,10,.08)}.profile-recognize-hero>span:first-child{font-size:28px}.profile-recognize-hero>span:nth-child(2){flex:1}.profile-recognize-hero strong,.profile-recognize-hero small{display:block}.profile-recognize-hero small{margin-top:2px;color:#74652d}.profile-recognize-hero b{font-size:22px}.profile-section{padding:34px 0 0}.profile-section-heading h2{margin:3px 0 16px;font-size:28px}.positive-summary{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 13px}.positive-summary span{border:1px solid #e6dcae;background:#fff9df;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:750}.positive-summary b{margin-left:3px}.recognition-timeline{display:grid;gap:9px}.recognition-entry{display:grid;grid-template-columns:42px 1fr 28px;gap:10px;align-items:start;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:12px}.recognition-icon{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#fff5c9;font-size:21px}.recognition-entry strong,.recognition-entry small{display:block}.recognition-entry small{font-size:10px;color:var(--muted);margin-top:1px}.recognition-entry p{margin:7px 0 0;color:var(--ink);font-size:13px;line-height:1.4}.recognition-delete{border:0;background:transparent;color:#aaa;font-size:19px}.positive-empty{background:var(--card);border:1px dashed var(--line);border-radius:18px;padding:24px;text-align:center;color:var(--muted)}.positive-empty>span{font-size:34px}.positive-empty strong{display:block;color:var(--ink);margin:5px 0}.positive-empty p{margin:3px 0}.positive-empty.compact{padding:18px}.profile-badges{display:grid;gap:9px}.profile-badge-row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:15px;padding:12px 14px}.profile-badge-row>span{font-size:28px}.profile-badge-row strong,.profile-badge-row small{display:block}.profile-badge-row small{font-size:10px;color:var(--muted);margin-top:2px}.positive-modal-person{display:flex;align-items:center;gap:13px;text-align:left}.positive-modal-person h2{font-size:24px;margin:3px 0 0}.positive-modal-person .eyebrow{margin:0}.positive-modal-intro{text-align:left;color:var(--muted);margin:15px 0}.recognition-choices{display:grid;grid-template-columns:1fr 1fr;gap:9px}.recognition-choices button{border:1px solid var(--line);background:#fff;border-radius:14px;padding:13px 10px;display:flex;align-items:center;gap:8px;text-align:left;color:var(--ink)}.recognition-choices button span{font-size:21px}.recognition-choices button strong{font-size:12px}.recognition-choices button.selected{border-color:#caa635;background:#fff4bd;box-shadow:0 0 0 1px #caa635 inset}.positive-note-label{margin-top:16px;text-align:left}.positive-note-label small{font-weight:500;color:var(--muted)}.positive-note-label textarea{width:100%;min-height:88px;margin-top:6px;resize:vertical;border:1px solid var(--line);border-radius:12px;padding:11px;font:inherit;background:#fff}.positive-recognition-modal .modal-actions{margin-top:14px}
@media(max-width:520px){.person-profile-page{padding-left:16px;padding-right:16px}.profile-hero h1{font-size:32px}.profile-stats strong{font-size:21px}.profile-stats span{font-size:8px}.recognition-choices{grid-template-columns:1fr}.positive-card-actions{gap:6px}.positive-card-actions button{font-size:10px}}
`;
document.head.appendChild(positiveStyle);

const positiveObserver = new MutationObserver(decoratePositiveProfiles);
positiveObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
decoratePositiveProfiles();