// Bridges module-scoped Daily Check-In controls into the behavioral-loop dashboard.
(function installBehaviorLoopBridge(){
  document.addEventListener('click',event=>{
    const daily=event.target.closest?.('#loopDailyCheckIn,#loopViewCheckIn');
    if(daily&&typeof window.dswfOpenDailyCheckIn==='function'){
      event.preventDefault();
      window.dswfOpenDailyCheckIn();
    }
  });

  // Daily Check-In saves state without calling the global dashboard render.
  // Refresh the resting dashboard after its result modal closes so BEFORE state is current.
  const observer=new MutationObserver(mutations=>{
    for(const mutation of mutations){
      for(const node of mutation.removedNodes){
        if(node instanceof Element&&node.id==='dailyCheckInModal'&&state.onboardingComplete){
          queueMicrotask(()=>{if(!document.querySelector('#dailyCheckInModal')&&typeof render==='function')render();});
          return;
        }
      }
    }
  });
  observer.observe(document.body,{childList:true});
})();