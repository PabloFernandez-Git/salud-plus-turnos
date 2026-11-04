# Retrospectiva

Mantener los campos ocultos pero montados y dejar Turnstile en un punto fijo del árbol React conservó valores y token durante el cambio de pestaña. La prueba de un solo `render` y cero `remove` de Turnstile detectaría una regresión de montaje. Las capturas de dos anchos complementaron los tests de DOM para verificar el título y el desbordamiento.
