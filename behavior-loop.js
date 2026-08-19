// DSWF behavioral-loop dashboard
// Reorganizes the home screen around Before → During → After → Learn without changing stored data.
(function installBehaviorLoopDashboard(){
  const DAY_MS = typeof DAY === 'number' ? DAY : 86400000;

  function todayKey(value=Date.now()){
    const d=new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function todayCheckIn(){
    const key=todayKey();
    return (state.dailyCheckIns||[]).find(x=>x.dayKey===key)||null;
  }
  function activeExperimentsNow(){
    const current=Date.now();
    return (state.experiments||[]).filter(x=>x.status==='active'&&(!x.endsAt||x.endsAt>current));
  }
  function openSimmerSessions(){
    if(typeof simmerHistory!=='function')return [];
    return simmerHistory().filter(x=>x.completed&&!x.outcome).sort((a,b)=>(b.completedAt||0)-(a.completedAt||0));
  }
  function metricsNow(){
    try{return typeof leaderboardMetrics==='function'?leaderboardMetrics(state.people):[];}catch{return [];}
  }
  function relationshipChangeFor(personId){
    return (state.relationshipChanges||[]).filter(x=>x.personId===personId).sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0))[0]||null;
  }
  function currentInsight(){
    try{return typeof deriveInsights==='function'?deriveInsights()[0]||null:null;}catch{return null;}
  }
  function simmerSuccessInsight(){
    if(typeof simmerHistory!=='function')return null;
    const checked=simmerHistory().filter(x=>x.outcome);
    if(checked.length<2)return null;
    const noFight=checked.filter(x=>x.outcome==='cooled'||x.outcome==='tense').length;
    if(!noFight)return null;
    const moves={};
    checked.filter(x=>x.outcome==='cooled'||x.outcome==='tense').forEach(x=>{if(x.move)moves[x.move]=(moves[x.move]||0)+1;});
    const top=Object.entries(moves).sort((a,b)=>b[1]-a[1])[0];
    return {title:'Simmer Down is building evidence',body:`${noFight} of ${checked.length} checked-in interventions ended without a recorded fight${top?`. “${top[0]}” appears in ${top[1]} of those outcomes`:''}.`};
  }
  function safeText(value=''){return typeof escapeHtml==='function'?escapeHtml(String(value)):String(value);}
  function streakLabel(ms){
    if(typeof formatLeaderboardStreak==='function')return formatLeaderboardStreak(ms);
    const s=elapsed(ms);return s.days?`${s.days}d ${s.hours}h`:s.hours?`${s.hours}h ${s.minutes}m`:`${s.minutes}m`;
  }

  function relationshipRows(){
    const metrics=metricsNow();
    return metrics.map(row=>{
      const p=row.person;
      const recognition=(state.recognitions||[]).filter(x=>x.personId===p.id).sort((a,b)=>(b.at||0)-(a.at||0))[0];
      const change=relationshipChangeFor(p.id);
      const positive=recognition?`⭐ ${recognition.category||'Recognition'}${recognition.note?` · ${recognition.note}`:''}`:change?`🌱 Working on: ${change.text}`:'Open the profile to add a positive recognition or behavior change.';
      return `<button type="button" class="loop-person" data-loop-profile="${p.id}">
        ${avatar(p,'sm')}
        <span class="loop-person-main"><strong>${safeText(p.name)}</strong><small>${streakLabel(row.streakMs)} current streak</small><em>${safeText(positive)}</em></span>
        <span class="loop-score"><b>${Math.round(row.peaceScore)}</b><small>peace</small></span>
      </button>`;
    }).join('');
  }

  function currentActionCard(){
    const pending=openSimmerSessions()[0];
    if(pending){
      const person=state.people.find(p=>p.id===pending.personId);
      return `<section class="loop-action loop-after"><p class="eyebrow">AFTER · CLOSE THE LOOP</p><h2>You used Simmer Down earlier${person?` with ${safeText(person.name)}`:''}.</h2><p>When you are ready—not because a timer says so—record what happened next.</p><div class="loop-action-buttons"><button class="btn btn-primary" id="loopSimmerOutcome">How did it go?</button><button class="btn btn-ghost" id="loopNotYet">Not yet</button></div></section>`;
    }
    const check=todayCheckIn();
    const experiments=activeExperimentsNow();
    if(!check){
      const experiment=experiments[0];
      return `<section class="loop-action loop-before"><p class="eyebrow">BEFORE · TODAY</p><h2>How are you showing up today?</h2><p>Take the Daily Check-In before the day gets noisy.${experiment?` Keep <strong>${safeText(experiment.title)}</strong> in mind while you check in.`:''}</p><button class="btn btn-primary" id="loopDailyCheckIn">Complete Daily Check-In →</button></section>`;
    }
    const level=check.temperature>=80?'Hot':check.temperature>=65?'Elevated':check.temperature>=45?'Watchful':check.temperature>=25?'Steady':'Cool';
    return `<section class="loop-action loop-before complete"><p class="eyebrow">BEFORE · TODAY</p><div class="loop-today-row"><div><h2>${level} · ${check.temperature}/100</h2><p>Your Daily Check-In is complete. Use it as context, not a grade.</p></div><button class="text-btn" id="loopViewCheckIn">View →</button></div></section>`;
  }

  function commitmentsCard(){
    const changes=(state.relationshipChanges||[]).slice().sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    const experiments=activeExperimentsNow();
    const items=[];
    changes.slice(0,3).forEach(change=>{
      const person=state.people.find(p=>p.id===change.personId);
      items.push(`<button type="button" class="loop-focus-row" data-loop-profile="${change.personId}"><span>🌱</span><span><strong>${person?safeText(person.name):'Relationship'}</strong><small>${safeText(change.text)}</small></span><b>→</b></button>`);
    });
    experiments.slice(0,2).forEach(exp=>{
      const remaining=exp.endsAt?Math.max(0,Math.ceil((exp.endsAt-Date.now())/DAY_MS)):null;
      items.push(`<button type="button" class="loop-focus-row" data-loop-insights="1"><span>🧪</span><span><strong>${safeText(exp.title)}</strong><small>${safeText(exp.description)}${remaining!==null?` · ${remaining}d left`:''}</small></span><b>→</b></button>`);
    });
    return `<section class="loop-section" id="loopFocus"><div class="loop-heading"><div><p class="eyebrow">WHAT I'M WORKING ON</p><h2>Keep the next move visible.</h2></div></div>${items.length?`<div class="loop-focus-list">${items.join('')}</div>`:`<div class="loop-empty"><span>🌱</span><strong>No active commitments yet.</strong><small>Add “A change I can make is” from a relationship profile, or start an experiment from Insights.</small></div>`}</section>`;
  }

  function learnCard(){
    const simmer=simmerSuccessInsight();
    const insight=currentInsight();
    const chosen=simmer||insight;
    const title=chosen?.title||'DSWF is still learning your patterns.';
    const body=chosen?.body||'As you use check-ins, reflections, recognitions, and Simmer Down, DSWF will surface evidence-based patterns here.';
    return `<section class="loop-section loop-learn"><div class="loop-heading"><div><p class="eyebrow">LEARN</p><h2>Insight of the day.</h2></div><button class="text-btn" id="loopOpenInsights">Explore →</button></div><button type="button" class="loop-insight-card" id="loopInsightCard"><span>💡</span><span><strong>${safeText(title)}</strong><small>${safeText(body)}</small></span></button><div class="loop-learn-actions"><button id="loopJournal">📝 Journal</button><button id="loopInsights">💡 Insights</button><button id="loopHistory">🧯 Simmer Log</button><button id="loopRecognitionHistory">⭐ Recognition</button></div></section>`;
  }

  function renderLoopDashboard(){
    if(!state.onboardingComplete)return;
    const app=document.querySelector('#app');
    const metrics=metricsNow();
    const totalPeaceMs=metrics.reduce((sum,row)=>sum+(row.streakMs||0),0);
    const combined=typeof formatCombinedPeace==='function'?formatCombinedPeace(totalPeaceMs):{primary:Math.floor(totalPeaceMs/DAY_MS),secondary:'d',label:'combined peace time'};
    app.innerHTML=`<div class="app-shell loop-shell">
      <header class="topbar loop-topbar"><div><p class="eyebrow">PERSONAL BEHAVIOR-CHANGE SYSTEM</p><h1 class="logo-title">Days Since <span>We Fought</span></h1></div><button id="settingsBtn" class="round-btn" aria-label="Settings">⚙</button></header>
      <section class="loop-emergency"><button id="simmerDownLaunch" class="simmer-launch-btn"><span class="simmer-fire">🔥</span><span><strong>I’m getting heated</strong><small>Interrupt the spiral. Nothing else matters right now.</small></span><span class="simmer-arrow">→</span></button></section>
      ${currentActionCard()}
      <section class="loop-section loop-family"><div class="loop-heading"><div><p class="eyebrow">YOUR FAMILY TODAY</p><h2>How are the relationships doing?</h2></div><button class="text-btn" id="loopAddMember">＋ Add</button></div><div class="loop-family-summary"><span><b>${combined.primary}${combined.secondary?` ${combined.secondary}`:''}</b><small>${combined.label}</small></span><span><b>${(state.recognitions||[]).length}</b><small>good things noticed</small></span></div><div class="loop-people">${relationshipRows()||'<div class="loop-empty">No family members yet.</div>'}</div></section>
      ${commitmentsCard()}
      ${learnCard()}
      <footer>Less scorekeeping. More making up. ♥</footer>
    </div>`;

    app.querySelector('#settingsBtn').onclick=()=>openSettings();
    app.querySelector('#simmerDownLaunch').onclick=()=>openSimmerDown();
    app.querySelector('#loopAddMember').onclick=()=>openPersonModal(null,person=>{state.people.push({...person,id:id(),startedAt:null,completedStreaks:[],createdAt:now()});saveState();render();});
    app.querySelectorAll('[data-loop-profile]').forEach(btn=>btn.onclick=()=>openPersonProfile(btn.dataset.loopProfile));
    app.querySelectorAll('[data-loop-insights]').forEach(btn=>btn.onclick=()=>openInsightsScreen());
    app.querySelector('#loopDailyCheckIn')?.addEventListener('click',()=>{ if(typeof openDailyCheckIn==='function')openDailyCheckIn(); else document.querySelector('#openDailyCheckIn')?.click(); });
    app.querySelector('#loopViewCheckIn')?.addEventListener('click',()=>{ if(typeof openDailyCheckIn==='function')openDailyCheckIn(); else document.querySelector('#openDailyCheckIn')?.click(); });
    app.querySelector('#loopSimmerOutcome')?.addEventListener('click',()=>{const pending=openSimmerSessions()[0];if(pending&&typeof openSimmerCheckIn==='function')openSimmerCheckIn(pending.id);});
    app.querySelector('#loopNotYet')?.addEventListener('click',event=>{event.currentTarget.closest('.loop-action')?.classList.add('loop-action-muted');});
    app.querySelector('#loopOpenInsights').onclick=()=>openInsightsScreen();
    app.querySelector('#loopInsightCard').onclick=()=>openInsightsScreen();
    app.querySelector('#loopInsights').onclick=()=>openInsightsScreen();
    app.querySelector('#loopJournal').onclick=()=>{if(typeof openJournalRegistry==='function')openJournalRegistry();};
    app.querySelector('#loopHistory').onclick=()=>{if(typeof openSimmerHistory==='function')openSimmerHistory();};
    app.querySelector('#loopRecognitionHistory').onclick=()=>{if(typeof openRecognitionHistory==='function')openRecognitionHistory();};
  }

  // Expose Daily Check-In launcher to the state-aware dashboard without changing its workflow.
  if(typeof openDailyCheckIn==='function') window.openDailyCheckIn=openDailyCheckIn;

  // Keep existing render() call sites, but make the behavioral loop the resting dashboard.
  const baseRender=render;
  render=function renderBehaviorLoop(){
    if(!state.onboardingComplete)return baseRender();
    renderLoopDashboard();
  };

  const style=document.createElement('style');
  style.textContent=`
  .loop-shell{padding-bottom:42px}.loop-topbar{margin-bottom:12px}.loop-topbar .eyebrow{font-size:8px}.loop-emergency{margin:8px 0 14px}.loop-emergency .simmer-launch-btn{width:100%;box-sizing:border-box}.loop-action,.loop-section{margin:0 0 28px}.loop-action{border:1px solid var(--line);border-radius:22px;padding:18px;background:var(--card)}.loop-action .eyebrow{margin-bottom:5px}.loop-action h2{margin:0 0 6px;font-size:25px;letter-spacing:-.035em}.loop-action p{margin:0;color:var(--muted);font-size:12px;line-height:1.5}.loop-action-buttons{display:flex;gap:8px;margin-top:14px}.loop-action-buttons .btn{margin:0}.loop-action-muted{opacity:.55}.loop-before{background:#fff9e8;border-color:#eadcae}.loop-after{background:#fff3ed;border-color:#efcfc4}.loop-today-row{display:flex;align-items:center;gap:12px}.loop-today-row>div{flex:1}.loop-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:0 2px 10px}.loop-heading h2{font-size:24px;margin:2px 0 0;letter-spacing:-.03em}.loop-family-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:9px}.loop-family-summary>span{border:1px solid var(--line);background:var(--card);border-radius:15px;padding:11px;text-align:center}.loop-family-summary b,.loop-family-summary small{display:block}.loop-family-summary b{font-size:18px}.loop-family-summary small{font-size:8px;color:var(--muted);font-weight:800;text-transform:uppercase;letter-spacing:.05em}.loop-people,.loop-focus-list{display:grid;gap:8px}.loop-person,.loop-focus-row,.loop-insight-card{width:100%;border:1px solid var(--line);background:var(--card);border-radius:17px;padding:12px;display:flex;align-items:center;gap:11px;text-align:left;color:var(--ink)}.loop-person-main{flex:1;min-width:0}.loop-person-main strong,.loop-person-main small,.loop-person-main em{display:block}.loop-person-main strong{font-size:14px}.loop-person-main small{font-size:10px;color:var(--muted);margin-top:1px}.loop-person-main em{font-style:normal;font-size:9px;color:var(--muted);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.loop-score{text-align:right;flex:0 0 auto}.loop-score b,.loop-score small{display:block}.loop-score b{font-size:24px}.loop-score small{font-size:8px;color:var(--muted);text-transform:uppercase}.loop-focus-row>span:nth-child(2),.loop-insight-card>span:nth-child(2){flex:1;min-width:0}.loop-focus-row>span:first-child,.loop-insight-card>span:first-child{font-size:23px}.loop-focus-row strong,.loop-focus-row small,.loop-insight-card strong,.loop-insight-card small{display:block}.loop-focus-row strong,.loop-insight-card strong{font-size:12px}.loop-focus-row small,.loop-insight-card small{font-size:10px;color:var(--muted);line-height:1.45;margin-top:3px}.loop-empty{border:1px dashed var(--line);background:var(--card);border-radius:17px;padding:18px;text-align:center;color:var(--muted)}.loop-empty span,.loop-empty strong,.loop-empty small{display:block}.loop-empty span{font-size:25px}.loop-empty strong{color:var(--ink);margin-top:4px}.loop-empty small{font-size:10px;line-height:1.45;margin-top:3px}.loop-insight-card{background:#fff9e8;border-color:#eadcae}.loop-learn-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.loop-learn-actions button{border:1px solid var(--line);background:var(--card);border-radius:13px;padding:10px;color:var(--ink);font-size:10px;font-weight:850}.loop-shell~*{}#simmerHistorySection,#recognitionLogSection,#journalHub,#insightsHub{display:none!important}
  @media(max-width:520px){.loop-action h2,.loop-heading h2{font-size:21px}.loop-person{padding:11px}.loop-person-main em{max-width:190px}.loop-action-buttons{display:grid;grid-template-columns:1fr 1fr}}
  `;
  document.head.append(style);

  // Render once after every legacy decorator has loaded. Later mutations are handled by existing modules.
  render();
})();