# TASK-021 — Integración Next.js y Dashboard operativo

## Objetivo y criterios

Implementar lectura server-only de las dos RPC aprobadas, seleccionar por membership activa, validar proyecciones estrictas y mostrar actividad diaria, cinco próximos y navegación existente. Preservar SQL y restricciones del brief/contract.

## Gates

A. Adaptador tipado focal, servicio con cliente de sesión y autorización, endpoint de relectura sin caché; pruebas de rol, denegación, errores y contrato.
B. UI con carga/error/vacíos, actualización manual, por visibilidad y medianoche, protección ante respuestas tardías, pruebas de componentes y Chromium sintético 1440/390.
C. Review independiente de autorización, datos, tiempo, accesibilidad y regresiones; corregir hallazgos y documentar verificación.

## Riesgos e impacto

Cambios sólo en Dashboard, su endpoint y documentación TASK-021. No usar service_role ni datos de DEV. Evitar que una respuesta vieja de otro centro o rol vuelva a mostrarse. La fuente de fecha y as_of es la RPC; el reloj del navegador sólo dispara una lectura nueva.
