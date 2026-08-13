// DSWF leaderboard v2
// Rankings use two variables: longer current streaks are better, fewer cumulative fights are better.
// Composite Peace Score: 75% current streak duration + 25% inverse cumulative fight count.

function currentStreakMs(person) {
  return person?.startedAt ? Math.max(0, now() - person.startedAt) : 0;
}

function cumulativeFightCount(person) {
  return state.events.filter(event => event.type === 'fight' && event.personId === person.id).length;
}

function leaderboardMetrics(people = state.people) {
  const rows = people.map(person => ({
    person,
    streakMs: currentStreakMs(person),
    fights: cumulativeFightCount(person)
  }));

  const maxStreak = Math.max(0, ...rows.map(row => row.streakMs));
  const fightValues = rows.map(row => row.fights);
  const minFights = fightValues.length ? Math.min(...fightValues) : 0;
  const maxFights = fightValues.length ? Math.max(...fightValues) : 0;

  return rows.map(row => {
    // Best current streak receives 100% of the streak component.
    const streakComponent = maxStreak > 0 ? row.streakMs / maxStreak : 0;

    // Fewest fights receives 100% of the fight component. If everyone has the
    // same count, fight history is neutral and everyone receives equal credit.
    const fightComponent = maxFights === minFights
      ? 1
      : (maxFights - row.fights) / (maxFights - minFights);

    const peaceScore = (streakComponent * 0.75) + (fightComponent * 0.25);
    return { ...row, streakComponent, fightComponent, peaceScore };
  }).sort((a, b) =>
    b.peaceScore - a.peaceScore ||
    b.streakMs - a.streakMs ||
    a.fights - b.fights ||
    (a.person.createdAt || 0) - (b.person.createdAt || 0)
  );
}

function formatLeaderboardStreak(ms) {
  const s = elapsed(ms);
  if (s.days > 0) return `${s.days}d ${s.hours}h`;
  if (s.hours > 0) return `${s.hours}h ${s.minutes}m`;
  return `${s.minutes}m`;
}

// Replace the original dashboard renderer so live cards and leaderboard share
// the corrected ordering. Other modules can continue decorating the dashboard.
renderDashboard = function renderDashboardWithPeaceScore() {
  const app = document.querySelector('#app');
  const metrics = leaderboardMetrics(state.people);
  const ranked = metrics.map(row => row.person);
  const active = state.people.filter(p => p.startedAt);
  const totalPeaceDays = active.reduce((sum,p) => sum + currentDays(p), 0);
  const best = Math.max(0, ...state.people.map(bestDays));

  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">FAMILY PEACE SCOREBOARD</p>
          <h1 class="logo-title">Days Since <span>We Fought</span></h1>
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
        <div class="section-heading"><div><p class="eyebrow">LEADERBOARD</p><h2>Peace rankings</h2><small class="leaderboard-explainer">75% current streak · 25% fewer fights</small></div></div>
        <div class="leaderboard">
          ${metrics.map((row,i) => leaderboardRowV2(row,i)).join('')}
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
};

function leaderboardRowV2(row, i) {
  const p = row.person;
  const medal = ['🥇','🥈','🥉'][i] || `${i+1}.`;
  const score = Math.round(row.peaceScore * 100);
  const fightLabel = `${row.fights} fight${row.fights === 1 ? '' : 's'}`;
  return `<div class="leader-row">
    <span class="rank">${medal}</span>
    ${avatar(p,'sm')}
    <div class="leader-name">
      <strong>${escapeHtml(p.name)}</strong>
      <small>${formatLeaderboardStreak(row.streakMs)} current · ${fightLabel}</small>
    </div>
    <div class="leader-score peace-score">
      <strong>${score}</strong>
      <small>peace score</small>
    </div>
  </div>`;
}

const leaderboardStyle = document.createElement('style');
leaderboardStyle.textContent = `
.leaderboard-explainer{display:block;color:var(--muted);font-size:10px;font-weight:700;margin-top:5px;letter-spacing:.02em}.leader-score.peace-score strong{font-size:25px}.leader-score.peace-score small{white-space:nowrap}.leader-name small{line-height:1.35}
`;
document.head.append(leaderboardStyle);

// app.js renders once before this module loads. Re-render after installing the
// corrected ranking logic; journal/insight observers will redecorate afterward.
if (state.onboardingComplete) render();
