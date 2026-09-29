# TASK-005B3 — Final Design Review

**Resultado:** `PASS`
**Gate:** `DESIGN APPROVED FOR IMPLEMENTATION`
**Fecha:** 2026-09-25

## Alcance revisado

Se revisaron el diseño B3, schema, RLS, grants, helpers/RPCs tenant, provisioning idempotente,
invariante concurrente del último ADMIN y baseline persistente real de DEV. La revisión fue
documental y read-only: no se creó código, migration ni dato.

## Findings

No quedan findings abiertos ni decisiones humanas pendientes.

`B3-D1` quedó cerrada con esta regla:

```text
ProfessionalCenter
→ máximo una membership PROFESSIONAL activa
→ cero o más memberships PROFESSIONAL inactivas históricas
```

## Verificaciones finales

### 1. Modelo User ↔ ProfessionalCenter

PASS. `user_id` no se reasigna y continúa existiendo una sola membership por User-Center. La
exclusividad activa se implementará con un índice UNIQUE parcial sobre
`professional_center_id WHERE role = 'PROFESSIONAL' AND is_active`, más prechecks de dominio en las
dos RPCs que crean/reactivan/cambian el vínculo. No se permite representar delegados o cuentas
compartidas mediante este enlace.

### 2. Membership PROFESSIONAL activa/inactiva

PASS. Una activa exige PC existente, activo, same-center y sin otra membership PROFESSIONAL activa.
Una fila desactivada conserva rol y PC siempre que la operación sea una reducción pura. Puede
coexistir con otras filas inactivas históricas sobre el mismo PC. Reactivarla vuelve a aplicar todas
las condiciones activas.

### 3. Alta, rol, activación y desactivación

PASS.

- alta PROFESSIONAL: siempre activa, PC válido/activo/same-center/libre;
- cambio a PROFESSIONAL o cambio de PC: mismas validaciones;
- reactivación: mismas validaciones;
- desactivación sin cambiar rol/PC: permitida aunque el PC esté inactivo;
- cambio a ADMIN/RECEPTION: PC nulo;
- una operación no puede combinar cambios materiales y presentarse como mera reducción.

### 4. Último ADMIN y concurrencia

PASS. `admin_set_center_membership` mantiene el advisory lock por Center y la postcondición de al
menos un ADMIN activo. La unicidad profesional usa el mismo lock en caminos legítimos y un índice
UNIQUE como autoridad final. Self-demotion/desactivación sólo puede confirmar si queda otro ADMIN.

### 5. Aislamiento cross-center

PASS. La FK compuesta conserva `professional_center_id + center_id`; las RPCs validan el mismo
Center; `requireRole` y RLS se reevalúan. Ni un ID cliente ni PLATFORM_ADMIN por sí solo autorizan.

### 6. Identidad existente

PASS. Se reutilizan Auth/User sin modificar password, email, nombres ni memberships de otros
Centers. La resolución es exacta y no revela otros Centers/roles. Alta Auth/DB conserva
operation-id, fingerprint, reconciliación y compensación existentes.

### 7. Migrations necesarias

PASS. Se prevé una única migration incremental transaccional:

1. preflight de duplicados activos, abortando sin reparación automática;
2. UNIQUE parcial de asociación profesional activa;
3. reemplazo con misma firma de `admin_provision_center_user` para precheck de exclusividad;
4. reemplazo con misma firma de `admin_set_center_membership` para transiciones state-aware;
5. mismos `search_path=''`, schemas calificados, revokes y grants explícitos.

No se agregan tablas, policies, grants de tabla ni RPCs. No se esperan cambios en tipos generados,
pero se verificarán contra DEV después de aplicar la migration autorizada.

### 8. Datos profesionales

PASS. B3 no crea Professional ni ProfessionalCenter. El rol queda deshabilitado en UI si no existe
un PC real elegible. No se requieren datos ficticios persistentes.

### 9. Protección del baseline DEV

PASS. La auditoría read-only reconfirmó 1 Auth/User/PLATFORM_ADMIN/Center/membership, 0
Professional/ProfessionalCenter y 2 provisioning operations `SUCCEEDED`. Los tests usarán un run ID,
registrarán UUIDs exactos y limpiarán sólo lo creado por esa corrida. Deben verificar al final que
los IDs persistentes originales continúan intactos; no se permite cleanup global por prefijo.

### 10. Límites funcionales

PASS. B3 no incluye pacientes, Person/PatientCenter, agenda, appointments, disponibilidades,
especialidades ni CRUD completo de Profesionales. Tampoco incluye edición de identidad global,
eliminación física, cuentas delegadas ni acceso tenant por PLATFORM_ADMIN.

## Riesgos residuales aceptados

- el modelo conserva filas inactivas, pero no es una auditoría temporal completa: cambiar después
  rol/PC de la misma fila reemplaza su estado anterior;
- reasignar un PC a otro User usa dos operaciones: primero desactiva la anterior y luego activa la
  nueva. Un fallo intermedio deja cero asociaciones activas, que es seguro y reintentable;
- el error amigable depende de prechecks RPC, pero la garantía de concurrencia depende del índice
  UNIQUE parcial;
- el flujo PROFESSIONAL sólo podrá probarse con fixtures temporales hasta que exista el módulo real.

## Evidencia read-only

- branch `task/005-auth-users-center-access`;
- `pnpm bootstrap`: PASS;
- health check DEV `ehllxymqyzrofydrvtzo`: PASS;
- doce migrations local/DEV sincronizadas;
- cero duplicados activos de ProfessionalCenter en el baseline actual;
- ningún cambio bajo `supabase/migrations/` durante esta revisión.

## Dictamen

El diseño es consistente, implementable con mínimo privilegio y no tiene decisiones humanas
pendientes. La implementación requiere una instrucción posterior y su propio gate operativo.

`TASK-005B3 DESIGN APPROVED FOR IMPLEMENTATION`
