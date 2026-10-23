# TASK-021 — Contrato propuesto del Dashboard operativo

**Estado:** especificación documental del 2026-10-22. Las reglas funcionales están aprobadas;
los nombres y la forma técnica de las RPC son propuesta para el gate de implementación. No
contiene SQL ejecutable ni autoriza crear o aplicar una migration.

## Alcance y fórmulas

Sea `C` el Center activo, `Z = centers.timezone`, `T` el instante de referencia de PostgreSQL
y `D = (T AT TIME ZONE Z)::date`. Sea `S` el conjunto **completo** de turnos con
`appointments.center_id = C` y `(starts_at AT TIME ZONE Z)::date = D`, según sus valores
actuales. Para PROFESSIONAL, `S` se restringe además al `professional_center_id` activo
asociado a su membership en `C`. Reprogramar cambia la fecha a la que contribuye un turno;
una transición de estado cambia su único grupo. `created_at` y `updated_at` no definen hoy.

| Indicador | Fórmula sobre `S` | Alcance |
| --- | --- | --- |
| Pendientes | `count(status = PENDING)` | Todos los roles, según `S` autorizado |
| Confirmados | `count(status = CONFIRMED)` | Todos |
| Por atender | Pendientes + confirmados | Derivado en servidor de ambos conteos |
| Atendidos | `count(status = ATTENDED)` | Todos |
| Ausentes | `count(status = NO_SHOW)` | Todos |
| Turnos del día | Pendientes + confirmados + atendidos + ausentes | Todos; excluye cancelados |
| Cancelados con fecha de hoy | `count(status = CANCELLED)` | Todos; fuera del total |
| Profesionales con turnos hoy | `count(distinct professional_center_id)` para `status <> CANCELLED` | Sólo staff |
| Próximos turnos de hoy | Primeros cinco de `S` con `status in (PENDING, CONFIRMED)` y `starts_at >= T`, orden `(starts_at, id)` | Todos, según `S` autorizado |

El inicio exacto del turno sigue incluido en «próximos». Un turno empezado antes de `T`
permanece en los conteos de su estado, pero no en la lista. Los cancelados cuentan por la
fecha de su horario **actual**, aunque la cancelación haya ocurrido otro día. La cantidad de
profesionales no indica presencia real ni disponibilidad configurada. No existe en este
contrato una métrica de eventos o cambios realizados hoy.

`active_total = 0` define «ningún turno vigente del día», aun si `cancelled_count > 0`.
`active_total > 0` y `upcoming.length = 0` define «turnos registrados, pero ningún próximo
turno restante». Los turnos PENDING/CONFIRMED que empezaron antes de `T` siguen en «por
atender»; no se convierten automáticamente en ausentes ni generan una alerta nueva.

## RPC de lectura propuestas

Dos funciones públicas, de sólo lectura, con argumento único `p_center_id uuid`:

- `staff_get_daily_dashboard(p_center_id)` para membership `ADMIN` o `RECEPTION` activa.
- `professional_get_own_daily_dashboard(p_center_id)` para membership `PROFESSIONAL` activa
  y su `ProfessionalCenter` activo en el mismo Center.

No aceptan `p_role`, `p_professional_center_id`, fecha, zona horaria ni `as_of` del cliente.
Cada función retorna **exactamente una fila** cuando hay acceso, incluso sin turnos. Acceso
denegado produce error `42501`; una consulta fallida nunca produce una fila de ceros.

Campos comunes de la fila:

| Campo | Tipo propuesto | Contrato |
| --- | --- | --- |
| `as_of` | `timestamptz` | `statement_timestamp()` capturado una sola vez en PostgreSQL |
| `local_date` | `date` | Fecha civil de `as_of` en `centers.timezone` |
| `timezone` | `text` | Zona IANA leída del Center autorizado |
| `pending_count` | `bigint` | Conteo completo, cero si el conjunto autorizado está vacío |
| `confirmed_count` | `bigint` | Ídem |
| `attended_count` | `bigint` | Ídem |
| `no_show_count` | `bigint` | Ídem |
| `cancelled_count` | `bigint` | Ídem; fuera del total principal |
| `upcoming` | `jsonb` | Array ordenado de 0 a 5 filas; `[]`, nunca `null` |

La fila staff agrega `professional_centers_with_appointments_count bigint`. La fila
professional **no** contiene ese campo ni ningún agregado del Center completo. `active_total`
y `to_attend` se derivan de los conteos comunes en el servicio del módulo, donde se validan
también las invariantes. Los `bigint` se convierten a número de UI sólo tras validar que son
enteros no negativos y representables de forma segura.

Cada elemento `upcoming` contiene `appointment_id`, `starts_at`, `ends_at`, `status`
(`PENDING` o `CONFIRMED`), `patient_first_name`, `patient_last_name` y `specialty_name`.
**Sólo staff** añade `professional_center_id`, `professional_first_name` y
`professional_last_name`. No se incluyen `patient_center_id`, documento, teléfono, email,
observación administrativa, token de actualización ni datos de otros centros. El adaptador
server-only valida estrictamente la forma y cardinalidad de cada proyección antes de pasarla
a la UI. La fecha/hora de presentación usa `timezone`; en una hora repetida por DST se
indica el desplazamiento UTC para distinguir instantes.

## Consulta y consistencia previstas

- Obtener autorización, `T`, `Z`, `D`, conteos y próximos en **una sola fotografía MVCC**
  dentro de cada RPC. El diseño de implementación preferido es una función `STABLE`, como
  los listados actuales, con una sentencia autorizada que derive todos esos valores.
  No usar una función `VOLATILE` con SELECT separados bajo `READ COMMITTED`: podría
  observar una revocación o desactivación entre el chequeo y la lectura y mezclar estados.
  `T` no se recalcula entre agregados y lista; tampoco se consultan los cinco estados con
  llamadas independientes.
- Partir de los turnos del Center y fecha local autorizados una sola vez; agregar todos los
  estados sin paginar y seleccionar cinco próximos del mismo conjunto. `LIMIT 5` limita
  sólo la lista, jamás el conjunto de los conteos.
- Los conteos se calculan sobre `appointments`, sin depender de joins a nombres. La
  proyección de los cinco próximos puede resolver paciente, profesional y especialidad,
  pero no debe exigir que sus vínculos sigan activos: un turno histórico conserva lectura
  aunque hoy se haya desactivado una entidad relacionada. Si falla una relación que el
  esquema garantiza, se trata como error de integridad, no como turno inexistente.
- Usar límites UTC conservadores sobre `starts_at` para aprovechar índices, seguidos de la
  comprobación exacta de fecha civil en `Z`, como los RPC existentes. No calcular el fin del
  día como `T + interval '24 hours'`: el día local puede durar 23 o 25 horas. El predicado
  local incluye la fecha completa y el corte de próximos usa el instante `T`.
- Los índices existentes `appointments(center_id, starts_at)`,
  `appointments(professional_center_id, starts_at)` y
  `appointments(center_id, status, starts_at)` son el punto de partida. No se propone índice
  nuevo sin medir un plan y volumen representativos en el gate posterior.
- La respuesta es una fotografía al momento `as_of`, no una suscripción en tiempo real.
  Tras mutaciones, cambio de Center/rol, vuelta a la pestaña y paso de medianoche local se
  solicita una lectura nueva; la hora del navegador sólo dispara el refresco, no define
  `T` ni `D`. Un error de actualización no permite presentar cifras viejas como actuales.

## Autorización y aislamiento

- La ruta valida UUID, sesión, Center activo y membership activa. El servicio del módulo
  revalida el rol y, para PROFESSIONAL, usa `requireProfessionalContext` antes de llamar a
  la función correspondiente. El rol nunca se decide a partir de un parámetro del cliente.
- Cada RPC vuelve a verificar `auth.uid()`, Center activo, membership activa y rol admitido.
  La función profesional obtiene internamente el `professional_center_id` activo de esa
  membership, exige que pertenezca al mismo Center y lo aplica al conjunto de turnos.
  `PLATFORM_ADMIN` por sí solo no concede acceso tenant.
- El contrato futuro debe seguir el patrón de RPC estrecha `SECURITY DEFINER`, con
  `search_path` fijo y referencias de esquema explícitas, sin ampliar SELECT directo sobre
  `appointments` ni el acceso del navegador. Ejecutable sólo por `authenticated` tras la
  revisión de permisos del gate de migration. No usar `service_role`.
- Denegación de acceso se trata como tal; fallo de PostgreSQL o de validación de contrato
  se presenta como error seguro. No traducir fallos internos a 404 ni a números cero.

## UI y estados

Orden fijo: **Actividad de hoy** con fecha civil y «Actualizado a las HH:mm» → **Próximos
turnos de hoy** → **¿Qué querés hacer hoy?** con `CenterNavigation` existente. Conservar
`CenterHeader`, nombre/identidad/rol, logout, rutas y visibilidad por rol, ancho de hasta
1400 px, tarjetas actuales y diseño responsive. No duplicar accesos rápidos.

- Carga inicial: placeholder accesible de actividad; nunca ceros provisionales. La
  navegación puede mantenerse visible mientras carga el resumen.
- `active_total = 0`: «No hay turnos vigentes para hoy». Cancelados, si existen, se
  informan aparte. Las tarjetas aprobadas mantienen el acceso a Turnos/Agenda según rol;
  no se añaden accesos rápidos duplicados.
- `active_total > 0 && upcoming.length = 0`: «No quedan próximos turnos de hoy»; los
  conteos siguen visibles. Esto incluye turnos ya atendidos/ausentes y turnos abiertos
  cuyo inicio pasó.
- Error: mensaje «No pudimos cargar la actividad», control Reintentar y navegación
  conservada; no mostrar `0` ni reutilizar silenciosamente una fotografía anterior.
- Refresco: botón «Actualizar», hora de `as_of` en zona del Center y recarga al volver a
  la pestaña o cruzar medianoche local. Descartar una respuesta tardía de otro Center.
- Las cifras y paneles no son enlaces ficticios. Los turnos próximos enlazan al detalle
  autorizado; la Agenda y Turnos se alcanzan desde las tarjetas aprobadas. Foco visible,
  orden de lectura lógico, encabezados semánticos y estado/error anunciados sin depender
  sólo de color.

La ausencia de pacientes o profesionales activos **no se deduce** de la ausencia de turnos.
Un onboarding específico requeriría una lectura de existencia adicional y queda fuera del
corte operativo aprobado.

## Escenarios de prueba del futuro gate

1. Conteos de los cinco estados, fórmula del total, cancelación separada y desglose por
   atender; cero filas y caso sólo cancelados.
2. Más de 50 turnos el mismo día: los conteos incluyen todos; cinco próximos exactos con
   empate de `starts_at` resuelto por ID. Ningún límite de página afecta el agregado.
3. Turno abierto iniciado antes de `as_of`, otro exactamente en `as_of`, uno después y uno
   del día siguiente: conteos y próximos cumplen sus predicados.
4. Reprogramación entre días y transición de estado: la nueva fotografía usa horario y
   estado actuales, sin atribuir actividad al día de la mutación.
5. Medianoche, zonas IANA distintas para dos centros, día DST de 23 horas y día de 25
   horas, incluida hora repetida con desplazamiento visible.
6. ADMIN y RECEPTION de A ven sólo A; PROFESSIONAL de A ve sólo su vínculo; otro
   profesional de A, miembro de B, desactivados, no vinculado y PLATFORM_ADMIN sin
   membership son denegados o no filtran datos ajenos. Inspeccionar el payload completo.
7. Mutación concurrente durante la lectura: conteos y próximos corresponden a la misma
   fotografía; cambios posteriores aparecen tras Actualizar, no a medias.
8. Fallo de consulta, error `42501`, contrato inválido y refresco fallido: resultados
   diferenciados, sin ceros falsos ni datos previos presentados como actuales.
9. UI 1440 px y 390 px, teclado, lector de pantalla básico, enlaces por rol, carga/vacíos,
   cambio de centro y actualización tras volver a la pestaña.

El gate de implementación incluirá pruebas unitarias y de componentes cerca del módulo,
pruebas SQL/RPC de autorización y consistencia, verificación visual local y review. Cualquier
conexión o aplicación en DEV requerirá el procedimiento autorizado de esa etapa; PROD queda
fuera del alcance.
