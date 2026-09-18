// Cross-device sync for At Yarışı — reuses the SAME Firebase project as the
// bridgegate app (same public client config; the API key is meant to be
// public, security is enforced server-side by Firebase rules), but writes
// only under the completely separate top-level path "/atYarisi/<code>".
// Bridgegate's own rules are scoped to "/clubs/...", so this path is
// unrelated to and cannot collide with bridgegate's data — but it also
// means it's very likely NOT covered by any existing "allow" rule, and
// Firebase denies by default. If pushes fail with a permission error, add
// a rule for "/atYarisi" in the Firebase console (Realtime Database →
// Rules) without touching the existing "clubs" rules, e.g.:
//   "atYarisi": { "$code": { ".read": "auth != null", ".write": "auth != null" } }
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD1TA78WcqWNDLkbhe6We9LM_AkmQs04EM",
  authDomain: "bridgegate-1a2c6.firebaseapp.com",
  databaseURL: "https://bridgegate-1a2c6-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "bridgegate-1a2c6",
  storageBucket: "bridgegate-1a2c6.firebasestorage.app",
  messagingSenderId: "544390125037",
  appId: "1:544390125037:web:b7f539c56d2aaea6f943e4",
};

const FB_BASE = firebaseConfig.databaseURL;
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function getToken() {
  if (auth.currentUser) return auth.currentUser.getIdToken();
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) { unsub(); resolve(user.getIdToken()); }
    });
  });
}
signInAnonymously(auth).catch((e) => console.warn('At Yarışı sync: anon sign-in failed', e));

let pollTimer = null;
let lastSeenUpdatedAt = 0;

const api = {
  generateCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  },

  async push(code, data) {
    try {
      const token = await getToken();
      const url = `${FB_BASE}/atYarisi/${code}.json?auth=${token}`;
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, updatedAt: Date.now() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      lastSeenUpdatedAt = Date.now();
      return true;
    } catch (e) {
      console.warn('At Yarışı sync push failed', e);
      return false;
    }
  },

  async pull(code) {
    try {
      const token = await getToken();
      const url = `${FB_BASE}/atYarisi/${code}.json?auth=${token}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn('At Yarışı sync pull failed', e);
      return null;
    }
  },

  startPolling(code, onUpdate, intervalMs = 4000) {
    api.stopPolling();
    pollTimer = setInterval(async () => {
      const result = await api.pull(code);
      if (result && result.updatedAt && result.updatedAt > lastSeenUpdatedAt) {
        lastSeenUpdatedAt = result.updatedAt;
        onUpdate(result.data);
      }
    }, intervalMs);
  },

  stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  },
};

window.atYarisiSync = api;
window.dispatchEvent(new Event('atyarisi-sync-ready'));
