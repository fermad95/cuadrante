// src/motor.js
import { aMinutos, aHora, diaSiguiente, redondear } from "./fechas.js";
import { clasificarDia } from "./festivos.js";
import { tarifaEn } from "./tarifas.js";

export const INICIO_POR_DURACION = { 7: "15:00", 8: "08:00", 12: "08:00", 15: "17:00", 17: "15:00", 24: "08:00" };

export function inicioSugerido(horas) {
  return INICIO_POR_DURACION[horas] || "15:00";
}

export function partirGuardia(guardia, festivos, opciones = {}) {
  const cortar = opciones.cortarAMedianoche !== false;
  const cortarEspecial = opciones.especialCortaAMedianoche !== false;
  const inicio = aMinutos(guardia.inicio || inicioSugerido(guardia.horas));
  const total = Math.round(guardia.horas * 60);
  const tipoInicial = clasificarDia(guardia.fecha, festivos);

  const enteraComoInicio =
    !cortar || (!cortarEspecial && tipoInicial === "especial");

  if (enteraComoInicio) {
    return [{
      fecha: guardia.fecha,
      desde: aHora(inicio),
      hasta: aHora(inicio + total),
      horas: guardia.horas,
      tipo: tipoInicial,
    }];
  }

  const tramos = [];
  let fecha = guardia.fecha;
  let desde = inicio;
  let restante = total;
  while (restante > 0) {
    const enEsteDia = Math.min(restante, 1440 - desde);
    tramos.push({
      fecha,
      desde: aHora(desde),
      hasta: aHora(desde + enEsteDia),
      horas: enEsteDia / 60,
      tipo: clasificarDia(fecha, festivos),
    });
    restante -= enEsteDia;
    desde = 0;
    fecha = diaSiguiente(fecha);
  }
  return tramos;
}

export function calcularGuardia(guardia, festivos, config) {
  const tramos = partirGuardia(guardia, festivos, config);
  const horasPorTipo = { laborable: 0, sdf: 0, especial: 0 };
  const importePorTipo = { laborable: 0, sdf: 0, especial: 0 };

  const detallados = tramos.map((t) => {
    const tarifa = tarifaEn(t.fecha, config.inicioResidencia)[t.tipo];
    const importe = redondear(t.horas * tarifa);
    horasPorTipo[t.tipo] += t.horas;
    importePorTipo[t.tipo] = redondear(importePorTipo[t.tipo] + importe);
    return { ...t, tarifa, importe };
  });

  const bruto = redondear(
    importePorTipo.laborable + importePorTipo.sdf + importePorTipo.especial);
  return { tramos: detallados, horasPorTipo, importePorTipo, bruto };
}
