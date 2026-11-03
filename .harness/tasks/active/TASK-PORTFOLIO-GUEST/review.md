# Revisión local

## Seguridad

- La migración exige un único centro DEMO activo y revocación previa de DML y RPC no auditadas; aborta ante deriva.
- La función del hook solo tiene `EXECUTE` para `supabase_auth_admin`. El trigger exige Auth anónimo sin identidad de contacto y crea las dos filas en la misma transacción; sin grants nuevos al cliente.
- RLS restrictiva conserva la regla de solo identidad propia incluso si el claim anónimo cambia tras vincular una identidad. El marcador del perfil es exclusivo de DEMO.
- La limpieza exige tipo de cuenta, edad, marcador, membership única DEMO y ausencia de platform admin; respeta el orden FK y revierte por defecto.
- `PORTFOLIO_GUEST_ACCESS_ENABLED=false` impide mostrar el acceso en el despliegue actual. Con el flag activo se exigen DEMO mode y URL del proyecto DEMO. El signup público depende además del hook real y de la activación manual de Auth.

## Límites de la revisión

- Se verificó la pila local con Auth real; no se probó ni alteró el proyecto remoto DEMO.
- El CAPTCHA queda preparado y documentado, pero su validación completa requiere configurarlo en Supabase DEMO y ejecutar una prueba negativa sin token antes de activar el acceso público.
- El smoke local ejecutó el dashboard RPC y rechazos de dos RPC sensibles. La navegación completa de todos los módulos se incluye en el smoke manual posterior.

## Dictamen

**LOCAL READY para revisión y activación posterior separada.** Ningún cambio remoto ni despliegue está autorizado en esta fase.
