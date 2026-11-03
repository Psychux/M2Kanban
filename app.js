// ===== Ergo Hub : Kanban des quêtes =====
// Modules retirés pour l'instant : Réseau Pro (CRM), Voyageur & JdB.
// Ils seront redéveloppés plus tard, à partir du document 03 - Fonctions.

// ----- Sons -----
const playRetroSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'levelUp') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'subGoal') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    }
  } catch (e) {}
};

// ----- Constantes -----
const STORAGE_KEY = 'ergo_kanban_tasks';
const COLUMNS = ['todo', 'doing', 'done'];
const URGENCY = {
  1: { label: 'Basse', icon: '🟢', cls: 'border-emerald-500/40 text-emerald-300' },
  2: { label: 'Moyenne', icon: '🟡', cls: 'border-yellow-500/40 text-yellow-300' },
  3: { label: 'Haute', icon: '🟠', cls: 'border-orange-500/40 text-orange-300' },
  4: { label: 'Critique', icon: '🔴', cls: 'border-rose-500/50 text-rose-300' }
};

// ----- Données -----
function loadTasks() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return raw.map(normalizeTask);
  } catch (e) {
    return [];
  }
}
function normalizeTask(t) {
  return {
    id: t.id || uid(),
    title: t.title || 'Sans titre',
    ue: t.ue || '',
    due: t.due || '',
    urgency: Number(t.urgency) || 2,
    desc: t.desc || '',
    status: COLUMNS.includes(t.status) ? t.status : 'todo',
    subquests: Array.isArray(t.subquests) ? t.subquests.map(s => ({
      id: s.id || uid(), title: s.title || '', due: s.due || '', done: !!s.done
    })) : [],
    expanded: !!t.expanded,
    createdAt: t.createdAt || Date.now()
  };
}
function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(kanbanTasks)); } catch (e) {}
}

let kanbanTasks = loadTasks();

// ----- Utilitaires -----
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function findTask(id) { return kanbanTasks.find(t => t.id === id); }
function daysUntil(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
function dueLabel(iso) {
  const n = daysUntil(iso);
  if (n === null) return '';
  if (n < 0) return `<span class="text-rose-400 font-bold">En retard de ${-n} j</span>`;
  if (n === 0) return `<span class="text-amber-300 font-bold">Aujourd'hui</span>`;
  if (n === 1) return `<span class="text-amber-300 font-bold">Demain</span>`;
  const [y, m, d] = iso.split('-');
  return `<span class="text-slate-300">${d}/${m}/${y}</span>`;
}

// ----- Navigation -----
function changeLogoStyle(styleKey) {
  const box = document.getElementById('main-logo-container');
  if (styleKey === 'A') box.innerHTML = `<h1 class="text-xl font-black tracking-wider text-emerald-400 font-mono">🌿 ERGO<span class="text-slate-100">.HUB</span></h1>`;
  else if (styleKey === 'B') box.innerHTML = `<h1 class="text-xl font-bold text-amber-400 font-mono">⚔️ ERGO<span class="text-emerald-400">_HUB</span></h1>`;
  else if (styleKey === 'C') box.innerHTML = `<div class="flex items-center gap-1.5"><span class="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">M2</span><h1 class="text-lg font-bold text-slate-100">Ergo Lab</h1></div>`;
}

function switchTab(tabId) {
  ['dashboard', 'workspace'].forEach(t => {
    document.getElementById(`sec-${t}`).classList.add('hidden');
    document.getElementById(`tab-${t}`).className = "px-3.5 py-1.5 rounded-md font-medium text-xs transition text-slate-400 hover:text-white";
  });
  document.getElementById(`sec-${tabId}`).classList.remove('hidden');
  document.getElementById(`tab-${tabId}`).className = "px-3.5 py-1.5 rounded-md font-medium text-xs transition bg-emerald-600 text-white";
  if (tabId === 'workspace') renderKanban();
  if (tabId === 'dashboard') renderDashboard();
}

function switchWorkspaceSubTab(subId) {
  ['kanban', 'agenda', 'resources'].forEach(s => {
    document.getElementById(`wsub-${s}`).classList.add('hidden');
    document.getElementById(`wsubtab-${s}`).className = "px-4 py-2 rounded-lg font-bold text-xs transition bg-slate-800 text-slate-400 hover:text-white border border-slate-700";
  });
  document.getElementById(`wsub-${subId}`).classList.remove('hidden');
  document.getElementById(`wsubtab-${subId}`).className = "px-4 py-2 rounded-lg font-bold text-xs transition bg-emerald-600 text-white";
  if (subId === 'kanban') renderKanban();
}

// ----- Formulaire de création -----
function toggleAddTaskModal() {
  const box = document.getElementById('add-task-form-box');
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) document.getElementById('new-task-title').focus();
}

function addSubQuestInput(data = {}) {
  const container = document.getElementById('subquests-input-container');
  const row = document.createElement('div');
  row.className = 'subquest-input-row flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs';
  row.innerHTML = `
    <input type="text" placeholder="Sous-quête (ex : Rédiger l'introduction)" value="${esc(data.title || '')}"
      class="sq-title flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded p-2 text-slate-200">
    <input type="date" value="${esc(data.due || '')}" title="Jalon (facultatif)"
      class="sq-due bg-slate-900 border border-slate-700 rounded p-2 text-amber-300 font-mono">
    <button type="button" onclick="this.parentElement.remove()" aria-label="Retirer cette sous-quête"
      class="px-2 py-1.5 text-rose-400 hover:text-rose-300">✕</button>`;
  container.appendChild(row);
  row.querySelector('.sq-title').focus();
}

function resetTaskForm() {
  ['new-task-title', 'new-task-ue', 'new-task-due', 'new-task-desc'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('new-task-urgency').value = '2';
  document.getElementById('subquests-input-container').innerHTML = '';
  document.getElementById('new-task-error').classList.add('hidden');
}

function addNewTask() {
  const titleEl = document.getElementById('new-task-title');
  const title = titleEl.value.trim();
  const err = document.getElementById('new-task-error');
  if (!title) {
    err.classList.remove('hidden');
    titleEl.focus();
    return;
  }
  err.classList.add('hidden');

  const subquests = [...document.querySelectorAll('#subquests-input-container .subquest-input-row')]
    .map(row => ({
      id: uid(),
      title: row.querySelector('.sq-title').value.trim(),
      due: row.querySelector('.sq-due').value,
      done: false
    }))
    .filter(s => s.title);

  kanbanTasks.push(normalizeTask({
    title,
    ue: document.getElementById('new-task-ue').value.trim(),
    due: document.getElementById('new-task-due').value,
    urgency: document.getElementById('new-task-urgency').value,
    desc: document.getElementById('new-task-desc').value.trim(),
    status: 'todo',
    subquests,
    expanded: subquests.length > 0
  }));
  saveTasks();
  resetTaskForm();
  document.getElementById('add-task-form-box').classList.add('hidden');
  renderKanban();
}

// Efface le message d'erreur dès que l'utilisateur tape un titre
document.addEventListener('input', e => {
  if (e.target.id === 'new-task-title') document.getElementById('new-task-error').classList.add('hidden');
});

// ----- Actions sur les cartes -----
function setUrgency(id, value) {
  const t = findTask(id); if (!t) return;
  t.urgency = Number(value);
  saveTasks();
  renderKanban();
}

function toggleExpandTask(id) {
  const t = findTask(id); if (!t) return;
  t.expanded = !t.expanded;
  saveTasks();
  renderKanban();
}

function moveTask(id, direction) {
  const t = findTask(id); if (!t) return;
  const i = COLUMNS.indexOf(t.status) + direction;
  if (i < 0 || i >= COLUMNS.length) return;
  setStatus(t, COLUMNS[i]);
}

function setStatus(t, status) {
  if (t.status === status) return;
  t.status = status;
  if (status === 'done') playRetroSound('levelUp');
  saveTasks();
  renderKanban();
}

function deleteTask(id) {
  const t = findTask(id); if (!t) return;
  if (!confirm(`Supprimer la quête « ${t.title} » et ses sous-quêtes ?`)) return;
  kanbanTasks = kanbanTasks.filter(x => x.id !== id);
  saveTasks();
  renderKanban();
}

function toggleSubQuest(taskId, subId) {
  const t = findTask(taskId); if (!t) return;
  const s = t.subquests.find(x => x.id === subId); if (!s) return;
  s.done = !s.done;
  if (s.done) playRetroSound('subGoal');
  saveTasks();
  renderKanban();
}

function deleteSubQuest(taskId, subId) {
  const t = findTask(taskId); if (!t) return;
  t.subquests = t.subquests.filter(x => x.id !== subId);
  saveTasks();
  renderKanban();
}

function addSubQuestToTask(event, taskId) {
  event.preventDefault();
  const t = findTask(taskId); if (!t) return;
  const form = event.target;
  const title = form.querySelector('[name=sq-title]').value.trim();
  if (!title) { form.querySelector('[name=sq-title]').focus(); return; }
  t.subquests.push({ id: uid(), title, due: form.querySelector('[name=sq-due]').value, done: false });
  saveTasks();
  renderKanban();
  const again = document.querySelector(`#task-${taskId} [name=sq-title]`);
  if (again) again.focus();
}

// ----- Glisser-déposer -----
function allowDrop(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.add('ring-2', 'ring-emerald-500/40', 'rounded-lg');
}
function leaveDrop(ev) {
  if (!ev.currentTarget.contains(ev.relatedTarget)) ev.currentTarget.classList.remove('ring-2', 'ring-emerald-500/40', 'rounded-lg');
}
function drag(ev) {
  ev.dataTransfer.setData('text/plain', ev.currentTarget.dataset.id);
  ev.dataTransfer.effectAllowed = 'move';
}
function drop(ev, col) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('ring-2', 'ring-emerald-500/40', 'rounded-lg');
  const t = findTask(ev.dataTransfer.getData('text/plain'));
  if (t) setStatus(t, col);
}

// ----- Tri -----
function sortTasks(list) {
  const mode = document.getElementById('kanban-sort-by')?.value || 'urgency';
  const byDue = (a, b) => {
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (a.due && !b.due) return -1;
    if (!a.due && b.due) return 1;
    return a.createdAt - b.createdAt;
  };
  return [...list].sort((a, b) => {
    if (mode === 'urgency') return (b.urgency - a.urgency) || byDue(a, b);
    if (mode === 'ue') return (a.ue || '~').localeCompare(b.ue || '~', 'fr') || byDue(a, b);
    return byDue(a, b);
  });
}

// ----- Rendu -----
function urgencySelect(t) {
  const u = URGENCY[t.urgency] || URGENCY[2];
  return `<label class="sr-only" for="urg-${t.id}">Degré d'urgence</label>
    <select id="urg-${t.id}" onchange="setUrgency('${t.id}', this.value)" title="Degré d'urgence"
      class="bg-slate-900 border ${u.cls} rounded px-1.5 py-1 text-[11px] font-bold cursor-pointer">
      ${Object.entries(URGENCY).map(([v, o]) => `<option value="${v}" ${Number(v) === t.urgency ? 'selected' : ''}>${o.icon} ${o.label}</option>`).join('')}
    </select>`;
}

function taskCard(t) {
  const total = t.subquests.length;
  const done = t.subquests.filter(s => s.done).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const colIdx = COLUMNS.indexOf(t.status);
  const isDone = t.status === 'done';

  const meta = [
    t.ue ? `<span class="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5">${esc(t.ue)}</span>` : '',
    t.due && !isDone ? dueLabel(t.due) : ''
  ].filter(Boolean).join('');

  const subList = t.subquests.map(s => `
    <li class="flex items-center gap-2 py-1">
      <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleSubQuest('${t.id}', '${s.id}')"
        aria-label="Sous-quête accomplie" class="w-4 h-4 accent-emerald-500 shrink-0 cursor-pointer">
      <span class="flex-1 min-w-0 break-words ${s.done ? 'line-through text-slate-500' : 'text-slate-200'}">${esc(s.title)}</span>
      ${s.due && !s.done ? `<span class="text-[10px] shrink-0">${dueLabel(s.due)}</span>` : ''}
      <button onclick="deleteSubQuest('${t.id}', '${s.id}')" aria-label="Supprimer la sous-quête"
        class="text-slate-500 hover:text-rose-400 shrink-0 px-1">✕</button>
    </li>`).join('');

  const details = t.expanded ? `
    <div class="mt-3 pt-3 border-t border-slate-700 space-y-3 text-xs">
      ${t.desc ? `<p class="text-slate-300 whitespace-pre-line">${esc(t.desc)}</p>` : ''}
      <div>
        <h4 class="font-bold text-amber-400 mb-1">Sous-quêtes ${total ? `(${done}/${total})` : ''}</h4>
        ${total ? `<ul class="divide-y divide-slate-700/60">${subList}</ul>` : '<p class="text-slate-500 italic">Aucune sous-quête.</p>'}
      </div>
      <form onsubmit="addSubQuestToTask(event, '${t.id}')" class="flex flex-wrap sm:flex-nowrap gap-2">
        <input name="sq-title" type="text" placeholder="Nouvelle sous-quête" autocomplete="off"
          class="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200">
        <input name="sq-due" type="date" title="Jalon (facultatif)"
          class="bg-slate-900 border border-slate-700 rounded p-1.5 text-amber-300 font-mono">
        <button type="submit" class="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-emerald-400 font-bold border border-slate-600">+ Ajouter</button>
      </form>
      <div class="flex justify-between items-center pt-1">
        <div class="flex gap-1">
          <button onclick="moveTask('${t.id}', -1)" ${colIdx === 0 ? 'disabled' : ''}
            class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed">← Reculer</button>
          <button onclick="moveTask('${t.id}', 1)" ${colIdx === COLUMNS.length - 1 ? 'disabled' : ''}
            class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed">Avancer →</button>
        </div>
        <button onclick="deleteTask('${t.id}')" class="text-rose-400 hover:text-rose-300">Supprimer</button>
      </div>
    </div>` : '';

  return `
    <article id="task-${t.id}" data-id="${t.id}" draggable="true" ondragstart="drag(event)"
      class="bg-slate-800 p-3 rounded-lg border border-slate-700 hover:border-slate-600 transition cursor-grab active:cursor-grabbing">
      <div class="flex items-start justify-between gap-2">
        <h4 class="font-bold text-sm leading-snug break-words min-w-0 ${isDone ? 'line-through text-slate-400' : 'text-slate-100'}">${esc(t.title)}</h4>
        ${urgencySelect(t)}
      </div>
      ${meta ? `<div class="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400">${meta}</div>` : ''}
      ${total ? `
        <div class="flex items-center gap-2 mt-2" title="${done} sous-quête(s) sur ${total}">
          <div class="flex-1 h-1.5 bg-slate-900 rounded-full overflow-hidden"><div class="h-full bg-emerald-500" style="width:${pct}%"></div></div>
          <span class="text-[10px] text-slate-400">${done}/${total}</span>
        </div>` : ''}
      <button onclick="toggleExpandTask('${t.id}')" aria-expanded="${t.expanded}"
        class="mt-2 text-[11px] text-emerald-400 hover:text-emerald-300 font-bold">${t.expanded ? '▴ Masquer les détails' : '▾ Détails et sous-quêtes'}</button>
      ${details}
    </article>`;
}

function renderKanban() {
  COLUMNS.forEach(col => {
    const list = sortTasks(kanbanTasks.filter(t => t.status === col));
    document.getElementById(`col-${col}`).innerHTML = list.length
      ? list.map(taskCard).join('')
      : `<p class="text-xs text-slate-500 italic p-2">${col === 'todo' ? 'Aucune quête à faire.' : col === 'doing' ? 'Glisse une quête ici pour la démarrer.' : 'Les quêtes terminées arrivent ici.'}</p>`;
    document.getElementById(`count-${col}`).innerText = list.length;
  });
  renderDashboard();
}

function renderDashboard() {
  const open = kanbanTasks.filter(t => t.status !== 'done');
  const next = open.filter(t => t.due).sort((a, b) => (a.due < b.due ? -1 : 1))[0];
  const nextEl = document.getElementById('dash-next-task');
  const metaEl = document.getElementById('dash-next-task-meta');
  if (nextEl) {
    nextEl.textContent = next ? next.title : 'Aucune échéance à venir';
    metaEl.innerHTML = next ? dueLabel(next.due) + (next.ue ? ` · ${esc(next.ue)}` : '') : '';
  }
  const doing = kanbanTasks.filter(t => t.status === 'doing').length;
  const todo = kanbanTasks.filter(t => t.status === 'todo').length;
  const d = document.getElementById('dash-doing-count');
  if (d) {
    d.textContent = `${doing} quête${doing > 1 ? 's' : ''} en cours`;
    document.getElementById('dash-todo-count').textContent = `${todo} à faire`;
  }
}

// ----- Agenda & Ressources (à développer) -----
function promptCalendarUrl() {}
function toggleAddResourceModal() { document.getElementById('add-resource-form-box').classList.toggle('hidden'); }
function addNewResource() {}
function deleteResource() {}
function renderResources() {}

// ----- Démarrage -----
document.addEventListener('DOMContentLoaded', () => {
  ['col-todo', 'col-doing', 'col-done'].forEach(id => {
    document.getElementById(id).addEventListener('dragleave', leaveDrop);
  });
  renderKanban();
});

// ----- Application installable : enregistrement du service worker -----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker non enregistré :', err));
  });
}
