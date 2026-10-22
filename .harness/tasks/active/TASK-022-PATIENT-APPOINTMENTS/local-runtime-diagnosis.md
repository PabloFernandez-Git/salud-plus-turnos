# Diagnóstico local de PostgreSQL — TASK-022 (2026-10-22)

## Resultado

**Bloqueado antes de ejecutar SQL.** Docker Desktop muestra el motor `stopped`; `docker version` no puede conectar al daemon. El backend configurado es Linux/Hyper-V (`WslEngineEnabled=false`), no WSL. El log de `com.docker.backend.exe` registra que `DockerDesktopVM` no pudo reservar **2048 MB de RAM**: Windows devolvió `0x800705AA` («Recursos insuficientes en el sistema para completar el servicio solicitado»). La UI y `com.docker.service` estaban activos, pero eso no implica que el motor Linux haya iniciado.

## Evidencia focal

- `docker context ls`: contexto activo `desktop-linux`, pipe `dockerDesktopLinuxEngine`.
- `docker desktop status`: `stopped` antes y después de un único `docker desktop start`; la CLI respondió «already running» por la UI, y `docker version` siguió devolviendo «Docker Desktop is unable to start».
- `settings-store.json`: `WslEngineEnabled=false`, `UseWindowsContainers=false`. Los logs identifican expresamente `engine linux/hyperv` y el fallo de asignación de RAM.
- `wsl --status`: versión predeterminada 2, pero kernel WSL 2 ausente; `wsl --list --verbose`: ninguna distribución instalada. Es una vía alternativa no disponible y no la causa inmediata del backend Hyper-V configurado.
- La memoria libre observada era ~3,06 GB de 13,88 GB, pero Hyper-V rechazó la reserva de 2048 MB. No se infiere que baste una cifra de RAM libre de `Win32_OperatingSystem` para iniciar esa VM.
- `pnpm exec supabase --version`: CLI local 2.117.0; `supabase start --help` confirma que inicia contenedores locales. No hay `psql`, `pg_ctl`, `initdb` ni instalación nativa de PostgreSQL en `C:\Program Files\PostgreSQL`.

## Alternativas evaluadas

- Supabase CLI local: requiere contenedores; no puede operar con el daemon detenido.
- WSL 2: no tiene kernel ni distribución. Habilitarla/actualizarla sería un cambio global de Windows/WSL no realizado.
- PostgreSQL nativo o incompleto: no está instalado y no reproduciría sin más los roles Auth, extensiones y dependencias Supabase. No se usó para declarar PASS.
- Imagen `ghcr.io/supabase/postgres:17.6.1.166` ya descargada: inaccesible mientras el motor Docker no inicia.

## Acciones y límites

Sólo se realizaron lecturas y un intento de arranque no destructivo de Docker Desktop ya detenido. No se cerraron procesos, no se cambiaron límites de memoria, configuración global de Windows/WSL ni servicios críticos, y no se limpiaron contenedores, imágenes o volúmenes.

No se ejecutaron migration, prueba SQL, `EXPLAIN` ni ningún acceso DEV/PROD. No existe PASS de ejecución ni revisión independiente de SQL ejecutado. La revisión estática anterior sigue condicionada.

## Próximo paso

Antes de otro intento, liberar capacidad de memoria del host mediante una decisión del usuario o acordar un cambio concreto en la configuración de memoria de Docker/Windows. Después confirmar `docker desktop status = running` y `docker version` con Server, levantar una instancia Supabase temporal aislada, ejecutar las migrations previas y TASK-022, la prueba transaccional, inventario residual y `EXPLAIN`, y solicitar review independiente de los resultados. No usar DEV como sustituto automático.

## Reanudación (2026-10-22)

Tras liberar memoria, Docker Desktop informó `running` y `docker version` mostró Server 28.5.1. Se pudo arrancar un PostgreSQL Supabase temporal saludable sin puertos ni volúmenes. El endpoint `docker exec`/`inspect` respondió erróneamente `No such container` para esa instancia, mientras `docker ps`, `top` y `stats` la mostraron activa. Un cliente `psql` efímero unido con `--network container:task022-pg-local-20261022` se conectó con éxito por loopback interno. Este fallo operativo de Docker no afectó la ejecución SQL ni exigió cambios de Windows. Resultado completo en `implementation-report.md`.
