# Retrospectiva — TASK-009

## Resultado

TASK-009 entregó turnos operables con contratos SQL/seguridad, aplicación, integración real y navegador. Gate D recibió PASS independiente comunicado por el usuario; el run final `4889153b-3960-403c-b6c2-26ad6f00e624` obtuvo 3/3 Playwright y cleanup completo. Las seis evidencias de integración se conservaron del run `71c74b49-e099-4c63-9dba-7f8c76989882`. Cierre administrativo autorizado; PROD fuera de alcance.

## Causas concretas de las demoras

- **Autonomía operativa:** la contraseña PostgreSQL DEV preexistente sólo estaba disponible en el PowerShell del usuario. Varias intervenciones separadas prolongaron la ejecución. El launcher de una sola operación redujo la participación humana a ingresar esa contraseña en un prompt seguro, sin ampliar permisos.
- **Compatibilidad Windows:** Windows PowerShell 5.1 no admite `ConvertFrom-SecureString -AsPlainText`. La conversión se adaptó con BSTR liberado en `finally`. Un reemplazo atómico del ledger recibió `EPERM` en Windows después de un COMMIT; los temporales únicos y reintentos acotados permitieron recuperación preservando el runId.
- **Recuperación de ejecuciones:** el cliente transformó `timestamptz` con microsegundos en `Date` con milisegundos y alteró un token CAS. La conservación textual y la reconciliación del ledger permitieron continuar sin crear fixtures ajenas ni repetir automáticamente un run fallido. Cada corrida conservó inventario, UUID propios, reporte y cleanup verificable.
- **Validación anticipada de navegador:** el origen `127.0.0.1` impedía la hidratación de Next; selectores de Nota y alertas coincidían con elementos distintos, y el modo serial omitía escenarios posteriores. La inspección de trazas, la reproducción en DOM real, las comprobaciones tempranas y los escenarios secuenciales independientes evitaron otra corrida parcial. Una carrera de catálogos al reprogramar se detectó localmente antes de la validación final.

## Aprendizajes futuros

Validar pronto el PowerShell objetivo, la vía de credenciales y el ciclo completo del launcher con dependencias simuladas; conservar tokens temporales SQL sin pérdida de precisión; exigir inventario y cleanup exactos para cada run; comprobar selectores de navegador contra DOM renderizado y probar que los escenarios restantes continúan tras un fallo. Estas son propuestas para tareas futuras: esta retrospectiva no inicia cambios del Harness, código ni infraestructura.
