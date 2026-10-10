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
    measurementId: "G-PS3K5YNR96"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  window._authReady = new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        window._authToken = null; // refreshed lazily below
        user.getIdToken().then(t => { window._authToken = t; resolve(t); });
      }
    });
  });

  // A fresh token every time: the SDK keeps it and renews it before it runs out (after an hour), so a long
  // tournament does not lose the connection. The same hidden account stays on this device (window._authUid).
  let signing = null;
  window._getAuthToken = async function(){
    try { await auth.authStateReady(); } catch (e) {}
    if (!auth.currentUser) {
      signing = signing || signInAnonymously(auth).catch(e => console.warn('Auth sign-in failed', e)).finally(() => { signing = null; });
      await signing;
    }
    if (auth.currentUser) {
      const t = await auth.currentUser.getIdToken();
      window._authToken = t; window._authUid = auth.currentUser.uid;
      return t;
    }
    return null;
  };

  window._getAuthToken();
