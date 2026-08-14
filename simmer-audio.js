// Auditory interruption for Simmer Down.
// Playback begins from the explicit "I'm getting heated" user gesture so
// mobile browsers permit it without autoplay permissions.
let simmerHotAudio = null;

function playSimmerHotAudio() {
  try {
    if (!simmerHotAudio) {
      simmerHotAudio = new Audio('./hot.mp3');
      simmerHotAudio.preload = 'auto';
    }
    simmerHotAudio.pause();
    simmerHotAudio.currentTime = 0;
    const playPromise = simmerHotAudio.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  } catch (error) {
    console.warn('Could not play Simmer Down audio', error);
  }
}

function stopSimmerHotAudio() {
  if (!simmerHotAudio) return;
  try {
    simmerHotAudio.pause();
    simmerHotAudio.currentTime = 0;
  } catch {}
}

// Preserve the existing Simmer Down behavior while adding the sound cue.
if (typeof openSimmerDown === 'function') {
  const baseOpenSimmerDownAudio = openSimmerDown;
  openSimmerDown = function openSimmerDownWithAudio() {
    playSimmerHotAudio();
    return baseOpenSimmerDownAudio.apply(this, arguments);
  };

  // The dashboard button may already have been bound before this helper loaded.
  const launch = document.querySelector('#simmerDownLaunch');
  if (launch) launch.onclick = openSimmerDown;
}

if (typeof closeSimmerOverlay === 'function') {
  const baseCloseSimmerOverlayAudio = closeSimmerOverlay;
  closeSimmerOverlay = function closeSimmerOverlayWithAudio() {
    stopSimmerHotAudio();
    return baseCloseSimmerOverlayAudio.apply(this, arguments);
  };
}
