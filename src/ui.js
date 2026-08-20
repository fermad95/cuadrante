// src/ui.js
import { diasDelMes, diaSemana, redondear } from "./fechas.js";
import { inicioSugerido, calcularGuardia } from "./motor.js";
import { resumenMes, previsionIngreso, resumenAnio, compararHipotesis, tiposEfectivos } from "./nomina.js";
import { cargar, guardar, estadoInicial } from "./estado.js";
import { RETRIBUCIONES_ANEXO, retribucionesDe } from "./tarifas.js";
import { calendarioDe } from "./festivos.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DURACIONES = [7, 8, 12, 15, 17, 24];
const LUGARES = [
  { sigla: "URG", nombre: "Puerta de Urgencias" },
  { sigla: "OBS", nombre: "Observacion" },
  { sigla: "PT", nombre: "Puerta de Trauma" },
  { sigla: "DSS", nombre: "Deccu Sector Sur" },
  { sigla: "DCP", nombre: "Deccu Castilla del Pino" },
];
const AVISO_SIN_VERIFICAR =
  "Regla del corte a medianoche sin verificar. Se confirma con la nomina de septiembre.";

const eur = (n) => `${n.toFixed(2).replace(".", ",")} €`;

const esc = (t) => String(t).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function iniciar(raiz, almacen) {
  const estado = cargar(almacen);
  let pestana = "calendario";
  let mesVisible = hoyISO().slice(0, 7);

  const persistir = () => guardar(almacen, estado);

  function pintar() {
    if (!estado.config.inicioResidencia) return pintarBienvenida();
    raiz.querySelector("#pestanas").hidden = false;
    raiz.querySelector("#pestanas").innerHTML = ["calendario", "festivos", "nominas", "anual"]
      .map((p) => `<button data-pestana="${p}" class="${p === pestana ? "activo" : ""}">${p}</button>`)
      .join("");
    const vista = raiz.querySelector("#vista");
    if (pestana === "calendario") vista.innerHTML = vistaCalendario();
    if (pestana === "festivos") vista.innerHTML = vistaFestivos();
    if (pestana === "nominas") vista.innerHTML = vistaNominas();
    if (pestana === "anual") vista.innerHTML = vistaAnual();
  }

  function pintarBienvenida() {
    raiz.querySelector("#pestanas").hidden = true;
    raiz.querySelector("#vista").innerHTML = `
      <div class="tarjeta">
        <strong class="etiqueta">// bienvenida</strong>
        <p>Para calcular tus guardias necesito saber cuando empezaste la residencia.
           De esa fecha salen tu anio (R1 a R5) y las tarifas que te corresponden.</p>
        <p class="etiqueta-campo">Fecha de inicio</p>
        <input type="date" id="b-inicio" value="">
        <div class="acciones-modal">
          <button class="primario" id="b-empezar">Empezar</button>
        </div>
        <p class="aviso">Puedes cambiarla despues en Ajustes.</p>
      </div>`;
  }

  function vistaCalendario() {
    const [anio, mes] = mesVisible.split("-").map(Number);
    const dias = diasDelMes(mesVisible);
    const hueco = (diaSemana(dias[0]) + 6) % 7; // lunes primero
    const celdas = ['<div aria-hidden="true"></div>'.repeat(hueco)];
    const hoy = hoyISO();
    for (const fecha of dias) {
      const g = estado.guardias[fecha];
      const num = Number(fecha.slice(8));
      let clases = "dia";
      if (fecha === hoy) clases += " hoy";
      let detalle = "";
      if (g) {
        const r = calcularGuardia({ ...g, fecha }, estado.festivos, estado.config);
        const tipos = [...new Set(r.tramos.map((t) => t.tipo))];
        clases += ` ${tipos[0]}`;
        if (!g.hecha) clases += " prevista";
        detalle = `<span class="horas">${g.horas}h</span>`;
        if (g.lugar) detalle += `<span class="lugar">${g.lugar}</span>`;
        if (tipos.length > 1) detalle += `<span class="cruza">cruza</span>`;
      }
      celdas.push(`<button type="button" class="${clases}" data-fecha="${fecha}" aria-label="${fecha}"><span class="num">${num}</span>${detalle}</button>`);
    }
    const r = resumenMes(mesVisible, estado);
    const p = previsionIngreso(mesVisible, estado);
    const c = compararHipotesis(mesVisible, estado);

    return `
      <div class="tarjeta">
        <div class="cabecera-mes">
          <button class="nav-mes" data-mes="-1">‹</button>
          <strong class="mes-titulo">${MESES[mes - 1]} <span class="mes-anio">${anio}</span></strong>
          <button class="nav-mes" data-mes="1">›</button>
        </div>
        <div class="rejilla" style="margin:.75rem 0">
          ${["L", "M", "X", "J", "V", "S", "D"].map((d) => `<div class="cabecera-semana">${d}</div>`).join("")}
        </div>
        <div class="rejilla">${celdas.join("")}</div>
        <p class="aviso">Las guardias con borde punteado aun no estan marcadas como
          realizadas: cuentan como prevision.</p>
      </div>
      <div class="tarjeta">
        <strong class="etiqueta">// ${MESES[mes - 1]} ${anio}</strong>
        <table>
          <tr><td>sueldo_base</td><td class="cifra">${eur(r.brutoBase)}</td></tr>
          ${filaTipo("laborable", r)}${filaTipo("sdf", r)}${filaTipo("especial", r)}
          <tr><td>bruto_total</td><td class="cifra">${eur(r.bruto)}</td></tr>
          <tr><td>guardias confirmadas</td><td class="cifra">${eur(r.brutoConfirmado)}</td></tr>
          <tr><td>guardias previstas</td><td class="cifra">${eur(r.brutoPrevisto)}</td></tr>
          <tr><td>neto_base</td><td class="cifra">${eur(r.netoBase)}</td></tr>
          <tr><td>neto_guardias</td><td class="cifra">${eur(r.netoGuardias)}</td></tr>
          <tr><td class="total">total_neto</td><td class="cifra total">${eur(r.neto)}</td></tr>
        </table>
        ${c.difieren ? `<p class="aviso">${AVISO_SIN_VERIFICAR}<br>
          Con corte: ${eur(c.conCorte.brutoGuardias)} · sin corte: ${eur(c.sinCorte.brutoGuardias)}
          · difieren en ${eur(c.diferencia)}.</p>` : ""}
      </div>
      <div class="tarjeta">
        <strong class="etiqueta">// se ingresa este mes</strong>
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
    return `<tr><td><span class="punto punto-${tipo}"></span>${nombre} <span class="tenue">(${r.horasPorTipo[tipo]}h)</span></td>
      <td class="cifra">${eur(r.importePorTipo[tipo])}</td></tr>`;
  }

  function vistaFestivos() {
    const anio = Number(mesVisible.slice(0, 4));
    const calendario = calendarioDe(anio, estado.festivos);
    const locales = Object.values(calendario).filter((f) => f.ambito === "local").length;
    const filas = Object.entries(calendario).sort().map(([fecha, f]) => `
      <tr><td>${fecha} ${esc(f.nombre)}</td><td class="cifra">
        <button data-festivo="${fecha}" data-clase="sdf" class="${f.clase === "sdf" ? "activo" : ""}">S-D-F</button>
        <button data-festivo="${fecha}" data-clase="especial" class="${f.clase === "especial" ? "activo" : ""}">especial</button>
      </td></tr>`).join("");
    return `<div class="tarjeta">
      <strong class="etiqueta">// festivos ${anio}</strong>
      <table>${filas}</table>
      <p class="aviso">Marca como especial los que se retribuyan a la tarifa doble.
        Tienes ${locales} festivo${locales === 1 ? "" : "s"} local${locales === 1 ? "" : "es"}
        dado${locales === 1 ? "" : "s"} de alta para ${anio}; cada municipio tiene dos.</p>
      <p class="etiqueta-campo">Anadir festivo local</p>
      <div class="formulario">
        <input type="date" id="f-fecha">
        <input id="f-nombre" placeholder="nombre" size="14">
        <button class="primario" id="f-anadir">anadir</button>
      </div></div>`;
  }

  function vistaNominas() {
    const t = tiposEfectivos(estado.nominas, estado.config);
    const filas = estado.nominas.map((n, i) => `
      <tr><td>${esc(n.periodo)} ${esc(n.clase)}</td><td class="cifra">${eur(n.bruto)} → ${eur(n.neto)}
      <button class="peligro" data-borrar-nomina="${i}">×</button></td></tr>`).join("");
    return `<div class="tarjeta"><strong class="etiqueta">// nominas registradas</strong>
      <table>${filas}</table>
      <p class="tenue">Tipo efectivo base: ${(t.base * 100).toFixed(2)} % (${t.nBase} nominas)<br>
         Tipo efectivo guardias: ${(t.guardias * 100).toFixed(2)} % (${t.nGuardias} nominas)</p>
      <div class="formulario">
        <input id="n-periodo" placeholder="2026-09" size="8">
        <select id="n-clase"><option value="base">base</option><option value="guardias">guardias</option></select>
        <input id="n-bruto" placeholder="bruto" size="8">
        <input id="n-neto" placeholder="neto" size="8">
        <button class="primario" id="n-anadir">anadir</button>
      </div>
      <p class="aviso" id="n-error"></p></div>`;
  }

  function vistaAnual() {
    const anio = Number(mesVisible.slice(0, 4));
    const r = resumenAnio(anio, estado);
    return `<div class="tarjeta"><strong class="etiqueta">// ${anio}</strong><table>
      <tr><td>horas laborables</td><td class="cifra">${r.horasPorTipo.laborable}h</td></tr>
      <tr><td>horas S-D-F</td><td class="cifra">${r.horasPorTipo.sdf}h</td></tr>
      <tr><td>horas especiales</td><td class="cifra">${r.horasPorTipo.especial}h</td></tr>
      <tr><td>bruto</td><td class="cifra">${eur(r.bruto)}</td></tr>
      <tr><td class="total">neto</td><td class="cifra total">${eur(r.neto)}</td></tr>
    </table></div>`;
  }

  function abrirModal(fecha) {
    const g = { ...(estado.guardias[fecha] || { horas: 17, inicio: inicioSugerido(17), lugar: "", hecha: false }) };
    const caja = raiz.querySelector("#caja-modal");

    function pintarModal() {
      const r = calcularGuardia({ ...g, fecha }, estado.festivos, estado.config);
      const tipos = [...new Set(r.tramos.map((t) => t.tipo))];
      const tramos = r.tramos.map((t) => `<tr><td>${t.fecha} ${t.desde}–${t.hasta}</td>
        <td class="cifra">${t.horas}h × ${eur(t.tarifa)} = ${eur(t.importe)}</td></tr>`).join("");
      caja.innerHTML = `
        <strong class="modal-fecha">${fecha}</strong>
        <p class="etiqueta-campo">Duracion</p>
        <div class="chips">${DURACIONES.map((h) => `<button data-horas="${h}" class="${g.horas === h ? "activo" : ""}">${h}h</button>`).join(" ")}</div>
        <p class="etiqueta-campo">Hora de inicio <input id="m-inicio" value="${g.inicio}" size="5"></p>
        <p class="etiqueta-campo">Lugar</p>
        <div class="chips">${LUGARES.map((l) => `<button data-lugar="${l.sigla}" class="${g.lugar === l.sigla ? "activo" : ""}">${l.nombre}</button>`).join(" ")}
             <button data-lugar="" class="${g.lugar === "" ? "activo" : ""}">sin especificar</button></div>
        <p><label><input type="checkbox" id="m-hecha" ${g.hecha ? "checked" : ""}> Guardia ya realizada</label></p>
        <table style="margin-top:.75rem">${tramos}
          <tr><td class="total">bruto</td><td class="cifra total">${eur(r.bruto)}</td></tr></table>
        ${tipos.length > 1 ? `<p class="aviso">${AVISO_SIN_VERIFICAR}</p>` : ""}
        <div class="acciones-modal">
          <button class="peligro" id="m-borrar">Borrar</button>
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
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(valorInicio)) g.inicio = valorInicio;
        g.hecha = caja.querySelector("#m-hecha").checked;
        estado.guardias[fecha] = g; persistir(); cerrarModal(); pintar();
      }
    };
    caja.oninput = (ev) => {
      if (ev.target.id === "m-inicio" && /^([01]\d|2[0-3]):[0-5]\d$/.test(ev.target.value)) {
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

  function abrirAjustes() {
    const caja = raiz.querySelector("#caja-modal");
    const c = estado.config;
    const r = retribucionesDe(c);
    const anioEnCurso = Number(hoyISO().slice(0, 4));
    const filas = [1, 2, 3, 4, 5].map((n) => `
      <tr><td>R${n}</td><td class="cifra">
        <input data-tarifa="${n}.laborable" value="${r.guardias[n].laborable}" size="4">
        <input data-tarifa="${n}.sdf" value="${r.guardias[n].sdf}" size="4">
        <input data-tarifa="${n}.especial" value="${r.guardias[n].especial}" size="4">
      </td></tr>`).join("");

    caja.innerHTML = `
      <strong class="modal-fecha">Ajustes</strong>

      <p class="etiqueta-campo">Inicio de residencia</p>
      <input type="date" id="a-inicio" value="${c.inicioResidencia || ""}">

      <p class="etiqueta-campo">Reparto de la guardia a medianoche</p>
      <label><input type="checkbox" id="a-corte" ${c.cortarAMedianoche ? "checked" : ""}>
        Partir las guardias a medianoche</label><br>
      <label><input type="checkbox" id="a-corte-esp" ${c.especialCortaAMedianoche ? "checked" : ""}>
        Partir tambien las de festivo especial</label>
      <p class="aviso">${AVISO_SIN_VERIFICAR}</p>

      <p class="etiqueta-campo">Retenciones por defecto</p>
      <label>Base <input id="a-ret-base" value="${(c.retencionBase * 100).toFixed(4)}" size="6"> %</label>
      <label>Guardias <input id="a-ret-guardias" value="${(c.retencionGuardias * 100).toFixed(4)}" size="6"> %</label>
      <p class="aviso">Solo se usan mientras no registres ninguna nomina de esa clase.
        En cuanto registras una, manda la mas reciente.</p>

      <p class="etiqueta-campo">Valor hora (laborable / S-D-F / especial)</p>
      <table>${filas}</table>
      <p class="etiqueta-campo">Sueldo base</p>
      <input id="a-sueldo" value="${r.sueldoBase}" size="8">
      <p class="aviso">Valores del anexo XVI, 2026.${
        anioEnCurso > 2026
          ? ` Estamos en ${anioEnCurso}: contrastalos con tu nomina, el SAS los actualiza por convenio.`
          : ""}</p>

      <p class="etiqueta-campo">Copia de seguridad</p>
      <textarea id="a-datos" rows="4" spellcheck="false">${esc(JSON.stringify(estado))}</textarea>
      <div class="chips">
        <button id="a-copiar">Copiar</button>
        <button id="a-importar">Importar lo pegado</button>
        <button class="peligro" id="a-borrar-todo">Borrar todo</button>
      </div>
      <p class="aviso" id="a-error">Tus datos viven solo en este navegador. Copia este
        texto para guardarlos o pasarlos a otro dispositivo.</p>

      <div class="acciones-modal">
        <button id="a-cancelar">Cancelar</button>
        <button class="primario" id="a-guardar">Guardar</button>
      </div>`;

    caja.onclick = (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.id === "a-cancelar") cerrarModal();
      else if (b.id === "a-guardar") {
        const inicio = caja.querySelector("#a-inicio").value;
        if (/^\d{4}-\d{2}-\d{2}$/.test(inicio)) c.inicioResidencia = inicio;
        c.cortarAMedianoche = caja.querySelector("#a-corte").checked;
        c.especialCortaAMedianoche = caja.querySelector("#a-corte-esp").checked;
        c.retencionBase = leerPorcentaje(caja, "#a-ret-base", c.retencionBase);
        c.retencionGuardias = leerPorcentaje(caja, "#a-ret-guardias", c.retencionGuardias);
        c.retribuciones = leerRetribuciones(caja, r);
        persistir(); cerrarModal(); pintar();
      }
      else if (b.id === "a-copiar") {
        const campo = caja.querySelector("#a-datos");
        campo.select();
        navigator.clipboard.writeText(campo.value).then(
          () => { b.textContent = "Copiado"; },
          () => { b.textContent = "Copialo a mano"; });
      }
      else if (b.id === "a-importar") {
        if (importar(caja.querySelector("#a-datos").value)) {
          persistir(); cerrarModal(); pintar();
        } else {
          caja.querySelector("#a-error").textContent =
            "Ese texto no es una copia valida del cuadrante.";
        }
      }
      else if (b.id === "a-borrar-todo") {
        // Dos pulsaciones en vez de confirm(): un dialogo modal del navegador
        // bloquea la pagina y no se puede recuperar desde el artifact.
        if (b.dataset.confirmado) {
          Object.assign(estado, estadoInicial());
          persistir(); cerrarModal(); pintar();
        } else {
          b.dataset.confirmado = "1";
          b.textContent = "Pulsa otra vez para confirmar";
        }
      }
    };
    caja.oninput = null;
    raiz.querySelector("#modal").classList.add("abierto");
  }

  function leerPorcentaje(caja, selector, actual) {
    const valor = Number(caja.querySelector(selector).value.replace(",", "."));
    return valor >= 0 && valor < 100 ? Math.round((valor / 100) * 1e6) / 1e6 : actual;
  }

  // Devuelve null si todo coincide con el anexo, para que quien no toca nada siga
  // recibiendo las correcciones futuras del codigo en vez de congelar una copia.
  function leerRetribuciones(caja, actuales) {
    const guardias = {};
    let cambiado = false;
    for (const n of [1, 2, 3, 4, 5]) {
      guardias[n] = { ...actuales.guardias[n] };
      for (const tipo of ["laborable", "sdf", "especial"]) {
        const campo = caja.querySelector(`[data-tarifa="${n}.${tipo}"]`);
        const valor = Number(campo.value.replace(",", "."));
        if (valor > 0) guardias[n][tipo] = valor;
        if (valor > 0 && valor !== RETRIBUCIONES_ANEXO.guardias[n][tipo]) cambiado = true;
      }
    }
    const sueldo = Number(caja.querySelector("#a-sueldo").value.replace(",", "."));
    const sueldoBase = sueldo > 0 ? sueldo : actuales.sueldoBase;
    if (sueldoBase !== RETRIBUCIONES_ANEXO.sueldoBase) cambiado = true;
    return cambiado
      ? { guardias, sueldoBase, cgFormacion: { ...actuales.cgFormacion } }
      : null;
  }

  function importar(texto) {
    let dato;
    try {
      dato = JSON.parse(texto);
    } catch {
      return false;
    }
    if (!dato || typeof dato !== "object" || !dato.config || !dato.guardias) return false;
    const limpio = estadoInicial();
    Object.assign(estado, {
      ...limpio,
      ...dato,
      config: { ...limpio.config, ...dato.config },
    });
    return true;
  }

  raiz.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-pestana], [data-mes], [data-fecha], [data-festivo], [data-borrar-nomina], #n-anadir, #b-empezar, #abrir-ajustes, #f-anadir");
    if (!b) return;
    if (b.id === "abrir-ajustes") abrirAjustes();
    else if (b.id === "b-empezar") {
      const valor = raiz.querySelector("#b-inicio").value;
      if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        estado.config.inicioResidencia = valor;
        persistir(); pintar();
      }
    }
    else if (b.dataset.pestana) { pestana = b.dataset.pestana; pintar(); }
    else if (b.dataset.mes) {
      const [a, m] = mesVisible.split("-").map(Number);
      const d = new Date(a, m - 1 + Number(b.dataset.mes), 1);
      mesVisible = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      pintar();
    }
    else if (b.dataset.fecha) abrirModal(b.dataset.fecha);
    else if (b.dataset.festivo) {
      const fecha = b.dataset.festivo;
      const anio = Number(fecha.slice(0, 4));
      const actual = calendarioDe(anio, estado.festivos)[fecha];
      const nueva = actual.clase === b.dataset.clase ? "laborable" : b.dataset.clase;
      const derivado = calendarioDe(anio, {})[fecha];
      // Si vuelve a coincidir con lo derivado, se borra la excepcion en vez de
      // guardarla: el estado solo debe contener diferencias de verdad.
      if (derivado && derivado.clase === nueva) delete estado.festivos[fecha];
      else if (derivado) estado.festivos[fecha] = { clase: nueva };
      else estado.festivos[fecha] = { nombre: actual.nombre, clase: nueva };
      persistir(); pintar();
    }
    else if (b.id === "f-anadir") {
      const fecha = raiz.querySelector("#f-fecha").value;
      const nombre = raiz.querySelector("#f-nombre").value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha) && nombre) {
        estado.festivos[fecha] = { nombre, clase: "sdf" };
        persistir(); pintar();
      }
    }
    else if (b.dataset.borrarNomina) {
      estado.nominas.splice(Number(b.dataset.borrarNomina), 1); persistir(); pintar();
    }
    else if (b.id === "n-anadir") {
      const leer = (id) => raiz.querySelector(id).value.replace(",", ".");
      const periodo = raiz.querySelector("#n-periodo").value.trim();
      const bruto = Number(leer("#n-bruto"));
      const neto = Number(leer("#n-neto"));
      const error = raiz.querySelector("#n-error");
      if (!/^\d{4}-\d{2}$/.test(periodo)) {
        error.textContent = "El periodo se escribe como 2026-09.";
      } else if (!(bruto > 0) || !(neto > 0)) {
        error.textContent = "Bruto y neto tienen que ser mayores que cero.";
      } else if (neto > bruto) {
        error.textContent = "El neto no puede ser mayor que el bruto.";
      } else {
        estado.nominas.push({
          periodo, clase: raiz.querySelector("#n-clase").value,
          bruto: redondear(bruto), neto: redondear(neto),
        });
        persistir(); pintar();
      }
    }
  });

  raiz.querySelector("#modal").addEventListener("click", (ev) => {
    if (ev.target.id === "modal") cerrarModal();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") cerrarModal();
  });

  pintar();
}
