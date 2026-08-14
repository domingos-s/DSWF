const SIMMER_KEY = 'dswf-simmer-down-v1';
const simmerTriggers = ['Not listening','Respect / tone','Stress','Unfairness','Mess / chores','Money','Parenting','Other'];
const simmerMoves = [
  ['🎯','Say it calmly'],['⏸️','Take 10 minutes'],['🤷','Let this one go'],['❤️','Assume good intent']
];
let simmerSession = null;

function simmerHistory(){ try{return JSON.parse(localStorage.getItem(SIMMER_KEY)||'[]')}catch{return[]} }
function saveSimmer(entry){ const h=simmerHistory(); h.push(entry); localStorage.setItem(SIMMER_KEY,JSON.stringify(h)); }
function simmerStats(){ const h=simmerHistory(); return {attempts:h.length, completed:h.filter(x=>x.completed).length}; }

function ensureSimmerButton(){
  if(typeof state==='undefined'||!state.onboardingComplete) return;
  const hero=document.querySelector('.hero-stats');
  if(!hero||document.querySelector('#simmerDownLaunch')) return;
  const box=document.createElement('section');
  box.className='simmer-launch';
  const stats=simmerStats();
  box.innerHTML=`<button id="simmerDownLaunch" class="simmer-launch-btn"><span class="simmer-fire">🔥</span><span><strong>I’m getting heated</strong><small>Play Simmer Down before things boil over</small></span><span class="simmer-arrow">→</span></button>${stats.completed?`<div class="simmer-mini">🧯 ${stats.completed} cool-down${stats.completed===1?'':'s'} completed</div>`:''}`;
  hero.insertAdjacentElement('afterend',box);
  box.querySelector('#simmerDownLaunch').onclick=openSimmerDown;
}

function openSimmerDown(){
  simmerSession={startedAt:Date.now(),trigger:null,move:null};
  const overlay=document.createElement('div'); overlay.className='simmer-overlay'; overlay.id='simmerOverlay';
  overlay.innerHTML=`<div class="simmer-card"><button class="simmer-close" aria-label="Close">×</button><div id="simmerStage"></div></div>`;
  document.body.appendChild(overlay); overlay.querySelector('.simmer-close').onclick=()=>overlay.remove();
  renderCoolStage();
}

function renderCoolStage(){
  const stage=document.querySelector('#simmerStage'); if(!stage)return;
  stage.innerHTML=`<div class="simmer-kicker">SIMMER DOWN · 60 SECONDS</div><div class="simmer-emoji">🔥</div><h2>Cool the fire.</h2><p>Don’t solve anything yet. Just get your temperature down.</p><div class="temp"><div id="tempFill"></div></div><div class="breath-orb" id="breathOrb"><span id="breathText">Ready?</span></div><button class="btn btn-primary" id="startCooling">Start cooling 🧯</button>`;
  stage.querySelector('#startCooling').onclick=runBreathing;
}

function runBreathing(){
  const btn=document.querySelector('#startCooling'); btn.disabled=true; btn.textContent='Cooling…';
  const text=document.querySelector('#breathText'), orb=document.querySelector('#breathOrb'), fill=document.querySelector('#tempFill');
  const phases=[['Breathe in',4000],['Breathe out',6000],['Breathe in',4000],['Breathe out',6000],['Breathe in',4000],['Breathe out',6000]];
  let i=0;
  function next(){
    if(i>=phases.length){fill.style.width='12%'; text.textContent='Cooler.'; setTimeout(renderTriggerStage,700);return;}
    const [label,dur]=phases[i]; text.textContent=label; orb.classList.toggle('inhale',label.includes('in')); orb.classList.toggle('exhale',label.includes('out'));
    fill.style.width=`${Math.max(18,100-((i+1)/phases.length)*82)}%`;
    if(navigator.vibrate) navigator.vibrate(35);
    i++; setTimeout(next,dur);
  } next();
}

function renderTriggerStage(){
  const stage=document.querySelector('#simmerStage');
  stage.innerHTML=`<div class="simmer-kicker">STEP 2 · NAME IT</div><div class="simmer-emoji">🧑🏼‍🚒</div><h2>What’s getting under your skin?</h2><p>No essay. Just name the thing.</p><div class="simmer-options">${simmerTriggers.map(x=>`<button data-trigger="${x}">${x}</button>`).join('')}</div>`;
  stage.querySelectorAll('[data-trigger]').forEach(b=>b.onclick=()=>{simmerSession.trigger=b.dataset.trigger;renderMoveStage()});
}

function renderMoveStage(){
  const stage=document.querySelector('#simmerStage');
  stage.innerHTML=`<div class="simmer-kicker">STEP 3 · CHOOSE YOUR MOVE</div><div class="simmer-emoji">🚒</div><h2>What happens next?</h2><p>Pick the response you want to be proud of later.</p><div class="simmer-moves">${simmerMoves.map(([e,t])=>`<button data-move="${t}"><span>${e}</span><strong>${t}</strong></button>`).join('')}</div>`;
  stage.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{simmerSession.move=b.dataset.move;finishSimmer()});
}

function finishSimmer(){
  saveSimmer({...simmerSession,completed:true,completedAt:Date.now()});
  const stage=document.querySelector('#simmerStage'), stats=simmerStats();
  stage.innerHTML=`<div class="simmer-kicker">FIRE CONTAINED</div><div class="simmer-emoji big">🧯</div><h2>You cooled it down.</h2><p><strong>${simmerSession.move}</strong> is the move. You don’t have to win this moment—you’re protecting the relationship.</p><div class="simmer-win">🔥 → 💨<small>${stats.completed} cool-down${stats.completed===1?'':'s'} completed</small></div><button class="btn btn-primary" id="doneSimmer">Back to DSWF</button>`;
  stage.querySelector('#doneSimmer').onclick=()=>{document.querySelector('#simmerOverlay')?.remove(); document.querySelector('.simmer-launch')?.remove();ensureSimmerButton()};
}

const simmerStyle=document.createElement('style');
simmerStyle.textContent=`
.simmer-launch{margin:16px 0 30px}.simmer-launch-btn{width:100%;border:0;border-radius:22px;padding:17px 18px;background:linear-gradient(135deg,#ef6b3a,#c43f2d);color:#fff;display:flex;align-items:center;gap:14px;text-align:left;box-shadow:0 10px 24px rgba(176,58,36,.2)}.simmer-launch-btn strong{display:block;font-size:18px}.simmer-launch-btn small{display:block;opacity:.86;margin-top:2px}.simmer-fire{font-size:30px}.simmer-arrow{font-size:24px;margin-left:auto}.simmer-mini{text-align:center;font-size:12px;color:var(--muted);margin-top:7px}.simmer-overlay{position:fixed;inset:0;z-index:9999;background:rgba(18,16,14,.72);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:18px}.simmer-card{position:relative;width:min(520px,100%);max-height:92vh;overflow:auto;background:#fffdf7;border-radius:28px;padding:30px 24px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.3)}.simmer-close{position:absolute;right:15px;top:12px;border:0;background:transparent;font-size:30px;color:#777}.simmer-kicker{font-size:11px;font-weight:900;letter-spacing:.13em;color:#c34b3d}.simmer-emoji{font-size:54px;margin:14px 0 4px}.simmer-emoji.big{font-size:72px}.simmer-card h2{font-size:30px;margin:6px 0 8px}.simmer-card p{color:#716c63;margin:0 auto 22px;max-width:390px}.temp{height:12px;background:#eee6da;border-radius:999px;overflow:hidden;margin:22px 0}.temp div{height:100%;width:100%;background:#e05236;transition:width 1s ease}.breath-orb{width:130px;height:130px;border-radius:50%;background:#f1e7d8;margin:18px auto 24px;display:grid;place-items:center;transition:transform 4s ease,background 1s}.breath-orb.inhale{transform:scale(1.22);background:#e6efe8}.breath-orb.exhale{transform:scale(.88);transition-duration:6s}.breath-orb span{font-weight:850}.simmer-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.simmer-options button,.simmer-moves button{border:1px solid #d9d2c5;background:#fff;border-radius:15px;padding:14px;font-weight:750}.simmer-moves{display:grid;gap:10px}.simmer-moves button{display:flex;align-items:center;gap:12px;text-align:left;font-size:16px}.simmer-moves button span{font-size:24px}.simmer-win{font-size:35px;margin:20px 0}.simmer-win small{display:block;font-size:12px;color:#716c63;margin-top:8px}@media(max-width:520px){.simmer-card{padding:28px 18px}.simmer-options{grid-template-columns:1fr}.simmer-launch-btn small{font-size:11px}}
`;
document.head.appendChild(simmerStyle);
const simmerObserver=new MutationObserver(()=>{if(!document.querySelector('#simmerDownLaunch'))ensureSimmerButton()});
simmerObserver.observe(document.querySelector('#app'),{childList:true,subtree:false});
ensureSimmerButton();