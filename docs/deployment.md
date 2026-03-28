# Guía de Despliegue

Guía paso a paso para desplegar un proyecto nuevo creado desde este template. Cada proyecto necesita su propia base de datos (Turso), servicio backend (Render) y frontend (Cloudflare Pages).

| Servicio  | Proveedor        | Tier gratuito                    |
| --------- | ---------------- | -------------------------------- |
| Base de datos | Turso        | 9 GB, 500M lecturas/mes         |
| Backend API   | Render       | 750h/mes (se apaga en inactividad) |
| Frontend SPA  | Cloudflare Pages | Ancho de banda ilimitado     |

---

## Paso 1 — Base de datos (Turso)

### 1.1 Crear la base de datos

```bash
# Instalar la CLI de Turso (solo la primera vez)
curl -sSfL https://get.tur.so/install.sh | bash

# Iniciar sesión
turso auth login

# Crear la base de datos
turso db create <nombre-db>
```

### 1.2 Obtener credenciales

```bash
# URL de conexión
turso db show <nombre-db> --url
# Resultado: libsql://<nombre-db>-<usuario>.turso.io

# Token de autenticación
turso db tokens create <nombre-db>
# Resultado: un token largo (guárdalo, lo necesitarás varias veces)
```

### 1.3 Aplicar el esquema inicial

```bash
TURSO_DATABASE_URL=<url> TURSO_AUTH_TOKEN=<token> bun run --filter backend db:migrate
```

Esto ejecuta todas las migraciones pendientes en la base de datos remota. Después de este paso, las migraciones se ejecutan automáticamente en cada deploy.

### Desarrollo local

No necesitas Turso para desarrollar. El `TURSO_DATABASE_URL=file:./local.db` del `.env` crea un archivo SQLite local.

---

## Paso 2 — Backend (Render)

### 2.1 Crear el servicio

1. Ve a [render.com](https://render.com) y crea una cuenta (o inicia sesión)
2. **New** → **Web Service**
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Environment**: `Docker`
   - **Dockerfile Path**: `./Dockerfile.api`
   - **Plan**: `Free`

### 2.2 Variables de entorno en Render

En el dashboard de Render → tu servicio → **Environment**, añade:

**Requeridas:**

| Variable             | Valor                                      |
| -------------------- | ------------------------------------------ |
| `PORT`               | `3000`                                     |
| `NODE_ENV`           | `production`                               |
| `JWT_SECRET`         | Un string aleatorio seguro (genera uno con `openssl rand -hex 32`) |
| `TURSO_DATABASE_URL` | La URL de Turso del paso 1.2               |
| `TURSO_AUTH_TOKEN`   | El token de Turso del paso 1.2             |

**Opcionales:**

| Variable                    | Default              | Descripción                                           |
| --------------------------- | -------------------- | ----------------------------------------------------- |
| `JWT_EXPIRES_IN`            | `7d`                 | Duración del JWT. Formatos: `7d`, `24h`, `3600s`      |
| `CORS_ORIGIN`               | `*`                  | Dominio permitido. Pon el dominio de tu frontend en producción (ej: `https://mi-app.pages.dev`) |
| `LOG_LEVEL`                 | `warn` (prod)        | Nivel mínimo enviado a Betterstack: `info`, `warn`, `error` |
| `BETTERSTACK_SOURCE_TOKEN`  | —                    | Token de Betterstack. Sin él, los logs solo van a stdout |
| `BETTERSTACK_HOST`          | `in.logs.betterstack.com` | Host de ingesta de Betterstack               |
| `RATE_LIMIT_WINDOW_MS`      | `900000` (15 min)    | Ventana del rate limiter en milisegundos              |
| `RATE_LIMIT_MAX`            | `10`                 | Máximo de peticiones por ventana por IP               |

### 2.3 Desactivar Auto-Deploy

**Importante**: desactiva el Auto-Deploy para evitar deploys duplicados.

Render dashboard → tu servicio → **Settings** → **Build & Deploy** → **Auto-Deploy** → **No**

Los deploys se lanzan desde GitHub Actions, no desde Render directamente.

### 2.4 Copiar el Deploy Hook

Render dashboard → tu servicio → **Settings** → **Deploy Hook** → copia la URL.

La necesitarás en el paso 4 para los secretos de GitHub.

---

## Paso 3 — Frontend (Cloudflare Pages)

### 3.1 Crear el proyecto

1. Ve a [dash.cloudflare.com](https://dash.cloudflare.com) y crea una cuenta (o inicia sesión)
2. **Workers & Pages** → **Create** → **Pages** → **Direct Upload**
3. Pon el nombre que quieras al proyecto (ej: `mi-proyecto`)
4. Sube cualquier archivo para completar la creación (no importa el contenido, el deploy real lo hace GitHub Actions)

### 3.2 Obtener credenciales

| Credencial     | Dónde encontrarla                                              |
| -------------- | -------------------------------------------------------------- |
| **Account ID** | Dashboard de Cloudflare → barra lateral derecha, o ejecuta `bunx wrangler whoami` |
| **API Token**  | Dashboard → **API Tokens** → **Create Token** → usa la plantilla **"Edit Cloudflare Workers"** |
| **Project Name** | El nombre que elegiste en el paso 3.1                        |

> **Consejo**: copia el Account ID con cuidado. Un carácter mal copiado y el deploy falla con `Project not found [code: 8000007]`.

### 3.3 Dominio personalizado (opcional)

Cloudflare Pages → tu proyecto → **Custom domains** → añade tu dominio. Cloudflare gestiona el SSL automáticamente.

---

## Paso 4 — Secretos en GitHub

Ve a tu repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Añade estos 7 secretos:

| Secreto                    | Valor                                          | Usado por        |
| -------------------------- | ---------------------------------------------- | ---------------- |
| `TURSO_DATABASE_URL`       | URL de Turso (paso 1.2)                        | Deploy API       |
| `TURSO_AUTH_TOKEN`         | Token de Turso (paso 1.2)                      | Deploy API       |
| `RENDER_DEPLOY_HOOK_URL`   | URL del Deploy Hook de Render (paso 2.4)       | Deploy API       |
| `CLOUDFLARE_API_TOKEN`     | API Token de Cloudflare (paso 3.2)             | Deploy Web       |
| `CLOUDFLARE_ACCOUNT_ID`    | Account ID de Cloudflare (paso 3.2)            | Deploy Web       |
| `CLOUDFLARE_PROJECT_NAME`  | Nombre del proyecto en Cloudflare Pages (paso 3.1) | Deploy Web   |
| `VITE_API_URL`             | URL de tu API en Render (ej: `https://mi-api.onrender.com/api`) | Deploy Web |

---

## Paso 5 — Verificar

### 5.1 Primer deploy

Haz un push a `main`. El pipeline completo es:

```
push a main
    │
    ▼
CI (ci.yml)
    ├── lint (Biome)
    ├── type-check (tsc)
    ├── test (bun test)
    └── build
    │
    ▼ (si CI pasa)
    ├── Deploy API (deploy-api.yml)
    │     ├── Ejecuta migraciones contra Turso
    │     └── Lanza deploy en Render via Deploy Hook
    │
    └── Deploy Web (deploy-web.yml)
          ├── Build del frontend con VITE_API_URL
          └── Deploy a Cloudflare Pages via wrangler
```

### 5.2 Comprobar que todo funciona

1. **CI**: GitHub → Actions → el workflow "CI" debería pasar en verde
2. **API**: abre `https://<tu-servicio>.onrender.com/api/health` (puede tardar ~30s la primera vez por el cold start del tier gratuito)
3. **Frontend**: abre `https://<tu-proyecto>.pages.dev`

### 5.3 Errores comunes

| Error | Causa probable | Solución |
| ----- | -------------- | -------- |
| `Project not found [code: 8000007]` | `CLOUDFLARE_ACCOUNT_ID` mal copiado | Ejecuta `bunx wrangler whoami`, compara y actualiza el secreto |
| Deploy Hook no lanza nada | Auto-Deploy activado en Render o URL mal copiada | Verifica la URL del hook y que Auto-Deploy esté en "No" |
| Migraciones fallan en CD | Credenciales de Turso incorrectas | Verifica `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` en GitHub Secrets |
| Frontend no conecta con la API | `VITE_API_URL` incorrecto | Debe incluir `/api` al final (ej: `https://mi-api.onrender.com/api`) |
| Render despliega dos veces | Auto-Deploy activado | Desactívalo en Settings → Build & Deploy |

---

## Resumen de cambios de esquema

Cuando modifiques tablas después del setup inicial:

```bash
# 1. Genera la migración
bun run --filter backend db:generate

# 2. Pruébala en local
bun run --filter backend db:migrate

# 3. Commitea el archivo .sql generado y haz push a main
# El pipeline la aplica automáticamente en producción
```
