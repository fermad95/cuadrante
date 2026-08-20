// src/festivos.js
import { diaSemana, desplazar } from "./fechas.js";
import { domingoDePascua } from "./pascua.js";

const FIJOS_NACIONALES = [
  ["01-01", "Ano Nuevo"],
  ["01-06", "Reyes"],
  ["05-01", "Fiesta del Trabajo"],
  ["08-15", "Asuncion"],
  ["10-12", "Fiesta Nacional"],
  ["11-01", "Todos los Santos"],
  ["12-06", "Constitucion"],
  ["12-08", "Inmaculada"],
  ["12-25", "Navidad"],
];

export function festivosDerivados(anio) {
  const mapa = {};
  for (const [diaMes, nombre] of FIJOS_NACIONALES) {
    mapa[`${anio}-${diaMes}`] = { nombre, ambito: "nacional", clase: "sdf" };
  }
  const pascua = domingoDePascua(anio);
  mapa[desplazar(pascua, -2)] = { nombre: "Viernes Santo", ambito: "nacional", clase: "sdf" };
  mapa[`${anio}-02-28`] = { nombre: "Dia de Andalucia", ambito: "autonomico", clase: "sdf" };
  mapa[desplazar(pascua, -3)] = { nombre: "Jueves Santo", ambito: "autonomico", clase: "sdf" };
  return mapa;
}

const cacheDerivados = new Map();

export function derivadosDe(anio) {
  if (!cacheDerivados.has(anio)) cacheDerivados.set(anio, festivosDerivados(anio));
  return cacheDerivados.get(anio);
}

export const FESTIVOS_2026 = [
  { fecha: "2026-01-01", nombre: "Ano Nuevo", ambito: "nacional" },
  { fecha: "2026-01-06", nombre: "Reyes", ambito: "nacional" },
  { fecha: "2026-02-28", nombre: "Dia de Andalucia", ambito: "autonomico" },
  { fecha: "2026-04-02", nombre: "Jueves Santo", ambito: "nacional" },
  { fecha: "2026-04-03", nombre: "Viernes Santo", ambito: "nacional" },
  { fecha: "2026-05-01", nombre: "Fiesta del Trabajo", ambito: "nacional" },
  { fecha: "2026-08-15", nombre: "Asuncion", ambito: "nacional" },
  { fecha: "2026-09-08", nombre: "Ntra. Sra. de la Fuensanta", ambito: "local" },
  { fecha: "2026-10-12", nombre: "Fiesta Nacional", ambito: "nacional" },
  { fecha: "2026-10-24", nombre: "San Rafael", ambito: "local" },
  { fecha: "2026-11-01", nombre: "Todos los Santos", ambito: "nacional" },
  { fecha: "2026-12-06", nombre: "Constitucion", ambito: "nacional" },
  { fecha: "2026-12-08", nombre: "Inmaculada", ambito: "nacional" },
  { fecha: "2026-12-25", nombre: "Navidad", ambito: "nacional" },
];

export const CANDIDATOS_ESPECIALES = [
  { fecha: "2026-12-24", nombre: "Nochebuena", ambito: "candidato" },
  { fecha: "2026-12-31", nombre: "Nochevieja", ambito: "candidato" },
];

export function festivosIniciales() {
  const mapa = {};
  for (const f of FESTIVOS_2026) {
    mapa[f.fecha] = { nombre: f.nombre, ambito: f.ambito, clase: "sdf" };
  }
  for (const f of CANDIDATOS_ESPECIALES) {
    mapa[f.fecha] = { nombre: f.nombre, ambito: f.ambito, clase: "laborable" };
  }
  return mapa;
}

export function clasificarDia(fechaISO, festivos) {
  const marcado = festivos[fechaISO];
  if (marcado && marcado.clase === "especial") return "especial";
  if (marcado && marcado.clase === "sdf") return "sdf";
  const dia = diaSemana(fechaISO);
  if (dia === 0 || dia === 6) return "sdf";
  return "laborable";
}
