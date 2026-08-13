// Post-fight reflection journal for Days Since We Fought.
// Journal data remains inside the same local state/backup as streak data.

if (!Array.isArray(state.journalEntries)) {
  state.journalEntries = [];
  saveState();
}

const FEELINGS = ['Angry','Hurt','Frustrated','Overwhelmed','Disrespected','Anxious','Sad','Embarrassed','Defensive','Tired'];
const NEXT_STEPS = ['Apologize','Listen first','Give it space','Talk it through','Do something kind','Let it go'];

function localDateKey(value) {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatJournalDate(value, includeTime = true) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {})
  });
}

function journalPerson(entry) {
  return state.people.find(p => p.id === entry.personId);
}

function journalPreview(entry) {
  return entry.answers?.whatHappened || entry.answers?.myPart || entry.answers?.betterNextTime || 'Reflection saved';
}

function closeJournalModal(modal) {
  modal?.remove();
}

function openJournalFlow(personId, fightEventId, fightAt, existingEntry = null) {
  const person = state.people.find(p => p.id === personId);
  if (!person) return;

  const existing = existingEntry || state.journalEntries.find(e => e.fightEventId === fightEventId);
  const draft = {
    whatHappened: existing?.answers?.whatHappened || '',
    trigger: existing?.answers?.trigger || '',
    feelings: [...(existing?.answers?.feelings || [])],
    whatNeeded: existing?.answers?.whatNeeded || '',
    myPart: existing?.answers?.myPart || '',
    nextSteps: [...(existing?.answers?.nextSteps || [])],
    betterNextTime: existing?.answers?.betterNextTime || ''
  };
  let step = 0;
  const steps = ['What happened?', 'What was happening inside you?', 'Own your part', 'Choose the next move'];

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop journal-backdrop';
  document.body.append(modal);

  const renderStep = () => {
    const progress = ((step + 1) / steps.length) * 100;
    let body = '';

    if (step === 0) {
      body = `
        <label class="journal-label">What happened?<textarea id="whatHappened" maxlength="2000" placeholder="Describe it as plainly as you can. What was said or done?">${escapeHtml(draft.whatHappened)}</textarea></label>
        <label class="journal-label">What seemed to set it off?<textarea id="trigger" maxlength="1000" placeholder="The trigger can be small even when the reaction was big.">${escapeHtml(draft.trigger)}</textarea></label>`;
    } else if (step === 1) {
      body = `
        <p class="journal-question">What were you feeling?</p>
        <div class="choice-chips" id="feelingChips">${FEELINGS.map(f => `<button type="button" class="choice-chip ${draft.feelings.includes(f) ? 'selected' : ''}" data-feeling="${f}">${f}</button>`).join('')}</div>
        <label class="journal-label">What did you need, want, or feel you were protecting?<textarea id="whatNeeded" maxlength="1500" placeholder="Examples: respect, quiet, help, control, reassurance, being heard…">${escapeHtml(draft.whatNeeded)}</textarea></label>`;
    } else if (step === 2) {
      body = `
        <label class="journal-label">What part was yours?<textarea id="myPart" maxlength="2000" placeholder="Focus on what you can own without keeping score of the other person's part.">${escapeHtml(draft.myPart)}</textarea></label>
        <div class="reflection-nudge">You can be right about the issue and still identify something you wish you had handled differently.</div>`;
    } else {
      body = `
        <p class="journal-question">What do you want to do next?</p>
        <div class="choice-chips" id="nextStepChips">${NEXT_STEPS.map(f => `<button type="button" class="choice-chip ${draft.nextSteps.includes(f) ? 'selected' : ''}" data-next="${f}">${f}</button>`).join('')}</div>
        <label class="journal-label">What would a better response look like next time?<textarea id="betterNextTime" maxlength="2000" placeholder="Give future-you something specific to try.">${escapeHtml(draft.betterNextTime)}</textarea></label>`;
    }

    modal.innerHTML = `<div class="modal journal-modal">
      <button class="modal-close" id="closeJournal" aria-label="Close">×</button>
      <p class="eyebrow">POST-FIGHT REFLECTION · ${escapeHtml(person.name.toUpperCase())}</p>
      <div class="journal-progress"><span style="width:${progress}%"></span></div>
      <div class="journal-step-count">${step + 1} of ${steps.length}</div>
      <h2>${steps[step]}</h2>
      <p class="journal-intro">This is for understanding the quarrel—not winning it.</p>
      <div class="journal-step-body">${body}</div>
      <div class="journal-actions">
        ${step > 0 ? '<button class="btn btn-ghost" id="journalBack">← Back</button>' : '<button class="btn btn-ghost" id="journalLater">Not now</button>'}
        <button class="btn btn-primary" id="journalNext">${step === steps.length - 1 ? 'Save reflection' : 'Continue →'}</button>
      </div>
    </div>`;

    const syncFields = () => {
      if (step === 0) {
        draft.whatHappened = modal.querySelector('#whatHappened')?.value.trim() || '';
        draft.trigger = modal.querySelector('#trigger')?.value.trim() || '';
      } else if (step === 1) {
        draft.whatNeeded = modal.querySelector('#whatNeeded')?.value.trim() || '';
      } else if (step === 2) {
        draft.myPart = modal.querySelector('#myPart')?.value.trim() || '';
      } else {
        draft.betterNextTime = modal.querySelector('#betterNextTime')?.value.trim() || '';
      }
    };

    modal.querySelectorAll('[data-feeling]').forEach(btn => btn.onclick = () => {
      const value = btn.dataset.feeling;
      draft.feelings = draft.feelings.includes(value) ? draft.feelings.filter(x => x !== value) : [...draft.feelings, value];
      btn.classList.toggle('selected');
    });
    modal.querySelectorAll('[data-next]').forEach(btn => btn.onclick = () => {
      const value = btn.dataset.next;
      draft.nextSteps = draft.nextSteps.includes(value) ? draft.nextSteps.filter(x => x !== value) : [...draft.nextSteps, value];
      btn.classList.toggle('selected');
    });

    modal.querySelector('#closeJournal').onclick = () => closeJournalModal(modal);
    modal.querySelector('#journalLater')?.addEventListener('click', () => closeJournalModal(modal));
    modal.querySelector('#journalBack')?.addEventListener('click', () => { syncFields(); step--; renderStep(); });
    modal.querySelector('#journalNext').onclick = () => {
      syncFields();
      if (step < steps.length - 1) { step++; renderStep(); return; }
      saveJournalEntry({ existing, personId, fightEventId, fightAt, answers: draft });
      closeJournalModal(modal);
      toast(existing ? 'Reflection updated.' : 'Reflection saved. 📝');
      decorateJournalHub();
    };
  };

  renderStep();
}

function saveJournalEntry({ existing, personId, fightEventId, fightAt, answers }) {
  const fightEvent = state.events.find(e => e.id === fightEventId);
  if (existing) {
    existing.answers = answers;
    existing.updatedAt = now();
  } else {
    state.journalEntries.unshift({
      id: id(),
      fightEventId,
      personId,
      at: fightAt || fightEvent?.at || now(),
      streakDurationMs: fightEvent?.durationMs || 0,
      answers,
      createdAt: now(),
      updatedAt: now()
    });
  }
  saveState();
}

function openJournalRegistry() {
  const entries = [...state.journalEntries].sort((a,b) => b.at - a.at);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop journal-backdrop';
  modal.innerHTML = `<div class="modal journal-browser">
    <button class="modal-close" aria-label="Close">×</button>
    <p class="eyebrow">REFLECTION JOURNAL</p>
    <h2>Registry</h2>
    <p class="journal-intro">${entries.length} saved reflection${entries.length === 1 ? '' : 's'}.</p>
    <div class="journal-registry">
      ${entries.length ? entries.map(entry => {
        const p = journalPerson(entry);
        return `<button class="registry-entry" data-entry="${entry.id}">
          <div class="registry-date">${formatJournalDate(entry.at)}</div>
          <div class="registry-person">${p ? avatar(p, 'sm') : ''}<div><strong>${escapeHtml(p?.name || 'Removed family member')}</strong><span>${escapeHtml(journalPreview(entry).slice(0,110))}${journalPreview(entry).length > 110 ? '…' : ''}</span></div></div>
        </button>`;
      }).join('') : '<div class="empty-state">No reflections yet. Your first one can begin after a “We fought” reset.</div>'}
    </div>
  </div>`;
  document.body.append(modal);
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  modal.querySelectorAll('[data-entry]').forEach(btn => btn.onclick = () => {
    const entry = state.journalEntries.find(e => e.id === btn.dataset.entry);
    if (!entry) return;
    modal.remove();
    openJournalEntry(entry);
  });
}

function openJournalEntry(entry) {
  const p = journalPerson(entry);
  const a = entry.answers || {};
  const duration = elapsed(entry.streakDurationMs || 0);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop journal-backdrop';
  modal.innerHTML = `<div class="modal journal-browser journal-detail">
    <button class="modal-close" aria-label="Close">×</button>
    <p class="eyebrow">${formatJournalDate(entry.at)}</p>
    <div class="journal-detail-person">${p ? avatar(p, 'lg') : ''}<div><h2>${escapeHtml(p?.name || 'Family member')}</h2><p>Streak before fight: ${duration.days}d ${duration.hours}h ${duration.minutes}m</p></div></div>
    ${journalDetailSection('What happened', a.whatHappened)}
    ${journalDetailSection('What set it off', a.trigger)}
    ${journalDetailSection('What I was feeling', (a.feelings || []).join(', '))}
    ${journalDetailSection('What I needed / was protecting', a.whatNeeded)}
    ${journalDetailSection('What part was mine', a.myPart)}
    ${journalDetailSection('What I want to do next', (a.nextSteps || []).join(', '))}
    ${journalDetailSection('A better response next time', a.betterNextTime)}
    <div class="journal-actions"><button class="btn danger-text" id="deleteReflection">Delete</button><button class="btn btn-primary" id="editReflection">Edit reflection</button></div>
  </div>`;
  document.body.append(modal);
  modal.querySelector('.modal-close').onclick = () => modal.remove();
  modal.querySelector('#editReflection').onclick = () => { modal.remove(); openJournalFlow(entry.personId, entry.fightEventId, entry.at, entry); };
  modal.querySelector('#deleteReflection').onclick = () => {
    if (!confirm('Delete this reflection? The fight record and streak history will remain.')) return;
    state.journalEntries = state.journalEntries.filter(e => e.id !== entry.id);
    saveState(); modal.remove(); decorateJournalHub(); toast('Reflection deleted.');
  };
}

function journalDetailSection(title, value) {
  if (!value) return '';
  return `<section class="journal-detail-section"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(String(value))}</p></section>`;
}

function openJournalCalendar(initialDate = new Date()) {
  let cursor = new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop journal-backdrop';
  document.body.append(modal);

  const renderCalendar = () => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push('<div class="calendar-cell blank"></div>');
    for (let day = 1; day <= daysInMonth; day++) {
      const key = localDateKey(new Date(year, month, day));
      const entries = state.journalEntries.filter(e => localDateKey(e.at) === key);
      cells.push(`<button class="calendar-cell ${entries.length ? 'has-entry' : ''}" data-date="${key}"><span>${day}</span>${entries.length ? `<i>${entries.length}</i>` : ''}</button>`);
    }
    modal.innerHTML = `<div class="modal journal-browser calendar-modal">
      <button class="modal-close" aria-label="Close">×</button>
      <p class="eyebrow">REFLECTION JOURNAL</p>
      <div class="calendar-title-row"><button class="round-btn" id="prevMonth">‹</button><h2>${cursor.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</h2><button class="round-btn" id="nextMonth">›</button></div>
      <div class="calendar-weekdays">${['S','M','T','W','T','F','S'].map(d => `<span>${d}</span>`).join('')}</div>
      <div class="calendar-grid">${cells.join('')}</div>
      <div id="calendarDayEntries" class="calendar-day-entries"></div>
    </div>`;
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('#prevMonth').onclick = () => { cursor = new Date(year, month - 1, 1); renderCalendar(); };
    modal.querySelector('#nextMonth').onclick = () => { cursor = new Date(year, month + 1, 1); renderCalendar(); };
    modal.querySelectorAll('[data-date]').forEach(btn => btn.onclick = () => showCalendarDay(btn.dataset.date));
  };

  const showCalendarDay = key => {
    const target = modal.querySelector('#calendarDayEntries');
    const entries = state.journalEntries.filter(e => localDateKey(e.at) === key).sort((a,b)=>a.at-b.at);
    const d = new Date(`${key}T12:00:00`);
    target.innerHTML = `<h3>${d.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</h3>${entries.length ? entries.map(entry => {
      const p = journalPerson(entry);
      return `<button class="day-entry" data-open-entry="${entry.id}"><strong>${escapeHtml(p?.name || 'Family member')}</strong><span>${new Date(entry.at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})} · ${escapeHtml(journalPreview(entry).slice(0,80))}</span></button>`;
    }).join('') : '<p>No reflections saved on this day.</p>'}`;
    target.querySelectorAll('[data-open-entry]').forEach(btn => btn.onclick = () => {
      const entry = state.journalEntries.find(e => e.id === btn.dataset.openEntry);
      if (!entry) return;
      modal.remove(); openJournalEntry(entry);
    });
  };

  renderCalendar();
}

function decorateJournalHub() {
  if (!state.onboardingComplete) return;
  const shell = document.querySelector('.app-shell');
  if (!shell || shell.querySelector('#journalHub')) return;
  const footer = shell.querySelector('footer');
  const entries = state.journalEntries || [];
  const latest = [...entries].sort((a,b)=>b.at-a.at)[0];
  const section = document.createElement('section');
  section.id = 'journalHub';
  section.className = 'journal-hub';
  section.innerHTML = `<div class="section-heading"><div><p class="eyebrow">REFLECTION JOURNAL</p><h2>Learn from the hard days.</h2></div></div>
    <div class="journal-hub-card">
      <div class="journal-hub-copy"><span class="journal-icon">📝</span><div><strong>${entries.length} reflection${entries.length === 1 ? '' : 's'}</strong><small>${latest ? `Latest: ${formatJournalDate(latest.at, false)}` : 'Your post-fight reflections will live here.'}</small></div></div>
      <div class="journal-hub-actions"><button class="btn btn-ghost" id="openRegistry">Registry</button><button class="btn btn-primary" id="openCalendar">Calendar</button></div>
    </div>`;
  footer?.before(section);
  section.querySelector('#openRegistry').onclick = openJournalRegistry;
  section.querySelector('#openCalendar').onclick = () => openJournalCalendar();
}

// Preserve the streak behavior, then immediately offer the reflection flow.
const baseResetStreak = resetStreak;
resetStreak = function journalAwareResetStreak(person) {
  baseResetStreak(person);
  const fightEvent = state.events.find(e => e.type === 'fight' && e.personId === person.id);
  if (fightEvent) setTimeout(() => openJournalFlow(person.id, fightEvent.id, fightEvent.at), 120);
};

// If a fight reset is undone, remove a reflection tied to that reset as well.
const baseUndoFight = undoFight;
undoFight = function journalAwareUndoFight() {
  const undo = state.lastUndo && now() <= state.lastUndo.expiresAt ? { ...state.lastUndo } : null;
  baseUndoFight();
  if (undo) {
    state.journalEntries = state.journalEntries.filter(e => e.fightEventId !== undo.eventId);
    saveState();
    decorateJournalHub();
  }
};

const journalObserver = new MutationObserver(() => decorateJournalHub());
journalObserver.observe(document.querySelector('#app'), { childList: true, subtree: true });
decorateJournalHub();
