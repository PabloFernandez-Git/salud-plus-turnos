# 6. Almacenamiento de archivos

## Decisión aprobada

**Supabase Storage**

### Alcance del MVP actual

Supabase Storage se utilizará inicialmente para almacenar:

- logo del centro.

La base de datos guardará la referencia o ruta del archivo, no la imagen en sí.

### Reglas iniciales

- solo ADMIN podrá modificar el logo del centro;
- se limitarán formatos y tamaño máximo del archivo;
- el logo existente podrá ser reemplazado;
- se evitará acumular versiones innecesarias del mismo archivo;
- el logo podrá almacenarse en un bucket público al no tratarse de información sensible.

### Motivos principales

- ya utilizamos Supabase para PostgreSQL y autenticación;
- evita incorporar otro proveedor únicamente para almacenamiento;
- simplifica la infraestructura del MVP;
- permite aprender un mecanismo de storage reutilizable en futuras funcionalidades.

### Evolución futura

Supabase Storage podrá reutilizarse en futuros MVP para otras funcionalidades, por ejemplo:

- imágenes o recursos del centro;
- avatares;
- archivos adjuntos no sensibles;
- documentos administrativos.

El uso de Storage para información clínica o documentos médicos no se considera aprobado.

Si en el futuro se incorporan archivos clínicos, será necesario definir por separado:

- almacenamiento privado;
- autorización de acceso;
- URLs firmadas o mecanismos equivalentes;
- auditoría;
- privacidad;
- reglas de retención y eliminación.

### Estado

**Aprobado**
