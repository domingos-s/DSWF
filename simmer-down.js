const SIMMER_KEY = 'dswf-simmer-down-v1';
const SIMMER_CHECKIN_DELAY = 20 * 60 * 1000;
const SIMMER_LINK_WINDOW = 45 * 60 * 1000;
const simmerTriggers = ['Not listening','Respect / tone','Stress','Unfairness','Mess / chores','Money','Parenting','Other'];
const simmerMoves = [
  ['🎯','Say it calmly'],['⏸️','Take 10 minutes'],['🤷','Let this one go'],['❤️','Assume good intent']
];
const simmerScripts = {
  'Say it calmly': 'I want to talk about this without making it worse. Can I say what’s bothering me calmly?',
  'Take 10 minutes': 'I’m getting worked up. Give me 10 minutes and I’ll come back.',
  'Let this one go': 'This isn’t worth us fighting over. I’m going to let it go.',
  'Assume good intent': 'I know you probably didn’t mean it the way I heard it. Can we reset?'
};
const simmerTriggerInsightMap = {
  'Not listening': 'Feeling ignored',
  'Respect / tone': 'Respect / tone',
  'Stress': 'Work / stress',
  'Unfairness': 'Other',
  'Mess / chores': 'Chores / responsibilities',
  'Money': 'Money',
  'Parenting': 'Parenting',
  'Other': 'Other'
};
let simmerSession = null;
let simmerCountdownTimer = null;

function simmerId() {
  return crypto.randomUUID?.() || `simmer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function simmerHistory() {
  try { return JSON.parse(localStorage.getItem(SIMMER_KEY) || '[]'); }
  catch { return []; }
}
function writeSimmerHistory(history) {
  localStorage.setItem(SIMMER_KEY, JSON.stringify(history));
}
function upsertSimmer(entry) {
  const history = simmerHistory();
  const index = history.findIndex(x => x.id && x.id === entry.id);
  if (index >= 0) history[index] = { ...history[index], ...entry };
  else history.push(entry);
  writeSimmerHistory(history);
  return entry;
}
function updateSimmer(id, patch) {
  const history = simmerHistory();
  const index = history.findIndex(x => x.id === id);
  if (index < 0) return null;
  history[index] = { ...history[index], ...patch };
  writeSimmerHistory(history);
  return history[index];
}
function simmerStats() {
  const history = simmerHistory();
  const completed = history.filter(x => x.completed);
  const outcomes = completed.filter(x => x.outcome);
  const firesPutOut = outcomes.filter(x => x.outcome === 'cooled').length;
  const fightsAvoided = outcomes.filter(x => x.outcome === 'cooled' || x.outcome === 'tense').length;
  return { attempts: history.length, completed: completed.length, outcomes: outcomes.length, firesPutOut, fightsAvoided };
}
function simmerPerson(session) {
  return state.people.find(p => p.id === session?.personId);
}
function pendingSimmerCheckIns() {
  const current = Date.now();
  return simmerHistory()
    .filter(x => x.completed && !x.outcome && x.checkInAt && x.checkInAt <= current)
    .sort((a,b) => a.checkInAt - b.checkInAt);
}
function activeSimmerPause() {
  const current = Date.now();
  return simmerHistory()
    .filter(x => x.completed && !x.outcome && x.pauseUntil && x.pauseUntil > current)
    .sort((a,b) => b.pauseUntil - a.pauseUntil)[0] || null;
}
function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2,'0')}`;
}

function ensureSimmerButton() {
  if (typeof state === 'undefined' || !state.onboardingComplete) return;
  const hero = document.querySelector('.hero-stats');
  if (!hero) return;
  let box = document.querySelector('#simmerLaunchSection');
  if (!box) {
    box = document.createElement('section');
    box.id = 'simmerLaunchSection';
    box.className = 'simmer-launch';
    hero.insertAdjacentElement('afterend', box);
  }
  refreshSimmerLaunch(box);
}

function refreshSimmerLaunch(box = document.querySelector('#simmerLaunchSection')) {
  if (!box) return;
  const stats = simmerStats();
  const pending = pendingSimmerCheckIns()[0] || null;
  const pause = activeSimmerPause();
  const pausePerson = pause ? simmerPerson(pause) : null;
  const pendingPerson = pending ? simmerPerson(pending) : null;
  const signature = [stats.firesPutOut, stats.fightsAvoided, pending?.id || '', pause?.id || '', pause ? Math.ceil((pause.pauseUntil-Date.now())/60000) : 0].join('|');
  if (box.dataset.signature === signature) return;
  box.dataset.signature = signature;
  box.innerHTML = `
    <button id="simmerDownLaunch" class="simmer-launch-btn">
      <span class="simmer-fire">🔥</span>
      <span><strong>I’m getting heated</strong><small>Play Simmer Down before things boil over</small></span>
      <span class="simmer-arrow">→</span>
    </button>
    <div class="simmer-stats"><span>🧯 <strong>${stats.firesPutOut}</strong> Fires Put Out</span><span>🕊️ <strong>${stats.fightsAvoided}</strong> fights avoided</span></div>
    ${pending ? `<button class="simmer-checkin-callout" id="simmerCheckIn"><span>🚒</span><span><strong>How did it go${pendingPerson ? ` with ${escapeHtml(pendingPerson.name)}` : ''}?</strong><small>Your Simmer Down check-in is ready.</small></span><b>→</b></button>` : ''}
    ${pause ? `<button class="simmer-pause-resume" id="resumeSimmerPause">⏸️ ${pausePerson ? `${escapeHtml(pausePerson.name)} · ` : ''}${Math.max(1,Math.ceil((pause.pauseUntil-Date.now())/60000))}m pause remaining · Resume timer</button>` : ''}`;
  box.querySelector('#simmerDownLaunch').onclick = openSimmerDown;
  box.querySelector('#simmerCheckIn')?.addEventListener('click', () => openSimmerCheckIn(pending.id));
  box.querySelector('#resumeSimmerPause')?.addEventListener('click', () => resumeSimmerPause(pause.id));
}

function closeSimmerOverlay() {
  if (simmerCountdownTimer) clearInterval(simmerCountdownTimer);
  simmerCountdownTimer = null;
  document.querySelector('#simmerOverlay')?.remove();
  ensureSimmerButton();
}
function createSimmerOverlay() {
  document.querySelector('#simmerOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.className = 'simmer-overlay';
  overlay.id = 'simmerOverlay';
  overlay.innerHTML = `<div class="simmer-card"><button class="simmer-close" aria-label="Close">×</button><div id="simmerStage"></div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.simmer-close').onclick = closeSimmerOverlay;
  return overlay;
}

function openSimmerDown() {
  if (!state.people.length) { toast('Add a family member first.'); return; }
  simmerSession = { id: simmerId(), startedAt: Date.now(), personId: null, trigger: null, move: null };
  createSimmerOverlay();
  renderPersonStage();
}

function renderPersonStage() {
  const stage = document.querySelector('#simmerStage'); if (!stage) return;
  stage.innerHTML = `<div class="simmer-kicker">SIMMER DOWN</div><div class="simmer-emoji">🔥</div><h2>Who are you getting heated with?</h2><p>Pick the relationship so DSWF can learn what actually helps.</p><div class="simmer-people">${state.people.map(p => `<button data-simmer-person="${p.id}">${avatar(p,'sm')}<strong>${escapeHtml(p.name)}</strong><span>→</span></button>`).join('')}</div>`;
  stage.querySelectorAll('[data-simmer-person]').forEach(btn => btn.onclick = () => {
    simmerSession.personId = btn.dataset.simmerPerson;
    renderCoolStage();
  });
}

function renderCoolStage() {
  const stage = document.querySelector('#simmerStage'); if (!stage) return;
  const person = simmerPerson(simmerSession);
  stage.innerHTML = `<div class="simmer-kicker">STEP 1 · COOL THE FIRE${person ? ` · ${escapeHtml(person.name.toUpperCase())}` : ''}</div><div class="simmer-emoji">🔥</div><h2>Don’t solve it yet.</h2><p>Give your body 30 seconds to come down before you decide what to say.</p><div class="temp"><div id="tempFill"></div></div><div class="breath-orb" id="breathOrb"><span id="breathText">Ready?</span></div><button class="btn btn-primary" id="startCooling">Start cooling 🧯</button>`;
  stage.querySelector('#startCooling').onclick = runBreathing;
}

function runBreathing() {
  const sessionId = simmerSession?.id;
  const btn = document.querySelector('#startCooling');
  const text = document.querySelector('#breathText'), orb = document.querySelector('#breathOrb'), fill = document.querySelector('#tempFill');
  if (!btn || !text || !orb || !fill) return;
  btn.disabled = true; btn.textContent = 'Cooling…';
  const phases = [['Breathe in',4000],['Breathe out',6000],['Breathe in',4000],['Breathe out',6000],['Breathe in',4000],['Breathe out',6000]];
  let i = 0;
  function next() {
    if (simmerSession?.id !== sessionId || !document.querySelector('#simmerStage')) return;
    if (i >= phases.length) { fill.style.width = '12%'; text.textContent = 'Cooler.'; setTimeout(renderTriggerStage, 700); return; }
    const [label,dur] = phases[i];
    text.textContent = label;
    orb.classList.toggle('inhale', label.includes('in'));
    orb.classList.toggle('exhale', label.includes('out'));
    fill.style.width = `${Math.max(18,100-((i+1)/phases.length)*82)}%`;
    if (navigator.vibrate) navigator.vibrate(35);
    i++; setTimeout(next,dur);
  }
  next();
}

function renderTriggerStage() {
  const stage = document.querySelector('#simmerStage'); if (!stage) return;
  stage.innerHTML = `<div class="simmer-kicker">STEP 2 · NAME IT</div><div class="simmer-emoji">🧑🏼‍🚒</div><h2>What’s getting under your skin?</h2><p>No essay. Just name the thing.</p><div class="simmer-options">${simmerTriggers.map(x => `<button data-trigger="${x}">${x}</button>`).join('')}</div>`;
  stage.querySelectorAll('[data-trigger]').forEach(btn => btn.onclick = () => { simmerSession.trigger = btn.dataset.trigger; renderMoveStage(); });
}

function renderMoveStage() {
  const stage = document.querySelector('#simmerStage'); if (!stage) return;
  stage.innerHTML = `<div class="simmer-kicker">STEP 3 · CHOOSE YOUR MOVE</div><div class="simmer-emoji">🚒</div><h2>What happens next?</h2><p>Pick the response you want to be proud of later.</p><div class="simmer-moves">${simmerMoves.map(([emoji,text]) => `<button data-move="${text}"><span>${emoji}</span><strong>${text}</strong></button>`).join('')}</div>`;
  stage.querySelectorAll('[data-move]').forEach(btn => btn.onclick = () => selectSimmerMove(btn.dataset.move));
}

function selectSimmerMove(move) {
  simmerSession.move = move;
  simmerSession.completed = true;
  simmerSession.completedAt = Date.now();
  simmerSession.checkInAt = simmerSession.completedAt + SIMMER_CHECKIN_DELAY;
  if (move === 'Take 10 minutes') simmerSession.pauseUntil = Date.now() + 10 * 60 * 1000;
  upsertSimmer(simmerSession);
  if (move === 'Take 10 minutes') renderPauseStage();
  else renderSimmerWin();
  ensureSimmerButton();
}

function renderScriptBox(move) {
  const script = simmerScripts[move] || '';
  if (!script) return '';
  return `<div class="simmer-script"><span>TRY SAYING</span><p>“${escapeHtml(script)}”</p><button type="button" id="copySimmerScript">Copy</button></div>`;
}
function bindScriptCopy(move) {
  const button = document.querySelector('#copySimmerScript');
  if (!button) return;
  button.onclick = async () => {
    try { await navigator.clipboard.writeText(simmerScripts[move]); button.textContent = 'Copied ✓'; }
    catch { button.textContent = 'Use the line above'; }
  };
}

function renderPauseStage() {
  const stage = document.querySelector('#simmerStage'); if (!stage || !simmerSession) return;
  if (simmerCountdownTimer) clearInterval(simmerCountdownTimer);
  stage.innerHTML = `<div class="simmer-kicker">10-MINUTE PAUSE</div><div class="simmer-emoji">⏸️</div><h2>Don’t solve it yet.</h2><div class="simmer-countdown" id="simmerCountdown">10:00</div><p>Put some physical space between you and the argument. Come back when the timer ends.</p>${renderScriptBox('Take 10 minutes')}<button class="btn btn-primary" id="readyEarly">I’m ready to come back calmly</button>`;
  bindScriptCopy('Take 10 minutes');
  const tick = () => {
    const remaining = (simmerSession.pauseUntil || 0) - Date.now();
    const counter = document.querySelector('#simmerCountdown');
    if (counter) counter.textContent = formatRemaining(remaining);
    if (remaining <= 0) {
      if (simmerCountdownTimer) clearInterval(simmerCountdownTimer);
      simmerCountdownTimer = null;
      renderSimmerWin();
    }
  };
  tick(); simmerCountdownTimer = setInterval(tick,1000);
  stage.querySelector('#readyEarly').onclick = () => {
    updateSimmer(simmerSession.id,{pauseUntil:Date.now(),pauseEndedEarly:true});
    simmerSession.pauseUntil = Date.now();
    if (simmerCountdownTimer) clearInterval(simmerCountdownTimer);
    simmerCountdownTimer = null;
    renderSimmerWin();
  };
}

function resumeSimmerPause(sessionId) {
  const session = simmerHistory().find(x => x.id === sessionId);
  if (!session) return;
  simmerSession = session;
  createSimmerOverlay();
  renderPauseStage();
}

function renderSimmerWin() {
  const stage = document.querySelector('#simmerStage'); if (!stage || !simmerSession) return;
  const person = simmerPerson(simmerSession);
  stage.innerHTML = `<div class="simmer-kicker">FIRE CONTAINED FOR NOW</div><div class="simmer-emoji big">🧯</div><h2>You interrupted the spiral.</h2><p><strong>${escapeHtml(simmerSession.move)}</strong> is the move${person ? ` with ${escapeHtml(person.name)}` : ''}. DSWF will ask how it went in about 20 minutes before counting a fire as put out.</p>${renderScriptBox(simmerSession.move)}<div class="simmer-win">🔥 → 💨<small>Check-in scheduled locally</small></div><button class="btn btn-primary" id="doneSimmer">Back to DSWF</button>`;
  bindScriptCopy(simmerSession.move);
  stage.querySelector('#doneSimmer').onclick = closeSimmerOverlay;
}

function openSimmerCheckIn(sessionId) {
  const session = simmerHistory().find(x => x.id === sessionId);
  if (!session || session.outcome) { ensureSimmerButton(); return; }
  simmerSession = session;
  createSimmerOverlay();
  const stage = document.querySelector('#simmerStage');
  const person = simmerPerson(session);
  stage.innerHTML = `<div class="simmer-kicker">OUTCOME CHECK-IN</div><div class="simmer-emoji">🚒</div><h2>How did it go${person ? ` with ${escapeHtml(person.name)}` : ''}?</h2><p>You chose <strong>${escapeHtml(session.move || 'a calmer response')}</strong> after <strong>${escapeHtml(session.trigger || 'getting heated')}</strong>.</p><div class="simmer-outcomes"><button data-outcome="cooled"><span>🧯</span><strong>We cooled down</strong><small>Count this as a Fire Put Out</small></button><button data-outcome="tense"><span>😮‍💨</span><strong>Still tense, but no fight</strong><small>No fight, but not fully cooled off</small></button><button data-outcome="fought"><span>💥</span><strong>We fought</strong><small>Reset the streak and reflect</small></button></div>`;
  stage.querySelectorAll('[data-outcome]').forEach(btn => btn.onclick = () => recordSimmerOutcome(session, btn.dataset.outcome));
}

function recordSimmerOutcome(session, outcome) {
  if (outcome === 'fought') {
    const person = simmerPerson(session);
    closeSimmerOverlay();
    if (person?.startedAt && typeof confirmFight === 'function') confirmFight(person.id);
    else {
      updateSimmer(session.id,{outcome:'fought',outcomeAt:Date.now()});
      toast('Fight outcome recorded.');
      ensureSimmerButton();
    }
    return;
  }
  updateSimmer(session.id,{outcome,outcomeAt:Date.now()});
  const stage = document.querySelector('#simmerStage');
  const stats = simmerStats();
  if (stage) stage.innerHTML = `<div class="simmer-kicker">CHECK-IN SAVED</div><div class="simmer-emoji big">${outcome === 'cooled' ? '🧯' : '😮‍💨'}</div><h2>${outcome === 'cooled' ? 'Fire put out.' : 'You kept it from becoming a fight.'}</h2><p>${outcome === 'cooled' ? `That makes ${stats.firesPutOut} confirmed Fire${stats.firesPutOut===1?'':'s'} Put Out.` : 'It was still tense, so DSWF will count the fight avoided without calling it fully de-escalated.'}</p><button class="btn btn-primary" id="closeOutcome">Back to DSWF</button>`;
  stage?.querySelector('#closeOutcome')?.addEventListener('click', closeSimmerOverlay);
  document.querySelector('#insightsHub')?.remove();
  if (typeof decorateInsightsHub === 'function') decorateInsightsHub();
  ensureSimmerButton();
}

function recentLinkableSimmer(personId) {
  const cutoff = Date.now() - SIMMER_LINK_WINDOW;
  return simmerHistory()
    .filter(x => x.completed && x.personId === personId && x.completedAt >= cutoff && x.outcome !== 'fought')
    .sort((a,b) => b.completedAt - a.completedAt)[0] || null;
}
function prefillJournalFromSimmer(session) {
  setTimeout(() => {
    const modal = [...document.querySelectorAll('.journal-modal')].at(-1);
    if (!modal) return;
    const happened = modal.querySelector('#whatHappened');
    const trigger = modal.querySelector('#trigger');
    if (happened && !happened.value.trim()) happened.value = `Before this fight, I used Simmer Down and chose “${session.move}.”`;
    if (trigger && !trigger.value.trim()) trigger.value = `Simmer Down trigger: ${session.trigger}.`;
    const mapped = simmerTriggerInsightMap[session.trigger];
    if (mapped) {
      const button = [...modal.querySelectorAll('[data-trigger-category]')].find(x => x.dataset.triggerCategory === mapped);
      if (button && !button.classList.contains('selected')) button.click();
    }
    const intro = modal.querySelector('.journal-intro');
    if (intro && !modal.querySelector('.simmer-journal-context')) {
      const note = document.createElement('div');
      note.className = 'reflection-nudge simmer-journal-context';
      note.textContent = `Simmer Down context: ${session.trigger} · ${session.move}`;
      intro.insertAdjacentElement('afterend',note);
    }
  }, 220);
}

if (typeof resetStreak === 'function') {
  const baseResetStreakSimmer = resetStreak;
  resetStreak = function simmerAwareResetStreak(person) {
    const session = recentLinkableSimmer(person.id);
    baseResetStreakSimmer(person);
    if (!session) return;
    const fightEvent = state.events.find(e => e.type === 'fight' && e.personId === person.id);
    updateSimmer(session.id,{outcome:'fought',outcomeAt:fightEvent?.at || Date.now(),linkedFightEventId:fightEvent?.id || null});
    prefillJournalFromSimmer({...session,outcome:'fought',linkedFightEventId:fightEvent?.id || null});
    document.querySelector('#insightsHub')?.remove();
    if (typeof decorateInsightsHub === 'function') decorateInsightsHub();
    ensureSimmerButton();
  };
}

if (typeof deriveInsights === 'function' && typeof makeInsight === 'function') {
  const baseDeriveInsightsSimmer = deriveInsights;
  deriveInsights = function deriveInsightsWithSimmer() {
    const insights = baseDeriveInsightsSimmer();
    const sessions = simmerHistory().filter(x => x.completed && x.personId);
    const outcomes = sessions.filter(x => x.outcome);
    if (outcomes.length >= 3) {
      const avoided = outcomes.filter(x => x.outcome === 'cooled' || x.outcome === 'tense').length;
      const rate = avoided / outcomes.length;
      const insight = makeInsight({
        id:'simmer-household-effectiveness',type:'simmer-effectiveness',scope:'household',
        title:'Simmer Down outcomes',
        body:`${avoided} of ${outcomes.length} checked-in Simmer Down sessions ended without a recorded fight (${Math.round(rate*100)}%).`,
        suggestion:'Keep using Simmer Down early—before the argument has momentum—and favor the responses that work best for you.',
        sampleSize:outcomes.length,observedValue:rate,category:'Trends',priority:91
      });
      insight.simmerSessionIds = outcomes.map(x=>x.id); insights.push(insight);
    }
    const triggerCounts = {};
    sessions.forEach(x => { if (x.trigger) triggerCounts[x.trigger] = (triggerCounts[x.trigger] || 0) + 1; });
    const topTrigger = Object.entries(triggerCounts).sort((a,b)=>b[1]-a[1])[0];
    if (topTrigger && topTrigger[1] >= 3 && topTrigger[1] / sessions.length >= .4) {
      const [trigger,count] = topTrigger;
      const support = sessions.filter(x=>x.trigger===trigger);
      const insight = makeInsight({
        id:`simmer-trigger-${trigger.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,type:'simmer-trigger',scope:'household',
        title:`Early-warning trigger: ${trigger}`,body:`“${trigger}” was selected in ${count} of ${sessions.length} Simmer Down sessions.`,
        suggestion:'Treat this as a cue to slow down sooner rather than as proof about who is right.',sampleSize:sessions.length,observedValue:count/sessions.length,category:'Patterns',priority:87
      });
      insight.simmerSessionIds = support.map(x=>x.id); insights.push(insight);
    }
    const moveGroups = {};
    outcomes.forEach(x => { if (x.move) (moveGroups[x.move] ||= []).push(x); });
    const moveResults = Object.entries(moveGroups).filter(([,rows])=>rows.length>=3).map(([move,rows]) => ({move,rows,success:rows.filter(x=>x.outcome==='cooled'||x.outcome==='tense').length/rows.length})).sort((a,b)=>b.success-a.success || b.rows.length-a.rows.length);
    if (moveResults.length) {
      const best = moveResults[0];
      const insight = makeInsight({
        id:`simmer-move-${best.move.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,type:'simmer-move',scope:'household',
        title:`Best-tested cool-down move: ${best.move}`,body:`${Math.round(best.success*100)}% of ${best.rows.length} checked-in uses of “${best.move}” ended without a recorded fight.`,
        suggestion:`When it fits the situation, “${best.move}” is currently your best-supported Simmer Down strategy.`,sampleSize:best.rows.length,observedValue:best.success,category:'Patterns',priority:89
      });
      insight.simmerSessionIds = best.rows.map(x=>x.id); insights.push(insight);
    }
    state.people.forEach(person => {
      const rows = outcomes.filter(x=>x.personId===person.id);
      if (rows.length < 3) return;
      const avoided = rows.filter(x=>x.outcome==='cooled'||x.outcome==='tense').length;
      const rate = avoided / rows.length;
      const insight = makeInsight({
        id:`simmer-person-${person.id}`,type:'simmer-relationship',scope:'relationship',personId:person.id,
        title:`Simmer Down with ${person.name}`,body:`${avoided} of ${rows.length} checked-in sessions with ${person.name} ended without a recorded fight (${Math.round(rate*100)}%).`,
        suggestion:'Look at the trigger and response combinations that worked best in this relationship.',sampleSize:rows.length,observedValue:rate,category:'Relationships',priority:88
      });
      insight.simmerSessionIds = rows.map(x=>x.id); insights.push(insight);
    });
    return insights.filter(i=>!isDismissed(i.id)).sort((a,b)=>b.priority-a.priority || b.sampleSize-a.sampleSize);
  };
}

if (typeof openInsightEvidence === 'function') {
  const baseOpenInsightEvidenceSimmer = openInsightEvidence;
  openInsightEvidence = function openInsightEvidenceWithSimmer(insight) {
    if (!insight?.type?.startsWith('simmer')) return baseOpenInsightEvidenceSimmer(insight);
    const ids = new Set(insight.simmerSessionIds || []);
    const rows = simmerHistory().filter(x => ids.has(x.id)).sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop journal-backdrop';
    modal.innerHTML = `<div class="modal journal-browser insight-evidence"><button class="modal-close">×</button><p class="eyebrow">SIMMER DOWN EVIDENCE</p><h2>${escapeHtml(insight.title)}</h2><p class="journal-intro">${escapeHtml(insight.body)}</p><div class="evidence-list">${rows.length ? rows.map(row => { const p=simmerPerson(row); const outcome=row.outcome==='cooled'?'🧯 Cooled down':row.outcome==='tense'?'😮‍💨 No fight, still tense':'💥 Fought'; return `<div class="evidence-row static"><strong>${escapeHtml(p?.name || 'Family member')} · ${escapeHtml(row.trigger || 'Trigger not recorded')}</strong><span>${escapeHtml(formatJournalDate(row.completedAt || row.startedAt))} · ${escapeHtml(row.move || 'Move not recorded')} · ${outcome}</span></div>`; }).join('') : '<div class="empty-state">No matching Simmer Down sessions found.</div>'}</div><div class="reflection-nudge">These are self-reported outcomes. They are useful for pattern-finding, not proof of causation.</div></div>`;
    document.body.append(modal);
    modal.querySelector('.modal-close').onclick = () => modal.remove();
  };
}

const simmerStyle = document.createElement('style');
simmerStyle.textContent = `
.simmer-launch{margin:16px 0 30px}.simmer-launch-btn{width:100%;border:0;border-radius:22px;padding:17px 18px;background:linear-gradient(135deg,#ef6b3a,#c43f2d);color:#fff;display:flex;align-items:center;gap:14px;text-align:left;box-shadow:0 10px 24px rgba(176,58,36,.2)}.simmer-launch-btn strong{display:block;font-size:18px}.simmer-launch-btn small{display:block;opacity:.86;margin-top:2px}.simmer-fire{font-size:30px}.simmer-arrow{font-size:24px;margin-left:auto}.simmer-stats{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--muted);margin-top:8px}.simmer-checkin-callout{width:100%;margin-top:10px;border:1px solid #e4b9ad;background:#fff7f3;border-radius:16px;padding:12px 13px;display:flex;align-items:center;gap:10px;text-align:left;color:var(--ink)}.simmer-checkin-callout>span:first-child{font-size:24px}.simmer-checkin-callout span strong,.simmer-checkin-callout span small{display:block}.simmer-checkin-callout span small{font-size:10px;color:var(--muted);margin-top:2px}.simmer-checkin-callout b{margin-left:auto}.simmer-pause-resume{width:100%;margin-top:8px;border:0;background:transparent;color:var(--accent-dark);font-size:11px;font-weight:850}.simmer-overlay{position:fixed;inset:0;z-index:9999;background:rgba(18,16,14,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px}.simmer-card{position:relative;width:min(520px,100%);max-height:92vh;overflow:auto;background:#fffdf7;border-radius:28px;padding:30px 24px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.3)}.simmer-close{position:absolute;right:15px;top:12px;border:0;background:transparent;font-size:30px;color:#777}.simmer-kicker{font-size:11px;font-weight:900;letter-spacing:.13em;color:#c34b3d}.simmer-emoji{font-size:54px;margin:14px 0 4px}.simmer-emoji.big{font-size:72px}.simmer-card h2{font-size:30px;margin:6px 0 8px}.simmer-card p{color:#716c63;margin:0 auto 22px;max-width:410px}.simmer-people,.simmer-moves,.simmer-outcomes{display:grid;gap:10px}.simmer-people button,.simmer-options button,.simmer-moves button,.simmer-outcomes button{border:1px solid #d9d2c5;background:#fff;border-radius:15px;padding:14px;font-weight:750;color:var(--ink)}.simmer-people button{display:flex;align-items:center;gap:12px;text-align:left}.simmer-people button strong{flex:1}.simmer-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.simmer-moves button,.simmer-outcomes button{display:flex;align-items:center;gap:12px;text-align:left;font-size:16px}.simmer-moves button span,.simmer-outcomes button span{font-size:24px}.simmer-outcomes button strong,.simmer-outcomes button small{display:block}.simmer-outcomes button small{font-size:10px;color:var(--muted);margin-top:2px}.temp{height:12px;background:#eee6da;border-radius:999px;overflow:hidden;margin:22px 0}.temp div{height:100%;width:100%;background:#e05236;transition:width 1s ease}.breath-orb{width:130px;height:130px;border-radius:50%;background:#f1e7d8;margin:18px auto 24px;display:grid;place-items:center;transition:transform 4s ease,background 1s}.breath-orb.inhale{transform:scale(1.22);background:#e6efe8}.breath-orb.exhale{transform:scale(.88);transition-duration:6s}.breath-orb span{font-weight:850}.simmer-countdown{font-family:Georgia,serif;font-size:64px;font-weight:800;line-height:1;margin:18px 0}.simmer-script{background:#f1ece3;border-radius:16px;padding:14px;margin:18px 0;text-align:left}.simmer-script span{font-size:9px;font-weight:900;letter-spacing:.12em;color:var(--muted)}.simmer-script p{color:var(--ink);font-weight:750;margin:6px 0 10px}.simmer-script button{border:0;background:transparent;padding:0;color:var(--accent-dark);font-size:11px;font-weight:900}.simmer-win{font-size:35px;margin:20px 0}.simmer-win small{display:block;font-size:12px;color:#716c63;margin-top:8px}.simmer-journal-context{margin:10px 0 4px;text-align:left}@media(max-width:520px){.simmer-card{padding:28px 18px}.simmer-options{grid-template-columns:1fr}.simmer-launch-btn small{font-size:11px}.simmer-stats{gap:10px}.simmer-countdown{font-size:56px}}
`;
document.head.appendChild(simmerStyle);

const simmerObserver = new MutationObserver(() => ensureSimmerButton());
simmerObserver.observe(document.querySelector('#app'), { childList:true, subtree:false });
setInterval(() => ensureSimmerButton(), 30000);
ensureSimmerButton();