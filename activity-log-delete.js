// Shared delete controls for Simmer Down and Recognition activity logs.
// Deletes the underlying local record after explicit in-app modal confirmation.

(function installActivityLogDeletion() {
  if (typeof simmerHistoryRow === 'function') {
    const baseSimmerHistoryRowDelete = simmerHistoryRow;
    simmerHistoryRow = function simmerHistoryRowWithDelete(session, compact = false) {
      return baseSimmerHistoryRowDelete(session, compact).replace(
        '</article>',
        `<button type="button" class="activity-log-delete" data-delete-simmer-log="${session.id}" aria-label="Delete Simmer Down intervention">×</button></article>`
      );
    };
  }

  if (typeof recognitionLogRow === 'function') {
    const baseRecognitionLogRowDelete = recognitionLogRow;
    recognitionLogRow = function recognitionLogRowWithDelete(recognition, compact = false) {
      return baseRecognitionLogRowDelete(recognition, compact).replace(
        '</article>',
        `<button type="button" class="activity-log-delete" data-delete-recognition-log="${recognition.id}" aria-label="Delete recognition">×</button></article>`
      );
    };
  }

  function openActivityDeleteConfirm({ eyebrow, title, message, confirmLabel, onConfirm }) {
    document.querySelector('#activityDeleteConfirm')?.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'activityDeleteConfirm';
    backdrop.className = 'modal-backdrop activity-delete-confirm-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'activityDeleteTitle');
    backdrop.innerHTML = `<div class="modal activity-delete-confirm">
      <div class="activity-delete-icon" aria-hidden="true">🗑️</div>
      <p class="eyebrow">${eyebrow}</p>
      <h2 id="activityDeleteTitle">${title}</h2>
      <p class="activity-delete-copy">${message}</p>
      <div class="modal-actions activity-delete-actions">
        <button type="button" class="btn btn-ghost" id="cancelActivityDelete">Cancel</button>
        <button type="button" class="btn activity-delete-danger" id="confirmActivityDelete">${confirmLabel}</button>
      </div>
    </div>`;

    const close = () => {
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
    };
    const onKeydown = event => {
      if (event.key === 'Escape') close();
    };

    document.body.append(backdrop);
    document.addEventListener('keydown', onKeydown);
    backdrop.querySelector('#cancelActivityDelete').onclick = close;
    backdrop.querySelector('#confirmActivityDelete').onclick = () => {
      close();
      onConfirm();
    };
    backdrop.onclick = event => {
      if (event.target === backdrop) close();
    };
    setTimeout(() => backdrop.querySelector('#cancelActivityDelete')?.focus(), 0);
  }

  function refreshSimmerAfterDelete() {
    const section = document.querySelector('#simmerHistorySection');
    if (section) section.dataset.signature = '';
    if (typeof renderSimmerHistoryUI === 'function') renderSimmerHistoryUI();
    if (typeof ensureSimmerButton === 'function') ensureSimmerButton();
    document.querySelector('#insightsHub')?.remove();
    if (typeof decorateInsightsHub === 'function') decorateInsightsHub();
  }

  function performSimmerDelete(sessionId, sourceModal, wasInModal) {
    const sessions = typeof simmerHistory === 'function' ? simmerHistory() : [];
    if (!sessions.some(session => session.id === sessionId)) return;

    const key = typeof SIMMER_KEY !== 'undefined' ? SIMMER_KEY : 'dswf-simmer-down-v1';
    localStorage.setItem(key, JSON.stringify(sessions.filter(session => session.id !== sessionId)));

    sourceModal?.remove();
    refreshSimmerAfterDelete();

    if (wasInModal && typeof completedSimmerHistory === 'function' && completedSimmerHistory().length && typeof openSimmerHistory === 'function') {
      openSimmerHistory();
    }
    if (typeof toast === 'function') toast('Simmer Down intervention deleted.');
  }

  function requestSimmerDelete(sessionId, button) {
    const sessions = typeof simmerHistory === 'function' ? simmerHistory() : [];
    if (!sessions.some(session => session.id === sessionId)) return;

    const sourceModal = button.closest('.modal-backdrop');
    const wasInModal = Boolean(button.closest('.simmer-history-modal'));
    openActivityDeleteConfirm({
      eyebrow: 'SIMMER DOWN LOG',
      title: 'Delete this intervention?',
      message: 'This removes the Simmer Down entry and updates intervention statistics. Any separate fight or journal record will remain.',
      confirmLabel: 'Delete intervention',
      onConfirm: () => performSimmerDelete(sessionId, sourceModal, wasInModal)
    });
  }

  function performRecognitionDelete(recognitionId, sourceModal, wasInModal) {
    if (!Array.isArray(state.recognitions) || !state.recognitions.some(recognition => recognition.id === recognitionId)) return;

    state.recognitions = state.recognitions.filter(recognition => recognition.id !== recognitionId);
    saveState();
    sourceModal?.remove();

    if (state.onboardingComplete && typeof render === 'function') render();

    queueMicrotask(() => {
      const section = document.querySelector('#recognitionLogSection');
      if (section) section.dataset.signature = '';
      if (typeof renderRecognitionLogUI === 'function') renderRecognitionLogUI();
      if (typeof decoratePositiveProfiles === 'function') decoratePositiveProfiles();
      if (wasInModal && typeof completedRecognitionHistory === 'function' && completedRecognitionHistory().length && typeof openRecognitionHistory === 'function') {
        openRecognitionHistory();
      }
    });

    if (typeof toast === 'function') toast('Recognition deleted. Peace Score updated.');
  }

  function requestRecognitionDelete(recognitionId, button) {
    if (!Array.isArray(state.recognitions) || !state.recognitions.some(recognition => recognition.id === recognitionId)) return;

    const sourceModal = button.closest('.modal-backdrop');
    const wasInModal = Boolean(button.closest('.recognition-log-modal'));
    openActivityDeleteConfirm({
      eyebrow: 'RECOGNITION LOG',
      title: 'Delete this recognition?',
      message: 'This removes the recognition from the log and family member profile. Its Peace Score credit will also be removed.',
      confirmLabel: 'Delete recognition',
      onConfirm: () => performRecognitionDelete(recognitionId, sourceModal, wasInModal)
    });
  }

  document.addEventListener('click', event => {
    const simmerDelete = event.target.closest?.('[data-delete-simmer-log]');
    if (simmerDelete) {
      event.preventDefault();
      event.stopPropagation();
      requestSimmerDelete(simmerDelete.dataset.deleteSimmerLog, simmerDelete);
      return;
    }

    const recognitionDelete = event.target.closest?.('[data-delete-recognition-log]');
    if (recognitionDelete) {
      event.preventDefault();
      event.stopPropagation();
      requestRecognitionDelete(recognitionDelete.dataset.deleteRecognitionLog, recognitionDelete);
    }
  });

  const deleteStyle = document.createElement('style');
  deleteStyle.textContent = `
  .simmer-history-row,.recognition-log-row{position:relative;padding-right:42px!important}
  .activity-log-delete{position:absolute;top:8px;right:8px;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:#aaa59b;font-size:20px;font-weight:500;line-height:1;padding:0;z-index:2}
  .activity-log-delete:hover,.activity-log-delete:focus-visible{background:#eee9df;color:var(--accent-dark);outline:none}
  .activity-log-delete:active{transform:scale(.94)}
  .activity-delete-confirm-backdrop{z-index:12000!important;align-items:center!important;padding:18px;background:rgba(20,18,14,.62)!important;backdrop-filter:blur(8px)}
  .activity-delete-confirm{width:min(100%,430px);margin:auto;border-radius:26px!important;padding:26px 22px calc(22px + env(safe-area-inset-bottom))!important;text-align:center;background:var(--card)!important;box-shadow:0 22px 70px rgba(0,0,0,.28)}
  .activity-delete-icon{width:58px;height:58px;margin:0 auto 15px;display:grid;place-items:center;border-radius:50%;background:#fff0ed;font-size:27px}
  .activity-delete-confirm .eyebrow{margin-bottom:7px;color:var(--accent-dark)}
  .activity-delete-confirm h2{margin:0 0 10px;font-size:28px;letter-spacing:-.035em}
  .activity-delete-copy{max-width:350px;margin:0 auto;color:var(--muted);font-size:13px;line-height:1.55}
  .activity-delete-actions{margin-top:22px}
  .activity-delete-actions .btn{margin:0}
  .activity-delete-danger{background:#fff0ed;color:var(--accent-dark);border:1px solid #efc7bf}
  .activity-delete-danger:active{background:#f9ddd7}
  `;
  document.head.appendChild(deleteStyle);

  // Both logs render once before this helper loads. Force a one-time refresh so
  // existing dashboard rows immediately receive their delete controls.
  const simmerSection = document.querySelector('#simmerHistorySection');
  if (simmerSection) simmerSection.dataset.signature = '';
  const recognitionSection = document.querySelector('#recognitionLogSection');
  if (recognitionSection) recognitionSection.dataset.signature = '';
  if (typeof renderSimmerHistoryUI === 'function') renderSimmerHistoryUI();
  if (typeof renderRecognitionLogUI === 'function') renderRecognitionLogUI();
})();
