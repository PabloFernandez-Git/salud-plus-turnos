# 13. Autorización

## ¿Qué es?

La autenticación responde:

> ¿Quién sos?

La autorización responde:

> ¿Qué podés hacer dentro de la aplicación?

En nuestro proyecto, un mismo usuario puede tener roles distintos según el centro.

Ejemplo:

```text
Ana

Centro A → RECEPTION
Centro B → PROFESSIONAL
```

Por eso la autorización siempre debe evaluarse dentro del contexto del centro activo.

## ¿Cómo la implementaremos?

La autorización principal vivirá del lado servidor en Next.js.

Para una operación sensible se comprobará:

```text
Usuario autenticado
+
Centro activo
+
CenterMembership
+
Estado
+
Rol
```

Ejemplos:

- ADMIN puede gestionar usuarios;
- RECEPTION puede gestionar turnos;
- PROFESSIONAL puede consultar su propia agenda.

## ¿Por qué no alcanza con ocultar botones?

Porque ocultar un botón solo cambia la interfaz.

Un usuario podría intentar llamar directamente a la operación.

Por eso:

```text
UI
→ muestra u oculta acciones

Servidor
→ decide realmente si la acción está permitida
```
