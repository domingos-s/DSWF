// DSWF Daily Check-In
// A short daily emotional/relationship temperature check that learns from journal,
// Simmer Down, and prior check-in data while keeping everything local-first.

(function installDailyCheckIn() {
  if (!Array.isArray(state.dailyCheckIns)) {
    state.dailyCheckIns = [];
    saveState();
  }

  const CHECKIN_QUESTIONS = [
    { id:'mood', title:'How are you feeling overall?', prompt:'Think about your baseline mood before the day gets noisy.', low:'Rough', high:'Good', risk:'inverse', emoji:'🌤️' },
    { id:'stress', title:'How loaded is your stress?', prompt:'Work, schedules, money, parenting, sleep — all of it counts.', low:'Low', high:'Maxed', risk:'direct', emoji:'🧠' },
    { id:'patience', title:'How much patience do you have available?', prompt:'Not how patient you should be. How much bandwidth is actually there?', low:'Empty', high:'Plenty', risk:'inverse', emoji:'🔋' },
    { id:'heard', title:'How heard and respected do you feel?', prompt:'Rate the feeling, not whether anyone is objectively right or wrong.', low:'Not at all', high:'Very', risk:'inverse', emoji:'👂' },
    { id:'connection', title:'How connected do you feel to your family?', prompt:'This can be different from whether everyone is getting along.', low:'Distant', high:'Close', risk:'inverse', emoji:'🤝' },
    { id:'heat', title:'How close do you feel to getting heated?', prompt:'Use your body and tone as the signal. Catch it before the argument has momentum.', low:'Calm', high:'Very close', risk:'direct', emoji:'🔥' }
  ];

  let dailyDraft = null;
  let dailyStep = 0;

  function localDayKey(value = Date.now()) {
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function dailyCheckInsSorted() {
    return [...(state.dailyCheckIns || [])].sort((a,b) => (a.at || 0) - (b.at || 0));
  }

  function todaysDailyCheckIn() {
    const key = localDayKey();
    return dailyCheckInsSorted().find(entry => entry.dayKey === key) || null;
  }

  function journalPatternSnapshot() {
    const cutoff = Date.now() - 30 * DAY;
    const entries = (state.journalEntries || []).filter(entry => (entry.at || entry.createdAt || 0) >= cutoff);
    const triggerCounts = {};
    const feelingCounts = {};
    entries.forEach(entry => {
      (entry.answers?.triggerCategories || []).forEach(value => triggerCounts[value] = (triggerCounts[value] || 0) + 1);
      (entry.answers?.feelings || []).forEach(value => feelingCounts[value] = (feelingCounts[value] || 0) + 1);
    });
    const topTrigger = Object.entries(triggerCounts).sort((a,b) => b[1]-a[1])[0] || null;
    const topFeeling = Object.entries(feelingCounts).sort((a,b) => b[1]-a[1])[0] || null;

    const simmer = typeof simmerHistory === 'function'
      ? simmerHistory().filter(session => (session.startedAt || 0) >= cutoff)
      : [];
    const simmerTriggerCounts = {};
    simmer.forEach(session => {
      if (session.trigger) simmerTriggerCounts[session.trigger] = (simmerTriggerCounts[session.trigger] || 0) + 1;
    });
    const topSimmerTrigger = Object.entries(simmerTriggerCounts).sort((a,b) => b[1]-a[1])[0] || null;
    const checked = simmer.filter(session => session.outcome);
    const noFight = checked.filter(session => session.outcome === 'cooled' || session.outcome === 'tense').length;

    return { entries, topTrigger, topFeeling, simmer, topSimmerTrigger, checked, noFight };
  }

  function suggestedTriggers() {
    const snapshot = journalPatternSnapshot();
    const scored = new Map();
    const add = (label, points) => {
      if (!label) return;
      scored.set(label, (scored.get(label) || 0) + points);
    };
    snapshot.entries.forEach(entry => (entry.answers?.triggerCategories || []).forEach(trigger => add(trigger, 3)));
    snapshot.simmer.forEach(session => add(session.trigger, 2));
    ['Parenting','Not listening','Respect / tone','Work / stress','Chores / responsibilities','Scheduling','Money','Feeling ignored'].forEach(label => add(label, .25));
    return [...scored.entries()].sort((a,b) => b[1]-a[1]).slice(0,6).map(([label]) => label);
  }

  function temperatureScore(answers) {
    const weights = { mood:.75, stress:1.15, patience:1.1, heard:.95, connection:.7, heat:1.35 };
    let weighted = 0;
    let weightTotal = 0;
    CHECKIN_QUESTIONS.forEach(question => {
      const raw = Math.max(1, Math.min(5, Number(answers?.[question.id]) || 3));
      const adverse = question.risk === 'inverse' ? 6 - raw : raw;
      const normalized = (adverse - 1) / 4;
      weighted += normalized * weights[question.id];
      weightTotal += weights[question.id];
    });
    return Math.max(0, Math.min(100, Math.round((weighted / weightTotal) * 100)));
  }

  function temperatureLevel(score) {
    if (score < 25) return { label:'Cool', emoji:'🟢', copy:'You have good room to respond instead of react.' };
    if (score < 45) return { label:'Steady', emoji:'🌤️', copy:'Mostly steady. Protect the bandwidth you have.' };
    if (score < 65) return { label:'Watchful', emoji:'🟡', copy:'There are a few conditions that could make conflict easier to trigger.' };
    if (score < 80) return { label:'Elevated', emoji:'🟠', copy:'Your margin is thin today. Slow things down before difficult interactions.' };
    return { label:'Hot', emoji:'🔥', copy:'Treat today as a high-heat day. Do not wait until an argument to start regulating.' };
  }

  function checkinDrivers(entry) {
    const answers = entry?.answers || {};
    const candidates = CHECKIN_QUESTIONS.map(question => {
      const value = Number(answers[question.id]) || 3;
      const adverse = question.risk === 'inverse' ? 6-value : value;
      return { question, value, adverse };
    }).sort((a,b) => b.adverse-a.adverse);
    return candidates.filter(item => item.adverse >= 4).slice(0,3);
  }

  function actionForCheckIn(entry) {
    const a = entry.answers || {};
    if (a.heat >= 4) return 'Use Simmer Down at the first sign of friction today. The goal is to interrupt escalation before you start trying to solve the issue.';
    if (a.patience <= 2) return 'Protect your limited bandwidth. Reduce non-essential corrections and take a pause before entering a disagreement.';
    if (a.heard <= 2) return 'Feeling unheard can turn a small disagreement into a respect battle. Avoid trying to prove your authority or resolve respect in the heated moment.';
    if (a.stress >= 4) return 'Your stress load is doing part of the talking today. Defer non-urgent difficult conversations and create recovery time where you can.';
    if (a.connection <= 2) return 'Aim for one low-demand positive interaction today — a kind comment, recognition, shared activity, or simple check-in — without forcing a bigger conversation.';
    if (a.mood <= 2) return 'Make today easier on your nervous system: food, sleep, movement, quiet, and fewer unnecessary points of friction.';
    return 'You have usable bandwidth today. Keep noticing the first signs of heat and preserve the conditions that are helping.';
  }

  function recentPatternCopy() {
    const p = journalPatternSnapshot();
    const parts = [];
    if (p.topTrigger && p.entries.length >= 3) parts.push(`${p.topTrigger[0]} appears in ${p.topTrigger[1]} of ${p.entries.length} recent reflections`);
    if (p.topFeeling && p.entries.length >= 3) parts.push(`${p.topFeeling[0]} appears in ${p.topFeeling[1]} of ${p.entries.length}`);
    if (p.checked.length >= 3) parts.push(`${p.noFight} of ${p.checked.length} recent Simmer Down check-ins ended without a recorded fight`);
    if (!parts.length) return 'Keep checking in. DSWF will connect today’s state to your journal and Simmer Down patterns as more data accumulates.';
    return parts.join(' · ') + '.';
  }

  function trendFor(entry) {
    const history = dailyCheckInsSorted().filter(item => item.id !== entry?.id && Number.isFinite(item.temperature));
    if (!history.length) return null;
    const recent = history.slice(-7);
    const avg = recent.reduce((sum,item) => sum + item.temperature, 0) / recent.length;
    const delta = Math.round((entry.temperature ?? 0) - avg);
    return { avg:Math.round(avg), delta, count:recent.length };
  }

  function dailyMiniBars() {
    const recent = dailyCheckInsSorted().slice(-7);
    if (!recent.length) return '';
    return `<div class="daily-mini-bars" aria-label="Recent daily temperature scores">${recent.map(entry => `<span title="${entry.dayKey}: ${entry.temperature}" style="--daily-height:${Math.max(10,entry.temperature)}%"><i></i><small>${new Date(entry.at).toLocaleDateString(undefined,{weekday:'narrow'})}</small></span>`).join('')}</div>`;
  }

  function ensureDailyCheckInCard(box = document.querySelector('#simmerLaunchSection')) {
    if (!box || box.querySelector('#dailyCheckInCard')) return;
    const stats = box.querySelector('.simmer-stats');
    if (!stats) return;
    const today = todaysDailyCheckIn();
    const card = document.createElement('div');
    card.id = 'dailyCheckInCard';
    card.className = `daily-checkin-card ${today ? 'complete' : ''}`;
    if (!today) {
      card.innerHTML = `<button type="button" class="daily-checkin-main" id="openDailyCheckIn"><span class="daily-checkin-icon">☀️</span><span><small>DAILY CHECK-IN</small><strong>How are you doing today?</strong><em>2 minutes · DSWF turns your answers into a useful read on the day</em></span><b>→</b></button>`;
    } else {
      const level = temperatureLevel(today.temperature);
      const trend = trendFor(today);
      const trendText = trend
        ? `${Math.abs(trend.delta)} pts ${trend.delta > 0 ? 'hotter' : trend.delta < 0 ? 'cooler' : 'even with'} your recent average`
        : 'First daily baseline recorded';
      card.innerHTML = `<div class="daily-checkin-summary"><div><small>DAILY CHECK-IN · TODAY</small><strong>${level.emoji} ${level.label} · ${today.temperature}/100</strong><em>${trendText}</em></div><button type="button" id="openDailyCheckIn">View →</button></div>${dailyMiniBars()}<button type="button" class="daily-history-link" id="openDailyHistory">View check-in history</button>`;
    }
    stats.insertAdjacentElement('afterend', card);
    card.querySelector('#openDailyCheckIn')?.addEventListener('click', openDailyCheckIn);
    card.querySelector('#openDailyHistory')?.addEventListener('click', openDailyHistory);
  }

  const baseRefreshSimmerLaunchDaily = refreshSimmerLaunch;
  refreshSimmerLaunch = function refreshSimmerLaunchWithDailyCheckIn(...args) {
    const result = baseRefreshSimmerLaunchDaily(...args);
    ensureDailyCheckInCard(args[0] || document.querySelector('#simmerLaunchSection'));
    return result;
  };

  function openDailyCheckIn() {
    const existing = todaysDailyCheckIn();
    if (existing) {
      openDailyResult(existing, true);
      return;
    }
    dailyDraft = { answers:{}, triggers:[], note:'' };
    dailyStep = 0;
    createDailyModal();
    renderDailyQuestion();
  }

  function createDailyModal() {
    document.querySelector('#dailyCheckInModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'dailyCheckInModal';
    modal.className = 'modal-backdrop daily-checkin-backdrop';
    modal.innerHTML = `<div class="modal daily-checkin-modal"><button type="button" class="modal-close" aria-label="Close">×</button><div id="dailyCheckInStage"></div></div>`;
    document.body.append(modal);
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = event => { if (event.target === modal) modal.remove(); };
    return modal;
  }

  function renderDailyQuestion() {
    const stage = document.querySelector('#dailyCheckInStage');
    if (!stage) return;
    const question = CHECKIN_QUESTIONS[dailyStep];
    const progress = Math.round((dailyStep / CHECKIN_QUESTIONS.length) * 100);
    const chosen = dailyDraft.answers[question.id];
    stage.innerHTML = `<div class="daily-progress"><i style="width:${progress}%"></i></div><p class="eyebrow">DAILY CHECK-IN · ${dailyStep+1} OF ${CHECKIN_QUESTIONS.length}</p><div class="daily-question-emoji">${question.emoji}</div><h2>${question.title}</h2><p class="daily-question-copy">${question.prompt}</p><div class="daily-scale">${[1,2,3,4,5].map(value => `<button type="button" data-daily-value="${value}" class="${chosen===value?'selected':''}"><strong>${value}</strong>${value===1?`<small>${question.low}</small>`:value===5?`<small>${question.high}</small>`:'<small>&nbsp;</small>'}</button>`).join('')}</div><div class="daily-question-nav">${dailyStep ? '<button type="button" class="btn btn-ghost" id="dailyBack">Back</button>' : '<span></span>'}</div>`;
    stage.querySelectorAll('[data-daily-value]').forEach(button => button.onclick = () => {
      dailyDraft.answers[question.id] = Number(button.dataset.dailyValue);
      if (dailyStep < CHECKIN_QUESTIONS.length-1) {
        dailyStep += 1;
        renderDailyQuestion();
      } else renderDailyTriggerStage();
    });
    stage.querySelector('#dailyBack')?.addEventListener('click', () => { dailyStep -= 1; renderDailyQuestion(); });
  }

  function renderDailyTriggerStage() {
    const stage = document.querySelector('#dailyCheckInStage');
    if (!stage) return;
    const options = suggestedTriggers();
    stage.innerHTML = `<div class="daily-progress"><i style="width:100%"></i></div><p class="eyebrow">DAILY CHECK-IN · CONTEXT</p><div class="daily-question-emoji">🧭</div><h2>Anything likely to trip you up today?</h2><p class="daily-question-copy">Pick up to two. DSWF prioritizes themes that have appeared in your own journal and Simmer Down history.</p><div class="daily-trigger-options">${options.map(label => `<button type="button" data-daily-trigger="${escapeHtml(label)}" class="${dailyDraft.triggers.includes(label)?'selected':''}">${escapeHtml(label)}</button>`).join('')}<button type="button" data-daily-trigger="Nothing obvious" class="${dailyDraft.triggers.includes('Nothing obvious')?'selected':''}">Nothing obvious</button></div><label class="daily-note-label">Anything DSWF should remember today?<textarea id="dailyNote" maxlength="500" placeholder="Optional note…">${escapeHtml(dailyDraft.note || '')}</textarea></label><div class="modal-actions"><button type="button" class="btn btn-ghost" id="dailyTriggerBack">Back</button><button type="button" class="btn btn-primary" id="saveDailyCheckIn">See today’s read →</button></div>`;
    stage.querySelectorAll('[data-daily-trigger]').forEach(button => button.onclick = () => {
      const label = button.dataset.dailyTrigger;
      if (label === 'Nothing obvious') {
        dailyDraft.triggers = dailyDraft.triggers.includes(label) ? [] : [label];
      } else {
        dailyDraft.triggers = dailyDraft.triggers.filter(item => item !== 'Nothing obvious');
        if (dailyDraft.triggers.includes(label)) dailyDraft.triggers = dailyDraft.triggers.filter(item => item !== label);
        else if (dailyDraft.triggers.length < 2) dailyDraft.triggers.push(label);
      }
      renderDailyTriggerStage();
    });
    stage.querySelector('#dailyTriggerBack').onclick = () => { dailyDraft.note = stage.querySelector('#dailyNote')?.value || ''; dailyStep = CHECKIN_QUESTIONS.length-1; renderDailyQuestion(); };
    stage.querySelector('#saveDailyCheckIn').onclick = () => {
      dailyDraft.note = stage.querySelector('#dailyNote')?.value.trim() || '';
      saveDailyCheckIn(dailyDraft);
    };
  }

  function saveDailyCheckIn(draft, existingId = null) {
    const current = todaysDailyCheckIn();
    const at = Date.now();
    const entry = {
      id: existingId || current?.id || (crypto.randomUUID?.() || `daily-${at}`),
      dayKey: localDayKey(at),
      at: current?.at || at,
      updatedAt: at,
      answers: { ...draft.answers },
      triggers: [...(draft.triggers || [])],
      note: draft.note || ''
    };
    entry.temperature = temperatureScore(entry.answers);
    state.dailyCheckIns = (state.dailyCheckIns || []).filter(item => item.dayKey !== entry.dayKey);
    state.dailyCheckIns.push(entry);
    saveState();
    document.querySelector('#dailyCheckInModal')?.remove();
    const oldCard = document.querySelector('#dailyCheckInCard');
    oldCard?.remove();
    ensureDailyCheckInCard();
    if (typeof toast === 'function') toast('Daily check-in saved.');
    openDailyResult(entry, false);
  }

  function openDailyResult(entry, existing = false) {
    const modal = createDailyModal();
    const stage = modal.querySelector('#dailyCheckInStage');
    const level = temperatureLevel(entry.temperature);
    const drivers = checkinDrivers(entry);
    const trend = trendFor(entry);
    const driverText = drivers.length
      ? drivers.map(item => `${item.question.emoji} ${item.question.title.replace('How ','').replace('?','')}`).join(' · ')
      : 'No major pressure point stands out in today’s answers.';
    const trendCopy = trend
      ? `Today is <strong>${Math.abs(trend.delta)} points ${trend.delta > 0 ? 'hotter' : trend.delta < 0 ? 'cooler' : 'in line with'}</strong> your ${trend.count}-check-in recent average of ${trend.avg}.`
      : 'This is your first daily baseline. A trend will appear after another check-in.';
    stage.innerHTML = `<p class="eyebrow">TODAY’S READ</p><div class="daily-result-score"><span>${level.emoji}</span><strong>${entry.temperature}</strong><small>/100</small></div><h2>${level.label}</h2><p class="daily-result-lede">${level.copy}</p><div class="daily-result-block"><small>WHAT IS DRIVING TODAY</small><p>${driverText}</p></div><div class="daily-result-block"><small>DSWF SUGGESTS</small><p>${actionForCheckIn(entry)}</p></div><div class="daily-result-block"><small>YOUR RECENT DSWF DATA</small><p>${recentPatternCopy()}</p></div><div class="daily-trend-callout">${trendCopy}</div>${entry.triggers?.length ? `<div class="daily-result-tags">${entry.triggers.map(tag=>`<span>${escapeHtml(tag)}</span>`).join('')}</div>` : ''}${entry.note ? `<div class="daily-result-note">“${escapeHtml(entry.note)}”</div>` : ''}<div class="modal-actions"><button type="button" class="btn btn-ghost" id="dailyHistoryFromResult">History</button><button type="button" class="btn btn-primary" id="editDailyCheckIn">${existing ? 'Update today’s check-in' : 'Edit today’s check-in'}</button></div>`;
    stage.querySelector('#dailyHistoryFromResult').onclick = () => { modal.remove(); openDailyHistory(); };
    stage.querySelector('#editDailyCheckIn').onclick = () => {
      dailyDraft = { answers:{...entry.answers}, triggers:[...(entry.triggers||[])], note:entry.note||'' };
      dailyStep = 0;
      renderDailyQuestion();
    };
  }

  function openDailyHistory() {
    document.querySelector('#dailyCheckInHistory')?.remove();
    const history = dailyCheckInsSorted().reverse();
    const modal = document.createElement('div');
    modal.id = 'dailyCheckInHistory';
    modal.className = 'modal-backdrop daily-checkin-backdrop';
    modal.innerHTML = `<div class="modal daily-history-modal"><button type="button" class="modal-close" aria-label="Close">×</button><p class="eyebrow">DAILY CHECK-IN</p><h2>Your temperature history</h2><p class="daily-question-copy">Use the trend to notice conditions that make conflict easier or harder — not to grade yourself.</p>${dailyMiniBars()}<div class="daily-history-list">${history.length ? history.map(entry => {
      const level = temperatureLevel(entry.temperature);
      const date = new Date(entry.at).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
      const low = checkinDrivers(entry)[0];
      return `<button type="button" data-daily-history="${entry.id}"><span><small>${date}</small><strong>${level.emoji} ${level.label}</strong><em>${low ? low.question.title : 'Steady across the check-in'}</em></span><b>${entry.temperature}</b></button>`;
    }).join('') : '<div class="empty-state">No daily check-ins yet.</div>'}</div></div>`;
    document.body.append(modal);
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = event => { if (event.target === modal) modal.remove(); };
    modal.querySelectorAll('[data-daily-history]').forEach(button => button.onclick = () => {
      const entry = (state.dailyCheckIns || []).find(item => item.id === button.dataset.dailyHistory);
      if (!entry) return;
      modal.remove();
      openDailyResult(entry, entry.dayKey === localDayKey());
    });
  }

  const dailyStyle = document.createElement('style');
  dailyStyle.textContent = `
  .daily-checkin-card{margin-top:12px;border:1px solid #ddd6ca;background:#fffdf8;border-radius:18px;overflow:hidden}.daily-checkin-main{width:100%;border:0;background:transparent;padding:14px;display:flex;align-items:center;gap:11px;text-align:left;color:var(--ink)}.daily-checkin-main>span:nth-child(2){min-width:0;flex:1}.daily-checkin-main small,.daily-checkin-summary small{display:block;font-size:8px;font-weight:950;letter-spacing:.12em;color:var(--muted)}.daily-checkin-main strong,.daily-checkin-summary strong{display:block;font-size:14px;margin-top:2px}.daily-checkin-main em,.daily-checkin-summary em{display:block;font-style:normal;font-size:9px;color:var(--muted);line-height:1.35;margin-top:3px}.daily-checkin-icon{font-size:25px}.daily-checkin-main b{font-size:18px}.daily-checkin-summary{display:flex;align-items:center;gap:10px;padding:13px 14px 8px}.daily-checkin-summary>div{flex:1;min-width:0}.daily-checkin-summary button,.daily-history-link{border:0;background:transparent;color:var(--accent-dark);font-size:10px;font-weight:900;padding:4px}.daily-history-link{display:block;margin:4px auto 9px}.daily-mini-bars{height:52px;display:flex;align-items:end;justify-content:center;gap:7px;padding:5px 14px 0}.daily-mini-bars span{height:100%;width:15px;display:flex;flex-direction:column;justify-content:end;align-items:center;gap:2px}.daily-mini-bars i{display:block;width:8px;height:var(--daily-height);min-height:4px;max-height:36px;border-radius:999px;background:#d5a35c}.daily-mini-bars small{font-size:7px;color:var(--muted)}
  .daily-checkin-backdrop{z-index:11000!important}.daily-checkin-modal,.daily-history-modal{width:min(100%,500px);max-height:90vh;overflow:auto}.daily-progress{height:6px;background:#eee8df;border-radius:999px;overflow:hidden;margin:2px 34px 22px 0}.daily-progress i{display:block;height:100%;background:#d5a35c;border-radius:inherit;transition:width .2s ease}.daily-question-emoji{font-size:46px;margin:15px 0 5px;text-align:center}.daily-checkin-modal h2{font-size:29px;line-height:1.05;text-align:center;margin:6px auto 9px;max-width:390px}.daily-question-copy{color:var(--muted);font-size:12px;line-height:1.5;text-align:center;max-width:400px;margin:0 auto 20px}.daily-scale{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.daily-scale button{border:1px solid var(--line);background:#fff;border-radius:14px;padding:13px 4px 9px;color:var(--ink)}.daily-scale button strong{display:block;font-size:19px}.daily-scale button small{display:block;font-size:8px;color:var(--muted);margin-top:3px}.daily-scale button.selected{border-color:#d5a35c;background:#fff7e8}.daily-question-nav{display:flex;justify-content:flex-start;margin-top:16px}.daily-trigger-options{display:flex;flex-wrap:wrap;gap:7px;justify-content:center}.daily-trigger-options button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:9px 11px;color:var(--ink);font-size:10px;font-weight:800}.daily-trigger-options button.selected{background:var(--ink);border-color:var(--ink);color:#fff}.daily-note-label{display:block;font-size:10px;font-weight:850;margin-top:18px}.daily-note-label textarea{display:block;width:100%;min-height:72px;margin-top:6px;border:1px solid var(--line);background:#fff;border-radius:14px;padding:11px;font:inherit;color:var(--ink);resize:vertical}.daily-result-score{display:flex;align-items:baseline;justify-content:center;gap:5px;margin:16px 0 0}.daily-result-score span{font-size:30px}.daily-result-score strong{font-family:Georgia,serif;font-size:68px;line-height:.9}.daily-result-score small{color:var(--muted);font-size:13px}.daily-result-lede{text-align:center;color:var(--muted);font-size:12px;line-height:1.5;margin:0 auto 18px;max-width:390px}.daily-result-block{border:1px solid var(--line);background:#fffdf8;border-radius:15px;padding:12px 13px;margin-top:8px}.daily-result-block small{font-size:8px;font-weight:950;letter-spacing:.1em;color:var(--muted)}.daily-result-block p{margin:5px 0 0;font-size:11px;line-height:1.5}.daily-trend-callout{margin-top:10px;background:#f0ede6;border-radius:14px;padding:11px;font-size:10px;line-height:1.45;color:var(--muted)}.daily-result-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.daily-result-tags span{font-size:9px;font-weight:800;background:#eee9df;border-radius:999px;padding:6px 8px}.daily-result-note{margin-top:10px;font-family:Georgia,serif;font-style:italic;font-size:12px;line-height:1.45;color:var(--muted)}.daily-history-modal .daily-mini-bars{height:76px;margin:8px 0 18px}.daily-history-modal .daily-mini-bars i{max-height:58px}.daily-history-list{display:grid;gap:7px}.daily-history-list button{width:100%;border:1px solid var(--line);background:#fffdf8;border-radius:14px;padding:11px 12px;display:flex;align-items:center;text-align:left;color:var(--ink)}.daily-history-list button span{flex:1;min-width:0}.daily-history-list small,.daily-history-list strong,.daily-history-list em{display:block}.daily-history-list small{font-size:8px;color:var(--muted);font-weight:800}.daily-history-list strong{font-size:12px;margin-top:2px}.daily-history-list em{font-size:9px;font-style:normal;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}.daily-history-list b{font-family:Georgia,serif;font-size:27px;margin-left:10px}
  @media(max-width:520px){.daily-checkin-modal,.daily-history-modal{padding:25px 17px!important}.daily-scale{gap:5px}.daily-scale button{padding:12px 2px 8px}.daily-checkin-modal h2{font-size:26px}}
  `;
  document.head.appendChild(dailyStyle);

  ensureDailyCheckInCard();
})();
