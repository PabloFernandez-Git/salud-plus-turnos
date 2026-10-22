# TASK-022 — Retrospectiva y cierre documental

## Resultado

**CLOSED / ARCHIVED — 2026-10-22.** El PR #20 se integró en `main` por
squash `8ba31f7262a558b2cfc8471965c4453ce85bb816`; la referencia
`origin/main` se cotejó con ese commit. El criterio 13 de `docs/mvp.md`
quedó integrado. La persona usuaria confirmó CI posterior al merge SUCCESS
y revisión independiente APPROVED.

SQL local, verificación estructural y funcional DEV pasaron. La migration
`20261022120000_add_patient_appointment_history.sql` se aplicó de forma
controlada en DEV y figura como la versión 24. El gate funcional conserva
evidencia RPC y Chromium autenticado en runs separados, sin presentarlos
como una única corrida exitosa. El run focal final
`9b581bb1-e2be-44e4-b33d-77efbc594982` acreditó `residue=0`,
cuatro usuarios Auth ausentes e inventarios iguales de 14 recursos.
`focused-dev-revalidation.md` preserva los runs y sus límites.

La aplicación de la migration en PROD **no fue autorizada ni realizada**.
No se repitieron pruebas remotas ni se hizo despliegue durante este cierre.
Los checkpoints previos del expediente son evidencia histórica; sus
afirmaciones de pendientes pertenecen a la fecha de cada checkpoint.

## Lecciones

Las aserciones de Chromium que dependían de un selector global o de una
cantidad exacta de etiquetas `noindex` bloquearon runs aunque la vista
esperada estaba presente. Los runs focales y el cleanup exacto permitieron
resolver y revalidar el escenario restante sin repetir toda la batería.
No se propone un cambio del protocolo del Harness a partir de este cierre.
