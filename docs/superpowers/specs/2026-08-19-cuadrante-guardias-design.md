# Cuadrante de guardias MIR — diseño

Fecha: 2026-08-19
Estado: aprobado

## 1. Objetivo

Una aplicación de un solo archivo HTML donde un residente registra sus guardias
y obtiene, para cada mes, lo que va a cobrar realmente: bruto exacto según las
tarifas oficiales del SAS y neto estimado calibrado contra sus nóminas.

Sustituye a `cuadrante_standalone 4-1`, cuyo motor de cálculo tiene dos
defectos: cobra la guardia entera a la tarifa del día en que empieza, y estima
el neto con porcentajes planos (8 % guardias, 7,25 % base) que no coinciden con
la nómina real.

## 2. Fuente normativa

Retribuciones SAS R. 0002/2026, anexos XVI.1 y XVI.2.

### Retribución fija (anexo XVI.1)

| Categoría | Sueldo/mes | C.G. Formación | Total anual |
|---|---|---|---|
| Facult. Formación 1.º año | 1.379,90 | 0,00 | 19.318,60 |
| Facult. Formación 2.º año | 1.379,90 | 110,38 | 20.863,92 |
| Facult. Formación 3.º año | 1.379,90 | 248,41 | 22.796,34 |
| Facult. Formación 4.º año | 1.379,90 | 386,37 | 24.727,78 |
| Facult. Formación 5.º año | 1.379,90 | 524,38 | 26.659,92 |

El total anual es `(sueldo + C.G. formación) × 14`. Comprobado en los cinco
años: R1 `1379,90 × 14 = 19.318,60`; R2 `1490,28 × 14 = 20.863,92`. La app
usará esa fórmula, no la tabla, para que el mensual y el anual no se
contradigan.

### Valor hora de guardia (anexo XVI.2)

| Año | Laborable | S-D-F | Festivo especial |
|---|---|---|---|
| 1.º | 14,07 | 15,78 | 28,14 |
| 2.º | 15,42 | 17,28 | 30,84 |
| 3.º | 18,02 | 20,17 | 36,04 |
| 4.º y 5.º | 20,22 | 22,61 | 40,44 |

## 3. Decisiones de diseño

Acordadas con el usuario el 19/08/2026:

1. **Hora de inicio deducida de la duración, editable.** 7h → 15:00, 12h →
   08:00, 15h → 17:00, 17h → 15:00, 24h → 08:00. Cualquier guardia con horario
   atípico se corrige a mano en el modal.

   Las de 7h son las guardias «de mochila»: refuerzo de tarde de 15:00 a 22:00,
   sin noche. Son las que hizo el usuario en junio de 2026 y no cruzan
   medianoche. Las de 12h en fin de semana van de 08:00 a 20:00, también sin
   noche.
2. **Festivos precargados, clasificación manual.** La app trae el calendario
   laboral 2026 (nacional + Andalucía + Córdoba) y el usuario marca cuáles son
   festivo especial y cuáles S-D-F normal.
3. **Neto calibrado, no replicado.** Tipos efectivos derivados de nóminas
   reales, recalibrables. No se reimplementa la fórmula de cotización de la
   Seguridad Social.

## 4. Motor de cálculo

El núcleo es una función pura, sin dependencias del DOM ni del almacenamiento:

```
partirGuardia(fechaInicio, horaInicio, duracionHoras, calendarioFestivos)
  → [ { fecha, horaDesde, horaHasta, horas, tipo, tarifa, importe } ]
```

### Algoritmo

1. Construir el instante de inicio y sumarle la duración para obtener el fin.
2. Cortar el intervalo en cada medianoche que contenga.
3. Clasificar cada tramo **por el día natural en el que cae**, no por el día en
   que empezó la guardia:
   - el día está marcado como festivo especial → tarifa especial;
   - el día es sábado, domingo o festivo → tarifa S-D-F;
   - en cualquier otro caso → tarifa laborable.
4. Importe del tramo = horas × tarifa del año de residencia vigente en esa fecha.

Esta regla es exactamente la que describió el usuario: una guardia de viernes
pasa a tarifa de sábado a las 00:00, y una de domingo pasa a tarifa de laborable
a las 00:00 del lunes.

### Punto abierto: el corte en festivos especiales

El usuario no tiene confirmado si el festivo especial también corta a
medianoche. El diseño **asume que sí**, por coherencia con los otros dos casos,
y expone un interruptor `festivoEspecialCortaAMedianoche` (por defecto activado)
para invertirlo sin tocar código si en el hospital lo aclaran. La interfaz
señala esa asunción donde afecte al importe.

### Cambio de año de residencia

Las tarifas dependen del año de residencia, que cambia a finales de mayo. La
configuración guarda una sola fecha, `inicioResidencia` (el 27 de mayo de 2026,
cuando empezó R1), y el año se deriva de ella: un dato en vez de dos que pueden
contradecirse. `tarifaEn(fecha)` resuelve qué tabla aplica, de modo que una
estimación que cruce mayo de 2027 use 14,07 antes y 15,42 después.

## 5. Cálculo del neto

### Calibración inicial

Derivada de las dos nóminas disponibles:

| Nómina | Bruto | Descuentos | Neto | Tipo efectivo |
|---|---|---|---|---|
| Julio 2026 (base) | 1.379,90 | 123,85 | 1.256,05 | 8,98 % |
| Complementaria junio 2026 (guardias) | 484,83 | 15,81 | 469,02 | 3,26 % |

Ninguna de las dos tiene línea de IRPF: la retención es 0 %, coherente con los
ingresos de un R1. Los descuentos son solo Seguridad Social, calculada sobre
bases de cotización que no coinciden con el importe devengado (desempleo 1,60 %
sobre 1.610,10; formación 0,10 % sobre 1.610,10; régimen general 4,85 % sobre
1.989,30).

Los tipos se guardan como fracción con seis decimales, no como porcentaje con
dos. Con `8,98 %` el neto de julio sale 1.255,99 € y el real es 1.256,05 €; con
`0,089753` sale exacto. El orden de cálculo también importa: primero
`descuento = redondear(bruto × tipo)` y después `neto = bruto − descuento`. Al
revés se desvían céntimos.

### Por qué no se replica la fórmula

En la complementaria de junio la base de régimen general es 156,00 sobre un
devengo de 484,90 — un 32 %. Con dos nóminas no hay información suficiente para
deducir de dónde sale esa base, y un modelo inventado daría un número con
apariencia de exactitud y sin ella. La app aplica tipos efectivos y dice
claramente que son una calibración.

### Recalibración

Una pestaña permite registrar cada nómina que llegue (mes, tipo base o
complementaria, bruto, neto). El tipo efectivo de cada categoría pasa a ser la
media de los registrados, y la interfaz muestra sobre cuántas nóminas se
sostiene la estimación. Si el usuario empieza a tributar IRPF, el cambio entra
solo al registrar la primera nómina que lo lleve.

## 6. Desfase de liquidación

Las guardias no se cobran en el mes en que se hacen. La complementaria emitida
en 2026-07 liquida el periodo 05/06/2026–30/06/2026: las guardias del mes M se
pagan en la nómina del mes M+1.

El resumen mensual muestra las dos cifras separadas — lo trabajado ese mes y lo
que se ingresa ese mes — porque el usuario quiere previsión de ingresos.

El día de corte exacto (el periodo empieza el 5, no el 1) queda **sin
confirmar**: puede ser el corte real de cierre o el día de su primera guardia
del mes. Hasta tener otra nómina, la app asume mes natural completo y avisa de
la asunción.

## 7. Modelo de datos

Un objeto en `localStorage`, clave `cuadrante_v5`:

```
{
  version: 5,
  config: {
    inicioResidencia: "2026-05-27",
    cortarAMedianoche: true,
    festivoEspecialCortaAMedianoche: true,
    retencionBase: 0.089753,
    retencionGuardias: 0.032609
  },
  guardias: {
    "2026-08-02": { horas: 15, inicio: "17:00", lugar: "PTA", hecha: true }
  },
  festivos: {
    "2026-09-08": { nombre: "Ntra. Sra. de la Fuensanta", clase: "sdf" }
  },
  nominas: [
    { periodo: "2026-07", clase: "base", bruto: 1379.90, neto: 1256.05 }
  ]
}
```

`clase` de un festivo es `"sdf"` o `"especial"`. `lugar` es `PTA`, `OBS`, `INT`,
`RS`, `HP` o vacío.

`retencionBase` y `retencionGuardias` son valores de arranque. En cuanto
`nominas` contiene al menos una entrada de una categoría, el tipo efectivo de
esa categoría se calcula desde `nominas` y el valor de `config` deja de usarse.
Así una sola fuente manda en cada momento.

## 7 bis. Datos iniciales

La app arranca con lo ya conocido, para que el usuario no reintroduzca nada:

- **Guardias de junio de 2026**: 08 (7h), 15 (7h), 20 (12h), 26 (7h), todas
  marcadas como realizadas.
- **Guardias de agosto de 2026**: 02 (15h, PTA), 03 (8h), 05 (17h, OBS),
  11 (17h, PTA), 13 (17h).
- **Nóminas**: la de julio (base, 1.379,90 → 1.256,05) y la complementaria de
  junio (guardias, 484,83 → 469,02).

Los lugares de las guardias de junio y del día 3 de agosto no constan en las
capturas y quedan vacíos.

## 8. Calendario 2026 precargado

Verificado el día de la semana de cada fecha:

| Fecha | Día | Festividad | Ámbito |
|---|---|---|---|
| 01-01 | jueves | Año Nuevo | nacional |
| 06-01 | martes | Reyes | nacional |
| 28-02 | sábado | Día de Andalucía | autonómico |
| 02-04 | jueves | Jueves Santo | nacional |
| 03-04 | viernes | Viernes Santo | nacional |
| 01-05 | viernes | Fiesta del Trabajo | nacional |
| 15-08 | sábado | Asunción | nacional |
| 08-09 | martes | Ntra. Sra. de la Fuensanta | local Córdoba |
| 12-10 | lunes | Fiesta Nacional | nacional |
| 24-10 | sábado | San Rafael | local Córdoba |
| 01-11 | domingo | Todos los Santos | nacional |
| 06-12 | domingo | Constitución | nacional |
| 08-12 | martes | Inmaculada | nacional |
| 25-12 | viernes | Navidad | nacional |

Se añaden 24-12 y 31-12 como candidatos a festivo especial, sin marcar: no son
festivos oficiales pero suelen retribuirse como especiales.

Todas llegan clasificadas como `sdf`. El usuario marca las especiales. Los dos
festivos locales de Córdoba —la Fuensanta el 8 de septiembre y San Rafael el 24
de octubre— están confirmados por el usuario.

## 9. Interfaz

Se conserva el aspecto de la versión actual: tema oscuro de terminal, tira de
meses, rejilla de calendario con lunes primero, leyenda de tarifas y códigos de
lugar.

- **Calendario.** Cada día con guardia muestra horas y lugar, coloreado por el
  tipo de tarifa dominante del día. Un día cuya guardia cruza a otra tarifa lo
  indica visualmente, para que el corte a medianoche sea evidente sin abrirlo.
- **Modal de día.** Duración con atajos 24/17/15/12 y campo libre, hora de
  inicio autorrellenada y editable, lugar, casilla de guardia ya realizada, y el
  **desglose por tramos calculado en vivo** bajo los campos.
- **Festivos.** Lista del año con un conmutador S-D-F / especial por fecha.
- **Resumen mensual.** Sueldo base, guardias desglosadas por tipo con sus horas,
  bruto, neto por categoría y total. Debajo, la previsión de ingreso: qué se
  cobra este mes y en qué nómina caen las guardias de este mes.
- **Nóminas.** Alta de nóminas reales y tipos efectivos vigentes, con el número
  de nóminas que respaldan cada uno.
- **Resumen anual.** Acumulado por tipo de hora y total.

## 10. Criterios de aceptación

El motor debe reproducir estos casos:

1. Guardia de 17h el miércoles 5 de agosto desde las 15:00 → 17h laborables,
   239,19 €. Ningún tramo festivo: el jueves también es laborable.
2. Guardia de 17h el viernes desde las 15:00 → 9h laborables (126,63) + 8h S-D-F
   (126,24) = 252,87 €.
3. Guardia de 15h el domingo 2 de agosto desde las 17:00 → 7h S-D-F (110,46) +
   8h laborables del lunes (112,56) = 223,02 €.
4. Guardia de 24h el 8 de septiembre marcado como especial, desde las 08:00 →
   16h especiales (450,24) + 8h laborables del día 9 (112,56) = 562,80 €.
5. Con el interruptor de corte invertido, el caso 4 da 24h especiales = 675,36 €.
6. Una guardia sin lugar y sin marcar como realizada computa igual en el bruto.

## 10 bis. Validación contra nómina real

### Junio de 2026: qué queda validado

Guardias realmente realizadas, confirmadas por el usuario:

| Fecha | Día | Duración | Horario | Tipo |
|---|---|---|---|---|
| 08-06 | lunes | 7h | 15:00–22:00 | laborable |
| 15-06 | lunes | 7h | 15:00–22:00 | laborable |
| 20-06 | sábado | 12h | 08:00–20:00 | S-D-F |
| 26-06 | viernes | 7h | 15:00–22:00 | laborable |

La complementaria de junio liquidó 21 horas laborables (concepto I0310, periodo
08-06 a 26-06) y 12 festivas (I0312, 20-06 a 20-06). El modelo reproduce ambas
cifras exactamente: 3 × 7h = 21h laborables y 12h festivas el sábado 20.

Importes: 21 × 14,07 = 295,47 y 12 × 15,78 = 189,36, que son los dos devengos de
la nómina al céntimo. Aplicando el tipo efectivo del 3,26 %, el neto estimado es
469,03 € contra los 469,02 € reales — un céntimo de redondeo. La app anterior,
con su 8 % plano, daba 446,04 €: casi 23 € por debajo.

Esto valida las tarifas del anexo XVI.2, la clasificación laborable / S-D-F y la
calibración del neto.

### Lo que junio NO valida

Las cuatro guardias son «de mochila» y ninguna cruza medianoche. **La regla del
corte a medianoche sigue sin ninguna nómina que la respalde.** Se sostiene solo
en lo que le indicaron al usuario verbalmente.

No debe presentarse como verificada en la interfaz hasta que lo esté.

### La prueba pendiente: agosto de 2026

Agosto de 2026 tiene cinco guardias: día 2 (domingo, 15h), día 3 (lunes, 8h) y
los días 5, 11 y 13 (17h cada una). Las de 17h cruzan a la madrugada del día
siguiente, pero caen entre laborables, así que no cambian de tarifa. **La única
guardia que distingue las dos hipótesis es la del domingo 2**, de 15h desde las
17:00, que cruza a lunes.

Se liquidan en la nómina de septiembre, y ese documento decide:

| Hipótesis | Laborables | S-D-F | Bruto |
|---|---|---|---|
| Corte a medianoche | 67h | 7h | 1.053,15 € |
| Guardia entera a la tarifa del día de inicio | 59h | 15h | 1.066,83 € |

Se diferencian en 13,68 €, y el desglose por horas de la nómina las separa sin
ambigüedad. Nótese que la hipótesis del corte paga **menos** en este caso: no es
la que conviene asumir por optimismo, es la que hay que comprobar.

La app debe permitir contrastar ambas con un conmutador, para que al llegar la
nómina de septiembre baste comparar sin rehacer nada. Cuando se confirme cuál es
la correcta, se fija y se marca la regla como verificada.

## 11. Fuera de alcance

- Replicar el cálculo de bases de cotización de la Seguridad Social.
- IRPF por tramos: se trata como parte del tipo efectivo calibrado.
- Sincronización entre dispositivos: los datos viven en el `localStorage` del
  navegador donde se usa.
- Turnos que no sean guardias (jornada ordinaria, libranzas, vacaciones).

## 12. Riesgos

| Riesgo | Mitigación |
|---|---|
| El corte a medianoche en festivos especiales puede no ser el del SAS | Interruptor de configuración; asunción visible en la interfaz |
| Los festivos nacionales y autonómicos de 2026 no están contrastados con el BOJA | Editables uno a uno desde la pestaña de festivos |
| La calibración del neto se apoya en dos nóminas | Se muestra el número de nóminas; mejora al registrar más |
| El día de corte de la liquidación (día 5) es desconocido | Se asume mes natural y se avisa |
