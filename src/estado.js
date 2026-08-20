import { festivosIniciales } from "./festivos.js";

export const CLAVE = "cuadrante_v5";

export function estadoInicial() {
  return {
    version: 5,
    config: {
      inicioResidencia: "2026-05-27",
      cortarAMedianoche: true,
      especialCortaAMedianoche: true,
      retencionBase: 0.089753,
      retencionGuardias: 0.032609,
    },
    guardias: {
      "2026-06-08": { horas: 7, inicio: "15:00", lugar: "", hecha: true },
      "2026-06-15": { horas: 7, inicio: "15:00", lugar: "", hecha: true },
      "2026-06-20": { horas: 12, inicio: "08:00", lugar: "", hecha: true },
      "2026-06-26": { horas: 7, inicio: "15:00", lugar: "", hecha: true },
      "2026-08-02": { horas: 15, inicio: "17:00", lugar: "", hecha: true },
      "2026-08-03": { horas: 8, inicio: "08:00", lugar: "", hecha: true },
      "2026-08-05": { horas: 17, inicio: "15:00", lugar: "OBS", hecha: true },
      "2026-08-11": { horas: 17, inicio: "15:00", lugar: "", hecha: true },
      "2026-08-13": { horas: 17, inicio: "15:00", lugar: "", hecha: true },
    },
    festivos: festivosIniciales(),
    nominas: [
      { periodo: "2026-07", clase: "base", bruto: 1379.90, neto: 1256.05 },
      { periodo: "2026-06", clase: "guardias", bruto: 484.83, neto: 469.02 },
    ],
  };
}

export function cargar(almacen) {
  const inicial = estadoInicial();
  let guardado;
  try {
    guardado = JSON.parse(almacen.getItem(CLAVE));
  } catch {
    return inicial;
  }
  if (!guardado || typeof guardado !== "object") return inicial;
  return {
    ...inicial,
    ...guardado,
    config: { ...inicial.config, ...(guardado.config || {}) },
  };
}

export function guardar(almacen, estado) {
  almacen.setItem(CLAVE, JSON.stringify(estado));
}
