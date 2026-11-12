# FalconSync

Plataforma digital para la promoción, gestión y seguimiento del patrimonio turístico de Coro, con mapa interactivo, catálogo de lugares, autenticación de usuarios, check-ins por geolocalización y panel administrativo.

## Visión general

FalconSync reúne dos capas complementarias:

- Frontend moderno en Angular para la experiencia pública y administrativa.
- Backend REST en Node.js + Express + MongoDB para la lógica de negocio, seguridad y persistencia.

El proyecto está orientado a digitalizar la experiencia turística de Falcón y centralizar la información patrimonial en una solución gestionable, escalable y verificable.

## Arquitectura

```mermaid
flowchart LR
    Usuario[Visitante / administrador] --> Frontend[Angular + Leaflet]
    Frontend --> API[Express + JWT]
    API --> MongoDB[(MongoDB)]
    API --> Storage[Uploads locales]
    Admin[Panel administrativo] --> Frontend
    Public[Catálogo público] --> Frontend
```

## Funcionalidades principales

- Catálogo público de lugares y puntos de interés (POI)
- Mapa interactivo con geolocalización y filtro regional
- Autenticación con JWT y cookies de refresco
- Roles de usuario, moderador y administrador
- Gestión administrativa de POI, estados y validaciones
- Check-in por lugar con QR y geocerca
- Perfil privado con avatar y galería de fotos
- Insignias por visita y métricas de actividad
- Auditoría de cambios y soporte para imágenes locales
- Suite E2E con Playwright para validación continua

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| Frontend | Angular 21 |
| Mapa | Leaflet 1.9.4 |
| Backend | Node.js + Express 5 |
| Base de datos | MongoDB 9 |
| Autenticación | JWT + cookies HttpOnly |
| Seguridad | bcryptjs, rate limiting, helmet |
| Testing | Node test runner + Playwright |
| Build | Angular CLI |

## Estructura del repositorio

```text
FalconSYN/
├── projects/
│   ├── backend/              # API REST y lógica de negocio
│   ├── frontend/             # Aplicación web Angular
│   └── mobile/               # Esqueleto reservado para la app de campo
├── context/                  # Contexto, reglas y contratos
├── skills/                   # Índice de skills locales
├── memory/                   # Decisiones y soluciones conocidas
├── docs/                     # Documentación técnica y funcional
├── .github/workflows/        # CI/CD para validación
├── README.md                 # Documento principal
├── CONTRIBUTING.md            # Guía de colaboración
├── package.json              # Scripts del repositorio raíz
├── manifest.json             # Metadata del proyecto
├── INSTALACION.md            # Instrucciones extra de instalación
└── .opencode/                # Skills y configuración del entorno
```

## Requisitos previos

Antes de iniciar el proyecto asegúrate de tener instalado:

- Node.js 26.13.0 o superior
- MongoDB 9.0.4 local o equivalente
- Git
- Un navegador moderno para pruebas locales

## Instalación rápida

### 1. Clonar el repositorio

```bash
git clone https://github.com/Isaacoronam/FalconSync.git
cd FalconSync
```

### 2. Instalar dependencias del backend

```bash
npm install --prefix projects/backend
```

### 3. Instalar dependencias del frontend

```bash
npm install --prefix projects/frontend
```

### 4. Configurar variables de entorno

Crea un archivo `.env` dentro de `projects/backend/` con la estructura del ejemplo:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/falconsync
CORS_ORIGIN=http://localhost:4200
TRUST_PROXY=false

JWT_ACCESS_SECRET=tu_secreto_de_acceso
JWT_REFRESH_SECRET=tu_secreto_de_refresco
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=7
BCRYPT_COST=12
REFRESH_COOKIE_NAME=falconsync_refresh
COOKIE_SECURE=false

UPLOAD_DIR=./uploads
UPLOAD_PRIVATE_DIR=./uploads-private
UPLOAD_MAX_IMAGE_BYTES=5242880

ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=cambia-esta-clave
ADMIN_NAME=Administrador FalconSync
```

Puedes usar el archivo base `projects/backend/.env.example` como referencia.

## Ejecución local

### Backend

```bash
npm --prefix projects/backend run dev
```

El backend queda disponible en:

- http://localhost:3000

### Frontend

```bash
npm --prefix projects/frontend run start
```

El frontend queda disponible en:

- http://localhost:4200

## Scripts útiles

Desde la raíz del proyecto puedes ejecutar:

```bash
npm run test:backend
npm run test:frontend
npm run build
npm run e2e
npm run verify
```

También están disponibles tareas específicas para sembrar datos, publicar POI y generar QR:

```bash
npm run seed:sync
npm run publish:pois
npm run qr:generate
npm run seed:adventures
```

## Documentación del proyecto

La documentación del sistema se encuentra organizada en:

- [docs/FALCONSYNC.md](docs/FALCONSYNC.md) — estado general del proyecto y alcance
- [docs/AUTENTICACION.md](docs/AUTENTICACION.md) — autenticación, sesiones y seguridad
- [docs/ADMINISTRACION.md](docs/ADMINISTRACION.md) — panel administrativo, POI y auditoría
- [docs/POI.md](docs/POI.md) — catálogo, editorial, publicaciones y fuentes
- [docs/AVENTURAS.md](docs/AVENTURAS.md) — compatibilidad heredada y recorridos
- [docs/PERFIL.md](docs/PERFIL.md) — perfil privado, avatar y galería
- [CONTRIBUTING.md](CONTRIBUTING.md) — normas de contribución y flujo de trabajo

## Contribución

Toda contribución debe seguir el flujo de trabajo publicado en [CONTRIBUTING.md](CONTRIBUTING.md). Antes de abrir un pull request, revisa el estándar de ramas, conventional commits y checklist de validación.

## Licencia

Este proyecto se desarrolla con fines de aprendizaje, prototipado y entrega académica. Ajusta la licencia según la política del equipo antes de usarlo en producción.
