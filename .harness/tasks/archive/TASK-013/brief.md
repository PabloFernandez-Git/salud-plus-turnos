# TASK-013 — Agenda visual

## Contexto

PR #12 y #13 están integrados en `main`. Los archivos locales sin seguimiento de
`.harness/tasks/active/TASK-010/` pertenecen a un ajuste previo de Usuarios con el
mismo número; se conservan íntegros. TASK-011 y TASK-012 también están asignadas.
El siguiente identificador libre para Agenda es TASK-013.

## Objetivo y alcance aprobado

Iniciar la Agenda operativa usando React Big Calendar (decisión 10), los contratos
de lectura de TASK-009 y la zona horaria del Center. La Agenda completa comprende
Día (profesionales como columnas y slots libres), Semana (días como columnas,
simultaneidad visible), Mes (resumen por día), filtros de profesional, especialidad
y estado, navegación al detalle y alta desde un slot. ADMIN/RECEPTION ven el
Center; PROFESSIONAL sólo sus turnos. CANCELLED no ocupa la Agenda activa.

## Criterios de aceptación del primer corte local

- Ruta tenant protegida, accesible desde la navegación del Center, con Día, Semana
  y Mes y navegación temporal.
- Lectura paginada y completa del rango visible mediante los RPC existentes, sin
  consultar datos de otro Center ni proyectar la nota administrativa al rol
  PROFESSIONAL.
- Horas y fechas interpretadas en la zona del Center, incluso cuando el navegador
  usa otra zona. Día organiza por ProfessionalCenter; Semana conserva días como
  columnas; Mes resume actividad y abre el día.
- Filtro de profesional para staff, filtro de estado y acceso al detalle. CANCELLED
  se oculta por defecto; puede verse con filtro explícito.
- Estados de carga vacía/error y ancho pequeño operable con scroll horizontal.
- Tests focalizados, lint, typecheck y revisión del diff. Evidencia de TASK-009
  Gate D se reutiliza; no se repite el runner remoto.

## Riesgos, impacto y pendientes del corte

El renderer de React Big Calendar utiliza `Date` del navegador; hay que mapear
instantes a hora civil del Center para mostrar DST y zonas distintas. Los RPC de
listado aceptan máximo 31 días y 50 filas por página; un Mes requiere paginación.
La lista PROFESSIONAL omite el identificador de ProfessionalCenter, que proviene
del contexto autenticado. Un fallo de lectura no debe mostrar un calendario
parcial. No hay cambios de DB/RLS, migrations, permisos ni tooling.

Quedan para completar TASK-013: filtro de especialidad por ID (el listado actual
sólo devuelve nombre), slots libres respaldados por la RPC de disponibilidad y
preselección segura en el alta. No se simularán slots con la grilla del calendario.

## Continuación autorizada y estado

La continuación aprobada comprende esos tres pendientes, comportamiento de las
vistas Día/Semana/Mes, tratamiento explícito de DST y validación visual
autenticada desktop/mobile. La implementación local y sus verificaciones están
registradas en `implementation-report.md`; el expediente original del primer
corte se conserva arriba. La tarea sigue abierta porque el Center DEV accesible
no contiene datos reservables ni turnos para completar la validación visual
de slots y eventos reales.

## Resultado de la validación autorizada

Un Center aislado con datos sintéticos permitió completar 13/13 escenarios autenticados en desktop/mobile y revisar las capturas pobladas. Los dos defectos visuales encontrados se corrigieron y comprobaron localmente. El inventario DEV volvió al baseline con residuo cero; `validation-report.md` conserva el informe. No quedan criterios de aceptación pendientes.

## Ajuste visual final solicitado (2026-10-21)

Comprobar legibilidad y acceso al detalle de turnos breves, acceso evidente a
todas las columnas mobile, posición horaria inicial útil conservando las 24
horas y selector largo sin overflow. Alcance exclusivamente de presentación;
validar el componente real con datos sintéticos locales y conservar capturas.
Reutilizar el 13/13 DEV y su cleanup sin acceso remoto adicional. Riesgos:
recorte de simultáneos, columnas inaccesibles y horarios fuera del viewport;
la lista legible, las flechas y el scroll horario deben resolverlos sin alterar
contratos, disponibilidad ni autorización.
