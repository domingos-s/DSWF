// Prevent backup export from bypassing journal PIN protection.
document.addEventListener('click', event => {
  const button = event.target.closest?.('#exportData');
  if (!button || journalUnlocked) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  requireJournalUnlock(() => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `days-since-we-fought-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
}, true);
