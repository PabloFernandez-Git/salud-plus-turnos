# TASK-002 — Plan

**Estado:** `READY_FOR_REVIEW`

## Estrategia

Construir una prueba deliberadamente aislada y pequeña que ejerza las capacidades críticas de React Big Calendar con datos deterministas. Priorizar la observación directa de limitaciones sobre la creación de abstracciones reutilizables: el objetivo es aprender y producir evidencia, no anticipar la arquitectura final de agenda.

## Plan de implementación

1. **Revalidar precondiciones**
   - Ejecutar el startup del harness y `pnpm bootstrap`.
   - Confirmar que se trabaja en `task/002-react-big-calendar-spike` y revisar el diff existente.
   - Leer el brief completo antes de modificar código.

2. **Resolver dependencias mínimas**
   - Confirmar la versión candidata de React Big Calendar y su compatibilidad declarada con el stack fijado.
   - Instalar React Big Calendar, tipos sólo si hacen falta y un único localizador de fechas.
   - Registrar versiones, peer warnings y decisiones; no agregar librerías auxiliares sin justificación.

3. **Preparar el experimento aislado**
   - Crear una ruta experimental `/spikes/react-big-calendar` con una página de composición delgada.
   - Ubicar el spike bajo el módulo de agenda, claramente separado de futuras piezas productivas.
   - Definir tipos mínimos, tres profesionales y turnos ficticios deterministas, incluidos 20, 30 y 45 minutos y solapamientos entre profesionales.
   - Mantener toda fuente de datos en memoria y comprobar que no existen imports de infraestructura productiva.

4. **Implementar la carcasa de prueba**
   - Agregar controles mínimos para alternar Día/Semana/Mes, navegar por fecha, volver a la fecha de referencia y filtrar profesionales.
   - Mostrar en la UI el modo actual y las selecciones relevantes para que cada interacción sea verificable.
   - Mantener estado y adaptación de la librería fuera de la página de Next.js.

5. **Validar Vista Día**
   - Configurar un único día con profesionales como recursos/columnas.
   - Renderizar los tres tamaños de turno y verificar sus posiciones temporales.
   - Habilitar selección de slots libres y mostrar profesional, fecha y hora seleccionados sin persistencia.
   - Confirmar encabezados e identidad profesional en eventos.

6. **Validar Vista Semana**
   - Mantener los días como columnas principales.
   - Permitir alternar entre uno y varios profesionales.
   - Incluir turnos simultáneos de al menos dos profesionales y evaluar layout, legibilidad e identificación.
   - Verificar navegación anterior, siguiente y retorno a la fecha de referencia.
   - Si la API de recursos no satisface a la vez la estructura Día/Semana, probar el enfoque mínimo alternativo y documentar el costo, sin ocultarlo mediante una abstracción extensa.

7. **Validar Vista Mes**
   - Reemplazar el detalle horario por contenido diario propio basado en los mocks.
   - Mostrar un resumen compacto de actividad/profesionales.
   - Verificar navegación mensual.
   - Hacer que la selección de un día cambie a una vista detallada en esa fecha.

8. **Evaluar personalización e integración visual**
   - Usar un componente de evento propio.
   - Construir layout y controles propios con Tailwind CSS.
   - Acotar y enumerar imports de CSS de la librería y overrides necesarios.
   - Revisar 375 px, 768 px y 1280 px; implementar sólo las adaptaciones mínimas necesarias para evaluar usabilidad.

9. **Agregar pruebas proporcionales al spike**
   - Cubrir con React Testing Library los controles, filtros, selección y cambios de vista que sean deterministas.
   - Evitar aserciones geométricas falsas en JSDOM.
   - Usar Playwright o verificación equivalente en navegador para navegación, slots, simultaneidad, posicionamiento y responsive.
   - Guardar evidencia visual sólo cuando aporte a la matriz de evaluación.

10. **Producir evidencia técnica**
    - Crear `implementation-report.md` con una matriz completa `PASS` / `PARTIAL` / `FAIL` enlazada a cada criterio del brief.
    - Registrar capacidades nativas, personalizaciones y workarounds con severidad, impacto y alternativa.
    - Incluir versiones, pasos de reproducción, capturas relevantes y resultados de verificación.
    - Comparar la evidencia con las cuatro opciones futuras sin declarar adoptada ninguna.

11. **Verificar**
    - Ejecutar `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.
    - Ejecutar la validación E2E/visual específica del spike en navegador real.
    - Revisar que no se hayan incorporado conexiones a Supabase, auth, base de datos o lógica productiva.
    - Revisar el diff completo contra el brief.

12. **Review independiente**
    - Delegar a Reviewer/Verifier la comprobación funcional, técnica y documental.
    - Invocar especialista UI si la legibilidad de recursos, simultaneidad o responsive queda en duda.
    - Corregir hallazgos y repetir verificación, con un máximo recomendado de 2–3 ciclos.
    - No cerrar TASK-002 ni actualizar la decisión de calendario hasta obtener Review PASS y aprobación de cierre.

## Módulos y archivos previstos

- `src/app/spikes/react-big-calendar/page.tsx` — entrada aislada y composición.
- `src/modules/agenda/spike/` — mock data, adaptación, controles y componentes del experimento.
- `src/app/globals.css` o un stylesheet acotado — import base/overrides imprescindibles, según las restricciones reales de Next.js y la librería.
- Tests colocados junto al código; E2E específico bajo `tests/e2e/` sólo si se usa para evidencia reproducible.
- `.harness/tasks/active/TASK-002/implementation-report.md` — matriz y evidencia.

Los nombres internos son orientativos y pueden ajustarse si el Implementer demuestra una estructura más clara, manteniendo `src/app/` delgado y el spike explícitamente aislado.

## Delegación sugerida

- **Implementer:** implementación completa, pruebas y `implementation-report.md`.
- **Reviewer / Verifier:** revisión independiente de todos los criterios y comandos.
- **UI specialist, on demand:** legibilidad de simultaneidad, comportamiento responsive y costo de personalización.
- **Database/Security specialists:** no requeridos salvo que aparezca un cambio de alcance, que deberá escalarse antes de continuar.

## Gates

- `READY_FOR_IMPLEMENTATION` → brief y plan completos, branch correcta, riesgos identificados.
- `READY_FOR_VERIFICATION` → implementación y evidencia completas, verificaciones locales en verde.
- `READY_FOR_REVIEW` → verificación reproducida y sin criterios sin evaluar.
- `PASS` → review independiente aprobada.
- `CLOSED` → cierre orquestado, documentación de estado actualizada y decisión de adopción aún tratada por separado.

Estado actual: `READY_FOR_REVIEW`.
