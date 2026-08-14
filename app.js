const STORAGE_KEY = 'dswf:v1';
const DAY = 86400000;

const defaultState = {
  version: 1,
  onboardingComplete: false,
  people: [],
  events: [],
  lastUndo: null,
  settings: { confetti: true }
};

let state = loadState();
let deferredInstallPrompt = null;

function loadState() {
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function id() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function now() { return Date.now(); }

function elapsed(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

function streakFor(person) {
  if (!person.startedAt) return null;
  return elapsed(now() - person.startedAt);
}

function bestDays(person) {
  const current = person.startedAt ? (now() - person.startedAt) / DAY : 0;
  const recorded = (person.completedStreaks || []).map(s => s.durationMs / DAY);
  return Math.floor(Math.max(current, ...recorded, 0));
}

function currentDays(person) {
  return person.startedAt ? Math.floor((now() - person.startedAt) / DAY) : 0;
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') || '?';
}

function escapeHtml(value='') {
  return value.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function avatar(person, size='lg') {
  if (person.photo) return `<img class="avatar ${size}" src="${person.photo}" alt="${escapeHtml(person.name)}" />`;
  return `<div class="avatar ${size} avatar-fallback" aria-hidden="true">${escapeHtml(initials(person.name))}</div>`;
}

function milestone(days) {
  const marks = [1, 3, 7, 14, 30, 60, 90, 180, 365];
  const next = marks.find(m => m > days);
  const achieved = [...marks].reverse().find(m => m <= days) || 0;
  return { achieved, next };
}

function level(days) {
  if (days >= 365) return ['Legendary', '👑'];
  if (days >= 90) return ['Zen Master', '🧘'];
  if (days >= 30) return ['Peacemaker', '🕊️'];
  if (days >= 14) return ['Diplomat', '🤝'];
  if (days >= 7) return ['Cool Head', '🧊'];
  if (days >= 3) return ['Good Run', '✨'];
  if (days >= 1) return ['Day Maker', '🌤️'];
  return ['Fresh Start', '🌱'];
}

function render() {
  if (!state.onboardingComplete) return renderOnboarding();
  renderDashboard();
}

function renderOnboarding() {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <section class="onboarding shell">
      <div class="brand-mark">DSWF</div>
      <p class="eyebrow">A tiny family peace game</p>
      <h1>Days Since<br><span>We Fought</span></h1>
      <p class="lede">Build streaks with the people you love. A fight resets the clock—not the relationship.</p>
      <div class="onboarding-card">
        <div class="step-pill">SETUP · 1 MIN</div>
        <h2>Who are you keeping the peace with?</h2>
        <p>Add family members now. You can add or edit them anytime.</p>
        <div id="draftPeople" class="draft-people"></div>
        <button class="btn btn-primary" id="addPersonBtn">＋ Add family member</button>
        <button class="btn btn-ghost" id="finishSetupBtn" disabled>Start the game →</button>
      </div>
      <p class="privacy-note">🔒 Everything stays on this device.</p>
    </section>`;

  const drafts = [];
  const draftEl = document.querySelector('#draftPeople');
  const finish = document.querySelector('#finishSetupBtn');

  const rerenderDrafts = () => {
    draftEl.innerHTML = drafts.map((p, i) => `
      <div class="draft-person">
        ${p.photo ? `<img class="avatar sm" src="${p.photo}" alt="" />` : `<div class="avatar sm avatar-fallback">${escapeHtml(initials(p.name))}</div>`}
        <strong>${escapeHtml(p.name)}</strong>
        <button class="icon-btn" data-remove="${i}" aria-label="Remove ${escapeHtml(p.name)}">×</button>
      </div>`).join('');
    finish.disabled = drafts.length === 0;
    draftEl.querySelectorAll('[data-remove]').forEach(btn => btn.onclick = () => { drafts.splice(+btn.dataset.remove, 1); rerenderDrafts(); });
  };

  document.querySelector('#addPersonBtn').onclick = () => openPersonModal(null, person => { drafts.push(person); rerenderDrafts(); });
  finish.onclick = () => {
    state.people = drafts.map(p => ({ ...p, id: id(), startedAt: null, completedStreaks: [], createdAt: now() }));
    state.onboardingComplete = true;
    saveState();
    render();
  };
}

function renderDashboard() {
  const app = document.querySelector('#app');
  const ranked = [...state.people].sort((a,b) => currentDays(b) - currentDays(a) || (b.startedAt || 0) - (a.startedAt || 0));
  const active = state.people.filter(p => p.startedAt);
  const totalPeaceDays = active.reduce((sum,p) => sum + currentDays(p), 0);
  const best = Math.max(0, ...state.people.map(bestDays));

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">FAMILY PEACE SCOREBOARD</p>
          <h1 class="logo-title">Days Since<br><span>We Fought</span></h1>
        </div>
        <button id="settingsBtn" class="round-btn" aria-label="Settings">⚙</button>
      </header>

      <section class="hero-stats">
        <div><span>${totalPeaceDays}</span><small>combined peace days</small></div>
        <div><span>${best}</span><small>best streak ever</small></div>
      </section>

      <section>
        <div class="section-heading"><div><p class="eyebrow">LIVE STREAKS</p><h2>Keep it going.</h2></div><button class="text-btn" id="addMember">＋ Add</button></div>
        <div class="streak-grid">
          ${ranked.length ? ranked.map((p,i) => personCard(p,i)).join('') : `<div class="empty-state">No family members yet.</div>`}
        </div>
      </section>

      <section class="leaderboard-section">
        <div class="section-heading"><div><p class="eyebrow">LEADERBOARD</p><h2>Peace rankings</h2></div></div>
        <div class="leaderboard">
          ${ranked.map((p,i) => leaderboardRow(p,i)).join('')}
        </div>
      </section>

      <section class="achievements-section">
        <div class="section-heading"><div><p class="eyebrow">TROPHY CASE</p><h2>Milestones</h2></div></div>
        <div class="badges">${achievementBadges()}</div>
      </section>

      <footer>Less scorekeeping. More making up. ♥</footer>
    </div>`;

  document.querySelector('#addMember').onclick = () => openPersonModal(null, person => {
    state.people.push({ ...person, id: id(), startedAt: null, completedStreaks: [], createdAt: now() });
    saveState(); render();
  });
  document.querySelector('#settingsBtn').onclick = openSettings;

  app.querySelectorAll('[data-start]').forEach(btn => btn.onclick = () => startStreak(btn.dataset.start));
  app.querySelectorAll('[data-fight]').forEach(btn => btn.onclick = () => confirmFight(btn.dataset.fight));
  app.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => editPerson(btn.dataset.edit));
}

function personCard(p, rank) {
  const s = streakFor(p);
  const days = currentDays(p);
  const [label, emoji] = level(days);
  const { next } = milestone(days);
  const progress = next ? Math.min(100, (days / next) * 100) : 100;
  return `
    <article class="person-card ${p.startedAt ? 'active' : ''}">
      <div class="card-top">
        <div class="person-id">${avatar(p)}<div><h3>${escapeHtml(p.name)}</h3><span class="level">${emoji} ${label}</span></div></div>
        <button class="icon-btn" data-edit="${p.id}" aria-label="Edit ${escapeHtml(p.name)}">•••</button>
      </div>
      ${p.startedAt ? `
        <div class="timer-block">
          <div class="days-number">${s.days}</div><div class="days-label">${s.days === 1 ? 'DAY' : 'DAYS'}</div>
          <div class="subtimer">${String(s.hours).padStart(2,'0')}h ${String(s.minutes).padStart(2,'0')}m peaceful</div>
        </div>
        <div class="milestone-track"><div class="milestone-fill" style="width:${progress}%"></div></div>
        <div class="milestone-copy">${next ? `${next - days} day${next-days===1?'':'s'} to the ${next}-day badge` : 'Legend status unlocked'}</div>
        <button class="btn fight-btn" data-fight="${p.id}">We fought</button>
      ` : `
        <div class="not-started"><span>🌱</span><h4>Ready for a fresh start?</h4><p>Start the clock whenever you want.</p></div>
        <button class="btn btn-primary" data-start="${p.id}">Start streak</button>
      `}
    </article>`;
}

function leaderboardRow(p, i) {
  const days = currentDays(p);
  const medal = ['🥇','🥈','🥉'][i] || `${i+1}.`;
  return `<div class="leader-row"><span class="rank">${medal}</span>${avatar(p,'sm')}<div class="leader-name"><strong>${escapeHtml(p.name)}</strong><small>Best: ${bestDays(p)} days</small></div><div class="leader-score"><strong>${days}</strong><small>days</small></div></div>`;
}

function achievementBadges() {
  const marks = [
    [1,'🌤️','First Day'],[3,'✨','Three Easy'],[7,'🧊','Cool Head'],[14,'🤝','Diplomat'],[30,'🕊️','Peacemaker'],[90,'🧘','Zen Master'],[365,'👑','Legend']
  ];
  const best = Math.max(0,...state.people.map(bestDays));
  return marks.map(([d,e,n]) => `<div class="badge ${best>=d?'earned':'locked'}"><span>${best>=d?e:'🔒'}</span><strong>${n}</strong><small>${d} day${d===1?'':'s'}</small></div>`).join('');
}

function startStreak(personId) {
  const p = state.people.find(x => x.id === personId);
  if (!p) return;
  p.startedAt = now();
  state.events.unshift({ id:id(), personId, type:'start', at:now() });
  saveState(); render();
  toast(`${p.name}'s peace clock is running. 🌱`);
}

function confirmFight(personId) {
  const p = state.people.find(x => x.id === personId);
  if (!p || !p.startedAt) return;
  const s = streakFor(p);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal confirm-modal"><div class="big-emoji">💥</div><h2>Reset ${escapeHtml(p.name)}'s streak?</h2><p>You made it <strong>${s.days}d ${s.hours}h ${s.minutes}m</strong>. The streak resets, but the progress still counts.</p><div class="modal-actions"><button class="btn btn-ghost" id="cancelFight">Never mind</button><button class="btn fight-btn" id="confirmFight">Yes, we fought</button></div></div>`;
  document.body.append(modal);
  modal.querySelector('#cancelFight').onclick = () => modal.remove();
  modal.querySelector('#confirmFight').onclick = () => { modal.remove(); resetStreak(p); };
}

function resetStreak(p) {
  const previousStartedAt = p.startedAt;
  const durationMs = now() - previousStartedAt;
  const event = { id:id(), personId:p.id, type:'fight', at:now(), previousStartedAt, durationMs };
  p.completedStreaks = [...(p.completedStreaks || []), { startedAt: previousStartedAt, endedAt: event.at, durationMs }];
  p.startedAt = now();
  state.events.unshift(event);
  state.lastUndo = { personId:p.id, eventId:event.id, previousStartedAt, expiresAt: now()+10000 };
  saveState(); render();
  toast(`Fresh start with ${p.name}.`, true);
}

function undoFight() {
  const u = state.lastUndo;
  if (!u || now() > u.expiresAt) return;
  const p = state.people.find(x => x.id === u.personId);
  if (!p) return;
  p.startedAt = u.previousStartedAt;
  const idx = (p.completedStreaks || []).findIndex(s => s.startedAt === u.previousStartedAt);
  if (idx >= 0) p.completedStreaks.splice(idx,1);
  state.events = state.events.filter(e => e.id !== u.eventId);
  state.lastUndo = null;
  saveState(); render(); toast('Reset undone.');
}

function editPerson(personId) {
  const p = state.people.find(x => x.id === personId);
  if (!p) return;
  openPersonModal(p, updated => {
    p.name = updated.name; p.photo = updated.photo;
    saveState(); render();
  }, () => {
    if (!confirm(`Remove ${p.name}? Their streak history will be deleted from this device.`)) return;
    state.people = state.people.filter(x => x.id !== p.id);
    state.events = state.events.filter(e => e.personId !== p.id);
    saveState(); render();
  });
}

function openPersonModal(existing, onSave, onDelete) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `<div class="modal"><button class="modal-close" aria-label="Close">×</button><p class="eyebrow">${existing?'EDIT':'NEW'} FAMILY MEMBER</p><h2>${existing?'Update profile':'Add someone you love'}</h2><div class="photo-picker"><div id="photoPreview">${existing?avatar(existing):'<div class="avatar xl avatar-fallback">+</div>'}</div><label class="btn btn-ghost file-btn">Choose photo<input id="photoInput" type="file" accept="image/*" /></label></div><label class="field-label">Name<input id="nameInput" maxlength="40" placeholder="e.g. Melissa" value="${existing?escapeHtml(existing.name):''}" /></label><div class="modal-actions">${existing?'<button class="btn danger-text" id="deletePerson">Remove</button>':''}<button class="btn btn-primary" id="savePerson">${existing?'Save changes':'Add person'}</button></div></div>`;
  document.body.append(modal);
  const input = modal.querySelector('#nameInput');
  const photoInput = modal.querySelector('#photoInput');
  let photo = existing?.photo || '';
  input.focus();
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  photoInput.onchange = async () => {
    const file = photoInput.files?.[0]; if (!file) return;
    photo = await compressImage(file);
    modal.querySelector('#photoPreview').innerHTML = `<img class="avatar xl" src="${photo}" alt="Preview" />`;
  };
  modal.querySelector('#savePerson').onclick = () => {
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    onSave({ name, photo }); modal.remove();
  };
  if (existing) modal.querySelector('#deletePerson').onclick = () => { modal.remove(); onDelete?.(); };
}

function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 320; canvas.width=size; canvas.height=size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size/img.width,size/img.height);
        const w=img.width*scale,h=img.height*scale;
        ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
        resolve(canvas.toDataURL('image/jpeg',.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openSettings() {
  const modal = document.createElement('div');
  modal.className='modal-backdrop';
  modal.innerHTML=`<div class="modal"><button class="modal-close">×</button><p class="eyebrow">SETTINGS</p><h2>Game controls</h2><button class="setting-row" id="installApp"><span><strong>Install app</strong><small>Add DSWF to your home screen</small></span><b>→</b></button><button class="setting-row" id="exportData"><span><strong>Export backup</strong><small>Download your local streak data</small></span><b>↓</b></button><button class="setting-row danger-row" id="resetAll"><span><strong>Reset everything</strong><small>Erase all family members and history</small></span><b>×</b></button></div>`;
  document.body.append(modal);
  modal.querySelector('.modal-close').onclick=()=>modal.remove();
  modal.querySelector('#installApp').onclick=async()=>{
    if(deferredInstallPrompt){ deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt=null; }
    else toast('Use your browser menu → “Add to Home screen” or “Install app”.');
  };
  modal.querySelector('#exportData').onclick=()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`days-since-we-fought-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);
  };
  modal.querySelector('#resetAll').onclick=()=>{
    if(!confirm('Erase every family member, streak, and fight record on this device?')) return;
    localStorage.removeItem(STORAGE_KEY); state=structuredClone(defaultState); modal.remove(); render();
  };
}

function toast(message, withUndo=false) {
  const el=document.querySelector('#toast');
  el.innerHTML=`<span>${escapeHtml(message)}</span>${withUndo?'<button id="undoBtn">Undo</button>':''}`;
  el.classList.add('show');
  if(withUndo) el.querySelector('#undoBtn').onclick=()=>{undoFight(); el.classList.remove('show');};
  clearTimeout(toast._timer); toast._timer=setTimeout(()=>el.classList.remove('show'), withUndo?10000:3500);
}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
setInterval(()=>{ if(state.onboardingComplete && document.visibilityState==='visible') render(); },60000);
render();
