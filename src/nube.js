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
  });
}

export async function iniciarSesion() {
  const f = await cargarSDK();
  if (!f) throw new Error("Sin conexion: no se puede iniciar sesion ahora mismo.");
  await f.authMod.signInWithPopup(f.auth, new f.authMod.GoogleAuthProvider());
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

export async function cargarRemoto() {
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

// Misma logica de "gana quien sea mas reciente" que persistencia.js (el
// Artifact). Se repite aqui (en vez de importarla) porque los dos modulos
// son independientes: uno u otro puede faltar segun donde viva la app.
export function esMasReciente(remoto, local) {
  return (remoto && remoto.actualizadoEn || 0) > (local && local.actualizadoEn || 0);
}

// Debounced + envio inmediato al ocultar la pestana, igual que el guardado
// en el Artifact. `alCambiarEstado(estado)` recibe "comprobando" / "al-dia" /
// "pendiente" / "no-disponible" (no-disponible tambien cuando no hay sesion).
export function creaGuardadoNube(alCambiarEstado) {
  let temporizador = null;
  let ultimoEnviado = null;
  let pendiente = null;
  let estado = "no-disponible";

  function fijarEstado(nuevo) {
    if (nuevo === estado) return;
    estado = nuevo;
    if (typeof alCambiarEstado === "function") alCambiarEstado(estado);
  }

  async function enviar(datoAGuardar) {
    const act = await uidActual();
    if (!act) { fijarEstado("no-disponible"); return; }
    const { f, uid } = act;
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
