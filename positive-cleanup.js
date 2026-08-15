// Keep positive-recognition data aligned with the current family-member list.
function pruneOrphanRecognitions() {
  if (!Array.isArray(state.recognitions) || !Array.isArray(state.people)) return;
  const valid = new Set(state.people.map(p => p.id));
  const next = state.recognitions.filter(r => valid.has(r.personId));
  if (next.length === state.recognitions.length) return;
  state.recognitions = next;
  saveState();
}

const positiveCleanupObserver = new MutationObserver(pruneOrphanRecognitions);
positiveCleanupObserver.observe(document.querySelector('#app'), { childList:true, subtree:false });
pruneOrphanRecognitions();