# Retrospective — TASK-008

## Resultado

TASK-008 entregó la administración de disponibilidad semanal por ProfessionalCenter. El plan review y el implementation review independientes terminaron en PASS; PR #11 pasó CI y final merge review, y se integró en `main` mediante squash merge `c2857308ebf144fd69020636f8021ece4eb258cd`. TASK-008 queda `MERGED / ARCHIVED`; PROD permaneció fuera de alcance.

## What went well

- El contrato de roles, RLS y RPCs estrechas mantuvo el aislamiento tenant y permitió separar consultas de mutaciones.
- La verificación combinó tests locales, integración DEV con cleanup exacto y smoke de navegador desktop y móvil de 390 px.
- El review conservó cada veredicto y su remediación, de modo que el PASS final es rastreable.

## Findings IR-01 / IR-02

- **TASK008-IR-01 CLOSED:** el gate histórico de listado profesional exceptúa sólo la firma aprobada mediante OID exacto; una sobrecarga adicional vuelve a fallar el gate. La regresión ejecuta el SQL histórico en PostgreSQL descartable.
- **TASK008-IR-02 CLOSED:** el password de PostgreSQL descartable dejó de viajar en argv y los caminos de error probados no lo exponen; el cleanup selecciona únicamente el contenedor propio.

## Verification evidence

- DEV: 20/20 migrations, dry-run sin pendientes, DB lint e integración PASS; fixtures propios eliminados y baseline persistente restaurado.
- `pnpm check` PASS: 492 Vitest y 11 tests históricos; regresión IR-02 6/6 PASS.
- Browser smoke desktop y 390 px PASS. CI del PR: `Format check` y `Verify` PASS en el HEAD final `9650fe6efc47eb11f04e8f913e95c5d08f520cec`.
- El check global de formato conserva avisos CRLF históricos documentados; los archivos propios/nuevos de TASK-008 pasaron el formato focalizado.

## Lessons learned

- Una excepción en un gate de seguridad debe identificar la firma exacta y probar que variantes no autorizadas siguen siendo rechazadas.
- Los runners descartables deben evitar secretos en argumentos y en errores observables, y demostrar cleanup por identidad exacta.
- Actualizar `docs/status.md` después del merge mantiene la memoria del repositorio alineada con el estado real del PR.
