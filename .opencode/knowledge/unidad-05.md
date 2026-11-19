# Unidad 05 — Documentación del sistema

> **Fuente:** `fuentes/UNIDAD #5 DOS.docx` · documento Word sin numeración de páginas.
> **Tipo:** transcripción completa del material original.
> **Cobertura:** secciones 5.1 a 5.3.
> **Nota de transcripción:** la numeración 5.1–5.3 proviene de la lista automática del DOCX. Se conservan la redacción y los errores del original. Las descripciones de figuras son una lectura de su contenido, no texto literal del documento.

---

## Presentación de la unidad

**UNIDAD #5: DOCUMENTACION DEL SISTEMA.**

La documentación de sistemas suele percibirse como una carga administrativa; sin embargo, a medida que la complejidad de los módulos crece, se vuelve el activo más crítico para la mantenibilidad y escalabilidad. Omitir este proceso en favor de la "rapidez" suele derivar en el abandono de infraestructuras completas debido a la pérdida de conocimiento técnico. En esta unidad, aplicaremos metodologías de Documentación como Código (Doc-as-Code) para integrar la documentación en el flujo de desarrollo, evitando la sobrecarga de trabajo y garantizando información siempre actualizada.

## 5.1. Documentación del código (Interna)

El código debe tener la capacidad de explicarse a sí mismo. Utilizaremos estándares de comentarios estructurados (como JSDoc para TypeScript o Rustdoc para Rust) para definir la intención de funciones, tipos y módulos. El objetivo es implementar generadores automáticos que transformen estos comentarios en un sitio web de referencia técnica estático, eliminando la necesidad de redactar manuales técnicos por separado.

- **Por ejemplo, Rust:** se emplean "//!" para la separación de módulos/clases y "///" para la separación de funciones/métodos, esto permite que al ejecutar el comando "cargo doc --open" se genere un sitio web con la estructura de documentación establecida.

> **Figura (5.1) — Código Rust documentado.** Se muestra un archivo con comentarios de documentación:
>
> ```rust
> //! Modulo de pruebas para la clase de la unidad #4 y #5.
>
> /// Funcion para sumar dos numeros enteros.
> /// # Ejemplo
> /// let res = plus(2,2);
>
> pub fn plus(a: i32, b: i32) -> i32 {
>     a + b
> }
>
> /// Funcion principal para la ejecucion del programa.
> fn main() {
>
>     // Pruebas de desbordamiento de memoria en Rust
>     let number1: u8 = 255;
>     let _number2: u8 = 255;
>     let number: u8;
> ```
>
> El editor resalta la sintaxis y marca la línea `let _number2: u8 = 255;`.

> **Figura (5.1) — Resultado de `cargo doc --open`.** Sitio web generado con el crate `hola_genesis` (versión 0.1.0). En la barra lateral aparecen «All Items», «Crate Items» (Functions) y «Crates» (hola_genesis). La página del crate muestra el título **Crate hola_genesis**, la descripción «Modulo de pruebas para la clase de la unidad #4 y #5» y la sección **Functions** con `main` («Funcion principal para la ejecucion del programa») y `plus` («Funcion para sumar dos numeros enteros»).

Este ejemplo es un pequeño ejercicio donde se realizó la documentación de la función principal de ejecución y una función de suma.

## 5.2. Documentación Técnica (Arquitectura)

Esto se implementa con la finalidad de que otros programadores puedan entender el "por qué" y no solo el "como", en este punto se utiliza lo que se conoce como diagramas UML, lo cual, se puede integrar con una herramienta que se conoce como Mermaid.js la cual mediante un archivo .md permite representar la arquitectura de un sistema en diferentes diagramas, los cuales se pueden renderizar automáticamente en el repositorio del sistema.

> **Figura (5.2) — Código Mermaid de un diagrama de secuencia.**
>
> ````markdown
> # Diagrama de secuencia
>
> ```mermaid
> sequenceDiagram
>     autonumber
>     actor Empleado as Usuario/Empleado
>     participant Sistema as Lógica de Negocio
>     participant DB as Base de Datos
>
>     Note over Empleado, DB: Flujo de Creación de Pedido y Venta
>
>     Empleado->>Sistema: Crear nueva orden (productos/servicios)
>
>     Sistema->>DB: Consultar disponibilidad (product/service)
>     DB-->>Sistema: Datos de precios y stock
>
>     Sistema->>DB: INSERT INTO order (user_id, status: 'pending')
>     DB-->>Sistema: order_id
>
>     loop Por cada ítem
>         Sistema->>DB: INSERT INTO order_details (order_id, product_id/service_id)
>         Sistema->>DB: UPDATE product (reducir stock_quantity)
>     end
>
>     Sistema-->>Empleado: Mostrar total y solicitar pago
>
>     Empleado->>Sistema: Registrar pago (payment_method, monto)
>
>     rect rgb(240, 240, 240)
>         Note right of Sistema: Procesamiento de Transacción
>         Sistema->>DB: INSERT INTO transaction (order_id, total, status: 'completed')
>         DB-->>Sistema: transaction_id
>         Sistema->>DB: INSERT INTO payment_list (transaction_id, payment_method_id, amount)
>         Sistema->>DB: UPDATE order (status: 'paid')
>     end
> ```
> ````

> **Figura (5.2) — Diagrama de secuencia renderizado.** El diagrama muestra al actor **Usuario/Empleado** (Empleado), al participante **Lógica de Negocio** (Sistema) y a la **Base de Datos** (DB). El flujo «Creación de Pedido y Venta» incluye: crear nueva orden, consultar disponibilidad, obtener precios y stock, insertar la orden, recibir el `order_id`, recorrer cada ítem para insertar detalles y reducir stock, mostrar el total y solicitar el pago, registrar el pago y procesar la transacción (insertar `transaction`, obtener `transaction_id`, insertar en `payment_list` y actualizar la orden a `paid`).

Código construido en el lenguaje que implementa la herramienta, y el resultado corriendo exitosamente en el archivo readme.md en un repositorio remoto en github.

## 5.3. Manuales de usuario y despliegue

El archivo README.md es la puerta de entrada al proyecto. Este debe estructurarse bajo estándares profesionales, incluyendo: guías de instalación deterministas (requisitos y pasos exactos), configuración de variables de entorno y una bitácora de cambios (Changelog) lo cual se construye gracias al GitFlow y al estándar que establecieron en el Conventional Commits permitiendo que sea ese historial en el código que es tan necesario para explicar el proceso de desarrollo sin tener que decir una sola palabra. Por lo cual, el objetivo es que cualquier desarrollador pueda desplegar y operar el sistema de forma autónoma en el menor tiempo posible.

> **Figura (5.3) — «Documentación de sistemas».** Diagrama de flujo de la documentación: **(El núcleo) Documentación del código** → Comentarios estandarizados y Generadores automáticos; **(Arquitectura) Documentación Técnica** → Diagramas UML y Mermaid.js; **(Estructura operativa) Manuales de usuario y despliegue** → Archivo README.md, Conventional Commits, GitFlow y Bitácora de Cambios. El proceso desemboca en el **Producto Mínimo Viable Mantenible y Escalable**. A la izquierda se ubican las fases de **Desarrollo** y **Pruebas**.
