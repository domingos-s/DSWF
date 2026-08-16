// Shared delete controls for Simmer Down and Recognition activity logs.
// Deletes the underlying local record after explicit confirmation.

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

  function refreshSimmerAfterDelete() {
    const section = document.querySelector('#simmerHistorySection');
    if (section) section.dataset.signature = '';
    if (typeof renderSimmerHistoryUI === 'function') renderSimmerHistoryUI();
    if (typeof ensureSimmerButton === 'function') ensureSimmerButton();
    document.querySelector('#insightsHub')?.remove();
    if (typeof decorateInsightsHub === 'function') decorateInsightsHub();
  }

  function deleteSimmerLog(sessionId, button) {
    const sessions = typeof simmerHistory === 'function' ? simmerHistory() : [];
    if (!sessions.some(session => session.id === sessionId)) return;

    const confirmed = confirm('Delete this Simmer Down intervention? This will remove it from the log and intervention statistics. Any separate fight or journal record will remain.');
    if (!confirmed) return;

    const wasInModal = Boolean(button.closest('.simmer-history-modal'));
    const key = typeof SIMMER_KEY !== 'undefined' ? SIMMER_KEY : 'dswf-simmer-down-v1';
    localStorage.setItem(key, JSON.stringify(sessions.filter(session => session.id !== sessionId)));

    button.closest('.modal-backdrop')?.remove();
    refreshSimmerAfterDelete();

    if (wasInModal && typeof completedSimmerHistory === 'function' && completedSimmerHistory().length && typeof openSimmerHistory === 'function') {
      openSimmerHistory();
    }
    if (typeof toast === 'function') toast('Simmer Down intervention deleted.');
  }

  function deleteRecognitionLog(recognitionId, button) {
    if (!Array.isArray(state.recognitions) || !state.recognitions.some(recognition => recognition.id === recognitionId)) return;

    const confirmed = confirm('Delete this recognition? This will remove it from the Recognition Log, the family member profile, and any Peace Score credit it provides.');
    if (!confirmed) return;

    const wasInModal = Boolean(button.closest('.recognition-log-modal'));
    state.recognitions = state.recognitions.filter(recognition => recognition.id !== recognitionId);
    saveState();
    button.closest('.modal-backdrop')?.remove();

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

  document.addEventListener('click', event => {
    const simmerDelete = event.target.closest?.('[data-delete-simmer-log]');
    if (simmerDelete) {
      event.preventDefault();
      event.stopPropagation();
      deleteSimmerLog(simmerDelete.dataset.deleteSimmerLog, simmerDelete);
      return;
    }

    const recognitionDelete = event.target.closest?.('[data-delete-recognition-log]');
    if (recognitionDelete) {
      event.preventDefault();
      event.stopPropagation();
      deleteRecognitionLog(recognitionDelete.dataset.deleteRecognitionLog, recognitionDelete);
    }
  });

  const deleteStyle = document.createElement('style');
  deleteStyle.textContent = `
  .simmer-history-row,.recognition-log-row{position:relative;padding-right:42px!important}
  .activity-log-delete{position:absolute;top:8px;right:8px;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:#aaa59b;font-size:20px;font-weight:500;line-height:1;padding:0;z-index:2}
  .activity-log-delete:hover,.activity-log-delete:focus-visible{background:#eee9df;color:var(--accent-dark);outline:none}
  .activity-log-delete:active{transform:scale(.94)}
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
