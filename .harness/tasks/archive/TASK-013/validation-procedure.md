# TASK-013 — validación visual sintética en DEV

Estado: segunda corrida autorizada `27fcd681-4cb4-4450-8644-378bf343bcbb` completada 13/13 PASS; cleanup exacto y residuo cero. Ver `validation-report.md` y `validation-ledger.json`. La primera corrida detenida se conserva en `attempts/<runId>/validation-ledger.json`.

## Destino y datos exactos

- Proyecto Supabase DEV fijo: `ehllxymqyzrofydrvtzo`. Ningún acceso a PROD.
- Un Center aislado `TASK-013 Visual <runId>`, zona `America/New_York`.
- Un usuario Auth sintético `task013-<runId>@example.test`, su fila `public.users` y un membership ADMIN del Center. Contraseña aleatoria efímera; no se guarda en el ledger.
- Dos profesionales ficticios, dos ProfessionalCenter, dos especialidades (`Clínica`, `Cardiología`) y dos asignaciones. Cinco intervalos de disponibilidad de 30 minutos: miércoles y jueves 09:00–13:00 para ambos profesionales, domingo 00:30–03:30 para el profesional A. El miércoles se elige al menos siete días después del inicio de la corrida.
- Una persona y un PatientCenter ficticios, con documento y correo sintéticos `T013-*` / `@example.test`.
- Seis turnos SQL propios: miércoles 09:00 PENDING con A, miércoles 09:00 CONFIRMED con B, miércoles 10:00 CANCELLED con A, jueves 11:00 ATTENDED con A y dos instantes distintos del domingo 2026-11-01 a la misma hora civil 01:30 (`05:30Z`, `06:30Z`) con A. El test de navegador crea **un** séptimo turno PENDING, miércoles 12:00 con A, usando el flujo normal de la app y el slot ofrecido por PostgreSQL.
- Total máximo de filas propias: 1 `auth.users`, 1 `public.users`, 1 Center, 1 membership, 2 profesionales, 2 ProfessionalCenter, 2 especialidades, 2 asignaciones, 5 disponibilidades, 1 persona, 1 PatientCenter y 7 turnos. No se editan filas preexistentes.

## Ejecución acotada

1. Verificar el ref DEV, endpoint PostgreSQL y CA ya validada por TASK-009; ejecutar probe Auth Admin de sólo lectura. Tomar inventario de 14 recursos y 23 migrations con el componente TASK-009; comprobar que los UUID y el correo planeados no existen.
2. Crear ledger nuevo con UUID propios. Crear Auth sintético con metadatos `taskId`/`runId`; insertar las demás filas en una única transacción PostgreSQL. Si una precondición falla, detenerse antes de escribir. No reutilizar ledger ni expediente consumido de TASK-009.
3. Ejecutar un solo spec Playwright contra el build local aislado (`localhost:31013`), con navegador autenticado en 1440×900 (UTC) y 390×844 (Pacific/Honolulu). Revisar Día, Semana, Mes, filtros, los dos offsets DST, búsqueda de slots por RPC, enlace al alta y preselección. Desktop crea el turno de prueba; mobile verifica otra preselección sin crear un segundo turno.
4. Guardar hasta 13 PNG (Día, Semana, Mes, DST, slot y alta preseleccionada en ambos tamaños; además, desktop tras el alta) con SHA-256 en `.harness/tasks/archive/TASK-013/evidence/<runId>/` y registrar sus nombres en `validation-ledger.json`. Capturas parciales se conservan si falla el navegador.
5. Conciliar el posible turno creado aunque se haya perdido la respuesta. Auditar cada UUID, sus vínculos y la ausencia de filas ajenas en el Center. Borrar sólo las filas propias en orden de referencias y en transacción; luego borrar el Auth sintético. Confirmar ausencia e inventario/digests iguales al baseline. Ante ownership incierto o referencias ajenas, detener el cleanup y conservar ledger para recuperación exacta.

Scripts: `scripts/task013-agenda-visual/run.ps1`, `run.mjs`, simulaciones locales en el mismo directorio y `tests/e2e/task-013-agenda.spec.mjs`. El launcher exige `-AuthorizedDevWrite`, solicita la contraseña PostgreSQL DEV mediante entrada segura y necesita `SUPABASE_SECRET_KEY` ya disponible en el entorno; no se envían credenciales por chat. En esta sesión se usa `-BrowserCredential`: abre un formulario temporal en `127.0.0.1`, acepta una sola entrega en memoria y vence sin escribir en DEV si no se completa. `-Recover` sólo opera con el ledger existente y el mismo alcance autorizado.

## Autorización original

Autorizar una única ejecución en el proyecto DEV indicado para crear esos datos sintéticos, completar el flujo de reserva y borrar exactamente los registros propios, incluyendo recuperación si la ejecución se interrumpe. La autorización no incluye migraciones, RLS, permisos, PROD, modificaciones de datos ajenos, commit ni push.

La segunda corrida tuvo autorización expresa del usuario y completó la validación poblada. Sus 13 capturas fueron inspeccionadas y cotejadas contra las huellas del ledger.

## Primera corrida autorizada — 2026-10-21

- El preflight y el inventario DEV pasaron. Se creó un Auth sintético y se inició la transacción de fixture. El insert de `public.users` falló porque faltaba la columna obligatoria `email`; la transacción se revirtió.
- El cleanup borró el Auth propio. El ledger confirma `stage=cleaned`, `authDeleted=true`, `residueZero=true` e `inventoryRestored=true` contra los 14 recursos iniciales. No quedaron filas propias; se ejecutaron 0/13 escenarios y no hay capturas pobladas.
- Se corrigió el insert local para usar el correo sintético del Auth y se reforzó la simulación del contrato `public.users.email`. La corrida consumida no se reusa ni se repite automáticamente.
