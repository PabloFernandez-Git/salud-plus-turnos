# TASK-PORTFOLIO-GUEST — acceso invitado local

## Objetivo

Preparar en `codex/portfolio-mvp` sesiones Supabase Auth anónimas individuales para la demo ficticia, sin activar el registro público ni modificar DEMO, DEV, `main` o TASK-029.

## Criterios de aceptación

- El botón «Explorar demo como invitado» sólo se ofrece con un flag explícito de DEMO y reutiliza una sesión existente.
- Una alta anónima crea exactamente un perfil y una membership en el único centro DEMO mediante SQL privilegiado, sin grants de escritura al cliente.
- Auth rechaza nuevas altas no anónimas mediante un hook y la base mantiene un rechazo defensivo.
- Dos invitados distintos leen DEMO y no leen perfiles ni memberships del otro, ni otro centro.
- DML público, RPC sensibles y acciones web de escritura siguen rechazados.
- La limpieza antigua está acotada por edad, cantidad, tipo de cuenta y relaciones FK.
- Existe checklist de activación con límites, CAPTCHA y pruebas negativas; ningún paso remoto se ejecuta en esta fase.
- Login normal fuera de DEMO y pruebas focales pasan.

## Riesgos e impacto

- Auth: habilitar signup global sin el hook permitiría cuentas no autorizadas. El orden de activación debe ser fail closed.
- Seguridad/DB: una membership ADMIN permite las RPC de lectura existentes, pero la RLS debe impedir exposición cruzada de identidades invitadas.
- Datos: `public.users.email` no admite NULL; DEMO requiere un identificador sintético exclusivo para Auth anónimo y limpieza con FK `RESTRICT`.
- Costos: cuentas anónimas acumulan Auth/MAU; se necesitan límites, observación y limpieza.
- Superficie: login DEMO, módulo access, migración sólo DEMO, SQL de limpieza, tests y documentación DEMO. Fuera de DEMO no cambian rutas ni Auth.
