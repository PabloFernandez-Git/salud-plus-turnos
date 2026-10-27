# Review independiente — TASK-031

**Resultado:** APPROVED para el alcance local, sujeto a la revisión de la persona usuaria antes de publicar.

El reviewer examinó migración, pruebas SQL, Action/errores, detalle y diálogos. Confirmó comparaciones de instantes y una sola lectura de `clock_timestamp()` después de `FOR UPDATE`; preservación de autorización, centro, rol, estado, CAS, firma y grants; resultados tipados; controles temporales, pending y recuperación en UI. No encontró cambios funcionales a Cancelar, Reprogramar o TASK-029.

Hallazgos cerrados durante el review:

1. Las nuevas pruebas SQL leían `appointments` directamente como `authenticated`; se sustituyeron por las RPC de detalle autorizadas. La suite local pasó después.
2. El diálogo omitía offset DST y fecha final cuando correspondía; se añadieron al resumen.
3. Confirmar podía quedar deshabilitado al cruzar el inicio con el diálogo abierto sin explicar el motivo; el diálogo ahora lo anuncia.
4. El refresh al recuperar foco podía desmontar un diálogo pending/incierto; se pospone mientras haya diálogo, pending o bloqueo.
5. Si Confirmar desaparece tras éxito, el foco vuelve al encabezado de acciones.
6. La prueba concurrente usa reloj PostgreSQL y resultado normalizado para no depender de reloj Windows ni crear un rechazo de Promise sin handler.

Evidencia posterior: replay local de 26 migraciones, suite B0 con rollback, cruce de lock, 860 pruebas Vitest, 31 tooling y capturas 390/1440. Límite: igualdad exacta de RPC no ejecutada en un microsegundo coordinado; tabla SQL determinista y código de comparación verificados. El resultado no acredita DEV/PROD.

## Review focal del pulido visual final — APPROVED

El reviewer verificó los cuatro footers centrados, el orden Volver → confirmación, el gap uniforme, controles ≥44 px, tratamiento rojo de Cancelar y ausencia de overflow a 390 px. Comprobó que los mensajes aparecen sólo para acciones temporalmente bloqueadas, mantienen `aria-describedby` y tienen separación visible. Los patrones de foco, Escape y pending y la lógica de transiciones permanecen intactos. No se tocaron SQL, RPC, Actions ni TASK-029.

Hallazgo de evidencia cerrado: las primeras capturas móviles de mensajes quedaban fuera del viewport; el script desplaza el texto al área visible y se regeneraron `mobile-390-messages-one.png` y `mobile-390-messages-two.png`. No quedan hallazgos del pulido. La aprobación visual de la persona usuaria sigue pendiente antes de publicar.

## Review proporcional — iconos de reloj

**PASS.** El SVG local de 17 px usa `currentColor`, `aria-hidden` y `focusable=false`; sólo se renderiza para Atendido y Ausente bloqueados temporalmente. `aria-describedby` sigue apuntando al párrafo con texto y la prueba comprueba la descripción accesible. La captura real del componente a 390/1440 muestra gap de 8 px, alineación con la primera línea, texto multilinea móvil y ausencia de overflow. El diff de este ajuste no altera diálogos, reglas, PostgreSQL, Actions, permisos ni TASK-029. No quedan hallazgos dentro de este alcance; resta aprobación visual humana.

## Review independiente final del diff completo — APPROVED

Revisión realizada contra `origin/main` actualizado, después de la aprobación visual humana y antes del commit/PR. **Sin hallazgos bloqueantes.** Se comprobó la migración incremental y su compatibilidad con la RPC histórica: firma, owner/permisos por `CREATE OR REPLACE`, `SECURITY DEFINER`, `search_path`, autorización de membresía/centro/profesional, `FOR UPDATE`, CAS y estados terminales. Las tres comparaciones temporales usan instantes PostgreSQL y una única lectura de `clock_timestamp()` después del bloqueo. Cancelar y Reprogramar no reciben reglas nuevas.

También se revisaron Action/error tipado, React y refresco de foco (`key={updated_at}`), accesibilidad de botones, diálogos y confirmaciones, capturas 390/1440 y pruebas de regresión. `git diff --check origin/main` pasó. TASK-029 no aparece en el diff y su checkpoint `a04f8a7` se preserva. La igualdad exacta usa expresiones SQL deterministas, no una invocación RPC coordinada al microsegundo; ese límite está documentado. La revisión exigió actualizar el estado documental y excluir el `next-env.d.ts` local ajeno; ambas acciones se atienden antes del commit. La verificación local no acredita DEV/PROD ni aplica la migración remotamente.
