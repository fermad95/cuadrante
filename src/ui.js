// src/ui.js
import { diasDelMes, diaSemana, redondear } from "./fechas.js";
import { sugerenciaPara, calcularGuardia } from "./motor.js";
import { resumenMes, previsionIngreso, resumenAnio, compararHipotesis, tiposEfectivos, historialTipos } from "./nomina.js";
import { cargar, guardar, estadoInicial } from "./estado.js";
import { RETRIBUCIONES_ANEXO, retribucionesDe } from "./tarifas.js";
import { calendarioDe } from "./festivos.js";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
// La clave es interna (sin tildes, se usa como estado); el texto es lo que se lee.
const PESTANAS = [
  { clave: "calendario", texto: "Calendario" },
  { clave: "festivos", texto: "Festivos" },
  { clave: "nominas", texto: "Nóminas" },
  { clave: "anual", texto: "Anual" },
];
const DURACIONES = [7, 8, 12, 15, 17, 18, 23, 24];
const LUGARES = [
  { sigla: "URG", nombre: "Puerta de Urgencias" },
  { sigla: "OBS", nombre: "Observación" },
  { sigla: "PT", nombre: "Puerta de Trauma" },
  { sigla: "DSS", nombre: "Deccu Sector Sur" },
  { sigla: "DCP", nombre: "Deccu Castilla del Pino" },
];
const AVISO_SIN_VERIFICAR =
  "Regla del corte a medianoche sin verificar. Se confirma con la nómina de septiembre.";

const eur = (n) => `${n.toFixed(2).replace(".", ",")} €`;

const esc = (t) => String(t).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const GUION = {
  episodio: "Episodio IV",
  titulo: "UNA NUEVA NÓMINA",
  parrafos: [
    "Es una época de incertidumbre. Un joven RESIDENTE ha comenzado su formación "
    + "en un hospital de la periferia, sin saber aún cuánto va a cobrar por las "
    + "guardias que le esperan.",
    "Mientras el ANEXO XVI fija el valor de cada hora, nadie ha sabido decirle si "
    + "el SAS parte las guardias a medianoche o las paga enteras a la tarifa del "
    + "día en que empiezan. Trece euros con sesenta y ocho céntimos penden de esa "
    + "respuesta.",
    "Perseguido por la duda, el residente ha construido este CUADRANTE para "
    + "calcular su destino antes de que llegue la nómina....",
  ],
};

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
    document.documentElement.dataset.tema = estado.config.tema || "sobrio";
    if (!estado.config.inicioResidencia) return pintarBienvenida();
    raiz.querySelector("#pestanas").hidden = false;
    raiz.querySelector("#pestanas").innerHTML = PESTANAS
      .map(({ clave, texto }) =>
        `<button data-pestana="${clave}" class="${clave === pestana ? "activo" : ""}">${texto}</button>`)
      .join("");
    const vista = raiz.querySelector("#vista");
    if (pestana === "calendario") vista.innerHTML = vistaCalendario();
    if (pestana === "festivos") vista.innerHTML = vistaFestivos();
    if (pestana === "nominas") vista.innerHTML = vistaNominas();
    if (pestana === "anual") vista.innerHTML = vistaAnual();
  }

  // La intro solo aparece en el primer arranque con el tema espacial, o cuando
  // se pide desde Ajustes. Siempre se puede saltar, y con reduccion de
  // movimiento activada se omite entera.
  function lanzarIntro() {
    const caja = raiz.querySelector("#intro");
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (sinMovimiento) return;

    caja.innerHTML = `
      <button id="intro-saltar">Saltar ▸</button>
      <p class="intro-lejos">Hace mucho tiempo, en un hospital muy, muy lejano....</p>
      <div class="intro-logo">Cuadrante</div>
      <div class="intro-espacio">
        <div class="intro-crawl">
          <p class="intro-episodio">${GUION.episodio}</p>
          <h2 class="intro-titulo">${GUION.titulo}</h2>
          ${GUION.parrafos.map((p) => `<p>${p}</p>`).join("")}
        </div>
      </div>`;
    caja.hidden = false;
    document.body.classList.add("con-intro");

    const cerrar = () => {
      caja.hidden = true;
      caja.innerHTML = "";
      document.body.classList.remove("con-intro");
      clearTimeout(reloj);
      document.removeEventListener("keydown", porTecla);
    };
    const porTecla = (ev) => { if (ev.key === "Escape" || ev.key === " ") cerrar(); };
    const reloj = setTimeout(cerrar, 38000);
    caja.onclick = cerrar;
    document.addEventListener("keydown", porTecla);
  }

  function pintarBienvenida() {
    raiz.querySelector("#pestanas").hidden = true;
    raiz.querySelector("#vista").innerHTML = `
      <div class="tarjeta">
        <strong class="etiqueta">Empecemos</strong>
        <div class="crawl"><p>Para calcular tus guardias necesito saber cuándo empezaste
           la residencia. De esa fecha salen tu año (R1 a R5) y las tarifas que te
           corresponden.</p></div>
        <p class="etiqueta-campo">Fecha de inicio</p>
        <input type="date" id="b-inicio" value="">
        <div class="acciones-modal">
          <button class="primario" id="b-empezar">Empezar</button>
        </div>
        <p class="aviso">Puedes cambiarla después en Ajustes.</p>
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
        <p class="aviso">Las guardias con borde punteado aún no están marcadas como
          realizadas: cuentan como previsión.</p>
      </div>
      <div class="tarjeta">
        <strong class="etiqueta">Resumen de ${MESES[mes - 1]}</strong>
        <table>
          <tr><td>Sueldo base</td><td class="cifra">${eur(r.brutoBase)}</td></tr>
          ${filaTipo("laborable", r)}${filaTipo("sdf", r)}${filaTipo("especial", r)}
          <tr><td>Bruto total</td><td class="cifra">${eur(r.bruto)}</td></tr>
          <tr><td>Guardias confirmadas</td><td class="cifra">${eur(r.brutoConfirmado)}</td></tr>
          <tr><td>Guardias previstas</td><td class="cifra">${eur(r.brutoPrevisto)}</td></tr>
          <tr><td>Neto de la nómina base</td><td class="cifra">${eur(r.netoBase)}</td></tr>
          <tr><td>Neto de las guardias</td><td class="cifra">${eur(r.netoGuardias)}</td></tr>
          <tr><td class="total">Total neto</td><td class="cifra total">${eur(r.neto)}</td></tr>
        </table>
        ${c.difieren ? `<p class="aviso">${AVISO_SIN_VERIFICAR}<br>
          Con corte: ${eur(c.conCorte.brutoGuardias)} · sin corte: ${eur(c.sinCorte.brutoGuardias)}
          · difieren en ${eur(c.diferencia)}.</p>` : ""}
      </div>
      <div class="tarjeta">
        <strong class="etiqueta">Lo que ingresas este mes</strong>
        <table>
          <tr><td>Nómina base</td><td class="cifra">${eur(p.base)}</td></tr>
          <tr><td>Guardias de ${p.guardiasDe}</td><td class="cifra">${eur(p.importeGuardias)}</td></tr>
          <tr><td class="total">Total</td><td class="cifra total">${eur(p.total)}</td></tr>
        </table>
        <p class="aviso">Las guardias se cobran en la nómina del mes siguiente.</p>
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
      <strong class="etiqueta">Festivos de ${anio}</strong>
      <table>${filas}</table>
      <p class="aviso">Marca como especial los que se retribuyan a la tarifa doble.
        Tienes ${locales} festivo${locales === 1 ? "" : "s"} local${locales === 1 ? "" : "es"}
        dado${locales === 1 ? "" : "s"} de alta para ${anio}; cada municipio tiene dos.</p>
      <p class="etiqueta-campo">Añadir festivo local</p>
      <div class="formulario">
        <input type="date" id="f-fecha">
        <input id="f-nombre" placeholder="Nombre del festivo" size="14">
        <button class="primario" id="f-anadir">Añadir</button>
      </div></div>`;
  }

  function vistaNominas() {
    const t = tiposEfectivos(estado.nominas, estado.config);
    const filas = estado.nominas.map((n, i) => `
      <tr><td>${esc(n.periodo)} ${esc(n.clase)}</td><td class="cifra">${eur(n.bruto)} → ${eur(n.neto)}
      <button class="peligro" data-borrar-nomina="${i}">×</button></td></tr>`).join("");
    return `<div class="tarjeta"><strong class="etiqueta">Nóminas registradas</strong>
      <table>${filas}</table>
      ${bloqueRetencion("base", "Base", t.base, t.nBase)}
      ${bloqueRetencion("guardias", "Guardias", t.guardias, t.nGuardias)}
      <div class="formulario">
        <input id="n-periodo" placeholder="2026-09" size="8">
        <select id="n-clase"><option value="base">Base</option><option value="guardias">Guardias</option></select>
        <input id="n-bruto" placeholder="Bruto" size="8">
        <input id="n-neto" placeholder="Neto" size="8">
        <button class="primario" id="n-anadir">Añadir</button>
      </div>
      <div class="formulario">
        <input id="n-cotizacion" placeholder="Cotización €" size="10">
        <input id="n-irpf" placeholder="IRPF €" size="8">
      </div>
      <p class="aviso" id="n-error">Los dos últimos son opcionales, pero si los
        copias de la nómina puedo separar lo fijo (cotización) de lo que varía (IRPF).</p></div>`;
  }

  // El tipo de IRPF se regulariza y puede moverse mes a mes. Se enseña la deriva
  // en vez de un solo numero, y se marcan los saltos grandes.
  function bloqueRetencion(clase, titulo, tipoVigente, cuantas) {
    const h = historialTipos(estado.nominas, clase);
    if (h.length === 0) {
      return `<p class="tenue">Retención de ${titulo.toLowerCase()}:
        <strong>${(tipoVigente * 100).toFixed(2)} %</strong> — valor por defecto,
        aún sin nóminas registradas.</p>`;
    }
    const pasos = h.map((f, i) => {
      const ultimo = i === h.length - 1;
      // Con desglose se enseña el IRPF, que es lo que deriva; la cotizacion va
      // aparte y en tenue, porque es de tipo fijo y no dice nada nuevo.
      const cifra = f.tipoIrpf !== null
        ? `<b>${(f.tipoIrpf * 100).toFixed(2)} %</b><span class="fijo">+${(f.tipoCotizacion * 100).toFixed(2)} cot.</span>`
        : `<b>${(f.tipo * 100).toFixed(2)} %</b>`;
      const marca = f.esSalto
        ? `<span class="salto">${f.salto > 0 ? "▲" : "▼"} ${Math.abs(f.salto * 100).toFixed(2)}</span>`
        : "";
      const aviso = f.cuadra ? "" : `<span class="salto" title="El desglose no cuadra con el neto">⚠</span>`;
      return `<span class="paso${ultimo ? " vigente" : ""}">${esc(f.periodo)}
        ${cifra}${marca}${aviso}</span>`;
    }).join('<span class="flecha">→</span>');
    const saltos = h.filter((f) => f.esSalto);
    const desglosadas = h.filter((f) => f.tipoIrpf !== null).length;
    return `
      <p class="etiqueta-campo">Retención de ${titulo.toLowerCase()}</p>
      <div class="historial">${pasos}</div>
      ${saltos.length ? `<p class="aviso">El tipo cambió de golpe en
        ${saltos.map((s) => esc(s.periodo)).join(", ")}. Suele ser una regularización
        de Hacienda: las previsiones de los meses anteriores se quedaron
        ${saltos[saltos.length - 1].salto > 0 ? "largas" : "cortas"}.</p>`
        : `<p class="aviso">Estable en ${cuantas} ${cuantas === 1 ? "nómina" : "nóminas"}.
        Se usa el último valor para las previsiones.${desglosadas === 0
          ? " Si copias la cotización y el IRPF de tu nómina, puedo seguir solo la parte que varía."
          : ""}</p>`}`;
  }

  function vistaAnual() {
    const anio = Number(mesVisible.slice(0, 4));
    const r = resumenAnio(anio, estado);
    return `<div class="tarjeta"><strong class="etiqueta">Resumen de ${anio}</strong><table>
      <tr><td><span class="punto punto-laborable"></span>Horas laborables</td><td class="cifra">${r.horasPorTipo.laborable}h</td></tr>
      <tr><td><span class="punto punto-sdf"></span>Horas festivas (S-D-F)</td><td class="cifra">${r.horasPorTipo.sdf}h</td></tr>
      <tr><td><span class="punto punto-especial"></span>Horas de festivo especial</td><td class="cifra">${r.horasPorTipo.especial}h</td></tr>
      <tr><td>Bruto del año</td><td class="cifra">${eur(r.bruto)}</td></tr>
      <tr><td class="total">Neto del año</td><td class="cifra total">${eur(r.neto)}</td></tr>
    </table></div>`;
  }

  function abrirModal(fecha) {
    // Una guardia nueva arranca con lo que toca ese dia; una ya guardada, con lo suyo.
    const sugerida = sugerenciaPara(fecha, estado.festivos);
    const g = { ...(estado.guardias[fecha]
      || { horas: sugerida.horas, inicio: sugerida.inicio, lugar: "", hecha: false }) };
    const caja = raiz.querySelector("#caja-modal");

    function pintarModal() {
      const r = calcularGuardia({ ...g, fecha }, estado.festivos, estado.config);
      const tipos = [...new Set(r.tramos.map((t) => t.tipo))];
      const tramos = r.tramos.map((t) => `<tr><td>${t.fecha} ${t.desde}–${t.hasta}</td>
        <td class="cifra">${t.horas}h × ${eur(t.tarifa)} = ${eur(t.importe)}</td></tr>`).join("");
      caja.innerHTML = `
        <strong class="modal-fecha">${fecha}</strong>
        <p class="etiqueta-campo">Duración</p>
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
      // Cambiar la duracion ya no toca la hora de entrada: esa depende del dia,
      // no de lo que dure la guardia.
      if (b.dataset.horas) { g.horas = Number(b.dataset.horas); pintarModal(); }
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

      <p class="etiqueta-campo">Aspecto</p>
      <div class="chips">
        <button data-tema="sobrio" class="${(c.tema || "sobrio") === "sobrio" ? "activo" : ""}">Sobrio</button>
        <button data-tema="espacial" class="${c.tema === "espacial" ? "activo" : ""}">Una galaxia muy lejana</button>
      </div>
      ${c.tema === "espacial" ? `<div class="chips" style="margin-top:.4rem">
        <button id="a-intro">▶ Ver la intro</button></div>` : ""}

      <p class="etiqueta-campo">Inicio de residencia</p>
      <input type="date" id="a-inicio" value="${c.inicioResidencia || ""}">

      <p class="etiqueta-campo">Reparto de la guardia a medianoche</p>
      <label><input type="checkbox" id="a-corte" ${c.cortarAMedianoche ? "checked" : ""}>
        Partir las guardias a medianoche</label><br>
      <label><input type="checkbox" id="a-corte-esp" ${c.especialCortaAMedianoche ? "checked" : ""}>
        Partir también las de festivo especial</label>
      <p class="aviso">${AVISO_SIN_VERIFICAR}</p>

      <p class="etiqueta-campo">Retenciones por defecto</p>
      <label>Base <input id="a-ret-base" value="${(c.retencionBase * 100).toFixed(4)}" size="6"> %</label>
      <label>Guardias <input id="a-ret-guardias" value="${(c.retencionGuardias * 100).toFixed(4)}" size="6"> %</label>
      <p class="aviso">Solo se usan mientras no registres ninguna nómina de esa clase.
        En cuanto registras una, manda la más reciente.</p>

      <p class="etiqueta-campo">Valor hora (laborable / S-D-F / especial)</p>
      <table>${filas}</table>
      <p class="etiqueta-campo">Sueldo base</p>
      <input id="a-sueldo" value="${r.sueldoBase}" size="8">
      <p class="aviso">Valores del anexo XVI, 2026.${
        anioEnCurso > 2026
          ? ` Estamos en ${anioEnCurso}: contrástalos con tu nómina, el SAS los actualiza por convenio.`
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
      if (b.dataset.tema) {
        c.tema = b.dataset.tema;
        document.documentElement.dataset.tema = c.tema;
        persistir();
        abrirAjustes(); // se repinta para que el boton activo sea el nuevo
      }
      else if (b.id === "a-intro") { cerrarModal(); lanzarIntro(); }
      else if (b.id === "a-cancelar") cerrarModal();
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
            "Ese texto no es una copia válida del cuadrante.";
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
        if (estado.config.tema === "espacial") lanzarIntro();
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
        const cot = Number(leer("#n-cotizacion"));
        const irpf = Number(leer("#n-irpf"));
        const nomina = {
          periodo, clase: raiz.querySelector("#n-clase").value,
          bruto: redondear(bruto), neto: redondear(neto),
        };
        // El desglose es opcional, pero si se da tiene que ser entero y cuadrar.
        if (cot > 0 || irpf > 0) {
          if (!(cot > 0) || !(irpf > 0)) {
            error.textContent = "Si desglosas, pon las dos: cotización e IRPF.";
            return;
          }
          if (Math.abs(cot + irpf - (bruto - neto)) > 0.02) {
            error.textContent = `Cotización + IRPF son ${eur(redondear(cot + irpf))}, `
              + `pero del bruto al neto van ${eur(redondear(bruto - neto))}. Revísalo.`;
            return;
          }
          nomina.cotizacion = redondear(cot);
          nomina.irpf = redondear(irpf);
        }
        estado.nominas.push(nomina);
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
