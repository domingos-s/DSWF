// DSWF milestone ladder — intentionally realistic and achievable.
// Milestones run from 1 to 30 completed 24-hour days.

milestone = function milestone30(days) {
  const marks = [1, 3, 7, 10, 14, 21, 30];
  const next = marks.find(m => m > days);
  const achieved = [...marks].reverse().find(m => m <= days) || 0;
  return { achieved, next };
};

achievementBadges = function achievementBadges30() {
  const marks = [
    [1, '🌤️', 'First Day'],
    [3, '✨', 'Good Start'],
    [7, '🧊', 'Cool Head'],
    [10, '🙌', 'Double Digits'],
    [14, '🤝', 'Diplomat'],
    [21, '🌿', 'Three Weeks'],
    [30, '🕊️', 'Peacemaker']
  ];
  const best = Math.max(0, ...state.people.map(bestDays));
  return marks.map(([d,e,n]) => `<div class="badge ${best>=d?'earned':'locked'}"><span>${best>=d?e:'🔒'}</span><strong>${n}</strong><small>${d} day${d===1?'':'s'}</small></div>`).join('');
};

const originalPersonCardForMilestones = personCard;
personCard = function personCardWithThirtyDayCap(person, rank) {
  return originalPersonCardForMilestones(person, rank)
    .replace('Legend status unlocked', '30-day milestone achieved');
};

// Re-render once so a currently open session picks up the revised ladder.
if (state.onboardingComplete) render();
