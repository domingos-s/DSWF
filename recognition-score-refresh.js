// Keep rehabilitation credit visible immediately when recognitions are added or removed.
(function recognitionPeaceScoreRefresh() {
  document.addEventListener('click', event => {
    const saveButton = event.target.closest?.('#saveRecognition');
    const deleteButton = event.target.closest?.('[data-delete-recognition]');
    if (!saveButton && !deleteButton) return;

    const recognitionId = deleteButton?.dataset.deleteRecognition || null;
    const beforeCount = Array.isArray(state.recognitions) ? state.recognitions.length : 0;

    setTimeout(() => {
      const recognitions = Array.isArray(state.recognitions) ? state.recognitions : [];
      const changed = saveButton
        ? recognitions.length > beforeCount
        : recognitionId && !recognitions.some(recognition => recognition.id === recognitionId);

      if (!changed || !state.onboardingComplete) return;
      render();
      if (typeof decoratePositiveProfiles === 'function') decoratePositiveProfiles();
    }, 0);
  });
})();
