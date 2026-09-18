# 3. Base de datos y plataforma de datos

## Decisión aprobada

**PostgreSQL + Supabase**

### Criterio de uso

- PostgreSQL será la base de datos relacional principal del proyecto.
- Supabase será la plataforma administrada utilizada inicialmente para alojar PostgreSQL.
- Supabase también podrá utilizarse para autenticación y almacenamiento de archivos, pero esas decisiones se documentarán por separado cuando sean discutidas.
- El modelo de dominio no debe acoplarse innecesariamente a Supabase.
- La base de datos debe diseñarse utilizando relaciones, restricciones e integridad referencial propias de PostgreSQL.
- Se priorizará mantener la posibilidad de migrar la infraestructura en el futuro sin rediseñar el dominio.

### Motivos principales

- El dominio del producto es altamente relacional.
- PostgreSQL permite representar de forma natural relaciones entre centros, usuarios, profesionales, pacientes, especialidades, disponibilidad y turnos.
- Supabase reduce la complejidad inicial de infraestructura al ofrecer PostgreSQL administrado.
- Para el MVP, el plan gratuito de Supabase permite comenzar sin costo de infraestructura significativo.
- Supabase permite trabajar con PostgreSQL real, por lo que el aprendizaje de SQL y bases de datos relacionales sigue siendo transferible.

### Estado

**Aprobado**

---
