// DSWF Android/browser Back navigation
// Makes hardware/browser Back unwind the topmost DSWF UI layer before leaving the app.
(function installDSWFBackNavigation(){
  const LAYER_SELECTOR = '.modal-backdrop,.person-profile-backdrop,.simmer-overlay';
  let nextLayerId = 1;
  let handlingPop = false;
  let ignoreNextPop = false;

  function directLayers(root=document){
    return [...root.querySelectorAll(LAYER_SELECTOR)].filter(el => {
      if (!el.isConnected) return false;
      return !el.parentElement?.closest?.(LAYER_SELECTOR);
    });
  }

  function topLayer(){
    const layers = directLayers();
    return layers.length ? layers[layers.length - 1] : null;
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

    const preferred = layer.querySelector(
      ':scope > .modal .modal-close, :scope > .person-profile-page #closePersonProfile, :scope > .person-profile-page .profile-back, :scope > .simmer-card .simmer-close'
    );

    if (preferred && !preferred.disabled) preferred.click();
    else layer.remove();
  }

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

    added
      .filter(el => el.isConnected && !el.parentElement?.closest?.(LAYER_SELECTOR))
      .forEach(pushLayerState);

    // If an on-screen X/back button closed the current layer, also pop the
    // matching synthetic history entry. Ignore that resulting popstate so the
    // layer beneath it stays open.
    if (!handlingPop) {
      for (const layer of removed) {
        if (layer.dataset?.dswfBackTracked !== '1') continue;
        if (history.state?.dswfBackLayer === layer.dataset.dswfBackLayerId) {
          ignoreNextPop = true;
          history.back();
          break;
        }
      }
    }
  });

  observer.observe(document.body,{childList:true,subtree:true});

  window.addEventListener('popstate', () => {
    if (ignoreNextPop) {
      ignoreNextPop = false;
      return;
    }

    const layer = topLayer();
    if (!layer) {
      // No DSWF overlay is open. Browser/PWA history is allowed to continue
      // naturally to the previous page or app destination.
      return;
    }

    handlingPop = true;
    closeLayer(layer);
    // MutationObserver sees the removal while this remains true, preventing a
    // second history.back() for the same hardware-Back action.
    setTimeout(() => { handlingPop = false; }, 0);
  });

  directLayers().forEach(pushLayerState);
})();
