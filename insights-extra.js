// Additional v1.2 pattern detectors layered onto the core insights engine.
const baseDeriveInsightsV12 = deriveInsights;
deriveInsights = function deriveInsightsWithContrasts() {
  const insights = baseDeriveInsightsV12();
  const entries = journalEntriesSorted();
  const fights = fightEvents();
  const extras = [];

  // Recent clustering: three or more fights inside any five-day window, only while still recent.
  if (fights.length >= 3) {
    const recent = fights.filter(f => f.at >= daysAgo(14));
    let bestCluster = [];
    recent.forEach((start, i) => {
      const cluster = recent.slice(i).filter(f => f.at >= start.at && f.at <= start.at + 5 * INSIGHT_DAY);
      if (cluster.length > bestCluster.length) bestCluster = cluster;
    });
    if (bestCluster.length >= 3) {
      extras.push(makeInsight({
        id:'recent-fight-cluster', type:'clustering', title:'Fights are clustering right now', category:'Right Now', priority:99,
        body:`You recorded ${bestCluster.length} fights inside a 5-day window recently.`,
        suggestion:'A cluster can reflect temporary stress as much as a relationship pattern. Consider lowering the temperature, simplifying demands, and protecting recovery time for a few days.',
        sampleSize:bestCluster.length, supportEventIds:bestCluster.map(f=>f.id),
        experiment:{title:'Lower the temperature',description:'For 7 days, prioritize short pauses, sleep, food, and postponing non-urgent disagreements when emotions are already elevated.'}
      }));
    }
  }

  // Household fight-free milestone based on the least-advanced active relationship streak.
  const active = state.people.filter(p=>p.startedAt);
  if (active.length && fights.length) {
    const minDays = Math.min(...active.map(p=>currentDays(p)));
    const mark = [90,60,30,14,7].find(d=>minDays>=d);
    if (mark) extras.push(makeInsight({
      id:`household-fight-free-${mark}`, type:'milestone', title:`${mark} fight-free days across every active streak`, category:'Right Now', priority:97,
      body:`Every currently running family streak has reached at least ${mark} completed 24-hour days.`,
      suggestion:'Celebrate the steadier pattern without turning the streak into pressure. The point is the relationship, not perfection.',
      sampleSize:active.length
    }));
  }

  // Relationship-specific contrasts against the user's other relationships.
  state.people.forEach(person => {
    const mine = entries.filter(e=>e.personId===person.id);
    const others = entries.filter(e=>e.personId!==person.id);
    if (mine.length < 5 || others.length < 5) return;

    const mineFeelings = {}; const otherFeelings = {};
    mine.forEach(e=>(e.answers?.feelings||[]).forEach(v=>mineFeelings[v]=(mineFeelings[v]||0)+1));
    others.forEach(e=>(e.answers?.feelings||[]).forEach(v=>otherFeelings[v]=(otherFeelings[v]||0)+1));
    Object.entries(mineFeelings).forEach(([value,count])=>{
      const mineRate=count/mine.length; const otherRate=(otherFeelings[value]||0)/others.length;
      if(count>=3 && mineRate>=.5 && mineRate-otherRate>=.25) extras.push(makeInsight({
        id:safeInsightId(['relationship-contrast-feeling',person.id,value]), type:'relationship-contrast', personId:person.id, scope:'relationship', category:'Relationships', priority:91,
        title:`“${value}” is especially common with ${person.name}`,
        body:`You selected “${value}” in ${pct(mineRate)} of reflections with ${person.name} versus ${pct(otherRate)} across your other relationships.`,
        suggestion:'Use the contrast as a question: what does this relationship or situation tend to bring up for you? Avoid treating it as evidence about the other person.',
        sampleSize:mine.length+others.length, observedValue:mineRate, baselineValue:otherRate,
        supportEntryIds:mine.filter(e=>(e.answers?.feelings||[]).includes(value)).map(e=>e.id)
      }));
    });

    const mineTriggers = {}; const otherTriggers = {};
    mine.forEach(e=>(e.answers?.triggerCategories||[]).forEach(v=>mineTriggers[v]=(mineTriggers[v]||0)+1));
    others.forEach(e=>(e.answers?.triggerCategories||[]).forEach(v=>otherTriggers[v]=(otherTriggers[v]||0)+1));
    Object.entries(mineTriggers).forEach(([value,count])=>{
      const mineRate=count/mine.length; const otherRate=(otherTriggers[value]||0)/others.length;
      if(count>=3 && mineRate>=.45 && mineRate-otherRate>=.25) extras.push(makeInsight({
        id:safeInsightId(['relationship-contrast-trigger',person.id,value]), type:'relationship-contrast', personId:person.id, scope:'relationship', category:'Relationships', priority:93,
        title:`“${value}” stands out with ${person.name}`,
        body:`That trigger appears in ${pct(mineRate)} of reflections with ${person.name} versus ${pct(otherRate)} across your other relationships.`,
        suggestion:'Consider planning a calmer default response for this topic before the next time it comes up.',
        sampleSize:mine.length+others.length, observedValue:mineRate, baselineValue:otherRate,
        supportEntryIds:mine.filter(e=>(e.answers?.triggerCategories||[]).includes(value)).map(e=>e.id)
      }));
    });
  });

  return [...insights, ...extras.filter(i=>!isDismissed(i.id))]
    .filter((value,index,array)=>array.findIndex(x=>x.id===value.id)===index)
    .sort((a,b)=>b.priority-a.priority || b.sampleSize-a.sampleSize);
};
