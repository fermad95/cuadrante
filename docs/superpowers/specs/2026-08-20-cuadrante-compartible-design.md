# Cuadrante compartible — diseño

Fecha: 2026-08-20
Estado: aprobado en brainstorming, pendiente de plan de implementación
Spec anterior: `2026-08-19-cuadrante-guardias-design.md` (sigue vigente en todo lo
que no contradiga este documento)

## 1. Objetivo

Convertir el cuadrante de una herramienta con un único usuario incrustado en el
código a una app que cualquier residente andaluz pueda abrir y usar con sus
propios datos, y arreglar de paso los defectos que la revisión del 20/08/2026
encontró.

No cambia el motor de cálculo. Las cifras de los casos ya validados —los seis
casos del motor, junio y agosto de 2026 contra nóminas reales— deben salir
idénticas después del cambio. Es el criterio que demuestra que la migración no
ha movido nada.

## 2. El problema de fondo

Hoy el estado guardado contiene **copias** de datos que el código también
conoce: el calendario de festivos entero se serializa en `localStorage`. Como
`cargar()` fusiona superficialmente, la copia congelada del usuario gana sobre
el código para siempre. Verificado: añadir 2027 a `festivosIniciales()` no
llegaría a nadie que ya haya guardado algo.

El mismo patrón, aplicado a las tarifas y al calendario, produciría una app que
envejece mal en manos de terceros: alguien que la estrene en 2028 vería
festivos que no existen y tarifas caducadas, sin ninguna señal.

## 3. Decisión central: el estado guarda diferencias

Se invierte quién manda.

**El código deriva.** Los festivos nacionales se calculan por año (fechas fijas
más Semana Santa por Computus). Los andaluces se añaden por año. Las tarifas
del anexo XVI son la tabla base.

**El estado guarda solo lo que el usuario ha tocado**, como un mapa de
excepciones:

```
festivos: {
  "2026-12-24": { clase: "especial" },              // reclasifica uno derivado
  "2026-09-08": { nombre: "Fuensanta", clase: "sdf" } // alta de festivo local
}
```

Una entrada con `nombre` que no está en el calendario derivado es un alta; una
sin `nombre` es una reclasificación de uno derivado. Un solo mecanismo para las
dos cosas.

Consecuencias, todas deseables:

- Añadir 2027-2030 llega a todo el mundo sin migración.
- Corregir una tarifa llega a quien no la haya sobrescrito.
- El estado guardado queda lo bastante pequeño para caber en un copiar-pegar,
  que es lo único que funciona para exportar dentro del sandbox de los
  artifacts.

## 4. Alcance del calendario

Ámbito: **España (nacionales) y Andalucía (autonómicos)**. Los festivos locales
—dos por municipio— los añade cada usuario en Ajustes, porque dependen del
ayuntamiento y no hay forma de derivarlos.

### Nacionales, calculados por año

Fijos: 1 de enero, 6 de enero, 1 de mayo, 15 de agosto, 12 de octubre,
1 de noviembre, 6 de diciembre, 8 de diciembre, 25 de diciembre.

Móvil: Viernes Santo, dos días antes del Domingo de Pascua.

### Autonómicos de Andalucía

28 de febrero (Día de Andalucía) y Jueves Santo, tres días antes del Domingo de
Pascua. Jueves Santo no es estatal: cada comunidad decide, y Andalucía lo toma.

### Semana Santa

Algoritmo anónimo gregoriano. Verificado antes de escribir este documento
contra fechas conocidas y contra los datos que ya había en el proyecto:

| Año | Domingo de Pascua | Jueves Santo | Viernes Santo |
|---|---|---|---|
| 2024 | 31 marzo | 28 marzo | 29 marzo |
| 2025 | 20 abril | 17 abril | 18 abril |
| 2026 | 5 abril | **2 abril** | **3 abril** |
| 2027 | 28 marzo | 25 marzo | 26 marzo |
| 2028 | 16 abril | 13 abril | 14 abril |
| 2029 | 1 abril | 29 marzo | 30 marzo |
| 2030 | 21 abril | 18 abril | 19 abril |

Las dos fechas en negrita coinciden con las que hoy están escritas a mano en
`FESTIVOS_2026`, lo que confirma la implementación.

### Nochebuena y Nochevieja

Dejan de ser entradas del calendario. No son festivos: eran candidatos a
marcarse como especiales. Cualquier día del año se puede marcar como especial
desde la pestaña Festivos, así que el caso queda cubierto sin datos falsos en
el calendario. El calendario derivado ya no contiene nada que no sea festivo
de verdad.

## 5. Tarifas

Las tablas del anexo XVI se quedan en el código como base, con los valores de
2026. `config.retribuciones` vale `null` mientras el usuario no las edite; en
cuanto las edita, su bloque manda **entero**, no campo a campo:

```
retribuciones: null | {
  guardias: { 1: { laborable, sdf, especial }, ...hasta 5 },
  sueldoBase: 1379.90,
  cgFormacion: { 1: 0, 2: 110.38, ...hasta 5 }
}
```

Un solo campo cubre las tres tablas —valor hora, sueldo base y complemento de
formación— para que no haya duda de dónde vive cada una ni estados a medias en
los que una esté sobrescrita y otra no.

La pantalla de Ajustes muestra las tres tablas editables, etiquetadas como
"valores del anexo XVI, 2026", y si el año en curso es posterior a 2026, un
aviso de que conviene contrastarlas con la nómina porque el SAS las actualiza
por convenio.

## 6. Modelo de datos, versión 6

Clave de `localStorage`: `cuadrante_v6`.

Un estado ya poblado tiene esta forma:

```
{
  version: 6,
  config: {
    inicioResidencia: "2026-05-27",
    cortarAMedianoche: true,
    especialCortaAMedianoche: true,
    retencionBase: 0.089753,
    retencionGuardias: 0.032609,
    retribuciones: null
  },
  guardias: { "2026-08-05": { horas, inicio, lugar, hecha } },
  festivos: { ...excepciones, ver §3... },
  nominas: [ { periodo, clase, bruto, neto } ]
}
```

El arranque de un usuario nuevo es el mismo objeto con `inicioResidencia: null`,
`guardias: {}`, `festivos: {}` y `nominas: []`. Ningún dato personal en el
código.

### Migración desde v5

`migrar(guardado)` conserva `guardias` y `nominas` tal cual, y convierte el
mapa de festivos v5 en excepciones: compara cada entrada con el calendario
derivado de su año y guarda solo lo que difiera. Los festivos locales de
Córdoba (Fuensanta, San Rafael) del estado v5 sobreviven como altas, porque no
están en el calendario derivado.

`cargar()` deja de fusionar superficialmente: reconoce `version` y aplica la
migración que corresponda.

## 7. Interfaz

### Primer arranque

Si `config.inicioResidencia` es `null`, la app muestra una pantalla limpia con
una sola pregunta —cuándo empezó la residencia— y entra al calendario. El resto
tiene valores por defecto y se afina en Ajustes.

### Ajustes

Va en un engranaje de la cabecera, no en una quinta pestaña: cinco pestañas no
caben bien a 420 px y la rejilla del calendario ya tuvo que arreglarse una vez
para móvil.

Contenido: inicio de residencia, los dos interruptores de la hipótesis del
corte, retenciones por defecto, tabla de tarifas editable, exportar, importar y
borrar todo.

Los interruptores del corte son nuevos en la interfaz. Hasta ahora la app
avisaba de que la regla está sin verificar pero no dejaba cambiarla, lo que
obligaba a tocar código para probar la otra hipótesis.

### Exportar e importar

Un `<textarea>` con el JSON del estado y un botón de copiar; importar es pegar
y validar. No se usa descarga de fichero porque **el sandbox de los artifacts
bloquea las descargas que inicia la propia página**: `<a download>`, blobs y
guardados por script quedan inertes para quien abre el artifact.

Sirve además para pasar datos entre dispositivos, que hoy no es posible:
`localStorage` es por navegador, así que el móvil y el portátil son dos
cuadrantes distintos.

### El campo `hecha` pasa a significar algo

Hoy se guarda y no lo lee ningún cálculo ni se ve en el calendario. Pasa a
distinguir dinero ganado de dinero previsto, que es la diferencia que importa
en una app cuyo objeto es predecir ingresos:

- El calendario dibuja con borde punteado las guardias no realizadas.
- El resumen mensual separa confirmado de previsto.

`resumenMes` mantiene `brutoGuardias` como total y **añade** `brutoConfirmado`
y `brutoPrevisto`. El cambio es aditivo: ninguna cifra existente se mueve. Una
guardia sin `hecha` cuenta como prevista.

### Pestaña Festivos

Pasa a mostrar el año que se esté viendo en el calendario, en vez de la lista
fija de 2026. Gana un botón para añadir un festivo local con fecha y nombre.

### Accesibilidad y correcciones de la revisión

- Los días pasan de `<div>` con `onclick` a `<button>`: hoy no se llega con
  teclado ni los anuncia un lector de pantalla.
- Escape cierra el modal. Hoy no hay ningún manejador de teclado.
- Vuelve el `<h1>`: el rediseño del 20/08 dejó la página sin ningún encabezado.
- Se reordenan las reglas `.dia.hoy` para que ganen sobre `.dia.laborable` y
  hermanas, que hoy las anulan por ir después con la misma especificidad. El
  marcador de "hoy" es invisible en cualquier día que tenga guardia.
- `color-mix()` recibe un color plano de reserva, para que un navegador sin
  soporte no deje el calendario sin código de color.
- Helper de escapado para los textos libres que se insertan en HTML: periodo de
  nómina y nombre de festivo local.

### Validación

El formulario de nóminas rechaza `neto > bruto` —que hoy produce en silencio
una retención negativa del −20 %— y exige el formato `AAAA-MM` en el periodo.

## 8. Retenciones: la más reciente, no la media

`tipoMedio()` promedia hoy todas las nóminas de una clase sin mirar el periodo.
El IRPF se recalcula cada año y sube con el año de residencia, así que promediar
una nómina de R1 con una de R3 da un tipo que no describe a ninguno de los dos:
verificado, 8,98 % y ~17 % dan 13,03 %.

Pasa a usarse **la nómina más reciente por periodo** de cada clase. Un solo dato
verdadero en vez de una media de datos incompatibles.

El periodo es una cadena `AAAA-MM`, así que ordena bien alfabéticamente. Si dos
nóminas de la misma clase comparten periodo, gana **la última añadida**, por
orden en el array: se asume que quien la vuelve a introducir está corrigiendo la
anterior. Se siguen ignorando las nóminas con `bruto <= 0`.

## 9. Otras correcciones

- `resumenAnio` deja de estar clavado en 2026 en la pestaña Anual; sigue al año
  del mes visible.

## 10. Pruebas

Los tests existentes que codifican los datos personales cambian por diseño:

- `estado.test.js` afirma hoy que el arranque trae 9 guardias y 2 nóminas; pasa
  a afirmar que arranca vacío y sin fecha de inicio.
- `festivosIniciales()` desaparece como API. Los tests de `motor`, `resumen` e
  `hipotesis` que la invocan pasan a `calendarioDe(anio, excepciones)`.

La lógica que cubren no se toca. Los casos del spec y las cifras de junio y
agosto de 2026 deben seguir dando exactamente lo mismo.

Tests nuevos:

- Computus contra las fechas de la tabla del §4.
- Calendario derivado de 2026 a 2030, incluida la ausencia de Nochebuena y
  Nochevieja.
- Resolución de excepciones: alta, reclasificación y precedencia sobre el
  derivado.
- Migración v5 → v6, con el estado real como caso.
- Retención por nómina más reciente, incluido el desempate por periodo.
- Validación del formulario de nóminas.

## 11. Fuera de alcance

- Comunidades autónomas distintas de Andalucía. El diseño no lo impide —basta
  añadir tablas por comunidad y un selector— pero recopilar y verificar ~400
  fechas de 17 comunidades contra el BOE no entra aquí.
- Sincronización entre dispositivos por red. Exportar e importar cubre el caso.
- La validación de la regla del corte a medianoche contra la nómina de
  septiembre de 2026, que sigue pendiente del spec anterior. Este diseño se
  limita a hacerla configurable desde la interfaz.

## 12. Riesgos

- **Pérdida de los datos actuales del usuario.** Sus 9 guardias y 2 nóminas hoy
  viven como valores por defecto del código, no necesariamente en
  `localStorage`. Vaciar el arranque las borraría de cualquier dispositivo donde
  no haya guardado. Mitigación: generar una cadena de importación con sus datos
  actuales y entregársela antes de publicar la nueva versión.
- **Tarifas caducadas.** Mitigado con el aviso del §5, no resuelto: nadie
  comprueba el BOJA por el usuario.
- **Festivos locales mal introducidos.** Un usuario puede olvidarse de añadir
  los dos de su municipio y cobrar de menos en la previsión. Mitigación: la
  pestaña Festivos indica cuántos locales hay dados de alta para el año visible.
