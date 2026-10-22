# TASK-022 — Revalidación focal DEV preparada

## Conciliación de la ejecución anterior

La persona usuaria informó una conciliación remota **de solo lectura** con
`TASK022_FUNCTIONAL_PREFLIGHT_PASS` y `TASK022_READ_ONLY_CLEAN_STATE_PASS` para el
runId `5597e6db-ddfb-43fa-8b99-5a8406a6ab16`: `resources=14`, `residue=0`,
ledger `stage=cleaned`. Se registra como **PASS de conciliación informado**; no se
repitió la conexión a DEV en esta preparación. Los tres escenarios Chromium
aprobados y las pruebas RPC del run anterior conservan su evidencia. Falta
revalidar el escenario «RECEPTION puede leer; PROFESSIONAL y otro centro no
acceden» porque la antigua aserción dependía sólo del HTTP 404.

## Plan focal fijado

- Proyecto: `salud-plus-turnos-dev`, ref `ehllxymqyzrofydrvtzo`, base y rol
  `postgres`, 24 migrations esperadas.
- RunId nuevo: `952b509b-2c03-42b6-849f-a15822b1905e`.
- Plan local: `.task022-functional-dev/focused-plan.json`, SHA-256
  `0DAE3BFB6EACD63422F3F7B1A9A921F99B9C55B02CEB4E502EE4FD8A4427B476`.
- Límite exacto: **4 Auth, 2 centros, 1 PatientCenter, 1 turno**, más 4 usuarios
  públicos, 3 membresías, 1 profesional, 1 vínculo profesional-centro, 1
  especialidad, 1 vínculo profesional-especialidad y 1 persona. Todos los
  recursos propios tienen UUID reservado en el plan y luego en el ledger.
- Roles: RECEPTION y PROFESSIONAL en el centro A; ADMIN en el centro B; una
  identidad Auth sin membresía. El paciente y el turno CONFIRMED futuro
  pertenecen sólo al centro A.

El plan conserva sólo datos sintéticos con marcador de runId. El gate exige su
hash y un runId distinto del anterior; verifica ausencia de conflictos de UUID
y correo antes de crear identidades. Usa un ledger y reporte separados
(`focused-ledger.json`, `focused-report.json`), por lo que no sobrescribe la
evidencia previa.

## Alcance y gates

El preflight existente valida identidad, endpoint, conexión, 24 migrations,
firma y privilegios de la RPC, RLS/SELECT e inventario de 14 recursos. Antes de
escribir, el modo focal vuelve a comprobar que el run anterior sigue sin
residuos y que el inventario coincide con su baseline.

El ejecutor crea las cuatro identidades sintéticas por Auth Admin y las filas
relacionadas en una transacción PostgreSQL. Reutiliza los controles de
ownership, la eliminación exacta por UUID en orden inverso, la verificación de
metadata Auth `gate/runId`, la ausencia de residuos y el postflight de 14
recursos. Sólo ejecuta por `--grep` el escenario Chromium pendiente. La prueba
exige lectura positiva de RECEPTION y, para PROFESSIONAL, adminB y unlinked,
página de denegación renderizada, ausencia del nombre/documento/email fixture
en el HTML, ausencia de ficha, listado y acciones administrativas, y `noindex`
si Next respondió 200 por streaming. Guarda resultado por actor y código HTTP
sin guardar cuerpos de respuesta ni credenciales.
Playwright usa `.task022-functional-dev/focused-playwright-results/` para no
sobrescribir el error-context de la ejecución anterior.

El ledger focal conserva inventario inicial y final (cantidad y digest de IDs
por recurso), UUIDs verificados ausentes, resultado por actor y etapas de
cleanup. El reporte replica esos campos. `PASS` exige la prueba Chromium y el
cleanup/postflight completos. En caso de escritura ambigua, no se reintenta ni
se lanza cleanup separado automáticamente; sólo se permite `focused-reconcile`
de lectura hasta una nueva decisión.

## Comprobaciones locales y revisión focal

`focused-local` PASS: hash, runId, contrato local, límites `4/2/1/1` y selector
Chromium único. `node --test scripts/task022-functional-dev/plan.test.mjs`:
4/4 PASS. Prueba focal de la ruta Pacientes: 9/9 PASS. TypeScript y ESLint
focal PASS. La revisión del flujo confirma que el modo focal no ejecuta las
otras tres pruebas Chromium ni los checks RPC extensos anteriores; que las
credenciales sólo se solicitan mediante entrada oculta en PowerShell; que el
servidor Next aislado usa puerto 31009 sin reutilizar el de VS Code; y que el
reporte anterior no se sobrescribe ni siquiera ante fallo de preflight. Este
dictamen es **PASS estático/local**, no PASS funcional DEV.

## Comando histórico del segundo run, ya ejecutado una vez

Desde la raíz del repo, en la terminal local del usuario:

```powershell
.\scripts\task022-functional-dev\run.ps1 -Mode focused-run -ConfirmProjectRef ehllxymqyzrofydrvtzo -ConfirmRunId 952b509b-2c03-42b6-849f-a15822b1905e
```

El comando anterior fue autorizado y ejecutado una vez por la persona usuaria.
**No repetirlo**: el ledger de ese runId existe y conserva su evidencia. El
wrapper solicitó la contraseña PostgreSQL DEV y la secret key Auth Admin por
entrada oculta. Un cleanup separado posterior o un nuevo run con escrituras
requieren autorización nueva. No aplicar migrations ni acceder a PROD.

## Segundo run focal: fallo de selector y cleanup verificado

La persona usuaria ejecutó una sola vez el plan autorizado con runId
`952b509b-2c03-42b6-849f-a15822b1905e`. El reporte local registra
`TASK022_FUNCTIONAL_PREFLIGHT_PASS`, `status=BLOCKED` y ledger `stage=cleaned`.
Se crearon 4 identidades Auth, 2 centros, 1 paciente y 1 turno, además de las
relaciones previstas. Chromium falló en la primera aserción de RECEPTION; no
llegó a observar a PROFESSIONAL, adminB ni unlinked y `browserEvidence=null`.

El `error-context.md` muestra el diálogo «Administrar paciente» abierto con
«Turnos» seleccionado, un turno futuro visible y el nombre del paciente en el
listado. `openPatient()` activaba «Turnos» antes de comprobar el nombre. El
primer match global de `getByText("Task022 Patient A").first()` era el `<dd>` del
panel «Datos del paciente», oculto por `hidden`. El fallo es del selector del
test; la evidencia no muestra un defecto de renderizado ni una exposición de
datos a los actores denegados.

El test ahora comprueba que el diálogo y la pestaña inicial estén visibles,
verifica el nombre dentro de «Datos del paciente», activa «Turnos» y comprueba
el turno dentro de ese panel. El test de componente reproduce el nombre visible
en Datos y oculto en Turnos. Vitest focal 28/28, TypeScript, ESLint, Prettier y
`node --check` PASS. Review independiente: PASS estático focal de la corrección
y de la evidencia de cleanup; no equivale a PASS funcional DEV.

`focused-ledger.json` y `focused-report.json` contienen inventarios inicial y
final idénticos (cantidad y digest de IDs) para los 14 recursos, `residue=0`,
4 Auth ausentes, UUIDs propios ausentes y catálogo sin cambios. El gate ejecutó
esas comprobaciones antes de marcar `stage=cleaned`. Esto acredita cero residuos
al cierre del run; no se hizo una nueva lectura del estado remoto actual. Si se
necesita esa confirmación adicional, `run.ps1 -Mode focused-reconcile` es de
solo lectura y exige que el ledger y el plan correspondan a este segundo runId.
No se ejecutó aquí. La validación funcional definitiva sigue pendiente de una
nueva ejecución focal autorizada con runId nuevo y fixtures nuevos, limitada a
los cuatro actores; no repetir este `focused-run`.

## Tercer plan focal: preparado, sin conexión DEV

La revisión preventiva del único escenario pendiente comprobó que RECEPTION
abre el diálogo, selecciona explícitamente «Datos del paciente» para leer el
nombre dentro del panel visible y luego «Turnos» para leer el turno futuro y su
enlace de detalle dentro de «Próximos turnos». PROFESSIONAL, adminB y unlinked
deben ver la página 404 renderizada; se acepta HTTP 200 de streaming o 404,
pero con `noindex` si la respuesta HTTP es 200. El test exige ausencia del
nombre, documento, email y UUID del turno en el HTML, y ausencia de ficha,
listado, secciones y controles administrativos incluso ocultos. El UUID del
PatientCenter no se usa como marcador de fuga porque forma parte de la URL
solicitada y puede ser reflejado legítimamente por Next.js. El escenario no
contiene `.first()` ni selectores globales de texto para lectura positiva.

- RunId reservado: `605a2632-9453-4d56-8cad-fd19379506b2`.
- Plan: `.task022-functional-dev/final-plan.json`, SHA-256
  `6312E6D70A2F1EABD8A02D915E52621A3A4CAF6630404E1EEB8E2212E6AD34B0`.
- Límite: 4 Auth, 2 centros, 1 PatientCenter y 1 turno CONFIRMED futuro, más
  4 usuarios públicos, 3 membresías, 1 profesional, 1 vínculo a centro,
  1 especialidad, 1 vínculo profesional/especialidad y 1 persona.
- Rutas exclusivas: `final-ledger.json`, `final-report.json`,
  `final-browser-evidence.json` y `final-playwright-results/`. No existen aún;
  los archivos `focused-*` del segundo run se conservan intactos.

`final-local` vuelve a verificar hash, contrato local, límites, segundo ledger
`cleaned` con `residue=0` y 14 inventarios iguales, selector Chromium único y
ausencia de ledger/reporte/evidencia/resultados para el nuevo run. `final-run`
reutiliza el preflight DEV de solo lectura, comprueba en DEV ausencia de residuos
del segundo run y coincidencia con su baseline antes de reservar el ledger
nuevo. Sólo entonces puede crear fixtures y ejecutar por `--grep` el escenario
pendiente. El cleanup exige ownership exacto, ausencia de UUIDs y Auth, y
restauración de inventario de 14 recursos. Ante resultado ambiguo no hay
reintento automático de escritura ni cleanup separado.

Validación local: `pnpm bootstrap` PASS; `final-local` PASS; 4/4 tests de plan,
37/37 Vitest de ficha y ruta, TypeScript, ESLint, Prettier del código,
`node --check` y sintaxis PowerShell PASS. Una comprobación Chromium local
confirmó que `{ includeHidden: true }` detecta también controles ocultos. La
revisión independiente del plan, selectores, semántica 200/404 y separación de
evidencia emitió **PASS estático focal**. No representa PASS funcional DEV.

Comando preparado para una autorización futura, desde la raíz del repo en la
terminal local de la persona usuaria:

```powershell
.\scripts\task022-functional-dev\run.ps1 -Mode final-run -ConfirmProjectRef ehllxymqyzrofydrvtzo -ConfirmRunId 605a2632-9453-4d56-8cad-fd19379506b2
```

La persona usuaria autorizó y ejecutó el comando anterior una sola vez con
entrada oculta de credenciales. El resultado se registra abajo. **No repetir**
`final-run`; un nuevo intento o cleanup separado requeriría otra decisión.

## Tercer run focal: noindex duplicado y cleanup

Para el runId `605a2632-9453-4d56-8cad-fd19379506b2`, la persona usuaria
informó `TASK022_FUNCTIONAL_PREFLIGHT_PASS` y `TASK022_FUNCTIONAL_BLOCKED
stage=cleaned`. El escenario pasó la lectura de RECEPTION y llegó a la primera
página denegada con «No encontramos esta página» visible. La aserción de
`meta[name="robots"][content*="noindex"]` esperaba exactamente una coincidencia
y Chromium observó dos. El error-context conserva el conteo, pero no el `<head>`
ni los atributos de esos nodos. Por tanto, el contenido, ubicación exacta y
compatibilidad de las dos etiquetas **no quedaron observados** en ese run.

El código local de Next.js contiene emisores de `meta name="robots"
content="noindex"` tanto en la inserción de errores del servidor como en el
boundary de fallback HTTP; la duplicación es compatible con ese flujo de
streaming, pero la evidencia retenida no permite atribuir cada nodo real a un
emisor. La aplicación no define metadata `robots` propia y no hay evidencia de
un defecto en ella.

La prueba ahora consulta todos los `meta[name="robots" i]`, separa directivas
por coma y exige, mediante `expect.poll`, al menos un token `noindex` completo
sin directivas contradictorias `index` o `all`. No exige cantidad exacta ni
acepta la subcadena `noindexing`. Se mantienen la página 404 visible, HTTP
200/404, los marcadores sensibles ausentes del HTML, el DOM sin controles
administrativos incluso ocultos, y los cuatro actores. El UUID del turno
también sigue excluido del HTML denegado.

El reporte y ledger `final-*` registran 4 Auth, 2 centros, 1 PatientCenter, 1
turno y relaciones propias. Cleanup `residue=0`, 4 Auth ausentes, UUIDs propios
ausentes, catálogo sin cambios e inventarios inicial/final idénticos en los 14
recursos. `testOutcome=BLOCKED` y `browserEvidence=null`: la denegación completa
de PROFESSIONAL y los actores adminB/unlinked aún carece de PASS remoto. La
evidencia acredita cero residuos al cierre, sin lectura DEV posterior en este
diagnóstico. No se preparó otro plan ni runId.

Auditoría completa del escenario: `openPatient()` y la lectura RECEPTION están
acotados al diálogo, pestañas y región visibles. El conteo exacto de un turno
es necesario porque el plan focal crea uno; el enlace comprueba su UUID. Para
actores denegados, status 200/404, encabezado 404, HTML sin cuatro marcadores
sintéticos y ausencia de ocho áreas/acciones incluso ocultas siguen vigentes.
No queda `.first()` en este escenario ni una espera arbitraria. Riesgo residual:
los controles de adminB y unlinked no llegaron a ejecutarse remotamente y no
hay DOM/head retenido del fallo de PROFESSIONAL; tampoco se observó el estado
remoto actual después del cleanup.

Pruebas locales focales: 7/7 Node (plan y parser `robots`, incluido Chromium
con dos metas compatibles), 37/37 Vitest (ficha y ruta), TypeScript, ESLint,
Prettier y sintaxis JS PASS. Revisión independiente de todas las aserciones y
del cleanup: **PASS estático focal**, no PASS funcional DEV.

## Cuarto plan focal: preparado, sin conexión DEV

El escenario conserva las correcciones de pestañas/paneles visibles, HTTP
200/404 de streaming y parser de `robots` con múltiples `noindex` compatibles.
Para cada actor se conserva resultado, status HTTP, tipo de página y checks
sanitizados. Las cuatro sesiones Chromium son independientes; una aserción
fallida queda como `FAIL` y permite inspeccionar a los actores siguientes. El
test agrega el fallo al final y el gate rechaza evidencia incompleta o fallida.
La evidencia se guarda localmente tras cada actor y el ledger la importa aun
cuando Playwright falle. Para cada denegación se examinan tanto el HTML de la
respuesta como el DOM renderizado, sin nombre, documento, correo ni UUID del
turno; se exige ausencia de controles incluso ocultos. No se guardan mensajes
de error, HTML, cookies, JWT ni contraseñas. El presupuesto global del test es
de cinco minutos para las cuatro sesiones; no se modificaron los tiempos de
espera de las aserciones.

- RunId reservado: `9b581bb1-e2be-44e4-b33d-77efbc594982`.
- Plan nuevo: `.task022-functional-dev/closure-plan.json`, SHA-256
  `46D02A0C5D7F9DD65AE61BAE13584DD07C9229EB0568C0D41B2AAB4918565F99`.
- Límite estricto: 4 Auth, 2 centros, 1 PatientCenter, 1 turno CONFIRMED
  futuro y relaciones indispensables identificadas por UUID.
- Artefactos nuevos: `closure-ledger.json`, `closure-report.json`,
  `closure-browser-evidence.json` y `closure-playwright-results/`. Ninguno
  existía al preparar el plan. Los artefactos de los tres runs anteriores se
  conservan.

`closure-local` verifica hash, contrato local, límites, ledger del tercer run
`cleaned` con residuo cero e inventarios de 14 recursos iguales, selector
Chromium único y ausencia de artefactos del cuarto run. `closure-run` exige
además confirmación de project ref y runId, preflight DEV de solo lectura con
24 migrations, catálogo e inventario iguales al baseline del tercer run y
ausencia de todos sus UUIDs antes de crear fixtures. Sólo ejecuta el escenario
pendiente por `--grep`, limpia recursos propios y compara el inventario final
con el inicial. Ante ambigüedad no reintenta escrituras ni hace cleanup
separado automáticamente.

Preparación local: `pnpm bootstrap` PASS; `closure-local` PASS; 9/9 pruebas
Node de plan, parser robots y evidencia de cuatro actores PASS; 37/37 Vitest
de ruta/ficha PASS; TypeScript, ESLint, Prettier, sintaxis JS y PowerShell
PASS. Revisión independiente focal: **PASS estático** del escenario completo,
evidencia por actor, gate, preflight y cleanup. Esta
preparación **no es PASS funcional remoto**.

Comando reservado para una única ejecución futura autorizada en la terminal
PowerShell local de la persona usuaria:

```powershell
.\scripts\task022-functional-dev\run.ps1 -Mode closure-run -ConfirmProjectRef ehllxymqyzrofydrvtzo -ConfirmRunId 9b581bb1-e2be-44e4-b33d-77efbc594982
```

No ejecutar antes de autorización específica que incluya runId, SHA-256 del
plan, límites, único escenario, preflight, cleanup y ausencia de reintentos.

## Cuarto run focal ejecutado: gate funcional DEV PASS

La persona usuaria ejecutó una sola vez el comando `closure-run` autorizado
para `salud-plus-turnos-dev` (`ehllxymqyzrofydrvtzo`) con runId
`9b581bb1-e2be-44e4-b33d-77efbc594982`. Informó
`TASK022_FUNCTIONAL_PREFLIGHT_PASS`, `1 passed (46.9s)` y
`TASK022_FUNCTIONAL_PASS stage=cleaned`, con retorno al prompt sin error.
Esta verificación posterior leyó sólo los artefactos locales; no conectó de
nuevo a DEV. El plan conserva SHA-256
`46D02A0C5D7F9DD65AE61BAE13584DD07C9229EB0568C0D41B2AAB4918565F99`.

El ledger y reporte coinciden en proyecto/ref, base y rol `postgres`, 24
migrations con última `20261022120000`, `status/testOutcome=PASS` y
`stage=cleaned`. `closure-browser-evidence.json` coincide exactamente con la
copia del ledger y del reporte. Sus cuatro observaciones son:

| Actor | HTTP | Página | Resultado |
| --- | ---: | --- | --- |
| receptionA | 200 | Ficha abierta | PASS: nombre visible en Datos del paciente y UUID del único turno futuro autorizado en Turnos. |
| professionalA | 200 | No encontramos esta página | PASS: `noindex` válido, sin datos protegidos ni controles administrativos. |
| adminB | 404 | No encontramos esta página | PASS: sin datos protegidos ni controles administrativos; `noindex` no requerido por HTTP 404. |
| unlinked | 404 | No encontramos esta página | PASS: sin datos protegidos ni controles administrativos; `noindex` no requerido por HTTP 404. |

Cada actor conserva `failures=[]`. El validador focal del gate exige cuatro
actores en ese orden, sus resultados y checks específicos; un Playwright
fallido o evidencia incompleta no habría producido PASS.

El cleanup verificó la ausencia de todos los UUIDs exactos del plan en los 14
recursos vigilados: 4 `auth.users`/`public.users`, 2 centros, 3 memberships, 1
profesional, 1 ProfessionalCenter, 1 especialidad, 1 relación de especialidad,
1 Person, 1 PatientCenter y 1 turno; los tres recursos sin fixtures quedaron
vacíos para este run. La consulta posterior también exigió cero correos Auth
marcados por runId y cero referencias de los cuatro usuarios en
`auth.identities`, `auth.sessions` y `auth.refresh_tokens`. El ledger registra
`authUsersAbsent=4`, `residue=0`, `resourcesMatched=14` y
`catalogUnchanged=true`. Los 14 pares de cantidad y digest del inventario
final son idénticos al inventario inicial; el reporte replica ambos. Esto
acredita cero residuos de fixtures al cierre del run, más allá de
`stage=cleaned` aislado.

La primera ejecución funcional `5597e6db-ddfb-43fa-8b99-5a8406a6ab16`
conserva en su ledger ocho checks RPC PASS: proyección y cursores de ADMIN y
RECEPTION para UPCOMING/HISTORY, paciente vacío/ajeno, denegación de
PROFESSIONAL/unlinked/otro centro/anon y detalle autorizado con aislamiento.
La persona usuaria informó entonces **3 PASS / 1 FAIL** de Chromium; los tres
escenarios aprobados fueron historia paginada y DST con detalle/vacío,
navegación entre pacientes, y error con reintento. Su reporte general quedó
`BLOCKED` por la cuarta aserción. Los tres runs focales posteriores quedaron
`BLOCKED` por aserciones del test y con cleanup PASS; el cuarto cerró sólo el
escenario pendiente. No se atribuye a los ledgers un resultado individual de
los tres escenarios que éstos no almacenan.

**Dictamen formal:** gate funcional TASK-022 **PASS** con evidencia de RPC
real, Chromium autenticado, pruebas locales anteriores y cleanup exacto. El
trabajo queda listo para PR. No se repitieron pruebas remotas ni se realizó
commit, push, apertura de PR o merge en esta verificación.
