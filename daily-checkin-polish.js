// DSWF Daily Check-In display polish
// Converts question-fragment driver text into concise, human-readable condition labels.
(function installDailyCheckInPolish() {
  const replacements = [
    ['🌤️ are you feeling overall', '🌤️ Low mood'],
    ['🧠 loaded is your stress', '🧠 High stress'],
    ['🔋 much patience do you have available', '🔋 Low patience'],
    ['👂 heard and respected do you feel', '👂 Feeling unheard / disrespected'],
    ['🤝 connected do you feel to your family', '🤝 Feeling disconnected'],
    ['🔥 close do you feel to getting heated', '🔥 Close to getting heated']
  ];

  const historyLabels = new Map([
    ['How are you feeling overall?', 'Low mood'],
    ['How loaded is your stress?', 'High stress'],
    ['How much patience do you have available?', 'Low patience'],
    ['How heard and respected do you feel?', 'Feeling unheard / disrespected'],
    ['How connected do you feel to your family?', 'Feeling disconnected'],
    ['How close do you feel to getting heated?', 'Close to getting heated']
  ]);

  function polishDailyCheckIn(root = document) {
    root.querySelectorAll?.('.daily-result-block').forEach(block => {
      const heading = block.querySelector('small');
      const paragraph = block.querySelector('p');
      if (!heading || !paragraph || heading.textContent.trim() !== 'WHAT IS DRIVING TODAY') return;

      let text = paragraph.textContent;
      replacements.forEach(([from, to]) => { text = text.replace(from, to); });
      if (paragraph.textContent !== text) paragraph.textContent = text;
    });

    root.querySelectorAll?.('.daily-history-list button em').forEach(label => {
      const polished = historyLabels.get(label.textContent.trim());
      if (polished) label.textContent = polished;
    });
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.('#dailyCheckInModal, #dailyCheckInHistory') || node.querySelector?.('#dailyCheckInModal, #dailyCheckInHistory, .daily-result-block, .daily-history-list')) {
          polishDailyCheckIn(node);
        }
      }
    }
  });

  observer.observe(document.body, { childList:true, subtree:true });
  polishDailyCheckIn();
})();