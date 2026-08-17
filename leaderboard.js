// DSWF leaderboard v4
// Peace Score is absolute rather than relative to other family members.
// Score = absolute current-streak score - cumulative fight penalty + recognition rehabilitation.

const RECOGNITION_PEACE_POINTS = 2;
const FIGHT_PEACE_PENALTY = 3;
const MAX_FIGHT_PENALTY = 30;
const MAX_PEACE_SCORE = 100;

// Absolute streak progression. Scores between milestones are linearly interpolated.
// A running streak starts at 25, reaches 35 after 1 full day, 50 at 3 days,
// 65 at 7, 80 at 14, 95 at 30, and 100 at 60 days.
const PEACE_STREAK_CURVE = [
  [0, 25],
  [1, 35],
  [3, 50],
  [7, 65],
  [14, 80],
  [30, 95],
  [60, 100]
];

function currentStreakMs(person) {
  return person?.startedAt ? Math.max(0, now() - person.startedAt) : 0;
}

function cumulativeFightCount(person) {
  return state.events.filter(event => event.type === 'fight' && event.personId === person.id).length;
}

function recognitionCountForPeaceScore(person) {
  const recognitions = Array.isArray(state.recognitions) ? state.recognitions : [];
  return recognitions.filter(recognition => recognition.personId === person.id).length;
}

function absoluteStreakPeaceScore(person, streakMs = currentStreakMs(person)) {
  if (!person?.startedAt) return 0;
  const days = Math.max(0, streakMs / DAY);

  for (let i = 0; i < PEACE_STREAK_CURVE.length - 1; i++) {
    const [startDay, startScore] = PEACE_STREAK_CURVE[i];
    const [endDay, endScore] = PEACE_STREAK_CURVE[i + 1];
    if (days <= endDay) {
      const progress = (days - startDay) / (endDay - startDay);
      return startScore + Math.max(0, Math.min(1, progress)) * (endScore - startScore);
    }
  }

  return MAX_PEACE_SCORE;
}

function leaderboardMetrics(people = state.people) {
  return people.map(person => {
    const streakMs = currentStreakMs(person);
    const fights = cumulativeFightCount(person);
    const recognitions = recognitionCountForPeaceScore(person);
    const streakScore = absoluteStreakPeaceScore(person, streakMs);
    const fightPenalty = Math.min(MAX_FIGHT_PENALTY, fights * FIGHT_PEACE_PENALTY);
    const recognitionBonus = recognitions * RECOGNITION_PEACE_POINTS;
    const basePeaceScore = Math.max(0, streakScore - fightPenalty);
    const peaceScore = Math.max(0, Math.min(MAX_PEACE_SCORE, basePeaceScore + recognitionBonus));

    return {
      person,
      streakMs,
      fights,
      recognitions,
      streakScore,
      fightPenalty,
      recognitionBonus,
      basePeaceScore,
      peaceScore
    };
  }).sort((a, b) =>
    b.peaceScore - a.peaceScore ||
    b.streakMs - a.streakMs ||
    a.fights - b.fights ||
    b.recognitions - a.recognitions ||
    (a.person.createdAt || 0) - (b.person.createdAt || 0)
  );
}

function formatLeaderboardStreak(ms) {
  const s = elapsed(ms);
  if (s.days > 0) return `${s.days}d ${s.hours}h`;
  if (s.hours > 0) return `${s.hours}h ${s.minutes}m`;
  return `${s.minutes}m`;
}

function formatCombinedPeace(ms) {
  const totalHours = Math.max(0, Math.floor(ms / 3600000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return { primary: days, secondary: `${hours}h`, label: 'combined peace time' };
  return { primary: hours, secondary: 'h', label: 'combined peace time' };
}

renderDashboard = function renderDashboardWithPeaceScore() {
  const app = document.querySelector('#app');
  const metrics = leaderboardMetrics(state.people);
  const ranked = metrics.map(row => row.person);
  const active = state.people.filter(p => p.startedAt);
  const totalPeaceMs = active.reduce((sum,p) => sum + currentStreakMs(p), 0);
  const combined = formatCombinedPeace(totalPeaceMs);
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
        <div><span>${combined.primary}<em class="peace-hours">${combined.secondary}</em></span><small>${combined.label}</small></div>
        <div><span>${best}</span><small>best streak ever</small></div>
      </section>

      <section>
        <div class="section-heading"><div><p class="eyebrow">LIVE STREAKS</p><h2>Keep it going.</h2></div><button class="text-btn" id="addMember">＋ Add</button></div>
        <div class="streak-grid">
          ${ranked.length ? ranked.map((p,i) => personCard(p,i)).join('') : `<div class="empty-state">No family members yet.</div>`}
        </div>
      </section>

      <section class="leaderboard-section">
        <div class="section-heading"><div><p class="eyebrow">LEADERBOARD</p><h2>Peace rankings</h2><small class="leaderboard-explainer">Absolute streak score · −${FIGHT_PEACE_PENALTY} per fight (max −${MAX_FIGHT_PENALTY}) · +${RECOGNITION_PEACE_POINTS} per recognition · max ${MAX_PEACE_SCORE}</small></div></div>
        <div class="leaderboard">
          ${metrics.map((row,i) => leaderboardRowV3(row,i)).join('')}
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
  document.querySelector('#settingsBtn').onclick = () => openSettings();

  app.querySelectorAll('[data-start]').forEach(btn => btn.onclick = () => startStreak(btn.dataset.start));
  app.querySelectorAll('[data-fight]').forEach(btn => btn.onclick = () => confirmFight(btn.dataset.fight));
  app.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => editPerson(btn.dataset.edit));
};

function leaderboardRowV3(row, i) {
  const p = row.person;
  const medal = ['🥇','🥈','🥉'][i] || `${i+1}.`;
  const score = Math.min(MAX_PEACE_SCORE, Math.round(row.peaceScore));
  const fightLabel = `${row.fights} fight${row.fights === 1 ? '' : 's'} (−${row.fightPenalty})`;
  const recognitionLabel = row.recognitions
    ? ` · ${row.recognitions} recognition${row.recognitions === 1 ? '' : 's'} (+${row.recognitionBonus})`
    : '';
  return `<div class="leader-row">
    <span class="rank">${medal}</span>
    ${avatar(p,'sm')}
    <div class="leader-name">
      <strong>${escapeHtml(p.name)}</strong>
      <small>${formatLeaderboardStreak(row.streakMs)} current · ${fightLabel}${recognitionLabel}</small>
    </div>
    <div class="leader-score peace-score">
      <strong>${score}</strong>
      <small>peace score</small>
    </div>
  </div>`;
}

const leaderboardStyle = document.createElement('style');
leaderboardStyle.textContent = `
.leaderboard-explainer{display:block;color:var(--muted);font-size:10px;font-weight:700;margin-top:5px;letter-spacing:.02em}.leader-score.peace-score strong{font-size:25px}.leader-score.peace-score small{white-space:nowrap}.leader-name small{line-height:1.35}.hero-stats .peace-hours{font-family:Inter,ui-sans-serif,system-ui,sans-serif;font-size:.42em;font-style:normal;font-weight:800;margin-left:5px;letter-spacing:0}
`;
document.head.append(leaderboardStyle);

if (state.onboardingComplete) render();
