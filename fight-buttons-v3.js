// Restore per-relationship "We fought" actions on the Version 3 behavioral dashboard.
(function installBehaviorLoopFightButtons(){
  function decorateFightButtons(){
    if(typeof state==='undefined'||!state.onboardingComplete)return;
    document.querySelectorAll('.loop-person[data-loop-profile]').forEach(row=>{
      const personId=row.dataset.loopProfile;
      const person=state.people.find(p=>p.id===personId);
      if(!person||!person.startedAt)return;
      let card=row.closest('.loop-person-wrap');
      if(!card){
        card=document.createElement('div');
        card.className='loop-person-wrap';
        row.replaceWith(card);
        card.append(row);
      }
      if(card.querySelector('[data-loop-fight]'))return;
      const button=document.createElement('button');
      button.type='button';
      button.className='loop-fight-btn';
      button.dataset.loopFight=personId;
      button.textContent='We fought';
      button.setAttribute('aria-label',`Record a fight with ${person.name}`);
      card.append(button);
      button.onclick=event=>{
        event.preventDefault();
        event.stopPropagation();
        if(typeof confirmFight==='function')confirmFight(personId);
      };
    });
  }

  const style=document.createElement('style');
  style.textContent=`
    .loop-person-wrap{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:stretch;width:100%}
    .loop-person-wrap>.loop-person{min-width:0}
    .loop-fight-btn{align-self:stretch;border:1px solid #efc7bf;background:#fff4f1;color:var(--accent-dark);border-radius:15px;padding:0 12px;font-size:10px;font-weight:900;white-space:nowrap}
    .loop-fight-btn:active{transform:scale(.98);background:#f9e1dc}
    @media(max-width:520px){.loop-person-wrap{grid-template-columns:minmax(0,1fr) 76px}.loop-fight-btn{padding:0 7px;font-size:9px}}
  `;
  document.head.append(style);

  const observer=new MutationObserver(()=>queueMicrotask(decorateFightButtons));
  observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
  decorateFightButtons();
})();