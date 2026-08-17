// DSWF notification permissions + local reminder layer.
// A pure PWA cannot guarantee arbitrary scheduled background execution without push delivery.
// These reminders fire when DSWF is active/reopened, and the service worker is push-ready for future server delivery.

(function installDSWFNotifications() {
  const NOTIFICATION_STATE_KEY = 'dswf-notification-meta-v1';
  const DEFAULT_PREFS = { dailyCheckIn: true, experiments: true };

  if (!state.settings || typeof state.settings !== 'object') state.settings = {};
  if (!state.settings.notifications || typeof state.settings.notifications !== 'object') {
    state.settings.notifications = { ...DEFAULT_PREFS };
    saveState();
  }

  function notificationSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  function notificationPrefs() {
    return { ...DEFAULT_PREFS, ...(state.settings.notifications || {}) };
  }

  function readMeta() {
    try { return JSON.parse(localStorage.getItem(NOTIFICATION_STATE_KEY) || '{}'); }
    catch { return {}; }
  }

  function writeMeta(patch) {
    localStorage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify({ ...readMeta(), ...patch }));
  }

  function localDayKey(value = Date.now()) {
    const d = new Date(value);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  async function ensureRootServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      // app/index.html lives one level below the service worker.
      const registration = await navigator.serviceWorker.register('../sw.js', { scope: '../' });
      return registration;
    } catch (error) {
      console.warn('DSWF service worker registration failed', error);
      return navigator.serviceWorker.getRegistration('../').catch(() => null);
    }
  }

  async function showDSWFNotification(title, body, tag, data = {}) {
    if (!notificationSupported() || Notification.permission !== 'granted') return false;
    try {
      const registration = await ensureRootServiceWorker();
      if (!registration) return false;
      await registration.showNotification(title, {
        body,
        tag,
        renotify: false,
        icon: '../icons/DSWF.png',
        badge: '../icons/DSWF.png',
        data: { url: './', ...data }
      });
      return true;
    } catch (error) {
      console.warn('DSWF notification failed', error);
      return false;
    }
  }

  function hasTodaysCheckIn() {
    const today = localDayKey();
    return (state.dailyCheckIns || []).some(entry => entry.dayKey === today);
  }

  function activeExperiments() {
    const current = Date.now();
    return (state.experiments || []).filter(exp => exp.status === 'active' && (!exp.endsAt || exp.endsAt > current));
  }

  async function maybeSendReminders() {
    if (!notificationSupported() || Notification.permission !== 'granted' || !state.onboardingComplete) return;
    const prefs = notificationPrefs();
    const meta = readMeta();
    const today = localDayKey();
    const hour = new Date().getHours();

    // Avoid an early-morning interruption. If DSWF is opened after 8am and today's check-in is incomplete,
    // send one reminder for the local calendar day.
    if (prefs.dailyCheckIn && hour >= 8 && !hasTodaysCheckIn() && meta.dailyCheckInReminderDay !== today) {
      const sent = await showDSWFNotification(
        'How are you doing today?',
        'Take your 2-minute DSWF Daily Check-In and get today’s relationship temperature.',
        `dswf-daily-${today}`,
        { type: 'daily-checkin' }
      );
      if (sent) writeMeta({ dailyCheckInReminderDay: today });
    }

    const experiments = activeExperiments();
    if (prefs.experiments && experiments.length && meta.experimentReminderDay !== today) {
      const exp = experiments[0];
      const remaining = exp.endsAt ? Math.max(0, Math.ceil((exp.endsAt - Date.now()) / DAY)) : null;
      const body = experiments.length === 1
        ? `${exp.title}${remaining !== null ? ` · ${remaining} day${remaining === 1 ? '' : 's'} remaining` : ''}. Keep the experiment in mind today.`
        : `${experiments.length} DSWF experiments are active. Keep today’s experiments in mind.`;
      const sent = await showDSWFNotification(
        'DSWF experiment reminder',
        body,
        `dswf-experiment-${today}`,
        { type: 'experiment' }
      );
      if (sent) writeMeta({ experimentReminderDay: today });
    }
  }

  function openNotificationPermissionModal() {
    document.querySelector('#dswfNotificationModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'dswfNotificationModal';
    modal.className = 'modal-backdrop notification-permission-backdrop';
    modal.innerHTML = `<div class="modal notification-permission-modal">
      <button type="button" class="modal-close" aria-label="Close">×</button>
      <div class="notification-bell">🔔</div>
      <p class="eyebrow">DSWF REMINDERS</p>
      <h2>Let DSWF give you a nudge.</h2>
      <p class="notification-intro">Notifications can remind you to complete your Daily Check-In and keep active 7-day experiments in mind.</p>
      <div class="notification-examples">
        <div><span>☀️</span><p><strong>Daily Check-In</strong><small>One reminder on days you have not checked in yet.</small></p></div>
        <div><span>🧪</span><p><strong>Active experiments</strong><small>A daily nudge while a DSWF experiment is running.</small></p></div>
      </div>
      <div class="notification-limit"><strong>PWA note</strong><span>Without a push server, DSWF can reliably check for these reminders when the app is active or reopened. The notification system is structured so background web push can be added later.</span></div>
      <div class="modal-actions"><button type="button" class="btn btn-ghost" id="notificationNotNow">Not now</button><button type="button" class="btn btn-primary" id="enableDSWFNotifications">Enable notifications</button></div>
    </div>`;
    document.body.append(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close').onclick = close;
    modal.querySelector('#notificationNotNow').onclick = () => { writeMeta({ permissionPromptDismissed: true }); close(); };
    modal.onclick = event => { if (event.target === modal) close(); };
    modal.querySelector('#enableDSWFNotifications').onclick = async () => {
      if (!notificationSupported()) {
        if (typeof toast === 'function') toast('Notifications are not supported in this browser.');
        close();
        return;
      }
      try {
        await ensureRootServiceWorker();
        const permission = await Notification.requestPermission();
        writeMeta({ permissionPromptDismissed: permission !== 'granted', permissionRequestedAt: Date.now() });
        if (permission === 'granted') {
          state.settings.notifications = { ...DEFAULT_PREFS, ...notificationPrefs() };
          saveState();
          if (typeof toast === 'function') toast('DSWF reminders are on. 🔔');
          setTimeout(maybeSendReminders, 400);
        } else if (typeof toast === 'function') {
          toast('Notifications were not enabled.');
        }
      } catch (error) {
        console.error('DSWF notification permission failed', error);
        if (typeof toast === 'function') toast('Could not enable notifications.');
      }
      close();
      refreshNotificationNudge();
    };
  }

  function refreshNotificationNudge() {
    document.querySelector('#notificationPermissionNudge')?.remove();
    if (!state.onboardingComplete || !notificationSupported() || Notification.permission !== 'default') return;
    const simmer = document.querySelector('#simmerLaunchSection');
    if (!simmer) return;
    const dailyCard = simmer.querySelector('#dailyCheckInCard');
    if (!dailyCard) return;
    const nudge = document.createElement('button');
    nudge.type = 'button';
    nudge.id = 'notificationPermissionNudge';
    nudge.className = 'notification-permission-nudge';
    nudge.innerHTML = `<span>🔔</span><span><strong>Turn on DSWF reminders</strong><small>Daily Check-In + active experiment nudges</small></span><b>→</b>`;
    dailyCard.insertAdjacentElement('afterend', nudge);
    nudge.onclick = openNotificationPermissionModal;
  }

  function openNotificationSettingsModal() {
    document.querySelector('#dswfNotificationSettings')?.remove();
    const prefs = notificationPrefs();
    const modal = document.createElement('div');
    modal.id = 'dswfNotificationSettings';
    modal.className = 'modal-backdrop notification-permission-backdrop';
    const permissionLabel = !notificationSupported() ? 'Not supported' : Notification.permission === 'granted' ? 'Allowed' : Notification.permission === 'denied' ? 'Blocked in browser' : 'Not enabled';
    modal.innerHTML = `<div class="modal notification-settings-modal">
      <button type="button" class="modal-close" aria-label="Close">×</button>
      <p class="eyebrow">NOTIFICATIONS</p><h2>Reminder controls</h2>
      <div class="notification-status-row"><span>System permission</span><strong>${permissionLabel}</strong></div>
      <label class="notification-toggle"><span><strong>Daily Check-In</strong><small>Remind me when today's check-in is still incomplete.</small></span><input type="checkbox" id="notifyDaily" ${prefs.dailyCheckIn ? 'checked' : ''}></label>
      <label class="notification-toggle"><span><strong>Active experiments</strong><small>Remind me once a day when a 7-day experiment is running.</small></span><input type="checkbox" id="notifyExperiments" ${prefs.experiments ? 'checked' : ''}></label>
      ${Notification.permission === 'default' ? '<button type="button" class="btn btn-primary notification-enable-settings" id="enableNotificationsFromSettings">Enable system notifications</button>' : ''}
      ${Notification.permission === 'denied' ? '<div class="notification-limit">Notifications are blocked for DSWF in your browser/site settings. Re-enable permission there to receive reminders.</div>' : ''}
    </div>`;
    document.body.append(modal);
    const save = () => {
      state.settings.notifications = {
        dailyCheckIn: modal.querySelector('#notifyDaily').checked,
        experiments: modal.querySelector('#notifyExperiments').checked
      };
      saveState();
    };
    modal.querySelector('#notifyDaily').onchange = save;
    modal.querySelector('#notifyExperiments').onchange = save;
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.onclick = event => { if (event.target === modal) modal.remove(); };
    modal.querySelector('#enableNotificationsFromSettings')?.addEventListener('click', () => {
      modal.remove();
      openNotificationPermissionModal();
    });
  }

  const baseOpenSettingsNotifications = openSettings;
  openSettings = function openSettingsWithNotifications(...args) {
    baseOpenSettingsNotifications(...args);
    const modal = [...document.querySelectorAll('.modal-backdrop .modal')].at(-1);
    if (!modal || modal.querySelector('#notificationSettingsRow')) return;
    const row = document.createElement('button');
    row.className = 'setting-row';
    row.id = 'notificationSettingsRow';
    const status = !notificationSupported() ? 'Unavailable' : Notification.permission === 'granted' ? 'On' : Notification.permission === 'denied' ? 'Blocked' : 'Off';
    row.innerHTML = `<span><strong>Notifications</strong><small>Daily Check-In and experiment reminders · ${status}</small></span><b>→</b>`;
    const install = modal.querySelector('#installApp');
    if (install) install.insertAdjacentElement('afterend', row);
    else modal.prepend(row);
    row.onclick = () => { row.closest('.modal-backdrop')?.remove(); openNotificationSettingsModal(); };
  };

  const style = document.createElement('style');
  style.textContent = `
    .notification-permission-nudge{width:100%;margin:9px 0 0;border:1px solid #ddd6ca;background:#fffdf8;border-radius:16px;padding:12px 13px;display:flex;align-items:center;gap:10px;text-align:left;color:var(--ink)}
    .notification-permission-nudge>span:first-child{font-size:24px}.notification-permission-nudge>span:nth-child(2){flex:1;min-width:0}.notification-permission-nudge strong,.notification-permission-nudge small{display:block}.notification-permission-nudge strong{font-size:12px}.notification-permission-nudge small{font-size:9px;color:var(--muted);margin-top:2px}.notification-permission-nudge b{font-size:17px}
    .notification-permission-backdrop{z-index:12500!important}.notification-bell{font-size:48px;text-align:center;margin:8px 0}.notification-permission-modal h2{font-size:28px;line-height:1.08}.notification-intro{color:var(--muted);font-size:12px;line-height:1.55}.notification-examples{display:grid;gap:8px;margin:16px 0}.notification-examples>div{display:flex;gap:10px;align-items:center;border:1px solid var(--line);background:#fffdf8;border-radius:15px;padding:11px}.notification-examples>div>span{font-size:25px}.notification-examples p{margin:0}.notification-examples strong,.notification-examples small{display:block}.notification-examples strong{font-size:12px}.notification-examples small{font-size:9px;color:var(--muted);margin-top:2px;line-height:1.4}.notification-limit{background:#f0ede6;border-radius:14px;padding:11px 12px;font-size:9px;line-height:1.45;color:var(--muted);margin-top:10px}.notification-limit strong,.notification-limit span{display:block}.notification-limit strong{color:var(--ink);margin-bottom:3px}.notification-status-row{display:flex;justify-content:space-between;gap:15px;padding:12px 0;border-bottom:1px solid var(--line);font-size:11px}.notification-toggle{display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)}.notification-toggle>span{flex:1}.notification-toggle strong,.notification-toggle small{display:block}.notification-toggle strong{font-size:12px}.notification-toggle small{font-size:9px;color:var(--muted);line-height:1.4;margin-top:2px}.notification-toggle input{width:20px;height:20px;accent-color:var(--accent-dark)}.notification-enable-settings{width:100%;margin-top:16px}
  `;
  document.head.appendChild(style);

  // Re-check when the dashboard changes, the tab becomes active, or enough time passes while open.
  const app = document.querySelector('#app');
  if (app) new MutationObserver(() => queueMicrotask(refreshNotificationNudge)).observe(app, { childList:true, subtree:false });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshNotificationNudge();
      maybeSendReminders();
    }
  });
  setInterval(maybeSendReminders, 15 * 60 * 1000);
  ensureRootServiceWorker().finally(() => {
    refreshNotificationNudge();
    maybeSendReminders();
  });
})();