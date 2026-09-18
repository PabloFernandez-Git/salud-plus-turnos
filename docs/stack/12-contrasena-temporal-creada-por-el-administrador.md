# 12. Contraseña temporal creada por el Administrador

## Decisión

Cuando el Administrador cree un usuario deberá definir manualmente una contraseña temporal inicial.

Ejemplo conceptual:

```text
Email:
recepcion@centro.com

Contraseña temporal:
********
```

El usuario podrá utilizar esas credenciales para acceder al sistema.

## ¿Por qué elegimos este flujo?

Para un centro pequeño es una solución simple y directa.

Evita inicialmente incorporar:

- invitaciones por email;
- tokens de invitación;
- expiración de invitaciones;
- reenvíos;
- estados de invitación.

Esto reduce el alcance técnico del MVP.

## Cambio de contraseña

El usuario no estará obligado a cambiar la contraseña temporal en su primer inicio de sesión.

Podrá cambiarla posteriormente cuando lo desee.
