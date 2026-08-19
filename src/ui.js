// src/ui.js
import { diasDelMes, diaSemana, redondear } from "./fechas.js";
import { inicioSugerido, calcularGuardia } from "./motor.js";
import { resumenMes, previsionIngreso, resumenAnio, compararHipotesis, tiposEfectivos } from "./nomina.js";
import { cargar, guardar } from "./estado.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DURACIONES = [7, 8, 12, 15, 17, 24];
const LUGARES = ["PTA", "OBS", "INT", "RS", "HP"];
const AVISO_SIN_VERIFICAR =
  "Regla del corte a medianoche sin verificar. Se confirma con la nomina de septiembre.";

const eur = (n) => `${n.toFixed(2).replace(".", ",")} €`;

export function iniciar(raiz, almacen) {
  const estado = cargar(almacen);
  let pestana = "calendario";
  let mesVisible = "2026-08";

  const persistir = () => guardar(almacen, estado);

  function pintar() {
    raiz.querySelector("#pestanas").innerHTML = ["calendario", "festivos", "nominas", "anual"]
      .map((p) => `<button data-pestana="${p}" class="${p === pestana ? "activo" : ""}">${p}</button>`)
      .join("");
    const vista = raiz.querySelector("#vista");
    if (pestana === "calendario") vista.innerHTML = vistaCalendario();
    if (pestana === "festivos") vista.innerHTML = vistaFestivos();
    if (pestana === "nominas") vista.innerHTML = vistaNominas();
    if (pestana === "anual") vista.innerHTML = vistaAnual();
  }

  function vistaCalendario() {
    const [anio, mes] = mesVisible.split("-").map(Number);
    const dias = diasDelMes(mesVisible);
    const hueco = (diaSemana(dias[0]) + 6) % 7; // lunes primero
    const celdas = ["<div></div>".repeat(hueco)];
    for (const fecha of dias) {
      const g = estado.guardias[fecha];
      const num = Number(fecha.slice(8));
      let clases = "dia";
      let detalle = "";
      if (g) {
        const r = calcularGuardia({ ...g, fecha }, estado.festivos, estado.config);
        const tipos = [...new Set(r.tramos.map((t) => t.tipo))];
        clases += ` ${tipos[0]}`;
        detalle = `<span class="horas">${g.horas}h</span>`;
        if (g.lugar) detalle += `<span class="lugar">${g.lugar}</span>`;
        if (tipos.length > 1) detalle += `<span class="cruza">cruza</span>`;
      }
      celdas.push(`<div class="${clases}" data-fecha="${fecha}">${num}${detalle}</div>`);
    }
    const r = resumenMes(mesVisible, estado);
    const p = previsionIngreso(mesVisible, estado);
    const c = compararHipotesis(mesVisible, estado);

    return `
      <div class="tarjeta">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <button data-mes="-1">‹</button>
          <strong>${MESES[mes - 1]} ${anio}</strong>
          <button data-mes="1">›</button>
        </div>
        <div class="rejilla" style="margin:.75rem 0">
          ${["L", "M", "X", "J", "V", "S", "D"].map((d) => `<div class="cabecera-semana">${d}</div>`).join("")}
        </div>
        <div class="rejilla">${celdas.join("")}</div>
      </div>
      <div class="tarjeta">
        <strong>// ${MESES[mes - 1]} ${anio}</strong>
        <table>
          <tr><td>sueldo_base</td><td class="cifra">${eur(r.brutoBase)}</td></tr>
          ${filaTipo("laborable", r)}${filaTipo("sdf", r)}${filaTipo("especial", r)}
          <tr><td>bruto_total</td><td class="cifra">${eur(r.bruto)}</td></tr>
          <tr><td>neto_base</td><td class="cifra">${eur(r.netoBase)}</td></tr>
          <tr><td>neto_guardias</td><td class="cifra">${eur(r.netoGuardias)}</td></tr>
          <tr><td class="total">total_neto</td><td class="cifra total">${eur(r.neto)}</td></tr>
        </table>
        ${c.difieren ? `<p class="aviso">${AVISO_SIN_VERIFICAR}<br>
          Con corte: ${eur(c.conCorte.brutoGuardias)} · sin corte: ${eur(c.sinCorte.brutoGuardias)}
          · difieren en ${eur(c.diferencia)}.</p>` : ""}
      </div>
      <div class="tarjeta">
        <strong>// se ingresa este mes</strong>
        <table>
          <tr><td>nomina base</td><td class="cifra">${eur(p.base)}</td></tr>
          <tr><td>guardias de ${p.guardiasDe}</td><td class="cifra">${eur(p.importeGuardias)}</td></tr>
          <tr><td class="total">total</td><td class="cifra total">${eur(p.total)}</td></tr>
        </table>
        <p class="aviso">Las guardias se cobran en la nomina del mes siguiente.</p>
      </div>`;
  }

  function filaTipo(tipo, r) {
    if (r.horasPorTipo[tipo] === 0) return "";
    const nombre = { laborable: "Laborable", sdf: "Festiva (S-D-F)", especial: "Festivo especial" }[tipo];
    return `<tr><td>${nombre} <span style="color:var(--tenue)">(${r.horasPorTipo[tipo]}h)</span></td>
      <td class="cifra">${eur(r.importePorTipo[tipo])}</td></tr>`;
  }

  function vistaFestivos() {
    const filas = Object.entries(estado.festivos).sort().map(([fecha, f]) => `
      <tr><td>${fecha} ${f.nombre}</td><td class="cifra">
        <button data-festivo="${fecha}" data-clase="sdf" class="${f.clase === "sdf" ? "activo" : ""}">S-D-F</button>
        <button data-festivo="${fecha}" data-clase="especial" class="${f.clase === "especial" ? "activo" : ""}">especial</button>
      </td></tr>`).join("");
    return `<div class="tarjeta"><strong>// festivos</strong><table>${filas}</table>
      <p class="aviso">Marca como especial los que se retribuyan a ${eur(28.14)}/h.</p></div>`;
  }

  function vistaNominas() {
    const t = tiposEfectivos(estado.nominas, estado.config);
    const filas = estado.nominas.map((n, i) => `
      <tr><td>${n.periodo} ${n.clase}</td><td class="cifra">${eur(n.bruto)} → ${eur(n.neto)}
      <button data-borrar-nomina="${i}">×</button></td></tr>`).join("");
    return `<div class="tarjeta"><strong>// nominas registradas</strong>
      <table>${filas}</table>
      <p>Tipo efectivo base: ${(t.base * 100).toFixed(2)} % (${t.nBase} nominas)<br>
         Tipo efectivo guardias: ${(t.guardias * 100).toFixed(2)} % (${t.nGuardias} nominas)</p>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem">
        <input id="n-periodo" placeholder="2026-09" size="8">
        <select id="n-clase"><option value="base">base</option><option value="guardias">guardias</option></select>
        <input id="n-bruto" placeholder="bruto" size="8">
        <input id="n-neto" placeholder="neto" size="8">
        <button class="primario" id="n-anadir">anadir</button>
      </div></div>`;
  }

  function vistaAnual() {
    const r = resumenAnio(2026, estado);
    return `<div class="tarjeta"><strong>// 2026</strong><table>
      <tr><td>horas laborables</td><td class="cifra">${r.horasPorTipo.laborable}h</td></tr>
      <tr><td>horas S-D-F</td><td class="cifra">${r.horasPorTipo.sdf}h</td></tr>
      <tr><td>horas especiales</td><td class="cifra">${r.horasPorTipo.especial}h</td></tr>
      <tr><td>bruto</td><td class="cifra">${eur(r.bruto)}</td></tr>
      <tr><td class="total">neto</td><td class="cifra total">${eur(r.neto)}</td></tr>
    </table></div>`;
  }

  function abrirModal(fecha) {
    const g = estado.guardias[fecha] || { horas: 17, inicio: inicioSugerido(17), lugar: "", hecha: false };
    const caja = raiz.querySelector("#caja-modal");

    function pintarModal() {
      const r = calcularGuardia({ ...g, fecha }, estado.festivos, estado.config);
      const tipos = [...new Set(r.tramos.map((t) => t.tipo))];
      const tramos = r.tramos.map((t) => `<tr><td>${t.fecha} ${t.desde}–${t.hasta}</td>
        <td class="cifra">${t.horas}h × ${eur(t.tarifa)} = ${eur(t.importe)}</td></tr>`).join("");
      caja.innerHTML = `
        <strong>${fecha}</strong>
        <p>Duracion</p>
        <div>${DURACIONES.map((h) => `<button data-horas="${h}" class="${g.horas === h ? "activo" : ""}">${h}h</button>`).join(" ")}</div>
        <p>Hora de inicio <input id="m-inicio" value="${g.inicio}" size="5"></p>
        <p>Lugar</p>
        <div>${LUGARES.map((l) => `<button data-lugar="${l}" class="${g.lugar === l ? "activo" : ""}">${l}</button>`).join(" ")}
             <button data-lugar="" class="${g.lugar === "" ? "activo" : ""}">sin especificar</button></div>
        <p><label><input type="checkbox" id="m-hecha" ${g.hecha ? "checked" : ""}> Guardia ya realizada</label></p>
        <table style="margin-top:.75rem">${tramos}
          <tr><td class="total">bruto</td><td class="cifra total">${eur(r.bruto)}</td></tr></table>
        ${tipos.length > 1 ? `<p class="aviso">${AVISO_SIN_VERIFICAR}</p>` : ""}
        <div style="display:flex;gap:.5rem;margin-top:1rem">
          <button id="m-borrar">Borrar</button>
          <button id="m-cancelar">Cancelar</button>
          <button class="primario" id="m-guardar">Guardar</button>
        </div>`;
    }

    caja.onclick = (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.horas) { g.horas = Number(b.dataset.horas); g.inicio = inicioSugerido(g.horas); pintarModal(); }
      else if ("lugar" in b.dataset) { g.lugar = b.dataset.lugar; pintarModal(); }
      else if (b.id === "m-cancelar") cerrarModal();
      else if (b.id === "m-borrar") { delete estado.guardias[fecha]; persistir(); cerrarModal(); pintar(); }
      else if (b.id === "m-guardar") {
        const valorInicio = caja.querySelector("#m-inicio").value;
        if (/^\d{2}:\d{2}$/.test(valorInicio)) g.inicio = valorInicio;
        g.hecha = caja.querySelector("#m-hecha").checked;
        estado.guardias[fecha] = g; persistir(); cerrarModal(); pintar();
      }
    };
    caja.oninput = (ev) => {
      if (ev.target.id === "m-inicio" && /^\d{2}:\d{2}$/.test(ev.target.value)) {
        g.inicio = ev.target.value;
        const foco = ev.target.selectionStart;
        pintarModal();
        const campo = caja.querySelector("#m-inicio");
        campo.focus();
        campo.setSelectionRange(foco, foco);
      }
    };
    pintarModal();
    raiz.querySelector("#modal").classList.add("abierto");
  }

  function cerrarModal() {
    raiz.querySelector("#modal").classList.remove("abierto");
  }

  raiz.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-pestana], [data-mes], [data-fecha], [data-festivo], [data-borrar-nomina], #n-anadir");
    if (!b) return;
    if (b.dataset.pestana) { pestana = b.dataset.pestana; pintar(); }
    else if (b.dataset.mes) {
      const [a, m] = mesVisible.split("-").map(Number);
      const d = new Date(a, m - 1 + Number(b.dataset.mes), 1);
      mesVisible = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      pintar();
    }
    else if (b.dataset.fecha) abrirModal(b.dataset.fecha);
    else if (b.dataset.festivo) {
      const f = estado.festivos[b.dataset.festivo];
      f.clase = f.clase === b.dataset.clase ? "laborable" : b.dataset.clase;
      persistir(); pintar();
    }
    else if (b.dataset.borrarNomina) {
      estado.nominas.splice(Number(b.dataset.borrarNomina), 1); persistir(); pintar();
    }
    else if (b.id === "n-anadir") {
      const leer = (id) => raiz.querySelector(id).value.replace(",", ".");
      const bruto = Number(leer("#n-bruto"));
      const neto = Number(leer("#n-neto"));
      if (bruto > 0 && neto > 0) {
        estado.nominas.push({
          periodo: raiz.querySelector("#n-periodo").value,
          clase: raiz.querySelector("#n-clase").value,
          bruto: redondear(bruto), neto: redondear(neto),
        });
        persistir(); pintar();
      }
    }
  });

  raiz.querySelector("#modal").addEventListener("click", (ev) => {
    if (ev.target.id === "modal") cerrarModal();
  });

  pintar();
}
