// DSWF experiment UX: preview the exact 7-day test before starting it.
if (typeof startInsightExperiment === 'function' && typeof insightCard === 'function') {
  const baseStartInsightExperimentPreview = startInsightExperiment;
  const baseInsightCardExperimentPreview = insightCard;

  insightCard = function insightCardWithExperimentPreview(insight, compact = false) {
    return baseInsightCardExperimentPreview(insight, compact)
      .replace('Try 7-day experiment', 'Try a 7-Day Experiment');
  };

  function experimentScopeLabel(insight) {
    if (!insight.personId) return 'All recorded household fights';
    const person = state.people.find(p => p.id === insight.personId);
    return person ? `Recorded fights with ${person.name}` : 'Recorded fights in this relationship';
  }

  function previewInsightExperiment(insight) {
    if (!insight?.experiment) return;

    const existing = state.experiments.find(e => e.status === 'active' && e.insightId === insight.id);
    if (existing) {
      toast('That experiment is already active.');
      return;
    }

    const scopeFights = fightEvents().filter(f =>
      (insight.personId ? f.personId === insight.personId : true) &&
      f.at >= daysAgo(28)
    );
    const baselineWeekly = scopeFights.length / 4;
    const startsAt = now();
    const endsAt = startsAt + 7 * INSIGHT_DAY;
    const endLabel = new Date(endsAt).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    });

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop journal-backdrop experiment-preview-backdrop';
    modal.innerHTML = `<div class="modal journal-browser experiment-preview-modal">
      <button class="modal-close" id="closeExperimentPreview" aria-label="Close">×</button>
      <p class="eyebrow">7-DAY EXPERIMENT</p>
      <h2>${escapeHtml(insight.experiment.title)}</h2>
      <p class="journal-intro">Before you start, here is exactly what DSWF is asking you to try and what it will measure.</p>

      <section class="experiment-preview-block">
        <span class="experiment-preview-label">THE PATTERN</span>
        <strong>${escapeHtml(insight.title)}</strong>
        <p>${escapeHtml(insight.body)}</p>
      </section>

      <section class="experiment-preview-block experiment-preview-action">
        <span class="experiment-preview-label">THE EXPERIMENT</span>
        <strong>${escapeHtml(insight.experiment.title)}</strong>
        <p>${escapeHtml(insight.experiment.description)}</p>
      </section>

      <section class="experiment-preview-block">
        <span class="experiment-preview-label">WHAT DSWF WILL MEASURE</span>
        <strong>${escapeHtml(experimentScopeLabel(insight))}</strong>
        <p>DSWF will compare the number of fights recorded during these 7 days with your average weekly fight count over the previous 28 days.</p>
        <div class="experiment-preview-metrics">
          <div><b>${baselineWeekly.toFixed(1)}</b><small>recent fights / week</small></div>
          <div><b>7 days</b><small>experiment length</small></div>
          <div><b>${escapeHtml(endLabel)}</b><small>scheduled end</small></div>
        </div>
      </section>

      <div class="reflection-nudge experiment-preview-note">This is a personal behavior experiment, not a controlled study. DSWF looks for directional change and does not treat the result as proof of causation.</div>
      <div class="journal-actions experiment-preview-actions">
        <button class="btn btn-ghost" id="cancelExperimentPreview">Not now</button>
        <button class="btn btn-primary" id="confirmExperimentStart">Start Experiment</button>
      </div>
    </div>`;

    document.body.append(modal);
    const close = () => modal.remove();
    modal.querySelector('#closeExperimentPreview').onclick = close;
    modal.querySelector('#cancelExperimentPreview').onclick = close;
    modal.onclick = e => { if (e.target === modal) close(); };
    modal.querySelector('#confirmExperimentStart').onclick = () => {
      close();
      baseStartInsightExperimentPreview(insight);
      document.querySelector('#insightsHub')?.remove();
      if (typeof decorateInsightsHub === 'function') decorateInsightsHub();
    };
  }

  startInsightExperiment = previewInsightExperiment;

  const experimentPreviewStyle = document.createElement('style');
  experimentPreviewStyle.textContent = `
    .experiment-preview-modal{width:min(560px,calc(100vw - 32px))}
    .experiment-preview-block{border:1px solid var(--line);background:#fff;border-radius:18px;padding:16px 17px;margin:13px 0;text-align:left}
    .experiment-preview-block strong{display:block;font-size:16px;line-height:1.3;margin:4px 0 7px}
    .experiment-preview-block p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}
    .experiment-preview-action{background:#fff8ef;border-color:#ead7bb}
    .experiment-preview-label{display:block;font-size:9px;font-weight:950;letter-spacing:.13em;color:var(--accent-dark);margin-bottom:4px}
    .experiment-preview-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}
    .experiment-preview-metrics div{background:var(--paper);border-radius:12px;padding:10px;text-align:center;min-width:0}
    .experiment-preview-metrics b{display:block;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .experiment-preview-metrics small{display:block;color:var(--muted);font-size:9px;line-height:1.25;margin-top:2px}
    .experiment-preview-note{margin-top:14px;text-align:left}
    .experiment-preview-actions{margin-top:18px}
    @media(max-width:520px){.experiment-preview-metrics{grid-template-columns:1fr}.experiment-preview-metrics div{display:flex;align-items:center;justify-content:space-between;text-align:left}.experiment-preview-metrics small{margin:0 0 0 10px}}
  `;
  document.head.appendChild(experimentPreviewStyle);
}