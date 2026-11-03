# Plan

1. Preparar migración DEMO fail closed: preflight, hook Auth, trigger de perfil/membership, RLS restrictiva y grants intactos.
2. Incorporar flujo UI anónimo opt in con reutilización y manejo de error, sin cambiar login normal.
3. Documentar configuración Auth, límites, CAPTCHA y limpieza; añadir SQL de limpieza transaccional.
4. Probar unidades/UI y PostgreSQL/Auth local con dos invitados, lecturas, negaciones y limpieza. Revisar diff y dejar commit local sólo si todo pasa.
