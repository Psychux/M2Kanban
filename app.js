// Sound Engine
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
  } catch(e){}
};

const itemPool = [
  { name: "Gourdin du Plan Méthodologique", type: "Arme", rarity: "Épique", desc: "+3 Méthodologie." },
  { name: "Robe de la Statistique Inférentielle", type: "Équipement", rarity: "Épique", desc: "+3 Analyse." },
  { name: "Trousse de Soin Ergonomique", type: "Soin", rarity: "Consommable", desc: "Restaure 5 pts de Charge Mentale." }
];

const classConfigs = {
  psychologue_travail: { name: "Psychologue du Travail", stats: { empathie: 13, stress: 12, analyse: 10, creativite: 10, methodologie: 10 } },
  facteurs_humains: { name: "Spécialiste Facteurs Humains", stats: { analyse: 13, methodologie: 12, stress: 10, empathie: 10, creativite: 9 } }
};

let hero = JSON.parse(localStorage.getItem('ergo_hero')) || {
  classKey: 'psychologue_travail', isClassLocked: false, level: 1, xp: 0, statPoints: 0,
  mentalLoad: 3, statsBonus: { empathie: 0, stress: 0, analyse: 0, creativite: 0, methodologie: 0 },
  inventory: [itemPool[0], itemPool[2]], completedDates: []
};

let kanbanTasks = JSON.parse(localStorage.getItem('ergo_kanban_tasks')) || [];
let crmContacts = JSON.parse(localStorage.getItem('ergo_crm_contacts')) || [];
let jdbEntries = JSON.parse(localStorage.getItem('ergo_jdb_entries')) || [];
let resourcesList = JSON.parse(localStorage.getItem('ergo_resources_list')) || [];

let currentEditingId = null;
let saeChart = null;
let sportBlockCounter = 0;

function changeLogoStyle(styleKey) {
  const box = document.getElementById('main-logo-container');
  if (styleKey === 'A') box.innerHTML = `<h1 class="text-xl font-black tracking-wider text-emerald-400 font-mono">🌿 ERGO<span class="text-slate-100">.HUB</span></h1>`;
  else if (styleKey === 'B') box.innerHTML = `<h1 class="text-xl font-bold text-amber-400 font-mono">⚔️ ERGO<span class="text-emerald-400">_HUB</span></h1>`;
  else if (styleKey === 'C') box.innerHTML = `<div class="flex items-center gap-1.5"><span class="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">M2</span><h1 class="text-lg font-bold text-slate-100">Ergo Lab</h1></div>`;
}

function switchTab(tabId) {
  ['dashboard', 'workspace', 'crm', 'voyageur'].forEach(t => {
    const sec = document.getElementById(`sec-${t}`);
    const tab = document.getElementById(`tab-${t}`);
    if (sec) sec.classList.add('hidden');
    if (tab) tab.className = "px-3.5 py-1.5 rounded-md font-medium text-xs transition text-slate-400 hover:text-white";
  });
  document.getElementById(`sec-${tabId}`).classList.remove('hidden');
  document.getElementById(`tab-${tabId}`).className = "px-3.5 py-1.5 rounded-md font-medium text-xs transition bg-emerald-600 text-white";
  
  if (tabId === 'workspace') renderKanban();
  if (tabId === 'crm') renderCrm();
  if (tabId === 'voyageur') renderVoyageur();
}

function switchWorkspaceSubTab(subId) {
  ['kanban', 'agenda', 'resources'].forEach(s => {
    document.getElementById(`wsub-${s}`).classList.add('hidden');
    document.getElementById(`wsubtab-${s}`).className = "px-4 py-2 rounded-lg font-bold text-xs transition bg-slate-800 text-slate-400 hover:text-white border border-slate-700";
  });
  document.getElementById(`wsub-${subId}`).classList.remove('hidden');
  document.getElementById(`wsubtab-${subId}`).className = "px-4 py-2 rounded-lg font-bold text-xs transition bg-emerald-600 text-white";
  if (subId === 'resources') renderResources();
}

function switchVoyageurSubTab(subId) {
  ['gamification', 'quest', 'analytics', 'archives'].forEach(s => {
    document.getElementById(`vsub-${s}`).classList.add('hidden');
    document.getElementById(`vsubtab-${s}`).className = "px-4 py-2 rounded-lg font-bold text-xs transition bg-slate-800 text-slate-400 hover:text-white border border-slate-700";
  });
  document.getElementById(`vsub-${subId}`).classList.remove('hidden');
  document.getElementById(`vsubtab-${subId}`).className = "px-4 py-2 rounded-lg font-bold text-xs transition bg-emerald-600 text-white";
  if (subId === 'analytics') renderJdbDashboard();
  if (subId === 'archives') renderJdbTreeArchives();
}

function switchFormTab(idx) {
  [1, 2, 3, 4].forEach(i => {
    document.getElementById(`fsec-${i}`).classList.add('hidden');
    document.getElementById(`ftab-${i}`).className = "px-3 py-1 bg-slate-700 rounded text-xs font-bold text-slate-300";
  });
  document.getElementById(`fsec-${idx}`).classList.remove('hidden');
  document.getElementById(`ftab-${idx}`).className = "px-3 py-1 bg-emerald-600 rounded text-xs font-bold text-white";
}

// Kanban & Resources & CRM Placeholders
function toggleAddTaskModal() { document.getElementById('add-task-form-box').classList.toggle('hidden'); }
function addSubQuestInput() {}
function addNewTask() {}
function toggleExpandTask() {}
function moveTask() {}
function deleteTask() {}
function allowDrop(ev) { ev.preventDefault(); }
function drag(ev) { ev.dataTransfer.setData("text", ev.target.id); }
function drop(ev, col) { ev.preventDefault(); }
function renderKanban() {}
function promptCalendarUrl() {}
function toggleAddResourceModal() { document.getElementById('add-resource-form-box').classList.toggle('hidden'); }
function addNewResource() {}
function deleteResource() {}
function renderResources() {}
function toggleAddCrmModal() { document.getElementById('add-crm-form-box').classList.toggle('hidden'); }
function addNewCrmContact() {}
function deleteCrmContact() {}
function renderCrm() {}

// JDB & Sport (Sans cadence)
function updateMoodLabel(val) { document.getElementById('val-jdb-mood').innerText = `${val}/10`; }
function updateSatisfactionLabel(val) { document.getElementById('val-jdb-satisfaction').innerText = `${val}/10`; }

function addSportBlock(data = {}) {
  sportBlockCounter++;
  const id = sportBlockCounter;
  const container = document.getElementById('sports-container');
  const block = document.createElement('div');
  block.id = `sport-block-${id}`;
  block.className = "p-3 bg-slate-900 rounded-lg border border-slate-700 space-y-3 text-xs";
  block.innerHTML = `
    <div class="flex justify-between items-center">
      <input type="text" id="sp-title-${id}" value="${data.title || ''}" placeholder="Titre de la séance" class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-bold w-3/4">
      <button type="button" onclick="this.parentElement.parentElement.remove()" class="text-rose-400 text-xs">Supprimer</button>
    </div>
    <select id="sp-type-${id}" onchange="updateSportFields(${id})" class="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs">
      <option value="course">Course à pied</option>
      <option value="wing_chun">Wing Chun</option>
      <option value="taiji">TaiJi</option>
      <option value="renforcement">Renforcement</option>
      <option value="mobilite">Mobilité</option>
    </select>
    <div id="sp-fields-${id}" class="space-y-2"></div>
  `;
  container.appendChild(block);
  if (data.type) document.getElementById(`sp-type-${id}`).value = data.type;
  updateSportFields(id, data);
}

function updateSportFields(id, data = {}) {
  const type = document.getElementById(`sp-type-${id}`).value;
  const target = document.getElementById(`sp-fields-${id}`);
  if (type === 'course') {
    target.innerHTML = `
      <div class="grid grid-cols-2 gap-2">
        <input type="number" step="0.1" id="sp-km-${id}" value="${data.km || 5}" placeholder="km" class="bg-slate-800 border border-slate-700 rounded p-1.5 text-xs">
        <input type="number" id="sp-dur-${id}" value="${data.duration || 30}" placeholder="min" class="bg-slate-800 border border-slate-700 rounded p-1.5 text-xs">
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input type="number" id="sp-hr-${id}" value="${data.hr || 140}" placeholder="BPM" class="bg-slate-800 border border-slate-700 rounded p-1.5 text-xs">
        <input type="number" min="1" max="10" id="sp-rpe-${id}" value="${data.rpe || 6}" placeholder="RPE (1-10)" class="bg-slate-800 border border-slate-700 rounded p-1.5 text-xs">
      </div>
    `;
  } else {
    target.innerHTML = `
      <div class="grid grid-cols-3 gap-2">
        <input type="number" id="sp-dur-${id}" value="${data.duration || 45}" placeholder="min" class="bg-slate-800 border border-slate-700 rounded p-1.5 text-xs">
        <input type="number" id="sp-hr-${id}" value="${data.hr || 120}" placeholder="BPM" class="bg-slate-800 border border-slate-700 rounded p-1.5 text-xs">
        <input type="number" min="1" max="10" id="sp-rpe-${id}" value="${data.rpe || 5}" placeholder="RPE" class="bg-slate-800 border border-slate-700 rounded p-1.5 text-xs">
      </div>
    `;
  }
}

function collectSportsData() {
  const blocks = document.querySelectorAll('#sports-container > div');
  const sports = [];
  blocks.forEach(b => {
    const id = b.id.replace('sport-block-', '');
    sports.push({
      title: document.getElementById(`sp-title-${id}`)?.value || 'Sport',
      type: document.getElementById(`sp-type-${id}`)?.value || 'autre',
      duration: parseInt(document.getElementById(`sp-dur-${id}`)?.value || 0),
      hr: parseInt(document.getElementById(`sp-hr-${id}`)?.value || 0),
      rpe: parseInt(document.getElementById(`sp-rpe-${id}`)?.value || 5),
      km: parseFloat(document.getElementById(`sp-km-${id}`)?.value || 0)
    });
  });
  return sports;
}

function saveJdbEntry(e) {
  e.preventDefault();
  const rawDate = document.getElementById('jdb-custom-date').value;
  const entry = {
    id: currentEditingId || Date.now(),
    date: new Date(rawDate).toLocaleDateString('fr-FR'),
    rawDate,
    timestamp: new Date(rawDate).getTime(),
    teachings: document.getElementById('jdb-teachings').value,
    mood: parseInt(document.getElementById('jdb-mood').value),
    satisfaction: parseInt(document.getElementById('jdb-satisfaction').value),
    sleepOnset: parseInt(document.getElementById('sleep-onset').value),
    sleepWake: parseInt(document.getElementById('sleep-wake').value),
    sleepQuality: parseInt(document.getElementById('sleep-quality').value),
    saeWork: parseInt(document.getElementById('sae-work').value),
    saeSport: parseInt(document.getElementById('sae-sport').value),
    saeSocial: parseInt(document.getElementById('sae-social').value),
    sports: collectSportsData()
  };

  if (currentEditingId) {
    jdbEntries = jdbEntries.map(item => item.id === currentEditingId ? entry : item);
    currentEditingId = null;
  } else {
    jdbEntries.unshift(entry);
  }

  localStorage.setItem('ergo_jdb_entries', JSON.stringify(jdbEntries));
  document.getElementById('form-jdb').reset();
  document.getElementById('sports-container').innerHTML = '';
  switchFormTab(1);
  renderVoyageur();
}

function renderJdbDashboard() {
  if (!jdbEntries.length) return;
  document.getElementById('kpi-mood').innerText = `${(jdbEntries.reduce((a,e)=>a+e.mood,0)/jdbEntries.length).toFixed(1)} / 10`;
  document.getElementById('kpi-sleep').innerText = `${(jdbEntries.reduce((a,e)=>a+e.sleepQuality,0)/jdbEntries.length).toFixed(1)} / 10`;
  applySportFilters();
}

function applySportFilters() {
  const tbody = document.getElementById('sport-filtered-tbody');
  if (!tbody) return;
  let html = '';
  jdbEntries.forEach(e => {
    (e.sports || []).forEach(s => {
      html += `<tr class="border-b border-slate-800"><td class="p-2 text-emerald-400">${e.date}</td><td class="p-2">${s.title}</td><td class="p-2">${s.type}</td><td class="p-2">${s.duration}m</td><td class="p-2">${s.km||'-'}km</td><td class="p-2">${s.hr||'-'}</td><td class="p-2">${s.rpe}/10</td></tr>`;
    });
  });
  tbody.innerHTML = html || `<tr><td colspan="7" class="p-3 text-center text-slate-500 italic">Aucune séance.</td></tr>`;
}

function renderJdbTreeArchives() {
  const container = document.getElementById('jdb-tree-container');
  if (!container) return;
  container.innerHTML = jdbEntries.map(e => `
    <div class="p-3 bg-slate-900 rounded border border-slate-700 flex justify-between items-center text-xs">
      <div><span class="text-emerald-400 font-bold">${e.date}</span> : "${e.teachings}"</div>
      <div class="flex gap-2">
        <button onclick="editEntry(${e.id})" class="text-emerald-400">✏️</button>
        <button onclick="deleteEntry(${e.id})" class="text-rose-400">✕</button>
      </div>
    </div>
  `).join('') || `<p class="text-xs text-slate-500 italic">Aucune archive.</p>`;
}

function editEntry(id) {
  const item = jdbEntries.find(e => e.id === id);
  if (!item) return;
  currentEditingId = id;
  document.getElementById('jdb-custom-date').value = item.rawDate;
  document.getElementById('jdb-teachings').value = item.teachings;
  document.getElementById('sports-container').innerHTML = '';
  (item.sports || []).forEach(s => addSportBlock(s));
  switchVoyageurSubTab('quest');
}

function deleteEntry(id) {
  jdbEntries = jdbEntries.filter(e => e.id !== id);
  localStorage.setItem('ergo_jdb_entries', JSON.stringify(jdbEntries));
  renderVoyageur();
}

function exportCustomCSV() {
  let csv = 'date,humeur,satisfaction,enseignements\n';
  jdbEntries.forEach(e => csv += `${e.date},${e.mood},${e.satisfaction},"${e.teachings}"\n`);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'export_jdb.csv';
  a.click();
}

function generateTextSummary() {
  const box = document.getElementById('summary-output-box');
  box.classList.remove('hidden');
  box.innerHTML = `<p class="text-amber-400 font-bold">Synthèse : ${jdbEntries.length} bilans enregistrés.</p>`;
}

function renderVoyageur() {
  renderJdbDashboard();
  renderJdbTreeArchives();
}

document.addEventListener('DOMContentLoaded', () => {
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const dateEl = document.getElementById('jdb-custom-date');
  if (dateEl) dateEl.value = yest.toISOString().split('T')[0];
  renderVoyageur();
});