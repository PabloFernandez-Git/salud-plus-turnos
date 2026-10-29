# TASK-034 — Retrospectiva de cierre

- Separar la consulta global opcional de las autorizaciones obligatorias permitió conservar el acceso a centros válidos sin conceder privilegios de plataforma ante una falla.
- La validación con rutas reales de Next.js y servicios sintéticos detectó que `reset()` no repetía la petición del servidor en el error raíz. La recarga manual corrigió ese comportamiento y se verificó tanto con fallo persistente como tras recuperación.
- El gate distinguió el error de arranque de siete workers en la primera corrida de `pnpm check` de las aserciones: 723 pruebas ejecutadas pasaron; una repetición controlada con dos workers completó 943/943 y el tooling 31/31 por separado. El expediente conserva ambos resultados.
- El archivo después del merge mantiene juntas las decisiones, pruebas y evidencias de las cuatro fases sin repetir pruebas funcionales para un cambio exclusivamente documental.
- La ausencia de E2E autenticados contra Supabase real y de verificación de RLS desplegada queda expresamente registrada. No se operó en DEV/PROD.

No se propone cambiar protocolos ni tooling del harness a partir de este cierre.
