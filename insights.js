// DSWF v1.2 — on-device insights engine, structured journaling analytics, and experiments.

if (!state.insightFeedback || typeof state.insightFeedback !== 'object') state.insightFeedback = {};
if (!state.insightDismissals || typeof state.insightDismissals !== 'object') state.insightDismissals = {};
if (!Array.isArray(state.experiments)) state.experiments = [];
saveState();

const INSIGHT_TRIGGER_CATEGORIES = [
  'Chores / responsibilities','Money','Parenting','Work / stress','Scheduling',
  'Screen / device use','School','Respect / tone','Mess / clutter','Plans changing',
  'Being late','Feeling ignored','Miscommunication','Other'
];
const REPAIR_STATUSES = ['Yes','Partially','Not yet'];
const INSIGHT_DAY = 86400000;

function mean(values) {
  return values.length ? values.reduce((a,b) => a + b, 0) / values.length : 0;
}
function pct(value) { return `${Math.round(value * 100)}%`; }
function daysAgo(days) { return now() - days * INSIGHT_DAY; }
function personName(personId) { return state.people.find(p => p.id === personId)?.name || 'this relationship'; }
function fightEvents() { return state.events.filter(e => e.type === 'fight').sort((a,b) => a.at - b.at); }
function journalEntriesSorted() { return [...(state.journalEntries || [])].sort((a,b) => a.at - b.at); }
function entriesForPerson(personId) { return journalEntriesSorted().filter(e => e.personId === personId); }
function confidenceFor(n) { return n >= 10 ? 'Strong pattern' : n >= 5 ? 'Pattern' : 'Emerging'; }
function safeInsightId(parts) { return parts.join(':').toLowerCase().replace(/[^a-z0-9:]+/g,'-'); }
function isDismissed(id) {
  const until = state.insightDismissals?.[id];
  return until && until > now();
}
function makeInsight({ id, type, scope='household', personId=null, title, body, suggestion='', sampleSize=0, observedValue=null, baselineValue=null, supportEntryIds=[], supportEventIds=[], category='Patterns', experiment=null, priority=50 }) {
  return { id, type, scope, personId, title, body, suggestion, sampleSize, observedValue, baselineValue, supportEntryIds, supportEventIds, category, experiment, priority, confidence: confidenceFor(sampleSize), generatedAt: now() };
}

function timeBucket(hour) {
  if (hour < 5) return 'late night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'late night';
}

function deriveInsights() {
  const insights = [];
  const entries = journalEntriesSorted();
  const fights = fightEvents();

  const scopes = [{ personId:null, label:'your household', entries }].concat(
    state.people.map(p => ({ personId:p.id, label:p.name, entries:entries.filter(e => e.personId === p.id) }))
  );

  scopes.forEach(scope => {
    const es = scope.entries;
    if (es.length >= 3) {
      const buckets = {};
      es.forEach(e => { const b = timeBucket(new Date(e.at).getHours()); buckets[b] = (buckets[b] || 0) + 1; });
      const [bucket, count] = Object.entries(buckets).sort((a,b) => b[1]-a[1])[0] || [];
      if (count >= 3 && count / es.length >= .55) {
        const personPrefix = scope.personId ? ` with ${scope.label}` : '';
        insights.push(makeInsight({
          id:safeInsightId(['time',scope.personId||'all',bucket]), type:'timing', personId:scope.personId,
          scope:scope.personId?'relationship':'household', title:`${bucket[0].toUpperCase()+bucket.slice(1)} pattern`,
          body:`${count} of ${es.length} journaled fights${personPrefix} happened in the ${bucket}.`,
          suggestion: bucket === 'evening' || bucket === 'late night' ? 'When possible, move difficult conversations earlier or pause them until everyone has more bandwidth.' : 'Notice what is usually happening around this time and consider a short pause before difficult conversations.',
          sampleSize:es.length, observedValue:count/es.length, supportEntryIds:es.filter(e => timeBucket(new Date(e.at).getHours()) === bucket).map(e=>e.id), category:'Patterns', priority:82,
          experiment:{ title:`Protect the ${bucket}`, description:`For 7 days, avoid starting non-urgent difficult conversations during the ${bucket} when possible.` }
        }));
      }

      const weekdays = {};
      es.forEach(e => { const day = new Date(e.at).toLocaleDateString(undefined,{weekday:'long'}); weekdays[day]=(weekdays[day]||0)+1; });
      const [dayName, dayCount] = Object.entries(weekdays).sort((a,b)=>b[1]-a[1])[0] || [];
      if (dayCount >= 3 && dayCount/es.length >= .4) {
        insights.push(makeInsight({
          id:safeInsightId(['weekday',scope.personId||'all',dayName]), type:'weekday', personId:scope.personId,
          scope:scope.personId?'relationship':'household', title:`${dayName} concentration`,
          body:`${dayCount} of ${es.length} journaled fights${scope.personId?` with ${scope.label}`:''} happened on ${dayName}s.`,
          suggestion:'Treat this as a cue to plan for stress, transitions, hunger, fatigue, or overloaded schedules on that day.',
          sampleSize:es.length, observedValue:dayCount/es.length, supportEntryIds:es.filter(e=>new Date(e.at).toLocaleDateString(undefined,{weekday:'long'})===dayName).map(e=>e.id), category:'Patterns', priority:65
        }));
      }

      const feelingCounts = {};
      es.forEach(e => (e.answers?.feelings || []).forEach(f => feelingCounts[f]=(feelingCounts[f]||0)+1));
      Object.entries(feelingCounts).sort((a,b)=>b[1]-a[1]).slice(0,2).forEach(([feeling,count]) => {
        if (count >= 3 && count/es.length >= .45) {
          insights.push(makeInsight({
            id:safeInsightId(['feeling',scope.personId||'all',feeling]), type:'emotion', personId:scope.personId,
            scope:scope.personId?'relationship':'household', title:`${feeling} keeps showing up`,
            body:`You selected “${feeling}” in ${count} of ${es.length} reflections${scope.personId?` with ${scope.label}`:''}.`,
            suggestion:`When you notice ${feeling.toLowerCase()} building, name it before responding and buy yourself a little time.`,
            sampleSize:es.length, observedValue:count/es.length, supportEntryIds:es.filter(e=>(e.answers?.feelings||[]).includes(feeling)).map(e=>e.id), category:'Patterns', priority:78,
            experiment:{ title:`Name ${feeling.toLowerCase()} early`, description:`For 7 days, when ${feeling.toLowerCase()} shows up, say or write it down before continuing the disagreement.` }
          }));
        }
      });

      const triggerCounts = {};
      es.forEach(e => (e.answers?.triggerCategories || []).forEach(t => triggerCounts[t]=(triggerCounts[t]||0)+1));
      Object.entries(triggerCounts).sort((a,b)=>b[1]-a[1]).slice(0,2).forEach(([trigger,count]) => {
        if (count >= 3 && count/es.length >= .4) {
          insights.push(makeInsight({
            id:safeInsightId(['trigger',scope.personId||'all',trigger]), type:'trigger', personId:scope.personId,
            scope:scope.personId?'relationship':'household', title:`Recurring trigger: ${trigger}`,
            body:`“${trigger}” appeared in ${count} of ${es.length} reflections${scope.personId?` with ${scope.label}`:''}.`,
            suggestion:'Look for the earliest moment this topic starts to heat up and decide in advance what a calmer first response could be.',
            sampleSize:es.length, observedValue:count/es.length, supportEntryIds:es.filter(e=>(e.answers?.triggerCategories||[]).includes(trigger)).map(e=>e.id), category:'Patterns', priority:84,
            experiment:{ title:`Change the first 60 seconds`, description:`For 7 days, when “${trigger}” comes up, slow the first minute down: lower your voice, ask one question, and avoid rebutting immediately.` }
          }));
        }
      });

      const combos = {};
      es.forEach(e => {
        (e.answers?.triggerCategories || []).forEach(t => (e.answers?.feelings || []).forEach(f => {
          const key = `${t}|||${f}`; combos[key]=(combos[key]||0)+1;
        }));
      });
      const bestCombo = Object.entries(combos).sort((a,b)=>b[1]-a[1])[0];
      if (bestCombo && bestCombo[1] >= 3 && bestCombo[1]/es.length >= .35) {
        const [trigger, feeling] = bestCombo[0].split('|||');
        insights.push(makeInsight({
          id:safeInsightId(['combo',scope.personId||'all',trigger,feeling]), type:'cross-variable', personId:scope.personId,
          scope:scope.personId?'relationship':'household', title:`${trigger} + ${feeling}`,
          body:`That trigger-and-feeling combination appeared together in ${bestCombo[1]} of ${es.length} reflections${scope.personId?` with ${scope.label}`:''}.`,
          suggestion:`Treat “${trigger} + ${feeling}” as an early-warning signal rather than proof about why the fight happened.`,
          sampleSize:es.length, observedValue:bestCombo[1]/es.length, supportEntryIds:es.filter(e=>(e.answers?.triggerCategories||[]).includes(trigger)&&(e.answers?.feelings||[]).includes(feeling)).map(e=>e.id), category:'Patterns', priority:88
        }));
      }

      const intensityValues = es.map(e=>+e.answers?.intensity||0).filter(Boolean);
      if (intensityValues.length >= 5) {
        const recent = intensityValues.slice(-3); const previous = intensityValues.slice(-6,-3);
        if (previous.length === 3) {
          const r = mean(recent), p = mean(previous);
          if (Math.abs(r-p) >= .75) insights.push(makeInsight({
            id:safeInsightId(['intensity',scope.personId||'all',r>p?'up':'down']), type:'intensity', personId:scope.personId,
            scope:scope.personId?'relationship':'household', title:r>p?'Recent fights have felt more intense':'Recent fights have felt less intense',
            body:`Your last 3 reflected fights averaged ${r.toFixed(1)}/5 in intensity versus ${p.toFixed(1)}/5 for the previous 3.`,
            suggestion:r>p?'Consider prioritizing recovery and shorter conversations when emotions are elevated.':'That is a useful improvement signal. Notice what has been different lately.',
            sampleSize:6, observedValue:r, baselineValue:p, supportEntryIds:es.slice(-6).map(e=>e.id), category:'Trends', priority:86
          }));
        }
      }
    }
  });

  state.people.forEach(p => {
    const completed = (p.completedStreaks || []).map(s => s.durationMs / INSIGHT_DAY);
    if (completed.length >= 6) {
      const recent = mean(completed.slice(-3));
      const previous = mean(completed.slice(-6,-3));
      if (previous > 0 && Math.abs(recent-previous)/previous >= .25) {
        const improving = recent > previous;
        insights.push(makeInsight({
          id:safeInsightId(['streak-trend',p.id,improving?'up':'down']), type:'streak-trend', personId:p.id, scope:'relationship',
          title:improving?`Your streaks with ${p.name} are getting longer`:`Your recent streaks with ${p.name} are shorter`,
          body:`Your last 3 completed streaks averaged ${recent.toFixed(1)} days versus ${previous.toFixed(1)} days for the previous 3.`,
          suggestion:improving?'Notice what you have been doing differently and keep the useful parts.':'Use this as a prompt to look for changed stress, routines, or recurring triggers—not as a verdict on the relationship.',
          sampleSize:6, observedValue:recent, baselineValue:previous, category:'Trends', priority:92
        }));
      }
    }
    const completedBest = Math.max(0,...completed);
    const current = p.startedAt ? (now()-p.startedAt)/INSIGHT_DAY : 0;
    if (completedBest >= 3 && current < completedBest && completedBest-current <= 1.05) {
      insights.push(makeInsight({
        id:safeInsightId(['near-best',p.id,Math.floor(completedBest)]), type:'near-best', personId:p.id, scope:'relationship',
        title:`Close to a personal best with ${p.name}`, body:`You are about ${Math.max(0,completedBest-current).toFixed(1)} days from your longest completed streak of ${completedBest.toFixed(1)} days.`,
        suggestion:'Keep the focus on the relationship, not the number—the milestone will take care of itself.', sampleSize:completed.length, category:'Right Now', priority:90
      }));
    }
  });

  const recent30 = fights.filter(e=>e.at>=daysAgo(30));
  const prior30 = fights.filter(e=>e.at>=daysAgo(60)&&e.at<daysAgo(30));
  if (prior30.length >= 3 && recent30.length + prior30.length >= 6) {
    const change = (recent30.length-prior30.length)/prior30.length;
    if (Math.abs(change) >= .25) insights.push(makeInsight({
      id:safeInsightId(['household-30',change<0?'down':'up']), type:'household-trend', scope:'household',
      title:change<0?'Fewer fights over the last 30 days':'More fights over the last 30 days',
      body:`You recorded ${recent30.length} fights in the last 30 days versus ${prior30.length} in the preceding 30 days (${Math.round(Math.abs(change)*100)}% ${change<0?'fewer':'more'}).`,
      suggestion:change<0?'That is a meaningful directional signal. Look for routines or responses worth preserving.':'Treat this as a signal to inspect recent stressors and patterns, not as a judgment.',
      sampleSize:recent30.length+prior30.length, observedValue:recent30.length, baselineValue:prior30.length, supportEventIds:[...recent30,...prior30].map(e=>e.id), category:'Trends', priority:96
    }));
  }

  const lastTen = [...fights].sort((a,b)=>b.at-a.at).slice(0,10);
  if (lastTen.length >= 5) {
    const journaledIds = new Set((state.journalEntries||[]).map(e=>e.fightEventId));
    const journaled = lastTen.filter(e=>journaledIds.has(e.id)).length;
    const rate = journaled/lastTen.length;
    if (rate >= .8) insights.push(makeInsight({
      id:'reflection-consistency', type:'reflection', title:'You are consistently reflecting', body:`You journaled ${journaled} of your last ${lastTen.length} fights.`,
      suggestion:'Consistency makes the pattern data more reliable and gives you a better record of what actually happened.', sampleSize:lastTen.length, observedValue:rate, supportEventIds:lastTen.map(e=>e.id), category:'Trends', priority:60
    }));
  }

  const repairSamples = [];
  entries.forEach(entry => {
    const nextFight = fights.find(f => f.personId===entry.personId && f.at>entry.at);
    if (!nextFight || !nextFight.durationMs) return;
    (entry.answers?.nextSteps || []).forEach(step => repairSamples.push({ step, days:nextFight.durationMs/INSIGHT_DAY, entryId:entry.id }));
  });
  if (repairSamples.length >= 6) {
    const overall = mean(repairSamples.map(s=>s.days));
    const groups = {};
    repairSamples.forEach(s => (groups[s.step] ||= []).push(s));
    Object.entries(groups).forEach(([step,samples]) => {
      if (samples.length >= 3) {
        const avg = mean(samples.map(s=>s.days));
        if (overall > 0 && avg >= overall*1.25) insights.push(makeInsight({
          id:safeInsightId(['repair',step]), type:'repair-association', title:`Longer streaks have followed “${step}”`,
          body:`After reflections where you selected “${step},” the following streak averaged ${avg.toFixed(1)} days versus ${overall.toFixed(1)} days across measured repair choices.`,
          suggestion:'This is an association, not proof of cause. Still, it may be a repair behavior worth repeating when it fits the situation.',
          sampleSize:samples.length, observedValue:avg, baselineValue:overall, supportEntryIds:samples.map(s=>s.entryId), category:'Patterns', priority:94
        }));
      }
    });
  }

  return insights
    .filter(i=>!isDismissed(i.id))
    .sort((a,b)=>b.priority-a.priority || b.sampleSize-a.sampleSize);
}

function insightMeta(insight) {
  return `${insight.sampleSize} observation${insight.sampleSize===1?'':'s'} · ${insight.confidence}`;
}
function feedbackLabel(id) { return state.insightFeedback?.[id]; }

function insightCard(insight, compact=false) {
  const fb = feedbackLabel(insight.id);
  return `<article class="insight-card ${compact?'compact':''}" data-insight-card="${insight.id}">
    <div class="insight-card-top"><span class="insight-spark">💡</span><div><p class="eyebrow">${escapeHtml(insight.category.toUpperCase())}</p><h3>${escapeHtml(insight.title)}</h3></div></div>
    <p class="insight-body">${escapeHtml(insight.body)}</p>
    ${insight.suggestion?`<div class="insight-try"><strong>Try:</strong> ${escapeHtml(insight.suggestion)}</div>`:''}
    <div class="insight-meta">${escapeHtml(insightMeta(insight))}</div>
    <div class="insight-actions">
      <button class="insight-link" data-evidence="${insight.id}">View evidence</button>
      ${insight.experiment?`<button class="insight-link" data-experiment="${insight.id}">Try 7-day experiment</button>`:''}
      <span class="insight-spacer"></span>
      <button class="insight-icon ${fb==='helpful'?'selected':''}" data-feedback="helpful" data-id="${insight.id}" aria-label="Helpful">👍</button>
      <button class="insight-icon ${fb==='not-helpful'?'selected':''}" data-feedback="not-helpful" data-id="${insight.id}" aria-label="Not helpful">👎</button>
      <button class="insight-icon" data-dismiss="${insight.id}" aria-label="Dismiss">×</button>
    </div>
  </article>`;
}

function bindInsightActions(root, insights) {
  root.querySelectorAll('[data-evidence]').forEach(btn=>btn.onclick=()=>{
    const insight=insights.find(i=>i.id===btn.dataset.evidence); if(insight) openInsightEvidence(insight);
  });
  root.querySelectorAll('[data-feedback]').forEach(btn=>btn.onclick=()=>{
    state.insightFeedback[btn.dataset.id]=btn.dataset.feedback; saveState();
    root.querySelectorAll(`[data-id="${CSS.escape(btn.dataset.id)}"]`).forEach(x=>x.classList.remove('selected'));
    btn.classList.add('selected'); toast(btn.dataset.feedback==='helpful'?'Marked helpful.':'Feedback saved.');
  });
  root.querySelectorAll('[data-dismiss]').forEach(btn=>btn.onclick=()=>{
    state.insightDismissals[btn.dataset.dismiss]=now()+30*INSIGHT_DAY; saveState();
    btn.closest('.insight-card')?.remove(); toast('Insight hidden for 30 days.');
  });
  root.querySelectorAll('[data-experiment]').forEach(btn=>btn.onclick=()=>{
    const insight=insights.find(i=>i.id===btn.dataset.experiment); if(insight) startInsightExperiment(insight);
  });
}

function openInsightEvidence(insight) {
  const entryMap = new Map((state.journalEntries||[]).map(e=>[e.id,e]));
  const eventMap = new Map(state.events.map(e=>[e.id,e]));
  const items = [
    ...insight.supportEntryIds.map(id=>({kind:'entry', value:entryMap.get(id)})).filter(x=>x.value),
    ...insight.supportEventIds.map(id=>({kind:'event', value:eventMap.get(id)})).filter(x=>x.value)
  ].sort((a,b)=>b.value.at-a.value.at);
  const modal=document.createElement('div'); modal.className='modal-backdrop journal-backdrop';
  modal.innerHTML=`<div class="modal journal-browser insight-evidence"><button class="modal-close">×</button><p class="eyebrow">INSIGHT EVIDENCE</p><h2>${escapeHtml(insight.title)}</h2><p class="journal-intro">${escapeHtml(insight.body)}</p><div class="evidence-list">${items.length?items.map(item=>{
    const p=state.people.find(x=>x.id===item.value.personId); const when=formatJournalDate(item.value.at);
    if(item.kind==='entry') return `<button class="evidence-row" data-open-journal="${item.value.id}"><strong>${escapeHtml(p?.name||'Family member')}</strong><span>${escapeHtml(when)} · ${escapeHtml(journalPreview(item.value).slice(0,95))}</span></button>`;
    return `<div class="evidence-row static"><strong>${escapeHtml(p?.name||'Family member')}</strong><span>${escapeHtml(when)} · Fight reset recorded</span></div>`;
  }).join(''):'<div class="empty-state">This insight is based on streak aggregates rather than individual journal entries.</div>'}</div><div class="reflection-nudge">Patterns describe what appears in your records. They do not establish who was right or what caused a fight.</div></div>`;
  document.body.append(modal); modal.querySelector('.modal-close').onclick=()=>modal.remove();
  modal.querySelectorAll('[data-open-journal]').forEach(btn=>btn.onclick=()=>{const e=entryMap.get(btn.dataset.openJournal); if(e){modal.remove();openJournalEntry(e);}});
}

function weeklyFightBars() {
  const fights=fightEvents(); const rows=[];
  for(let w=5;w>=0;w--){const end=now()-w*7*INSIGHT_DAY;const start=end-7*INSIGHT_DAY;const count=fights.filter(f=>f.at>=start&&f.at<end).length;rows.push({label:w===0?'This week':`${w}w ago`,count});}
  const max=Math.max(1,...rows.map(r=>r.count));
  return `<div class="mini-chart">${rows.map(r=>`<div class="mini-bar-col"><span class="mini-bar-value">${r.count}</span><div class="mini-bar-track"><i style="height:${Math.max(5,r.count/max*100)}%"></i></div><small>${r.label}</small></div>`).join('')}</div>`;
}

function relationshipTrendRows() {
  return state.people.map(p=>{
    const fights=fightEvents().filter(f=>f.personId===p.id); const current=currentDays(p); const completed=(p.completedStreaks||[]).map(s=>s.durationMs/INSIGHT_DAY); const avg=mean(completed);
    return `<div class="relationship-trend-row">${avatar(p,'sm')}<div><strong>${escapeHtml(p.name)}</strong><small>${fights.length} fights recorded · avg completed streak ${avg?avg.toFixed(1):'—'} days</small></div><b>${current}d</b></div>`;
  }).join('') || '<div class="empty-state">Add family members to see relationship trends.</div>';
}

function refreshExperiments() {
  state.experiments.forEach(exp=>{
    if(exp.status==='active' && now()>=exp.endsAt){
      exp.status='complete'; exp.completedAt=now();
      const during=fightEvents().filter(f=>f.at>=exp.startsAt&&f.at<=exp.endsAt&&(exp.personId?f.personId===exp.personId:true)).length;
      exp.result={during,baselineWeekly:exp.baselineWeekly};
    }
  }); saveState();
}
function experimentCard(exp) {
  const remaining=Math.max(0,Math.ceil((exp.endsAt-now())/INSIGHT_DAY));
  const result=exp.result;
  return `<div class="experiment-card"><p class="eyebrow">${exp.status==='active'?'ACTIVE EXPERIMENT':'COMPLETED EXPERIMENT'}</p><h4>${escapeHtml(exp.title)}</h4><p>${escapeHtml(exp.description)}</p>${exp.status==='active'?`<strong>${remaining} day${remaining===1?'':'s'} remaining</strong>`:`<strong>${result?`${result.during} fights during experiment · recent baseline ${result.baselineWeekly.toFixed(1)}/week`:'Completed'}</strong>`}</div>`;
}
function startInsightExperiment(insight) {
  if(!insight.experiment)return;
  const existing=state.experiments.find(e=>e.status==='active'&&e.insightId===insight.id); if(existing){toast('That experiment is already active.');return;}
  const scopeFights=fightEvents().filter(f=>(insight.personId?f.personId===insight.personId:true)&&f.at>=daysAgo(28));
  state.experiments.unshift({id:id(),insightId:insight.id,personId:insight.personId||null,title:insight.experiment.title,description:insight.experiment.description,startsAt:now(),endsAt:now()+7*INSIGHT_DAY,status:'active',baselineWeekly:scopeFights.length/4});
  saveState(); toast('7-day experiment started. 🧪');
}

function openInsightsScreen() {
  refreshExperiments();
  const insights=deriveInsights(); const modal=document.createElement('div'); modal.className='modal-backdrop journal-backdrop';
  const sections=['Right Now','Relationships','Trends','Patterns'];
  const relationshipInsights=insights.filter(i=>i.personId);
  modal.innerHTML=`<div class="modal journal-browser insights-browser"><button class="modal-close">×</button><p class="eyebrow">PRIVATE · ON-DEVICE</p><h2>Insights</h2><p class="journal-intro">Patterns from your streaks and reflections. Correlation is not causation; these are prompts for reflection, not judgments.</p>
    <section class="insights-summary"><h3>Fight frequency</h3>${weeklyFightBars()}</section>
    <section class="insights-summary"><h3>Relationships</h3><div class="relationship-trends">${relationshipTrendRows()}</div></section>
    ${state.experiments.length?`<section class="insights-summary"><h3>Experiments</h3><div class="experiment-list">${state.experiments.slice(0,4).map(experimentCard).join('')}</div></section>`:''}
    ${sections.map(section=>{let subset=section==='Relationships'?relationshipInsights:insights.filter(i=>i.category===section);if(section==='Right Now')subset=insights.filter(i=>i.category==='Right Now').concat(insights.slice(0,2)).filter((v,i,a)=>a.findIndex(x=>x.id===v.id)===i).slice(0,4);return `<section class="insight-section"><h3>${section}</h3>${subset.length?subset.slice(0,8).map(i=>insightCard(i,true)).join(''):'<div class="empty-state">Not enough evidence yet. Keep using the journal and this section will fill in over time.</div>'}</section>`;}).join('')}
  </div>`;
  document.body.append(modal); modal.querySelector('.modal-close').onclick=()=>modal.remove(); bindInsightActions(modal,insights);
}

function decorateInsightsHub() {
  if(!state.onboardingComplete)return; const shell=document.querySelector('.app-shell'); if(!shell||shell.querySelector('#insightsHub'))return;
  const journalHub=shell.querySelector('#journalHub'); const footer=shell.querySelector('footer'); const insights=deriveInsights();
  const section=document.createElement('section');section.id='insightsHub';section.className='insights-hub';
  section.innerHTML=`<div class="section-heading"><div><p class="eyebrow">INSIGHTS</p><h2>What the patterns are saying.</h2></div><button class="text-btn" id="viewAllInsights">View all</button></div>
    ${insights.length?`<div class="insight-card-stack">${insights.slice(0,3).map(i=>insightCard(i)).join('')}</div>`:`<div class="journal-hub-card insight-empty"><div class="journal-hub-copy"><span class="journal-icon">💡</span><div><strong>Insights unlock with use</strong><small>After a few reflected fights, DSWF will begin surfacing timing, emotion, trigger, and streak patterns.</small></div></div><button class="btn btn-primary" id="openInsightsEmpty">Open Insights</button></div>`}`;
  (journalHub||footer)?.before(section); section.querySelector('#viewAllInsights').onclick=openInsightsScreen; section.querySelector('#openInsightsEmpty')?.addEventListener('click',openInsightsScreen); bindInsightActions(section,insights);
}

openJournalFlow = function enhancedJournalFlow(personId, fightEventId, fightAt, existingEntry = null) {
  const person=state.people.find(p=>p.id===personId); if(!person)return;
  const existing=existingEntry||state.journalEntries.find(e=>e.fightEventId===fightEventId);
  const draft={
    whatHappened:existing?.answers?.whatHappened||'', trigger:existing?.answers?.trigger||'', triggerCategories:[...(existing?.answers?.triggerCategories||[])],
    feelings:[...(existing?.answers?.feelings||[])], whatNeeded:existing?.answers?.whatNeeded||'', intensity:+existing?.answers?.intensity||0,
    myPart:existing?.answers?.myPart||'', nextSteps:[...(existing?.answers?.nextSteps||[])], repairStatus:existing?.answers?.repairStatus||'', betterNextTime:existing?.answers?.betterNextTime||''
  };
  let step=0; const steps=['What happened?','What was happening inside you?','Own your part','Choose the next move'];
  const modal=document.createElement('div');modal.className='modal-backdrop journal-backdrop';document.body.append(modal);
  const renderStep=()=>{
    const progress=((step+1)/steps.length)*100;let body='';
    if(step===0)body=`<p class="journal-question">What triggered this?</p><div class="choice-chips trigger-chips">${INSIGHT_TRIGGER_CATEGORIES.map(t=>`<button type="button" class="choice-chip ${draft.triggerCategories.includes(t)?'selected':''}" data-trigger-category="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div><label class="journal-label">What happened?<textarea id="whatHappened" maxlength="2000" placeholder="Describe it as plainly as you can. What was said or done?">${escapeHtml(draft.whatHappened)}</textarea></label><label class="journal-label">Anything else about what set it off?<textarea id="trigger" maxlength="1000" placeholder="Optional context in your own words.">${escapeHtml(draft.trigger)}</textarea></label>`;
    else if(step===1)body=`<p class="journal-question">What were you feeling?</p><div class="choice-chips">${FEELINGS.map(f=>`<button type="button" class="choice-chip ${draft.feelings.includes(f)?'selected':''}" data-feeling="${f}">${f}</button>`).join('')}</div><p class="journal-question intensity-heading">How intense did it get?</p><div class="intensity-scale">${[1,2,3,4,5].map(n=>`<button type="button" class="intensity-btn ${draft.intensity===n?'selected':''}" data-intensity="${n}"><b>${n}</b><small>${['Low','Mild','Medium','High','Very high'][n-1]}</small></button>`).join('')}</div><label class="journal-label">What did you need, want, or feel you were protecting?<textarea id="whatNeeded" maxlength="1500" placeholder="Examples: respect, quiet, help, control, reassurance, being heard…">${escapeHtml(draft.whatNeeded)}</textarea></label>`;
    else if(step===2)body=`<label class="journal-label">What part was yours?<textarea id="myPart" maxlength="2000" placeholder="Focus on what you can own without keeping score of the other person's part.">${escapeHtml(draft.myPart)}</textarea></label><div class="reflection-nudge">You can be right about the issue and still identify something you wish you had handled differently.</div>`;
    else body=`<p class="journal-question">What do you want to do next?</p><div class="choice-chips">${NEXT_STEPS.map(x=>`<button type="button" class="choice-chip ${draft.nextSteps.includes(x)?'selected':''}" data-next="${x}">${x}</button>`).join('')}</div><p class="journal-question repair-heading">Have things been repaired yet?</p><div class="repair-options">${REPAIR_STATUSES.map(x=>`<button type="button" class="choice-chip ${draft.repairStatus===x?'selected':''}" data-repair="${x}">${x}</button>`).join('')}</div><label class="journal-label">What would a better response look like next time?<textarea id="betterNextTime" maxlength="2000" placeholder="Give future-you something specific to try.">${escapeHtml(draft.betterNextTime)}</textarea></label>`;
    modal.innerHTML=`<div class="modal journal-modal"><button class="modal-close" id="closeJournal">×</button><p class="eyebrow">POST-FIGHT REFLECTION · ${escapeHtml(person.name.toUpperCase())}</p><div class="journal-progress"><span style="width:${progress}%"></span></div><div class="journal-step-count">${step+1} of ${steps.length}</div><h2>${steps[step]}</h2><p class="journal-intro">This is for understanding the quarrel—not winning it.</p><div class="journal-step-body">${body}</div><div class="journal-actions">${step>0?'<button class="btn btn-ghost" id="journalBack">← Back</button>':'<button class="btn btn-ghost" id="journalLater">Not now</button>'}<button class="btn btn-primary" id="journalNext">${step===steps.length-1?'Save reflection':'Continue →'}</button></div></div>`;
    const sync=()=>{if(step===0){draft.whatHappened=modal.querySelector('#whatHappened')?.value.trim()||'';draft.trigger=modal.querySelector('#trigger')?.value.trim()||'';}else if(step===1){draft.whatNeeded=modal.querySelector('#whatNeeded')?.value.trim()||'';}else if(step===2){draft.myPart=modal.querySelector('#myPart')?.value.trim()||'';}else{draft.betterNextTime=modal.querySelector('#betterNextTime')?.value.trim()||'';}};
    modal.querySelectorAll('[data-trigger-category]').forEach(btn=>btn.onclick=()=>{const v=btn.dataset.triggerCategory;draft.triggerCategories=draft.triggerCategories.includes(v)?draft.triggerCategories.filter(x=>x!==v):[...draft.triggerCategories,v];btn.classList.toggle('selected');});
    modal.querySelectorAll('[data-feeling]').forEach(btn=>btn.onclick=()=>{const v=btn.dataset.feeling;draft.feelings=draft.feelings.includes(v)?draft.feelings.filter(x=>x!==v):[...draft.feelings,v];btn.classList.toggle('selected');});
    modal.querySelectorAll('[data-intensity]').forEach(btn=>btn.onclick=()=>{draft.intensity=+btn.dataset.intensity;modal.querySelectorAll('[data-intensity]').forEach(x=>x.classList.toggle('selected',x===btn));});
    modal.querySelectorAll('[data-next]').forEach(btn=>btn.onclick=()=>{const v=btn.dataset.next;draft.nextSteps=draft.nextSteps.includes(v)?draft.nextSteps.filter(x=>x!==v):[...draft.nextSteps,v];btn.classList.toggle('selected');});
    modal.querySelectorAll('[data-repair]').forEach(btn=>btn.onclick=()=>{draft.repairStatus=btn.dataset.repair;modal.querySelectorAll('[data-repair]').forEach(x=>x.classList.toggle('selected',x===btn));});
    modal.querySelector('#closeJournal').onclick=()=>modal.remove();modal.querySelector('#journalLater')?.addEventListener('click',()=>modal.remove());modal.querySelector('#journalBack')?.addEventListener('click',()=>{sync();step--;renderStep();});modal.querySelector('#journalNext').onclick=()=>{sync();if(step<steps.length-1){step++;renderStep();return;}saveJournalEntry({existing,personId,fightEventId,fightAt,answers:draft});modal.remove();toast(existing?'Reflection updated.':'Reflection saved. 📝');document.querySelector('#insightsHub')?.remove();decorateJournalHub();decorateInsightsHub();};
  }; renderStep();
};

const baseOpenJournalEntryInsights = openJournalEntry;
openJournalEntry = function openJournalEntryWithStructuredFields(entry) {
  baseOpenJournalEntryInsights(entry);
  const modal=[...document.querySelectorAll('.journal-detail')].at(-1); if(!modal)return;
  const actions=modal.querySelector('.journal-actions'); const a=entry.answers||{};
  const extra=document.createElement('div');extra.className='structured-journal-detail';extra.innerHTML=`${journalDetailSection('Trigger categories',(a.triggerCategories||[]).join(', '))}${journalDetailSection('Intensity',a.intensity?`${a.intensity}/5`:'')}${journalDetailSection('Repair status',a.repairStatus||'')}`; actions?.before(extra);
};

const insightsObserver=new MutationObserver(()=>decorateInsightsHub());
insightsObserver.observe(document.querySelector('#app'),{childList:true,subtree:true});
decorateInsightsHub();
