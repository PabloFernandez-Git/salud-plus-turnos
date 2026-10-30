# TASK-035 — Retrospectiva de cierre preparada

- La separación entre autorización de la pantalla, permiso de escritura y lectura tenant de `centers` evitó cambiar RLS por una ambigüedad documental. La decisión de producto quedó explícita en el brief y en los módulos.
- Distinguir la confirmación de PostgreSQL de la revalidación de Next.js evita comunicar un fallo de guardado falso. Una respuesta incierta conserva el borrador y exige recargar la versión actual antes de otro intento.
- La prueba funcional en DEV comprobó persistencia, encabezado, concurrencia y restauración de valores visibles; los caminos excepcionales añadidos después se verificaron con pruebas sintéticas, sin repetir escrituras remotas.
- El árbol de trabajo contiene cambios de varias tareas y artefactos locales. La integración de TASK-035 requiere seleccionar rutas concretas y revisar el índice antes del commit; el expediente se archivará sólo tras integrar la implementación.

No se proponen cambios al protocolo del harness ni a las reglas de producto a partir de este cierre.
