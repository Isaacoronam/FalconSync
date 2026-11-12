# Decisiones arquitectónicas registradas

## Estructura por proyectos

Backend, frontend y el esqueleto móvil se agrupan bajo `projects/`. El movimiento conserva
las estructuras internas existentes para reducir cambios de comportamiento y evitar
reescrituras no necesarias.

## Skills de agentes

Las skills ejecutables permanecen en `.opencode/skills/`, que es la ruta de descubrimiento
configurada en `AGENTS.md`. `skills/README.md` funciona como índice, no como copia de las
skills.

## Aplicación móvil

La app móvil se plantea como Android/Kotlin en la idea del producto. Solo se crea el
esqueleto de carpetas; no se inicializa un paquete npm ni se declara una app compilable
hasta definir su configuración Android.

## Adaptación del UNEFA AI Starter Kit

Se adoptó la separación entre contexto, reglas, contratos, skills y memoria. Las tecnologías
y procedimientos de ejemplo no se tratan como arquitectura actual: no se incorporaron
Socket.IO, `express-fileupload`, Bootstrap, PM2, endpoints de APK ni Angular 22. La matriz
de evidencia y decisiones está en
[`context/unefa-starter-kit-adaptation.md`](../context/unefa-starter-kit-adaptation.md).
