# Implementación — primer corte local

## Sincronización y preservación

- `git fetch origin main`, cambio a `main` y fast-forward `7d7bee0` → `a1e362a`.
- El hash SHA-256 original de `next-env.d.ts` es
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
  `next build` lo regeneró; se restauró exactamente ese contenido y hash.
- Se preservaron sin cambios los doce archivos locales de TASK-010/011/012.
  TASK-010 local describe un espaciado de Usuarios; este expediente de Agenda
  se trasladó sin pérdida a `TASK-013`, el siguiente identificador libre.

## Producto

- Ruta `/centers/[centerId]/agenda` con autorización tenant para los tres roles.
- Día por ProfessionalCenter, Semana por días y Mes con resumen y navegación a Día.
- Filtros de ProfessionalCenter activo para staff y estado; CANCELLED oculto por
  defecto. Click en un turno lleva al detalle existente.
- Servicio de lectura sobre RPCs de TASK-009, 50 registros por página, máximo
  explícito de 100 páginas. No se muestran datos parciales si falla una página.
- Fechas/horas de eventos proyectadas a hora civil del Center. Una hora que cae
  en un salto DST del navegador no se coloca en una franja equivocada: aparece
  en lista con hora civil y enlace al detalle; Mes la cuenta. UI con scroll
  horizontal en anchos menores. Navegación de Center enlaza Agenda.
- Sin DB, RLS, migrations, Actions, Route Handlers ni cambios de tooling.

## Verificación local

- `pnpm bootstrap`: PASS.
- Vitest focal: 13/13 PASS (parser/fechas, DST gap, paginación, ruta tenant y
  renderer Mes/fallback).
- ESLint focal, `pnpm typecheck`, Prettier focal y `git diff --check`: PASS
  después del último test de renderer.
- `pnpm build`: PASS, ruta dinámica de Agenda incluida.
- Review independiente: primer dictamen CHANGES_REQUESTED por DST gap;
  corrección y re-review focal con PASS del primer corte.
- Gate D de TASK-009 no se repitió: se reutiliza su evidencia PASS de Auth/RLS/RPC,
  DST, carreras y Playwright/cleanup, ya que este corte no cambió sus contratos,
  DB ni permisos.

## Pendiente

La validación visual autenticada de slots reales y turnos con DST sigue
pendiente por falta de datos reservables en el único Center DEV accesible.
TASK-013 permanece abierta.

## Continuación funcional

- Se usa `TASK-013` como identificador definitivo. El expediente original de
  TASK-010 Usuarios y los archivos TASK-011/012 no se modificaron.
- El filtro de especialidad recibe un ID, lo resuelve con el catálogo reservable
  autorizado y filtra en servidor por el nombre único del Center después de
  leer todas las páginas. No cambia RPC, migraciones, RLS ni permisos.
- Día y Semana permiten señalar una franja. La grilla sólo inicia la búsqueda;
  `BookingSelector` reutiliza `staff_search_appointment_slots` y Availability
  de TASK-009, y sólo un slot devuelto habilita continuar a Crear turno.
- El enlace pasa Center, especialidad, ProfessionalCenter, fecha civil e instante.
  Crear turno reconsulta PostgreSQL antes de preseleccionar; un slot vencido se
  descarta y se informa. Una denegación PostgreSQL `42501` retorna 404.
- Las horas de evento ambiguas por DST del Center o navegador aparecen fuera
  de la grilla con desplazamiento UTC; el selector de slots indica el
  desplazamiento calculado desde la respuesta civil de PostgreSQL. La
  preselección automática se aplica una sola vez y respeta cambios del usuario.
- Se corrigió el contraste del botón de vista activa detectado en browser.

## Verificación de la continuación

- `pnpm bootstrap`: PASS al iniciar este trabajo.
- Vitest focal: 39/39 PASS en 9 archivos; incluye filtro por ID, paginación,
  navegación entre Día/Semana/Mes, selección de slot y alta preseleccionada.
- ESLint focal, `pnpm typecheck`, `git diff --check`: PASS.
- `pnpm build`: PASS; se restauró `next-env.d.ts` a su hash SHA-256 original
  `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`.
- Browser autenticado con rol ADMIN en DEV: Día, Semana y Mes revisados en
  1440×900 y 390×844; Mes abrió Día correctamente. Se corrigió y volvió a
  comprobar el contraste de la vista activa. El único Center visible no tiene
  especialidades ni profesionales reservables ni turnos, por lo que esta
  corrida sólo valida el estado vacío y la navegación responsive.
- No se repitió Gate D de TASK-009: siguen vigentes sus contratos y evidencia.

## Preparación de validación sintética

- Se preparó una corrida única para el Center DEV aislado, con ledger y UUID propios, Auth sintético, seis turnos de muestra, disponibilidad de dos profesionales y un alta real desde el slot devuelto por PostgreSQL. El alcance fila por fila y la autorización necesaria están en `validation-procedure.md`.
- Se reutilizan únicamente los componentes de conexión DEV, inventario/huellas y escritura atómica de ledger de TASK-009. Sus expedientes y fixtures consumidos no se tocan.
- La simulación local de transacciones, éxito, rollback, CREATE con respuesta perdida y negativa de cleanup ante una referencia ajena pasó 7/7. El spec Playwright enumera 13 escenarios independientes para desktop y mobile y conserva hasta 13 PNG con hashes, incluso parciales si falla el navegador. Un test de componente verificó los selectores horarios contra el DOM renderizado (3/3 focal); PowerShell 5.1 analizó el launcher y rechazó una invocación sin autorización.
- ESLint focal y `pnpm typecheck` pasaron. No se ejecutó el spec contra DEV ni se escribió en Supabase; la validación visual poblada, el cleanup remoto y el cierre siguen pendientes de autorización.

## Intento autorizado de validación DEV

- El usuario autorizó una única corrida de hasta 26 filas sintéticas y 13 escenarios. Se añadió al mismo launcher PowerShell 5.1 una entrada temporal por formulario de navegador interno, ya que los prompts de ventanas Windows no eran visibles desde esta sesión. El formulario se enlazó sólo a `127.0.0.1`, admitía un envío y no persistía la contraseña; su simulación local pasó junto con las otras siete pruebas (8/8).
- El formulario venció tras diez minutos sin recibir la contraseña. El proceso terminó antes de iniciar `run.mjs`: **0/13 escenarios ejecutados, ningún fixture creado, ningún acceso DEV y ninguna captura poblada**. No existe `validation-ledger.json` ni directorio de evidencia; no quedó proceso de runner activo. Por tanto, no hubo cleanup remoto que ejecutar ni inventario final que comparar. No se inició una segunda corrida.
- `next-env.d.ts` conserva SHA-256 `0F70629890B72A0A82E91972CC032C04B658B26C265373CB711CF576BFBF8FCC`. TASK-013 sigue abierta, bloqueada sólo por la entrega segura de la credencial humana para la ejecución autorizada.

## Primera corrida DEV autorizada — 2026-10-21

- RunId `4a8f9648-3820-4dc4-9ceb-ff755d4e32b0`, ledger conservado en `attempts/<runId>/validation-ledger.json`. El build de producción y preflight pasaron; el inventario inicial de 14 recursos y 23 migrations quedó registrado.
- La transacción del fixture falló en `public.users.email` obligatorio. Se revirtió completa; el Auth sintético propio fue eliminado. Cleanup `stage=cleaned`, `residueZero=true`, `inventoryRestored=true` y `authDeleted=true`. No hubo eventos ni slots poblados, escenarios Playwright 0/13, capturas 0/13.
- Se corrigió sólo el fixture local para insertar `ledger.authEmail`, de acuerdo con la migration existente, y la simulación ahora exige ese correo. Simulación de base 2/2, ESLint y Prettier focal PASS. `next-env.d.ts` mantiene su SHA-256 original.
- No se inició otra corrida. El ledger consumido está archivado y el launcher queda disponible para un runId nuevo sólo bajo nueva autorización expresa. TASK-013 sigue abierta hasta los 13 escenarios, revisión visual y cleanup de la nueva corrida.

## Segunda corrida DEV autorizada y revisión visual

- RunId `27fcd681-4cb4-4450-8644-378bf343bcbb`: build PASS, 13/13 Playwright PASS en 1440×900 y 390×844. Día, Semana, Mes, filtros, DST repetido, slots PostgreSQL y preselección funcionaron. CREATE con respuesta perdida se reconcilió con una sola escritura. El detalle de cada escenario y las 13 capturas está en `validation-report.md`.
- Las 13 imágenes pasaron la comprobación SHA-256 del ledger. Cleanup `stage=cleaned`, `authDeleted=true`, `residueZero=true`, `inventoryRestored=true`: los 14 inventarios y 23 migrations se conservaron.
- La inspección visual detectó recorte vertical del texto de turnos de 30 minutos y overflow horizontal del selector largo en mobile. Se corrigió sólo la presentación. Chromium local comprobó ancho 390/390 px y evento de 16 px dentro de 20 px; Vitest focal 7/7, lint, formato, typecheck y build PASS. No se repitió la corrida DEV porque no cambiaron sus condiciones funcionales.
- `next-env.d.ts` conserva el hash original. Sin PROD, migrations, RLS, permisos, commit, push ni merge.

## Ajustes finales de experiencia visual (2026-10-21)

Componente/CSS: eventos de dos líneas y ~46 px por 30 minutos, lista desplegable
con nombres completos y enlaces, activación por Enter/Espacio, flechas por columnas
completas y grilla de altura acotada con scroll inicial cerca del primer turno.
Conserva las 24 horas, el scroll nativo y toda la lógica de selección y disponibilidad.

El script puntual `scripts/task013-agenda-visual/local-visual.mjs` usa las dependencias
ya instaladas y props sintéticas para renderizar el componente real sin Supabase.
6/6 combinaciones desktop/mobile PASS, 12 capturas finales, comprobación de columnas,
horarios extremos, selector largo y navegación al detalle. 7/7 pruebas de componentes,
lint focal, formato, tipos, build y diff check PASS. Review focal PASS y documentación
del módulo actualizada. Evidencia y limitaciones en `validation-report.md`.
No se repitió DEV ni TASK-009; los expedientes consumidos permanecen intactos.

## Cierre

Con review PASS y criterios del brief completos, se movió el expediente de
`tasks/active/TASK-013` a `tasks/archive/TASK-013`. Se conservan localmente
ambos ledgers consumidos y las capturas anteriores; sólo el informe y las 25
capturas sintéticas vigentes se preparan para Git. Las rutas documentales y los
scripts históricos apuntan al archivo. La retrospectiva y `docs/status.md`
registran el cierre. TASK-010/011/012 permanecen intactas y `next-env.d.ts`
conserva su SHA-256 anterior.

## Corrección focal del CI del PR

El primer `verify` del PR #14 falló sólo en las tres expectativas de navegación
de `center-navigation.test.tsx`: la ruta Agenda ya estaba presente para ADMIN,
RECEPTION y PROFESSIONAL, pero el test aún esperaba las listas anteriores.
Los otros 624 tests pasaron. Se actualizaron esas expectativas y se comprobó
el destino `/centers/<centerId>/agenda`; la suite focal pasó 3/3, con formato y
ESLint focal PASS. No cambió el componente ni la lógica funcional.
