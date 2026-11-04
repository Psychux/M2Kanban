// ===== Ergo Hub : synchronisation entre appareils (Firebase) =====
// Les quêtes restent enregistrées sur l'appareil (l'appli marche sans compte et sans réseau).
// Une fois connecté, chaque quête est aussi rangée dans Firestore, dans un espace
// que seul ton compte peut lire : users/<ton identifiant>/tasks/<quête>.

import {
  initializeApp,
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDocs, onSnapshot, writeBatch
} from './vendor/firebase.js';

// ----- Configuration du projet Firebase (masterergo-planner) -----
// Valeurs issues de la console Firebase : Paramètres du projet → Général → Vos applications.
// Ces valeurs ne sont pas des secrets : la protection vient des règles Firestore.
const firebaseConfig = {
  apiKey: 'AIzaSyDGBF_F9ATLwZdq9NYY8SS9NB-Q7R75pfc',
  authDomain: 'masterergo-planner.firebaseapp.com',
  projectId: 'masterergo-planner',
  storageBucket: 'masterergo-planner.firebasestorage.app',
  messagingSenderId: '169447145171',
  appId: '1:169447145171:web:4529a924f3ab3e778b9e26'
};

const SYNCED_KEY = 'ergo_sync_known_ids'; // quêtes déjà présentes sur le serveur
const box = document.getElementById('sync-box');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Ce qui part sur le serveur : tout sauf l'état « déplié » de la carte, propre à chaque appareil
const toRemote = t => { const { expanded, ...rest } = t; return rest; };
const contentKey = t => { const { expanded, updatedAt, ...rest } = t; return JSON.stringify(rest); };

let db = null, auth = null, col = null, unsubscribe = null;
let lastSent = new Map();   // id → contenu déjà connu du serveur
let state = { user: null, pending: false, error: '', panel: false };

// Interface utilisée par app.js
window.ErgoSync = {
  active: false,
  push(tasks) {
    if (!this.active || !col) return;
    const batch = writeBatch(db);
    let n = 0;
    const ids = new Set();
    for (const t of tasks) {
      ids.add(t.id);
      const key = contentKey(t);
      if (lastSent.get(t.id) === key) continue;
      t.updatedAt = Date.now();
      batch.set(doc(col, t.id), toRemote(t));
      lastSent.set(t.id, key);
      n++;
    }
    for (const id of [...lastSent.keys()]) {
      if (!ids.has(id)) { batch.delete(doc(col, id)); lastSent.delete(id); n++; }
    }
    if (n) batch.commit().catch(err => setError(err));
  }
};

// ----- Démarrage -----
function main() {
  if (!box) return;
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'A_REMPLIR') { box.innerHTML = ''; return; }
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  render();
  onAuthStateChanged(auth, user => {
    state.user = user;
    state.error = '';
    if (user) start(user); else stop();
    render();
  });
}

async function start(user) {
  col = collection(db, 'users', user.uid, 'tasks');
  try {
    // 1. Fusion entre ce qui est sur l'appareil et ce qui est sur le serveur
    const snap = await getDocs(col);
    const remote = new Map(snap.docs.map(d => [d.id, d.data()]));
    const known = new Set(readKnown());
    const local = window.ErgoApp.getTasks();
    const merged = [];
    const toUpload = [];
    for (const t of local) {
      const r = remote.get(t.id);
      if (r) {
        if ((t.updatedAt || 0) > (r.updatedAt || 0)) { merged.push(t); toUpload.push(t); }
        else merged.push(r);
        remote.delete(t.id);
      } else if (!known.has(t.id)) {
        merged.push(t); toUpload.push(t);   // nouvelle quête créée sur cet appareil
      }                                     // sinon : supprimée depuis un autre appareil
    }
    for (const r of remote.values()) merged.push(r);

    lastSent = new Map(merged.filter(t => !toUpload.includes(t)).map(t => [t.id, contentKey(window.ErgoApp.normalizeTask(t))]));
    window.ErgoApp.applyRemote(merged);
    window.ErgoSync.active = true;
    window.ErgoSync.push(window.ErgoApp.getTasks());

    // 2. Écoute des changements faits sur les autres appareils
    unsubscribe = onSnapshot(col, { includeMetadataChanges: true }, s => {
      state.pending = s.metadata.hasPendingWrites;
      if (!s.metadata.hasPendingWrites) {
        const list = s.docs.map(d => d.data());
        lastSent = new Map(list.map(t => [t.id, contentKey(window.ErgoApp.normalizeTask(t))]));
        writeKnown(list.map(t => t.id));
        window.ErgoApp.applyRemote(list);
      }
      render();
    }, err => setError(err));
  } catch (err) {
    setError(err);
  }
}

function stop() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  col = null;
  lastSent = new Map();
  window.ErgoSync.active = false;
}

function readKnown() { try { return JSON.parse(localStorage.getItem(SYNCED_KEY)) || []; } catch (e) { return []; } }
function writeKnown(ids) { try { localStorage.setItem(SYNCED_KEY, JSON.stringify(ids)); } catch (e) {} }

function setError(err) {
  console.warn('Synchronisation :', err);
  const code = err && err.code ? err.code : '';
  const messages = {
    'auth/invalid-credential': 'Adresse ou mot de passe incorrect.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cette adresse.',
    'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse : connecte-toi.',
    'auth/weak-password': 'Le mot de passe doit faire au moins 6 caractères.',
    'auth/invalid-email': 'Adresse e-mail invalide.',
    'auth/popup-closed-by-user': 'Connexion annulée.',
    'auth/popup-blocked': 'La fenêtre de connexion a été bloquée. Utilise l’adresse e-mail.',
    'auth/unauthorized-domain': 'Ce site n’est pas autorisé dans Firebase (Authentication → Paramètres → Domaines autorisés).',
    'permission-denied': 'Accès refusé par Firestore : vérifie les règles de sécurité.'
  };
  state.error = messages[code] || 'La synchronisation a rencontré un problème. Réessaie plus tard.';
  render();
}

// ----- Interface (en-tête) -----
function render() {
  if (!box) return;
  const prev = box.querySelector('#sync-form');
  const keep = prev ? { email: prev.email.value, password: prev.password.value } : null;
  const u = state.user;
  const label = u ? (state.pending ? '☁️ Envoi…' : '☁️ Synchronisé') : '☁️ Synchroniser';
  const btnCls = u
    ? 'border-emerald-500/40 text-emerald-300'
    : 'border-slate-600 text-slate-300';
  box.innerHTML = `
    <button type="button" id="sync-toggle" aria-expanded="${state.panel}"
      class="px-3 py-1.5 bg-slate-900 border ${btnCls} rounded-lg text-xs font-bold hover:border-emerald-400 transition">${label}</button>
    ${state.panel ? panel(u) : ''}`;
  box.querySelector('#sync-toggle').onclick = () => { state.panel = !state.panel; render(); };
  if (!state.panel) return;
  if (u) {
    box.querySelector('#sync-logout').onclick = async () => { await signOut(auth); writeKnown([]); state.panel = false; render(); };
  } else {
    box.querySelector('#sync-google').onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).then(() => { state.panel = false; render(); }).catch(setError);
    const form = box.querySelector('#sync-form');
    if (keep) { form.email.value = keep.email; form.password.value = keep.password; }
    const creds = () => [form.email.value.trim(), form.password.value];
    form.onsubmit = e => {
      e.preventDefault();
      const [email, password] = creds();
      if (!email || !password) { state.error = 'Saisis ton adresse et ton mot de passe.'; render(); return; }
      signInWithEmailAndPassword(auth, email, password).then(() => { state.panel = false; render(); }).catch(setError);
    };
    box.querySelector('#sync-signup').onclick = () => {
      const [email, password] = creds();
      if (!email || !password) { state.error = 'Saisis une adresse et un mot de passe pour créer le compte.'; render(); return; }
      createUserWithEmailAndPassword(auth, email, password).then(() => { state.panel = false; render(); }).catch(setError);
    };
    box.querySelector('#sync-reset').onclick = () => {
      const [email] = creds();
      if (!email) { state.error = 'Saisis ton adresse pour recevoir le lien.'; render(); return; }
      sendPasswordResetEmail(auth, email).then(() => { state.error = 'Lien de réinitialisation envoyé.'; render(); }).catch(setError);
    };
  }
}

function panel(u) {
  const err = state.error ? `<p class="text-rose-300 text-xs">${esc(state.error)}</p>` : '';
  if (u) return `
    <div class="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 text-xs shadow-xl z-50">
      <p class="text-slate-300">Connecté : <span class="text-slate-100 font-bold break-all">${esc(u.email || 'compte Google')}</span></p>
      <p class="text-slate-400">Tes quêtes sont synchronisées sur tous les appareils connectés à ce compte.</p>
      ${err}
      <button type="button" id="sync-logout" class="w-full py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200">Se déconnecter</button>
    </div>`;
  return `
    <div class="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3 text-xs shadow-xl z-50">
      <p class="text-slate-300">Connecte-toi avec le même compte sur ton téléphone et ton ordinateur pour retrouver tes quêtes partout.</p>
      <button type="button" id="sync-google" class="w-full py-2 bg-slate-100 hover:bg-white text-slate-900 rounded font-bold">Continuer avec Google</button>
      <p class="text-center text-slate-500">ou avec une adresse e-mail</p>
      <form id="sync-form" class="space-y-2">
        <label class="sr-only" for="sync-email">Adresse e-mail</label>
        <input id="sync-email" name="email" type="email" autocomplete="email" placeholder="Adresse e-mail"
          class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200">
        <label class="sr-only" for="sync-password">Mot de passe</label>
        <input id="sync-password" name="password" type="password" autocomplete="current-password" placeholder="Mot de passe"
          class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-slate-200">
        ${err}
        <div class="flex gap-2">
          <button type="submit" class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded font-bold text-white">Se connecter</button>
          <button type="button" id="sync-signup" class="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200">Créer un compte</button>
        </div>
        <button type="button" id="sync-reset" class="w-full text-slate-400 hover:text-slate-200 underline">Mot de passe oublié</button>
      </form>
    </div>`;
}

// Ferme le panneau en cliquant ailleurs
document.addEventListener('click', e => {
  if (state.panel && box && e.target.isConnected && !box.contains(e.target)) { state.panel = false; render(); }
});

main();
