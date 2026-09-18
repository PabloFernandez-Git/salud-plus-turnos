# 7. Validación de datos

## Decisión aprobada

**Zod como sistema estándar de validación de inputs**

### Alcance

Zod se utilizará para validar datos externos antes de que entren a la lógica de negocio.

Se aplicará especialmente a:

- acciones del servidor;
- datos recibidos desde el cliente;
- parámetros y payloads de operaciones que modifican información.

### Principio de uso

La aplicación distinguirá entre:

- TypeScript → tipos durante desarrollo;
- Zod → validación en runtime;
- lógica de negocio → reglas del dominio;
- PostgreSQL → integridad y restricciones de datos.

### Cliente y servidor

Zod podrá utilizarse en el cliente para mejorar la experiencia de usuario y mostrar errores rápidamente.

Las operaciones sensibles o que modifiquen datos deberán validar nuevamente del lado servidor.

No se considerará suficiente una validación realizada únicamente en el navegador.

### Fuente de verdad de inputs

Cuando resulte conveniente, los tipos TypeScript de los inputs podrán inferirse desde los schemas de Zod mediante `z.infer`.

Esto ayudará a evitar duplicación entre:

- definición del dato;
- tipo TypeScript.

### Lo que Zod no reemplaza

Zod no reemplaza:

- autorización;
- reglas de negocio;
- validaciones de disponibilidad;
- restricciones UNIQUE;
- foreign keys;
- integridad referencial;
- políticas RLS.

### Estado

**Aprobado**
