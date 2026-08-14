// Aggregate the full elapsed time across active relationships before converting
// to days/hours. This avoids losing partial days from each individual streak.
function renderCombinedPeaceTime() {
  if (typeof state === 'undefined' || !Array.isArray(state.people)) return;

  const stat = document.querySelector('.hero-stats > div:first-child');
  if (!stat) return;

  const totalMs = state.people.reduce((sum, person) => {
    if (!person.startedAt) return sum;
    return sum + Math.max(0, Date.now() - person.startedAt);
  }, 0);

  const totalHours = Math.floor(totalMs / 3600000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  stat.innerHTML = `<span>${days}<small class="combined-hours">d ${hours}h</small></span><small>combined peace time</small>`;
}

const combinedPeaceStyle = document.createElement('style');
combinedPeaceStyle.textContent = `.hero-stats .combined-hours{display:inline;color:#fff;font-family:inherit;font-size:.42em;font-weight:800;letter-spacing:0;text-transform:none;margin-left:5px}`;
document.head.append(combinedPeaceStyle);

const combinedPeaceObserver = new MutationObserver(renderCombinedPeaceTime);
combinedPeaceObserver.observe(document.querySelector('#app'), { childList: true, subtree: true });
renderCombinedPeaceTime();

// Keep the aggregate hour display current while the app is open.
setInterval(renderCombinedPeaceTime, 60000);
