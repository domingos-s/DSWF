// DSWF Relationship Changes
// Relationship-specific behavior changes with editable implementation journals.

(function installRelationshipChanges(){
  if(!Array.isArray(state.relationshipChanges)) state.relationshipChanges=[];
  if(!Array.isArray(state.changeJournalEntries)) state.changeJournalEntries=[];
  saveState();

  function changesFor(personId){
    return state.relationshipChanges.filter(x=>x.personId===personId).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  }
  function journalsFor(changeId){
    return state.changeJournalEntries.filter(x=>x.changeId===changeId).sort((a,b)=>(b.at||0)-(a.at||0));
  }
  function personForChange(change){ return state.people.find(p=>p.id===change?.personId); }
  function fmt(value){
    return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
  }
  function newId(){ return typeof id==='function'?id():(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`); }

  function closeChangeModal(id){ document.querySelector(id)?.remove(); }

  function styledConfirm({title,body,confirmText='Delete',onConfirm}){
    closeChangeModal('#relationshipChangeConfirm');
    const modal=document.createElement('div');
    modal.id='relationshipChangeConfirm';
    modal.className='modal-backdrop change-layer-backdrop';
    modal.innerHTML=`<div class="modal change-confirm-modal"><button class="modal-close" aria-label="Close">×</button><div class="change-confirm-icon">🗑️</div><p class="eyebrow">PLEASE CONFIRM</p><h2>${escapeHtml(title)}</h2><p class="change-modal-intro">${escapeHtml(body)}</p><div class="modal-actions"><button class="btn btn-ghost" id="cancelChangeDelete">Cancel</button><button class="btn change-delete-btn" id="confirmChangeDelete">${escapeHtml(confirmText)}</button></div></div>`;
    document.body.append(modal);
    const close=()=>modal.remove();
    modal.querySelector('.modal-close').onclick=close;
    modal.querySelector('#cancelChangeDelete').onclick=close;
    modal.onclick=e=>{if(e.target===modal)close();};
    modal.querySelector('#confirmChangeDelete').onclick=()=>{close();onConfirm?.();};
  }

  function openChangeEditor(personId,existing=null){
    const person=state.people.find(p=>p.id===personId); if(!person)return;
    closeChangeModal('#relationshipChangeEditor');
    const modal=document.createElement('div');
    modal.id='relationshipChangeEditor';
    modal.className='modal-backdrop change-layer-backdrop';
    modal.innerHTML=`<div class="modal change-editor-modal"><button class="modal-close" aria-label="Close">×</button><p class="eyebrow">${existing?'EDIT CHANGE':'A CHANGE I CAN MAKE'}</p><h2>${existing?'Update your commitment':`What can you try with ${escapeHtml(person.name)}?`}</h2><p class="change-modal-intro">Make it specific enough that future-you can tell whether you actually tried it.</p><label class="field-label">A change I can make is:<textarea id="relationshipChangeText" maxlength="800" placeholder="Example: When I feel ignored, I will pause before repeating myself or raising my voice.">${escapeHtml(existing?.text||'')}</textarea></label><div class="modal-actions"><button class="btn btn-ghost" id="cancelRelationshipChange">Cancel</button><button class="btn btn-primary" id="saveRelationshipChange">${existing?'Save changes':'Add change'}</button></div></div>`;
    document.body.append(modal);
    const close=()=>modal.remove();
    modal.querySelector('.modal-close').onclick=close;
    modal.querySelector('#cancelRelationshipChange').onclick=close;
    modal.onclick=e=>{if(e.target===modal)close();};
    modal.querySelector('#saveRelationshipChange').onclick=()=>{
      const text=modal.querySelector('#relationshipChangeText').value.trim();
      if(!text){toast('Add the change you want to try.');return;}
      if(existing){existing.text=text;existing.updatedAt=now();}
      else state.relationshipChanges.push({id:newId(),personId,text,createdAt:now(),updatedAt:now()});
      saveState();close();openPersonProfile(personId);toast(existing?'Change updated.':'Change added. 🌱');
    };
    setTimeout(()=>modal.querySelector('#relationshipChangeText')?.focus(),50);
  }

  function openJournalEditor(change,existing=null){
    const person=personForChange(change); if(!person)return;
    closeChangeModal('#changeJournalEditor');
    const modal=document.createElement('div');
    modal.id='changeJournalEditor';
    modal.className='modal-backdrop change-layer-backdrop';
    const rating=Number(existing?.rating)||0;
    modal.innerHTML=`<div class="modal change-journal-editor"><button class="modal-close" aria-label="Close">×</button><p class="eyebrow">HOW DID IT GO? · ${escapeHtml(person.name.toUpperCase())}</p><h2>Reflect on trying the change.</h2><div class="change-context"><small>THE CHANGE</small><p>${escapeHtml(change.text)}</p></div><label class="field-label">What happened?<textarea id="changeJournalText" maxlength="1800" placeholder="What did you try? What happened? What would you repeat or change next time?">${escapeHtml(existing?.text||'')}</textarea></label><p class="change-rating-label">How helpful was this change?</p><div class="change-rating">${[1,2,3,4,5].map(n=>`<button type="button" data-change-rating="${n}" class="${rating===n?'selected':''}"><b>${n}</b><small>${['Not helpful','A little','Somewhat','Helpful','Very helpful'][n-1]}</small></button>`).join('')}</div><div class="modal-actions"><button class="btn btn-ghost" id="cancelChangeJournal">Cancel</button><button class="btn btn-primary" id="saveChangeJournal">${existing?'Save entry':'Save reflection'}</button></div></div>`;
    document.body.append(modal);
    let selectedRating=rating;
    modal.querySelectorAll('[data-change-rating]').forEach(btn=>btn.onclick=()=>{
      selectedRating=+btn.dataset.changeRating;
      modal.querySelectorAll('[data-change-rating]').forEach(x=>x.classList.toggle('selected',x===btn));
    });
    const close=()=>modal.remove();
    modal.querySelector('.modal-close').onclick=close;
    modal.querySelector('#cancelChangeJournal').onclick=close;
    modal.onclick=e=>{if(e.target===modal)close();};
    modal.querySelector('#saveChangeJournal').onclick=()=>{
      const text=modal.querySelector('#changeJournalText').value.trim();
      if(!text){toast('Write a short reflection first.');return;}
      if(existing){existing.text=text;existing.rating=selectedRating||null;existing.updatedAt=now();}
      else state.changeJournalEntries.push({id:newId(),changeId:change.id,personId:change.personId,text,rating:selectedRating||null,at:now(),updatedAt:now()});
      saveState();close();openChangeJournal(change.id);toast(existing?'Reflection updated.':'Reflection saved. 📝');
    };
  }

  function openChangeJournal(changeId){
    const change=state.relationshipChanges.find(x=>x.id===changeId); if(!change)return;
    const person=personForChange(change); if(!person)return;
    closeChangeModal('#changeJournalBrowser');
    const rows=journalsFor(changeId);
    const modal=document.createElement('div');
    modal.id='changeJournalBrowser';
    modal.className='modal-backdrop change-layer-backdrop';
    modal.innerHTML=`<div class="modal change-journal-browser"><button class="modal-close" aria-label="Close">×</button><p class="eyebrow">HOW DID IT GO? · ${escapeHtml(person.name.toUpperCase())}</p><h2>Implementation journal</h2><div class="change-context"><small>A CHANGE I CAN MAKE IS</small><p>${escapeHtml(change.text)}</p></div><button class="btn btn-primary change-add-reflection" id="addChangeReflection">＋ Add reflection</button><div class="change-journal-list">${rows.length?rows.map(row=>`<article class="change-journal-row" data-change-journal="${row.id}"><div class="change-journal-top"><small>${fmt(row.at)}</small><div><button data-edit-change-journal="${row.id}" aria-label="Edit reflection">Edit</button><button data-delete-change-journal="${row.id}" aria-label="Delete reflection">×</button></div></div>${row.rating?`<div class="change-helpfulness">${'★'.repeat(row.rating)}${'☆'.repeat(5-row.rating)} <span>${row.rating}/5 helpful</span></div>`:''}<p>${escapeHtml(row.text)}</p></article>`).join(''):`<div class="positive-empty compact"><span>📝</span><strong>No reflections yet.</strong><p>Try the change in real life, then come back and record what happened.</p></div>`}</div></div>`;
    document.body.append(modal);
    const close=()=>modal.remove();
    modal.querySelector('.modal-close').onclick=close;
    modal.onclick=e=>{if(e.target===modal)close();};
    modal.querySelector('#addChangeReflection').onclick=()=>openJournalEditor(change);
    modal.querySelectorAll('[data-edit-change-journal]').forEach(btn=>btn.onclick=()=>{
      const row=state.changeJournalEntries.find(x=>x.id===btn.dataset.editChangeJournal); if(row)openJournalEditor(change,row);
    });
    modal.querySelectorAll('[data-delete-change-journal]').forEach(btn=>btn.onclick=()=>{
      const row=state.changeJournalEntries.find(x=>x.id===btn.dataset.deleteChangeJournal); if(!row)return;
      styledConfirm({title:'Delete this reflection?',body:'This implementation-journal entry will be permanently removed from this device.',onConfirm:()=>{
        state.changeJournalEntries=state.changeJournalEntries.filter(x=>x.id!==row.id);saveState();openChangeJournal(change.id);toast('Reflection deleted.');
      }});
    });
  }

  function renderChangesSection(personId){
    const rows=changesFor(personId);
    return `<section class="profile-section relationship-change-section" id="relationshipChangesSection"><div class="profile-section-heading change-section-heading"><div><p class="eyebrow">MY SIDE OF THE STREET</p><h2>A change I can make is:</h2></div><button type="button" class="text-btn" id="addRelationshipChange">＋ Add</button></div><p class="change-section-intro">Keep concrete commitments here, including useful ideas you bring back from Export to AI.</p><div class="relationship-change-list">${rows.length?rows.map(change=>{const journals=journalsFor(change.id);return `<article class="relationship-change-card" data-change-id="${change.id}"><div class="relationship-change-copy"><span>🌱</span><p>${escapeHtml(change.text)}</p></div><div class="relationship-change-actions"><button type="button" class="change-how" data-change-journal-open="${change.id}">How did it go?${journals.length?` <small>· ${journals.length}</small>`:''}</button><button type="button" data-edit-relationship-change="${change.id}">Edit</button><button type="button" class="danger" data-delete-relationship-change="${change.id}">×</button></div></article>`;}).join(''):`<button type="button" class="change-empty" id="emptyAddRelationshipChange"><span>🌱</span><strong>Add something you want to do differently.</strong><small>This section is about your own next move—not grading the other person.</small></button>`}</div></section>`;
  }

  function decorateProfileWithChanges(personId){
    const page=document.querySelector('#personProfilePage .person-profile-page'); if(!page||page.querySelector('#relationshipChangesSection'))return;
    const badgeSections=[...page.querySelectorAll('.profile-section')];
    const badge=badgeSections.find(s=>s.textContent.includes('BADGE HISTORY'));
    const wrapper=document.createElement('div');
    wrapper.innerHTML=renderChangesSection(personId);
    const section=wrapper.firstElementChild;
    if(badge) badge.before(section); else page.append(section);
    const add=()=>openChangeEditor(personId);
    section.querySelector('#addRelationshipChange')?.addEventListener('click',add);
    section.querySelector('#emptyAddRelationshipChange')?.addEventListener('click',add);
    section.querySelectorAll('[data-change-journal-open]').forEach(btn=>btn.onclick=()=>openChangeJournal(btn.dataset.changeJournalOpen));
    section.querySelectorAll('[data-edit-relationship-change]').forEach(btn=>btn.onclick=()=>{
      const change=state.relationshipChanges.find(x=>x.id===btn.dataset.editRelationshipChange);if(change)openChangeEditor(personId,change);
    });
    section.querySelectorAll('[data-delete-relationship-change]').forEach(btn=>btn.onclick=()=>{
      const change=state.relationshipChanges.find(x=>x.id===btn.dataset.deleteRelationshipChange);if(!change)return;
      const count=journalsFor(change.id).length;
      styledConfirm({title:'Delete this change?',body:`This will also delete ${count} implementation journal entr${count===1?'y':'ies'} tied to it.`,onConfirm:()=>{
        state.relationshipChanges=state.relationshipChanges.filter(x=>x.id!==change.id);
        state.changeJournalEntries=state.changeJournalEntries.filter(x=>x.changeId!==change.id);
        saveState();openPersonProfile(personId);toast('Change deleted.');
      }});
    });
  }

  const baseOpenPersonProfileChanges=openPersonProfile;
  openPersonProfile=function openPersonProfileWithChanges(personId){
    const result=baseOpenPersonProfileChanges(personId);
    decorateProfileWithChanges(personId);
    return result;
  };

  const style=document.createElement('style');
  style.textContent=`
  .change-section-heading{display:flex;align-items:end;justify-content:space-between;gap:12px}.change-section-heading .text-btn{margin-bottom:16px}.change-section-intro{margin:-8px 0 14px;color:var(--muted);font-size:11px;line-height:1.5}.relationship-change-list{display:grid;gap:10px}.relationship-change-card{border:1px solid var(--line);background:#fffdf8;border-radius:18px;padding:14px}.relationship-change-copy{display:flex;gap:10px;align-items:flex-start}.relationship-change-copy>span{font-size:22px}.relationship-change-copy p{margin:1px 0 0;font-size:13px;line-height:1.5;font-weight:700}.relationship-change-actions{display:flex;align-items:center;gap:7px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}.relationship-change-actions button{border:0;background:transparent;color:var(--muted);font-size:10px;font-weight:850;padding:6px}.relationship-change-actions .change-how{margin-right:auto;border:1px solid #d6c793;background:#fff5cc;color:#5f5120;border-radius:999px;padding:7px 10px}.relationship-change-actions .change-how small{font:inherit}.relationship-change-actions .danger{font-size:17px;color:#a33}.change-empty{width:100%;border:1px dashed #cfc7b9;background:#fffdf8;border-radius:18px;padding:20px;text-align:center;color:var(--ink)}.change-empty span,.change-empty strong,.change-empty small{display:block}.change-empty span{font-size:28px}.change-empty strong{margin-top:7px}.change-empty small{margin-top:4px;color:var(--muted);line-height:1.4}.change-layer-backdrop{z-index:13050!important}.change-editor-modal,.change-journal-editor,.change-journal-browser,.change-confirm-modal{width:min(540px,calc(100vw - 28px));max-height:90vh;overflow:auto}.change-modal-intro{color:var(--muted);font-size:12px;line-height:1.5}.change-editor-modal textarea,.change-journal-editor textarea{width:100%;min-height:120px;margin-top:7px;border:1px solid var(--line);border-radius:14px;background:#fff;padding:12px;font:inherit;color:var(--ink);resize:vertical}.change-context{border:1px solid #eadfbd;background:#fff8df;border-radius:15px;padding:12px 13px;margin:12px 0 16px}.change-context small{font-size:8px;font-weight:950;letter-spacing:.12em;color:#796529}.change-context p{margin:5px 0 0;font-size:12px;line-height:1.5}.change-rating-label{font-size:11px;font-weight:850;margin:15px 0 8px}.change-rating{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.change-rating button{border:1px solid var(--line);background:#fff;border-radius:12px;padding:9px 3px;color:var(--ink)}.change-rating button b,.change-rating button small{display:block}.change-rating button b{font-size:17px}.change-rating button small{font-size:7px;color:var(--muted);margin-top:3px}.change-rating button.selected{background:#fff5cc;border-color:#d6c793}.change-add-reflection{width:100%;margin:0 0 14px}.change-journal-list{display:grid;gap:9px}.change-journal-row{border:1px solid var(--line);background:#fffdf8;border-radius:16px;padding:13px}.change-journal-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.change-journal-top>small{color:var(--muted);font-size:9px}.change-journal-top button{border:0;background:transparent;color:var(--accent-dark);font-size:10px;font-weight:850;padding:4px 6px}.change-journal-top button:last-child{font-size:16px;color:#a33}.change-journal-row p{font-size:11px;line-height:1.5;margin:9px 0 0;white-space:pre-wrap}.change-helpfulness{font-size:11px;color:#c38a18;margin-top:7px}.change-helpfulness span{color:var(--muted);font-size:9px;margin-left:4px}.change-confirm-icon{text-align:center;font-size:42px}.change-delete-btn{border:0;background:#c43f2d;color:white;border-radius:14px;padding:12px 18px;font-weight:900}
  @media(max-width:520px){.change-rating{gap:4px}.change-rating button small{font-size:6.5px}.relationship-change-actions{gap:3px}}
  `;
  document.head.append(style);
})();