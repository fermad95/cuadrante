// src/nube.js
//
// Sincronizacion con Firebase (Auth con Google + Firestore), para cuando la
// app vive fuera de un Artifact de Claude (GitHub Pages). Reglas de
// Firestore: cada usuario solo puede leer/escribir /usuarios/{su-propio-uid}.
//
// El SDK de Firebase se carga con `import()` dinamico, no con un `import`
// estatico: un `import` estatico que falla (sin red) tira abajo TODO el
// modulo del script y la app entera dejaria de arrancar. Con import()
// dinamico, si falla (sin red, CDN caida), el resto de la app sigue
// funcionando con localStorage, igual que sin esta capacidad.
const CDN = "https://www.gstatic.com/firebasejs/10.13.2";

const CONFIG = {
  apiKey: "AIzaSyDo9DJWIM6tbCOH1tXgFuG4qa3R9BI260k",
  authDomain: "cuadrante-755f5.firebaseapp.com",
  projectId: "cuadrante-755f5",
  storageBucket: "cuadrante-755f5.firebasestorage.app",
  messagingSenderId: "887931018938",
  appId: "1:887931018938:web:72e32b54f36d89e2f9ec83",
  measurementId: "G-DR0V21E4M8",
};

let sdkPromesa = null;

// iOS Safari bloquea los popups, y en modo standalone (app anadida a pantalla
// de inicio) todavia mas. iPadOS 13+ se anuncia como Macintosh, asi que hace
// falta mirar tambien el touch. En esos casos el login va por redireccion.
function esMovilIOS() {
  return typeof navigator !== "undefined" && (
    /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function cargarSDK() {
  if (!sdkPromesa) {
    sdkPromesa = Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]).then(([appMod, authMod, fsMod]) => {
      const app = appMod.initializeApp(CONFIG);
      return { auth: authMod.getAuth(app), db: fsMod.getFirestore(app), authMod, fsMod };
    }).catch(() => null);
  }
  return sdkPromesa;
}

// Llama a `fn(usuario | null)` cada vez que cambia la sesion. `usuario` es
// `{ uid, nombre, correo, foto }` o `null` si no hay sesion. Si el SDK no
// carga (sin red), se llama una vez con null y ya esta.
export function alCambiarSesion(fn) {
  cargarSDK().then((f) => {
    if (!f) { fn(null); return; }
    f.authMod.onAuthStateChanged(f.auth, (u) => {
      fn(u ? { uid: u.uid, nombre: u.displayName, correo: u.email, foto: u.photoURL } : null);
    });
    // Si venimos de un login por redireccion (iOS), la sesion se restaura
    // igual por onAuthStateChanged, pero getRedirectResult cierra el flujo y
    // consume cualquier error pendiente para que no quede nada colgado.
    f.authMod.getRedirectResult(f.auth).catch(() => {});
  });
}

export async function iniciarSesion() {
  const f = await cargarSDK();
  if (!f) throw new Error("Sin conexion: no se puede iniciar sesion ahora mismo.");
  const proveedor = new f.authMod.GoogleAuthProvider();
  if (esMovilIOS()) {
    // iOS (sobre todo en modo standalone, la app anadida a pantalla de
    // inicio) bloquea los popups: el flujo de redireccion recarga la pagina
    // y la sesion queda iniciada al volver, sin popup.
    await f.authMod.signInWithRedirect(f.auth, proveedor);
    return; // la redireccion recarga la pagina; esto no llega a ejecutarse
  }
  await f.authMod.signInWithPopup(f.auth, proveedor);
}

export async function cerrarSesion() {
  const f = await cargarSDK();
  if (!f) return;
  await f.authMod.signOut(f.auth);
}

async function uidActual() {
  const f = await cargarSDK();
  return f && f.auth.currentUser ? { f, uid: f.auth.currentUser.uid } : null;
}

// Nombrada distinto de la del Artifact (`cargarRemoto` en persistencia.js):
// build.mjs concatena todos los modulos en un unico script, y un alias en el
// `import` de ui.js no evita el choque de nombres a nivel superior — hacen
// falta nombres de verdad distintos en el propio archivo.
export async function cargarNube() {
  const act = await uidActual();
  if (!act) return null;
  const { f, uid } = act;
  try {
    const snap = await f.fsMod.getDoc(f.fsMod.doc(f.db, "usuarios", uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// `esMasReciente` (la logica de "gana quien sea mas reciente") se reutiliza
// de persistencia.js: es la misma funcion pura, y por el mismo motivo de
// arriba no puede haber una segunda declaracion con el mismo nombre aqui.

// Debounced + envio inmediato al ocultar la pestana, igual que el guardado
// en el Artifact. `alCambiarEstado(estado)` recibe "comprobando" / "al-dia" /
// "pendiente" / "no-disponible" (no-disponible tambien cuando no hay sesion).
export function creaGuardadoNube(alCambiarEstado) {
  let temporizador = null;
  let ultimoEnviado = null;
  let ultimoUid = null;
  let pendiente = null;
  let estado = "comprobando";

  function fijarEstado(nuevo) {
    if (nuevo === estado) return;
    estado = nuevo;
    if (typeof alCambiarEstado === "function") alCambiarEstado(estado);
  }

  // Si al arrancar ya hay sesion (usuario que volvio), que el aviso empiece
  // en "al dia" (nada pendiente) en vez de quedarse en "no disponible" hasta
  // el primer cambio, que seria enganoso teniendo sesion. Ojo: `currentUser`
  // justo tras cargar el SDK puede ser todavia null aunque haya una sesion
  // persistida (Firebase Auth aun no la ha restaurado) — comprobarlo asi de
  // primeras es una carrera que deja el aviso encasquillado en "no
  // disponible" para siempre. Por eso se espera a onAuthStateChanged, que
  // dispara una vez cuando Firebase termina de resolver la sesion real.
  cargarSDK().then((f) => {
    if (!f) { if (estado === "comprobando") fijarEstado("no-disponible"); return; }
    f.authMod.onAuthStateChanged(f.auth, (u) => {
      if (estado === "comprobando") fijarEstado(u ? "al-dia" : "no-disponible");
    });
  });

  async function enviar(datoAGuardar) {
    const act = await uidActual();
    if (!act) { fijarEstado("no-disponible"); return; }
    const { f, uid } = act;
    // Si ha cambiado de cuenta (cerrar sesion + entrar con otra Google
    // distinta) sin que el estado local haya cambiado, no hay que confiar
    // en el "ya esta enviado" de la cuenta anterior.
    if (uid !== ultimoUid) { ultimoEnviado = null; ultimoUid = uid; }
    const contenido = JSON.stringify(datoAGuardar);
    if (contenido === ultimoEnviado) { fijarEstado("al-dia"); return; }
    try {
      await f.fsMod.setDoc(f.fsMod.doc(f.db, "usuarios", uid), datoAGuardar);
      ultimoEnviado = contenido;
      fijarEstado("al-dia");
    } catch {
      fijarEstado("no-disponible");
    }
  }

  function forzar() {
    if (pendiente === null) return;
    clearTimeout(temporizador);
    const datoAGuardar = pendiente;
    pendiente = null;
    enviar(datoAGuardar);
  }

  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") forzar();
    });
    document.addEventListener("pagehide", forzar);
  }

  function programar(datoAGuardar) {
    pendiente = datoAGuardar;
    fijarEstado("pendiente");
    clearTimeout(temporizador);
    temporizador = setTimeout(forzar, 2500);
  }

  Object.defineProperty(programar, "estadoActual", { get: () => estado });
  return programar;
}
