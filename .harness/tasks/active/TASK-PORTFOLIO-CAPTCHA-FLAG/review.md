# TASK-PORTFOLIO-CAPTCHA-FLAG — revisión local

**PASS.** La página entrega `captchaRequired` desde la configuración de DEMO al formulario. La Site Key sola no monta Turnstile ni deshabilita Ingresar. Cuando el flag exige CAPTCHA, el formulario espera un token; si falta la Site Key, el servidor rechaza la configuración y el botón permanece deshabilitado. El login tradicional fuera de DEMO y el flag de invitados conservan su comportamiento.

Verificación: 28 pruebas focales en cinco archivos, typecheck, ESLint focal, `git diff --check` y build DEMO con webpack. No se modificaron servicios externos, migraciones ni otras ramas. La prueba real contra Supabase Auth queda para la activación posterior de CAPTCHA.
