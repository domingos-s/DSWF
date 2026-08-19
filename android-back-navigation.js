// DSWF Android/browser Back navigation
// Makes hardware/browser Back unwind the topmost DSWF UI layer before leaving the app.
(function installDSWFBackNavigation(){
  const LAYER_SELECTOR = '.modal-backdrop,.person-profile-backdrop,.simmer-overlay';
  let nextLayerId = 1;
  let suppressRemovalBack = 0;
  let handlingPop = false;

  function directLayers(root=document){
    return [...root.querySelectorAll(LAYER_SELECTOR)].filter(el => {
      if (!el.isConnected) return false;
      // Nested matches should not count as separate history entries unless they are
      // actual overlay siblings appended to document.body.
      return !el.parentElement?.closest?.(LAYER_SELECTOR);
    });
  }

  function topLayer(){
    const layers = directLayers();
    if (!layers.length) return null;
    return layers[layers.length - 1];
  }

  function ensureLayerId(layer){
    if (!layer.dataset.dswfBackLayerId) {
      layer.dataset.dswfBackLayerId = `dswf-layer-${Date.now()}-${nextLayerId++}`;
    }
    return layer.dataset.dswfBackLayerId;
  }

  function pushLayerState(layer){
    if (!layer || layer.dataset.dswfBackTracked === '1') return;
    const id = ensureLayerId(layer);
    layer.dataset.dswfBackTracked = '1';
    history.pushState({ ...(history.state || {}), dswfBackLayer:id }, '', location.href);
  }

  function closeLayer(layer){
    if (!layer?.isConnected) return;

    // Prefer the layer's own close/back control so feature-specific cleanup runs.
    const preferred = layer.querySelector(
      ':scope > .modal .modal-close, :scope > .person-profile-page #closePersonProfile, :scope > .person-profile-page .profile-back, :scope > .simmer-card .simmer-close'
    );
    if (preferred && !preferred.disabled) {
      suppressRemovalBack += 1;
      preferred.click();
      return;
    }

    suppressRemovalBack += 1;
    layer.remove();
  }

  function syncExistingLayers(){
    directLayers().forEach(pushLayerState);
  }

  // Track every modal/profile/Simmer overlay as its own history step.
  const observer = new MutationObserver(mutations => {
    const added = [];
    const removed = [];

    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches?.(LAYER_SELECTOR)) added.push(node);
        node.querySelectorAll?.(LAYER_SELECTOR).forEach(el => added.push(el));
      });
      mutation.removedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.matches?.(LAYER_SELECTOR)) removed.push(node);
      });
    }

    added.filter(el => el.isConnected && !el.parentElement?.closest?.(LAYER_SELECTOR)).forEach(pushLayerState);

    // When the user closes a layer with an on-screen X/back button, consume its
    // synthetic history entry so the next Android Back still means "go back one UI layer".
    for (const layer of removed) {
      if (layer.dataset?.dswfBackTracked !== '1') continue;
      if (suppressRemovalBack > 0) {
        suppressRemovalBack -= 1;
        continue;
      }
      if (handlingPop) continue;
      const stateId = history.state?.dswfBackLayer;
      if (stateId && stateId === layer.dataset.dswfBackLayerId) {
        suppressRemovalBack += 1;
        history.back();
      }
    }
  });

  observer.observe(document.body,{childList:true,subtree:true});

  window.addEventListener('popstate', () => {
    handlingPop = true;
    const layer = topLayer();
    if (layer) {
      closeLayer(layer);
      queueMicrotask(() => { handlingPop = false; });
      return;
    }

    // No DSWF layer is open. Let browser/PWA history continue naturally to the
    // previous page (for example the DSWF landing page or wherever the user came from).
    queueMicrotask(() => { handlingPop = false; });
  });

  syncExistingLayers();
})();
