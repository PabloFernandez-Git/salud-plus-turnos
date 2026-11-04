# Revisión local

- El widget se monta solo en DEMO con Site Key; el resto de la aplicación no carga el script ni envía token.
- La Server Action valida token externo con Zod, limita longitud y rechaza su ausencia cuando CAPTCHA es obligatorio. Un token inválido rechazado por Auth devuelve un error genérico.
- Expiración, timeout, error del widget y error de Auth borran el token y permiten reintento; el botón invitado y el submit de login permanecen deshabilitados sin token.
- No hay Secret Key, token persistente, servicio adicional, escritura de base ni cambios de migraciones.
- Las pruebas usan mocks de respuesta Auth y las Site Keys oficiales de prueba; la verificación real de Siteverify en Supabase DEMO queda para la activación. La Secret Key de prueba solo sirve con Supabase local configurado para esa prueba.

**Dictamen:** implementación local lista. Activación remota pendiente y fuera de alcance.
