// src/estado.js
import { festivosDerivados } from "./festivos.js";

export const CLAVE = "cuadrante_v6";
export const CLAVE_V5 = "cuadrante_v5";

export function estadoInicial() {
  return {
    version: 6,
    config: {
      inicioResidencia: null,
      cortarAMedianoche: true,
      especialCortaAMedianoche: true,
      retencionBase: 0.089753,
      retencionGuardias: 0.032609,
      retribuciones: null,
      tema: "sobrio", // "sobrio" | "espacial"
    },
    guardias: {},
    festivos: {},
    nominas: [],
  };
}

// v5 guardaba el calendario de festivos entero; v6 solo guarda las diferencias
// contra el calendario derivado, para que las mejoras del codigo sigan llegando.
export function migrarV5(v5) {
  const inicial = estadoInicial();
  const festivos = {};
  for (const [fecha, f] of Object.entries(v5.festivos || {})) {
    const derivado = festivosDerivados(Number(fecha.slice(0, 4)))[fecha];
    if (derivado) {
      if (f.clase !== derivado.clase) festivos[fecha] = { clase: f.clase };
    } else if (f.clase !== "laborable") {
      festivos[fecha] = { nombre: f.nombre, clase: f.clase };
    }
  }
  return {
    ...inicial,
    config: { ...inicial.config, ...(v5.config || {}), retribuciones: null },
    guardias: v5.guardias || {},
    festivos,
    nominas: v5.nominas || [],
  };
}

function leerJSON(almacen, clave) {
  try {
    const crudo = almacen.getItem(clave);
    if (!crudo) return null;
    const dato = JSON.parse(crudo);
    return dato && typeof dato === "object" ? dato : null;
  } catch {
    return null;
  }
}

export function cargar(almacen) {
  const inicial = estadoInicial();
  const guardado = leerJSON(almacen, CLAVE);
  if (guardado) {
    return {
      ...inicial,
      ...guardado,
      config: { ...inicial.config, ...(guardado.config || {}) },
    };
  }
  const v5 = leerJSON(almacen, CLAVE_V5);
  return v5 ? migrarV5(v5) : inicial;
}

export function guardar(almacen, estado) {
  almacen.setItem(CLAVE, JSON.stringify(estado));
}
