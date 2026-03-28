# Contexto del Proyecto

Documento de referencia para que cualquier modelo de IA entienda qué es este template, cómo está estructurado y qué decisiones se tomaron. **Este archivo NO es documentación para el usuario final**, es contexto persistente para sesiones de asistencia con IA.

---

## Qué es

Un **repositorio template** en GitHub para crear proyectos fullstack TypeScript con monorepo. Cada nuevo proyecto se crea desde este template y tiene su propia infraestructura (base de datos, backend, frontend).

**Repositorio:** `https://github.com/DDuyn/bun-monorepo-template`

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Bun |
| Monorepo | Bun workspaces (`apps/*`, `packages/*`) |
| Backend | Hono |
| Frontend | SolidJS + Vite + TailwindCSS v4 |
| Base de datos | Turso (libSQL) + Drizzle ORM |
| Auth | JWT (register + login) via `hono/jwt` + `Bun.password.hash` |
| Validación | Zod |
| Manejo de errores | Result pattern (`Result<T, E>` — sin throws) |
| Testing | Bun test (TDD) |
| Linting | Biome |
| Git hooks | Lefthook (pre-push: lint + typecheck + test) |
| DI | Manual (parámetros) |
| Deploy backend | Render (free, Docker) |
| Deploy frontend | Cloudflare Pages (free) |
| Deploy base de datos | Turso (free tier) |

---

## Estructura del monorepo

```
bun-monorepo-template/
├── apps/
│   ├── backend/                  # API REST con Hono
│   │   ├── src/
│   │   │   ├── config/env.ts     # Variables de entorno validadas con Zod
│   │   │   ├── infrastructure/db/ # Cliente Drizzle, schema barrel, migraciones
│   │   │   ├── middleware/        # error-handler, jwt guard, rate-limit, logger
│   │   │   ├── modules/          # Feature modules (vertical slices)
│   │   │   │   ├── auth/         # Registro + login
│   │   │   │   │   ├── domain/   # User entity
│   │   │   │   │   ├── infrastructure/ # Table + repository
│   │   │   │   │   ├── use-cases/  # register, login
│   │   │   │   │   ├── tests/    # Unit tests
│   │   │   │   │   └── auth.api.ts
│   │   │   │   ├── items/        # CRUD + state machine (example)
│   │   │   │   │   ├── domain/   # Item entity
│   │   │   │   │   ├── infrastructure/ # Table + repository
│   │   │   │   │   ├── use-cases/  # create, get, list, update, activate, deactivate, delete
│   │   │   │   │   ├── tests/    # Unit tests
│   │   │   │   │   └── items.api.ts
│   │   │   │   └── health/       # Health check
│   │   │   ├── app.ts            # Factory de Hono, middleware, montaje de rutas
│   │   │   └── index.ts          # Entry point
│   │   └── drizzle.config.ts
│   └── frontend/                 # SPA con SolidJS
│       ├── src/
│       │   ├── domain/           # Capa de dominio (validaciones + API + servicio por feature)
│       │   │   ├── validation.ts            # FieldErrors, ValidationResult, zodIssuesToFieldErrors
│       │   │   ├── auth/
│       │   │   │   ├── auth.validations.ts  # Validaciones con Zod → ValidationResult<T>
│       │   │   │   ├── auth.api.ts          # Endpoints de auth
│       │   │   │   └── auth.service.ts      # Orquesta validación + API → AuthServiceResult<T>
│       │   │   └── item/
│       │   │       ├── item.validations.ts  # Validaciones con Zod → ValidationResult<T>
│       │   │       ├── item.api.ts          # Endpoints de items
│       │   │       └── item.service.ts      # Orquesta validación + API → ItemServiceResult<T>
│       │   ├── pages/            # Capa de vista + controlador por página
│       │   │   ├── login/
│       │   │   │   ├── Login.tsx            # Vista pura (solo JSX)
│       │   │   │   └── login.ctrl.ts        # Controlador (signals + handlers)
│       │   │   ├── home/
│       │   │   │   ├── Home.tsx
│       │   │   │   └── home.ctrl.ts
│       │   │   ├── profile/
│       │   │   │   ├── Profile.tsx
│       │   │   │   └── profile.ctrl.ts
│       │   │   └── items/
│       │   │       ├── Items.tsx
│       │   │       └── items.ctrl.ts
│       │   ├── components/       # Layout, componentes compartidos
│       │   │   ├── AppLayout.tsx            # Layout principal con sidebar + navbar
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Navbar.tsx
│       │   │   ├── ErrorFallback.tsx
│       │   │   ├── ToastContainer.tsx
│       │   │   └── ui/           # Componentes reutilizables
│       │   │       ├── Input.tsx
│       │   │       ├── Button.tsx
│       │   │       └── Toast.tsx
│       │   ├── context/          # Contextos de SolidJS (providers)
│       │   │   ├── auth.context.tsx         # AuthProvider: loadUser, clearUser, user signal
│       │   │   └── toast.context.tsx        # ToastProvider: show/hide toasts
│       │   ├── lib/api-client.ts # Transporte HTTP genérico + token utils + 401 redirect
│       │   └── index.tsx         # Entry point, rutas
│       └── public/_redirects     # SPA routing para Cloudflare Pages
├── packages/
│   └── shared/                   # Tipos, schemas Zod, Result type
│       └── src/
│           ├── result.ts         # Result<T, E>, ok(), err(), isOk(), isErr(), unwrap(), map()
│           ├── schemas/          # auth.schema, item.schema, common.schema
│           └── types/            # JwtPayload
├── docs/                         # Documentación
├── scripts/clean-template.ts     # Limpia el módulo items de ejemplo
├── .github/workflows/
│   ├── ci.yml                    # lint + typecheck + test + build
│   ├── deploy-api.yml            # db:migrate + Render deploy hook
│   └── deploy-web.yml            # build frontend + Cloudflare Pages via wrangler
├── Dockerfile.api                # Multi-stage: deps (producción) + runtime
├── render.yaml                   # Blueprint de Render
├── lefthook.yml                  # Pre-push: lint + typecheck + test (paralelo)
├── biome.json                    # Formatter + linter
├── tsconfig.base.json            # Config TS compartida
└── .env.example                  # Variables de entorno de ejemplo
```

---

## Arquitectura del backend

### Vertical Slices con Use-Cases

Cada feature vive en su propia carpeta dentro de `modules/` con subdirectorios para dominio, infraestructura, use-cases y tests:

```
modules/[feature]/
├── domain/                       # Entidades del dominio
│   └── [entity].ts
├── infrastructure/               # Tabla Drizzle + repositorio
│   ├── [feature].table.ts
│   └── [feature].repository.ts
├── use-cases/                    # Una función por operación
│   ├── create-[entity].ts
│   ├── get-[entity].ts
│   └── ...
├── tests/                        # Un archivo por entidad/use-case
│   ├── [entity].test.ts
│   ├── create-[entity].test.ts
│   └── ...
└── [feature].api.ts              # Sub-app Hono (composition root)
```

| Directorio/Archivo | Responsabilidad | Retorna |
|---------|----------------|---------|
| `domain/[entity].ts` | Entidad con comportamiento e invariantes | `Result<Entity, AppError>` |
| `infrastructure/[feature].table.ts` | Definición de tabla Drizzle | `sqliteTable(...)` |
| `infrastructure/[feature].repository.ts` | Interfaz + factory para acceso a datos | Promesas de entidades del dominio |
| `use-cases/[operation].ts` | Factory function para una operación de negocio | `Promise<Result<T, AppError>>` |
| `[feature].api.ts` | Sub-app Hono, conecta use-cases con rutas | Respuestas HTTP |
| `tests/[entity].test.ts` | Tests de la entidad del dominio | — |
| `tests/[operation].test.ts` | Tests de un use-case específico | — |

### Modelos de dominio ricos

- Constructor `private`
- `create()` — factory estática que valida y retorna `Result`
- `fromPersistence()` — reconstruye desde datos de BD (sin validar)
- `toResponse()` — convierte a la forma de respuesta de la API
- Transiciones de estado como métodos explícitos (ej: `activate()`, `deactivate()`)

### Use-case pattern

Cada operación de negocio es una función independiente creada por una factory que recibe el repositorio:

```ts
// use-cases/create-item.ts
export type CreateItem = (input: CreateItemInput, userId: string) => Promise<Result<ItemResponse, AppError>>;

export function createCreateItem(repository: ItemsRepository): CreateItem {
  return async (input, userId) => {
    const result = Item.create(input.name, input.description, userId);
    if (!result.ok) return result;
    await repository.create(result.value);
    return ok(result.value.toResponse());
  };
}

// API handler — wires use-cases
const repository = createItemsRepository(db);
const createItem = createCreateItem(repository);
const getItem = createGetItem(repository);
```

`AppError` tiene un `code` (`VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`) que se mapea a HTTP status en el middleware.

### Inyección de dependencias manual

Las dependencias se pasan como parámetros de la factory function:

```ts
const repository = createItemsRepository(db);
const createItem = createCreateItem(repository);
const getItem = createGetItem(repository);
// ... un use-case por operación
```

El wiring se hace en el archivo `[feature].api.ts`, que actúa como composition root del módulo.

---

## Arquitectura del frontend

### 3 capas: Vista – Controlador – Dominio (Service)

Inspirado en la filosofía de SpoonKit: la vista es agnóstica a la lógica, el controlador conecta vista con dominio, y el dominio contiene validaciones, llamadas a API y reglas de negocio.

```
Vista (.tsx) --> Controlador (.ctrl.ts) --> Service (.service.ts) --> Validations + API
                                                                        └── api-client.ts
```

El controlador NO conoce ni las validaciones ni la API directamente. Solo habla con el servicio del dominio.

#### Capa 1: Dominio (`domain/[feature]/`)

Cada feature tiene su carpeta con tres archivos, más un archivo compartido `domain/validation.ts`:

- **`domain/validation.ts`** — Tipos frontend-only para errores por campo. `AppError` de `@repo/shared` permanece sin cambios.
  - `FieldErrors = Record<string, string>` — Mapa campo → mensaje de error
  - `ValidationResult<T>` — `{ ok: true; value: T } | { ok: false; fieldErrors: FieldErrors }`
  - `zodIssuesToFieldErrors(issues)` — Mapea `ZodIssue[]` a `FieldErrors` usando `issue.path[0]` como clave
- **`[feature].validations.ts`** — Funciones de validación puras que usan los schemas Zod de `@repo/shared` y retornan `ValidationResult<T>`. No dependen de SolidJS ni de la API.
- **`[feature].api.ts`** — Definición de endpoints HTTP del feature. Usa `request<T>()` de `lib/api-client.ts`.
- **`[feature].service.ts`** — Orquesta validación + llamada API. Retorna un `ServiceResult<T>` que es una unión de tres casos:
  - `{ ok: true; value: T }` — Éxito
  - `{ ok: false; fieldErrors: FieldErrors }` — Validación fallida (errores por campo)
  - `{ ok: false; error: AppError }` — Error de API o red

```ts
// domain/auth/auth.service.ts
export type AuthServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: FieldErrors }
  | { ok: false; error: AppError };

export async function login(email: string, password: string): Promise<AuthServiceResult<AuthResponse>> {
  const validation = validateLoginInput(email, password);
  if (!validation.ok) return validation; // { ok: false, fieldErrors: { email: "...", ... } }
  try {
    const response = await authApi.login(validation.value);
    return ok(response);
  } catch (error) {
    return { ok: false, error: internalError(error.message) };
  }
}
```

#### Capa 2: Controlador (`pages/[feature]/[feature].ctrl.ts`)

Factory function que retorna un objeto con un store (estado reactivo) y handlers. Conoce SolidJS (usa `createStore`) pero NO genera JSX. Solo importa del servicio del dominio.

El store distingue entre errores por campo (`errors`) y errores generales de API (`generalError`):

```ts
// pages/login/login.ctrl.ts
export function createLoginCtrl(navigate: Navigator) {
  const [state, setState] = createStore({
    email: '', password: '', name: '',
    isRegister: false,
    errors: {} as FieldErrors,   // { email: "Invalid email", password: "Too short" }
    generalError: '',             // "Network error" / "Unauthorized"
    loading: false,
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    setState({ errors: {}, generalError: '', loading: true });
    const result = state.isRegister
      ? await register(state.email, state.password, state.name)
      : await login(state.email, state.password);
    if (!result.ok) {
      if ('fieldErrors' in result) setState({ errors: result.fieldErrors, loading: false });
      else setState({ generalError: result.error.message, loading: false });
      return;
    }
    setToken(result.value.token);
    navigate('/');
  }

  return { state, setState, handleSubmit, toggleMode };
}
```

#### Capa 3: Vista (`pages/[feature]/[Feature].tsx`)

Solo JSX. Recibe del controlador datos reactivos y handlers. Sin lógica de negocio ni validaciones. Accede al estado como propiedades del objeto (`ctrl.state.email`, sin paréntesis):

```tsx
// pages/login/Login.tsx
export default function Login() {
  const navigate = useNavigate();
  const ctrl = createLoginCtrl(navigate);

  return (
    <form onSubmit={ctrl.handleSubmit}>
      <input value={ctrl.state.email} onInput={(e) => ctrl.setState('email', e.currentTarget.value)} />
      {/* ... solo renderizado */}
    </form>
  );
}
```

#### Estado reactivo: `createStore` por defecto

Se usa `createStore` de `solid-js/store` en lugar de múltiples `createSignal`. Ventajas:

- **Menos verboso**: un solo store en vez de N pairs `[value, setValue]`
- **Acceso directo**: `state.email` en vez de `email()` — más natural para devs de backend
- **Actualizaciones en bloque**: `setState({ error: '', loading: true })` en una sola llamada
- **Reactividad granular en arrays**: si se actualiza un item individual, SolidJS solo re-renderiza ese elemento, no toda la lista

Para componentes con 1-2 valores simples (ej: un toggle de modal), `createSignal` sigue siendo válido.

#### Componentes reutilizables: `components/ui/`

Componentes de UI reutilizables para evitar repetir estilos de Tailwind en cada vista:

- **`Input`** — Input con label opcional, estilo soft (fondo gris claro, borde sutil, bordes redondeados). Props: `label?`, `value`, `onInput`, `type?`, `placeholder?`, `error?`, `class?`
  - Si se pasa `error`, el campo se muestra en rojo y hay un texto de error inline debajo del campo
- **`Button`** — Botón con variantes (`primary`, `danger`, `ghost`). Usa colores del tema (`bg-primary`, `text-danger`). Props: `children`, `onClick?`, `type?`, `variant?`, `disabled?`, `class?`

```tsx
// Ejemplo de uso con errores inline
<Input label="Email" type="email" value={ctrl.state.email}
  onInput={(v) => ctrl.setState('email', v)}
  error={ctrl.state.errors.email} />
<Button type="submit" disabled={ctrl.state.loading}>Sign in</Button>
<Button variant="danger" onClick={handleDelete}>Delete</Button>
```

**Patrón**: cuando un patrón de UI se repite 3+ veces en las vistas, se extrae a `components/ui/`. Los componentes son wrappers ligeros sobre HTML + Tailwind, no abstracciones complejas. Siempre aceptan `class` para extensión puntual.

#### Tema visual y CSS

- **Tailwind v4** con directiva `@theme` en `index.css` para definir custom properties
- **Work Sans** como fuente principal (cargada desde Google Fonts en `index.html`)
- Colores del tema disponibles como clases de Tailwind:
  - `bg-primary` / `hover:bg-primary-hover` / `bg-primary-light` — Indigo (#4f46e5)
  - `text-danger` / `hover:text-danger-hover` / `bg-danger-light` — Rojo (#ef4444)

```css
/* index.css */
@import "tailwindcss";

@theme {
  --font-sans: "Work Sans", ui-sans-serif, system-ui, sans-serif;
  --color-primary: #4f46e5;
  --color-primary-hover: #4338ca;
  --color-primary-light: #e0e7ff;
  --color-danger: #ef4444;
  --color-danger-hover: #dc2626;
  --color-danger-light: #fef2f2;
}
```

#### Infraestructura: `lib/api-client.ts`

Cliente HTTP genérico reutilizable por todos los dominios:

- `request<T>(path, options)` — Fetch genérico con JSON, Bearer token automático, manejo de errores
- **401 automático**: si el servidor responde 401 (token expirado o inválido), limpia el token y redirige a `/login`
- `setToken(token)` / `clearToken()` / `isAuthenticated()` — Gestión de JWT en `localStorage`
- **`VITE_API_URL`** como variable de entorno para la URL base de la API

### Patrón para añadir una nueva feature

1. Crear `domain/[feature]/[feature].validations.ts` con funciones que retornen `ValidationResult<T>`
2. Crear `domain/[feature]/[feature].api.ts` con los endpoints
3. Crear `domain/[feature]/[feature].service.ts` que orquesta validación + API, retornando `ServiceResult<T>`
4. Crear `pages/[feature]/[feature].ctrl.ts` con el controlador (factory function + createStore con `errors: FieldErrors` y `generalError: string`)
5. Crear `pages/[feature]/[Feature].tsx` con la vista pura — pasar `error={ctrl.state.errors.field}` a cada `<Input>`, mostrar `generalError` en un banner
6. Añadir la ruta en `index.tsx`

### Otras características

- **SolidJS** con `createStore` para estado y renderizado condicional (`<Show>`, `<For>`)
- **@solidjs/router** para rutas del lado del cliente
- **Guard de auth** en `onMount` del controlador: si no hay token, redirige a `/login`
- **Validación client-side con Zod** usando los mismos schemas de `@repo/shared` (validación antes de llamar a la API, encapsulada en el servicio)

---

## Pipeline CI/CD

```
push a main
  → Pre-push hook (lint + typecheck + test) [local, Lefthook]
    → CI (lint + typecheck + test + build) [GitHub Actions]
      → Deploy API (db:migrate contra Turso + Render Deploy Hook)
      → Deploy Web (build frontend con VITE_API_URL + Cloudflare Pages via wrangler)
```

- Los workflows de deploy usan `workflow_run` y solo se ejecutan si CI pasa en `main`
- Render tiene Auto-Deploy **desactivado** — solo despliega via Deploy Hook
- Las migraciones de BD se ejecutan **antes** del deploy del backend

---

## Secretos de GitHub necesarios por proyecto

| Secreto | Usado por |
|---------|-----------|
| `TURSO_DATABASE_URL` | Deploy API (migraciones) |
| `TURSO_AUTH_TOKEN` | Deploy API (migraciones) |
| `RENDER_DEPLOY_HOOK_URL` | Deploy API |
| `CLOUDFLARE_API_TOKEN` | Deploy Web |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy Web |
| `CLOUDFLARE_PROJECT_NAME` | Deploy Web |
| `VITE_API_URL` | Deploy Web (build del frontend) |

---

## Testing

- **TDD**: test primero, implementar después
- Se testean **dominio** y **use-cases**, no API routes ni repositorios
- **Mock repositories** con `Map` en memoria (sin mocking libraries)
- Los tests están en `tests/` dentro de cada módulo, un archivo por entidad y uno por use-case

### Mock repository helpers

Los repositorios mock se centralizan en `tests/__helpers__/mock-[feature]-repository.ts` dentro de cada módulo. Usan dos `Map` en memoria para soportar los lookup patterns típicos (ej: `byEmail` + `byId` en auth).

```ts
// apps/backend/src/modules/auth/tests/__helpers__/mock-auth-repository.ts
export function createMockAuthRepository(): AuthRepository { ... }

// En tests de use-cases:
import { createMockAuthRepository } from './__helpers__/mock-auth-repository';
const repo = createMockAuthRepository();
```

### Tests de integración HTTP

Los tests de integración verifican la capa HTTP completa con `app.request()` de Hono, usando SQLite in-memory via Drizzle.

**Archivos clave:**
- `apps/backend/bunfig.toml` — preload del setup de tests: `[test] preload = ["./src/tests/setup.ts"]`
- `apps/backend/src/tests/setup.ts` — setea env vars críticas ANTES de que cualquier módulo se importe: `JWT_SECRET`, `TURSO_DATABASE_URL=file::memory:`, `NODE_ENV=test`, `RATE_LIMIT_MAX=10000`, `RATE_LIMIT_WINDOW_MS=1`
- `apps/backend/src/tests/test-helpers.ts` — helpers reutilizables: `createTestApp()` (aplica migraciones Drizzle, singleton por proceso), `createTestToken()`, `registerTestUser()`
- `apps/backend/src/tests/auth.integration.test.ts` — 12 tests HTTP de auth (register, login, me, refresh)
- `apps/backend/src/tests/items.integration.test.ts` — 13 tests HTTP de items (auth guard, CRUD, ownership) — **eliminado por `clean-template.ts`**

**Patrón de test de integración:**
```ts
import { createTestApp, createTestToken, registerTestUser } from './test-helpers';

const app = await createTestApp();

test('POST /api/auth/register returns 201', async () => {
  const res = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@test.com', password: 'pass123', name: 'User' }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as AuthResponse;
  expect(body.token).toBeDefined();
});
```

**Gotchas:**
- `res.json<T>()` no acepta type args en este tsconfig — usar `(await res.json()) as T`
- El rate limiter se instancia a nivel de módulo: `RATE_LIMIT_MAX=10000` en setup lo neutraliza
- Token refresh puede producir JWT idéntico si se llama en el mismo segundo — verificar `userId` en el payload en lugar de `not.toBe(token)`

---

## Decisiones técnicas y problemas resueltos

### `bun build` no funciona con `@libsql/client`

El bundler de Bun no puede resolver módulos nativos como `@libsql/linux-x64-gnu`. **Solución**: no hacer build, ejecutar TypeScript directamente con `bun run src/index.ts`.

### Migraciones con `db:push` vs `db:generate` + `db:migrate`

`db:push` aplica cambios directamente sin historial. **Se migró a file-based migrations** (`db:generate` + `db:migrate`) para tener un historial de cambios y poder automatizar migraciones en CD.

### Lefthook falla en Docker (no hay git)

El `postinstall` ejecuta `lefthook install`, pero en Docker no hay git. **Solución**: `"postinstall": "lefthook install || true"` para que no falle.

### Docker multi-stage para imagen más pequeña

Stage 1: instala solo dependencias de producción con `--production --ignore-scripts`. Stage 2: copia solo lo necesario (node_modules de producción + código fuente).

### Render despliega dos veces

Con Auto-Deploy activado, Render desplegaba al detectar el commit Y otra vez por el Deploy Hook de GitHub Actions. **Solución**: desactivar Auto-Deploy en Render.

### Cloudflare Pages `Project not found`

El error `[code: 8000007]` fue causado por un `CLOUDFLARE_ACCOUNT_ID` mal copiado en los secretos de GitHub. Se verificó con `bunx wrangler whoami`.

### `wrangler-action` incompatible con Bun

La action `cloudflare/wrangler-action@v3` detecta Bun e intenta usar `bunx` de forma incompatible. **Solución**: usar `bunx wrangler pages deploy` directamente en vez de la action.

---

## Script de limpieza

`scripts/clean-template.ts` elimina el módulo de ejemplo `items` cuando se bootstrappea un proyecto nuevo desde el template. Limpia archivos, imports en `app.ts`, exports en `schema.ts`, schemas en `@repo/shared`, y la migración baseline.

**Fixes aplicados (v0.7.1):**

El script detectó 4 bugs al usarse en un proyecto real. Ya están corregidos:

1. **Imports `@repo/shared`**: ahora reemplaza `@repo/shared` → `@{projectName}/shared` en todos los `.ts`/`.tsx` bajo `apps/` y `packages/` (función `replaceInSourceFiles` con `Bun.Glob`).
2. **`--filter` en scripts del root**: ahora actualiza `--filter backend` → `--filter {projectName}-api` y `--filter frontend` → `--filter {projectName}-web` en el root `package.json`.
3. **`devDependency "backend"`**: ahora actualiza la entrada `"backend": "workspace:*"` a `"{projectName}-api": "workspace:*"` en el root `package.json`.
4. **`items.integration.test.ts`**: ahora elimina `apps/backend/src/tests/items.integration.test.ts` (causaba 11 fallos en `bun run test` al intentar testear rutas ya eliminadas).

**Implementación**: `renameInPackageJson` ahora opera sobre texto plano con `replaceAll` en lugar de parsear/serializar JSON, lo que permite actualizar claves de `devDependencies` y valores de `scripts` en una sola pasada.

---

## Architecture Check

`scripts/arch-check.ts` es un linter de arquitectura estático que se ejecuta como parte del pre-push hook y del CI. Cero dependencias externas — usa `Bun.Glob` + regex.

### Script

```bash
bun run arch-check
```

### Reglas que valida

| Regla | Qué detecta | Solución |
|-------|-------------|---------|
| `no-throw-in-use-cases` | `throw` dentro de `use-cases/` | Usar `return err(appError(...))` |
| `no-class-outside-domain` | `class` declaraciones fuera de `domain/` (en use-cases, infrastructure, API files) | Convertir a factory function |
| `no-console-log` | `console.log(` en código de producción (excluye tests, setup, logger.ts, index.ts) | Usar `c.var.log?.info/warn/error(...)` |

En **proyectos derivados** (clonados del template), se puede añadir una regla adicional:

| Regla | Qué detecta | Solución |
|-------|-------------|---------|
| `no-repo-shared-import` | `from '@repo/shared'` en `apps/` o `packages/` | Actualizar al nombre del proyecto (`@{name}/shared`) |

Esta regla no existe en el template porque `@repo/shared` es el nombre correcto aquí.

### Integración

Añadido como job al pre-push de Lefthook (paralelo con lint, typecheck, test) y como step en `ci.yml` (entre lint y typecheck). Falla con mensaje claro indicando fichero, línea y cómo corregirlo.

### Comportamiento post-clean

`scripts/clean-template.ts` ya reemplaza `@repo/shared` en todos los `.ts/.tsx` al bootstrappear, por lo que la regla `no-repo-shared-import` no debería dispararse en proyectos bien configurados.

---

## Ficheros de instrucciones para IA

### `.opencode/instructions.md`

Instrucciones que OpenCode lee automáticamente al abrir el proyecto. Contiene:
- Idioma (castellano)
- Patrones obligatorios (Result, factory functions, TDD)
- Arquitectura frontend (3 capas)
- Naming conventions
- Workflow de desarrollo

### `.github/copilot-instructions.md`

Instrucciones para GitHub Copilot Chat en VSCode. Mismo contenido que el anterior pero adaptado al formato que Copilot consume — más conciso, orientado a sugerencias de código.

Ambos ficheros se crean en el template con referencias genéricas (`@repo/shared`) y se heredan en proyectos clonados. El `clean-template.ts` actualiza `@repo/shared` a `@{projectName}/shared` en los ficheros `.ts/.tsx` de `apps/` y `packages/`, pero **no en los ficheros de instrucciones** — actualizar manualmente esa referencia en `.opencode/instructions.md` y `.github/copilot-instructions.md` tras el clean.

---

## Generator de features

`scripts/generate-feature.ts` genera un módulo CRUD completo (backend + shared, NO frontend) a partir de un nombre:

```bash
bun run generate feature <nombre>
# Ejemplo:
bun run generate feature user-profile
```

**Genera 13 ficheros** para el backend y shared, y **modifica 3**:
- `packages/shared/src/schemas/[feature].schema.ts` — schemas Zod (create, update, response)
- `apps/backend/src/modules/[features]/domain/[feature].ts` — entidad de dominio
- `apps/backend/src/modules/[features]/infrastructure/[features].table.ts` — tabla Drizzle
- `apps/backend/src/modules/[features]/infrastructure/[features].repository.ts` — repositorio
- `apps/backend/src/modules/[features]/use-cases/create-[feature].ts`
- `apps/backend/src/modules/[features]/use-cases/get-[feature].ts`
- `apps/backend/src/modules/[features]/use-cases/list-[features].ts`
- `apps/backend/src/modules/[features]/use-cases/update-[feature].ts`
- `apps/backend/src/modules/[features]/use-cases/delete-[feature].ts`
- `apps/backend/src/modules/[features]/tests/__helpers__/mock-[features]-repository.ts`
- `apps/backend/src/modules/[features]/tests/[feature].test.ts`
- `apps/backend/src/modules/[features]/tests/create-[feature].test.ts`
- `apps/backend/src/modules/[features]/[features].api.ts`

**Modifica:**
- `packages/shared/src/index.ts` — añade re-exports del nuevo schema
- `apps/backend/src/infrastructure/db/schema.ts` — añade export de la nueva tabla
- `apps/backend/src/app.ts` — añade import y montaje de la nueva API

**Naming conventions:**
- Módulo/tabla/repositorio/API: plural (`user-profiles`, `userProfilesTable`)
- Entidad/use-cases: singular (`UserProfile`, `createUserProfile`)
- `pluralize()` maneja `-y → -ies`, `-s/-x/-z/-ch/-sh → -es`, resto `+s`
- `toPascalCase()` maneja nombres con guiones (`user-profile → UserProfile`)

**Después de generar**, hay que:
1. Revisar y personalizar los campos de la entidad y tabla según el dominio
2. Ejecutar `bun run db:generate` para crear la migración
3. Ejecutar `bun run typecheck && bun run test` para verificar que todo compila y los tests placeholder pasan

---

## Rate Limiting

Implementado en `apps/backend/src/middleware/rate-limit.ts` como sliding window en memoria, keyed por IP (`x-forwarded-for`).

**Endpoints protegidos**: `POST /api/auth/register` y `POST /api/auth/login` (targets clásicos de fuerza bruta).

**Configuración** vía env vars (con defaults razonables):

| Variable | Default | Descripción |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` (15 min) | Duración de la ventana en ms |
| `RATE_LIMIT_MAX` | `10` | Intentos permitidos por ventana por IP |

**Respuesta al superar el límite:**
```json
HTTP 429 Too Many Requests
Retry-After: 847
{ "code": "RATE_LIMITED", "message": "Too many requests, please try again later." }
```

**`ErrorCode` en `@repo/shared`**: incluye `RATE_LIMITED` → mapeado a 429 en `STATUS_MAP` del error-handler.

**Cómo añadir rate limiting a otro endpoint:**
```ts
import { createRateLimit } from '../../middleware/rate-limit';
import { env } from '../../config/env';

const myRateLimit = createRateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
});

router.post('/mi-endpoint', myRateLimit, async (c) => { ... });
```

**Limitación**: el store es in-memory, no se comparte entre instancias. Para múltiples réplicas haría falta Redis u otro store externo.

---

## Logging y Observabilidad

### Logger estructurado (`apps/backend/src/middleware/logger.ts`)

El middleware `structuredLogger` se monta globalmente en `app.ts`. Por cada request HTTP:

1. Genera un `request_id` (UUID v4) e inyecta el header `X-Request-Id` en la respuesta.
2. Crea un `RequestLogger` contextual ligado a ese `request_id` y lo inyecta en `c.var.log`.
3. Al terminar la request, logea un evento `request` con `method`, `path`, `status`, `duration_ms`.

**Formato según entorno:**

| Entorno | Formato | Destino |
|---------|---------|---------|
| Desarrollo (`NODE_ENV != production`) | Pretty-print colorizado | stdout (consola) |
| Producción | JSON por línea (NDJSON) | stdout + Betterstack (si token configurado) |

**Campos del log de request:**
```json
{
  "level": "info",
  "timestamp": "2026-03-10T12:34:56.789Z",
  "request_id": "a1b2c3d4-...",
  "event": "request",
  "method": "POST",
  "path": "/api/auth/login",
  "status": 200,
  "duration_ms": 45
}
```

### Application logging (eventos de negocio)

Para logear dentro de use-cases, recibir `log?: RequestLogger` como parámetro opcional. Al ser opcional, los tests existentes no se ven afectados (no pasan logger, y `log?.info()` no falla si `log` es `undefined`).

**Patrón de uso:**
```ts
// use-cases/apply-skill.ts
import type { RequestLogger } from '../../../middleware/logger';

export type ApplySkill = (
  input: ApplySkillInput,
  log?: RequestLogger,
) => Promise<Result<SkillResult, AppError>>;

export function createApplySkill(repository: SkillRepository): ApplySkill {
  return async (input, log) => {
    const before = await repository.getStats(input.targetId);

    log?.info('skill_applying', {
      userId: input.userId,
      skillId: input.skillId,
      targetId: input.targetId,
      atk_before: before.atk,
    });

    // ... lógica de cálculo ...

    log?.info('skill_applied', {
      userId: input.userId,
      skillId: input.skillId,
      targetId: input.targetId,
      atk_before: before.atk,
      atk_after: after.atk,
      delta: after.atk - before.atk,
    });

    // Si algo no cuadra:
    if (after.atk - before.atk !== input.expectedDelta) {
      log?.warn('skill_unexpected_result', {
        userId: input.userId,
        skillId: input.skillId,
        expected_delta: input.expectedDelta,
        actual_delta: after.atk - before.atk,
      });
    }

    return ok(result);
  };
}
```

**En la API route**, pasar `c.var.log`:
```ts
const result = await applySkill(parsed.data, c.var.log);
```

**Tipado de Hono**: para que `c.var.log` esté tipado en una API route, usar `LoggerEnv`:
```ts
import type { LoggerEnv } from '../../middleware/logger';

type Env = { Variables: { jwtPayload: JwtPayload } } & LoggerEnv;
const router = new Hono<Env>();
```

**Niveles y cuándo usar cada uno:**

| Método | Cuándo usarlo |
|--------|--------------|
| `log?.info(...)` | Resultado esperado de una acción de negocio (registro exitoso, login, habilidad aplicada). Solo en dev por defecto. |
| `log?.warn(...)` | Resultado inesperado pero manejado (login fallido, conflicto, resultado de cálculo fuera de lo esperado). Enviado a Betterstack por defecto. |
| `log?.error(...)` | Error no recuperable o excepción capturada en el error-handler. Siempre enviado a Betterstack. |

**Regla de oro:** loguear el _input_ y el _output_ de una acción importante, no cada paso del cálculo interno.

### Control de nivel mínimo (`LOG_LEVEL`)

Solo los eventos con nivel ≥ `LOG_LEVEL` se envían a Betterstack. A stdout (consola local) siempre van todos.

| Variable | Default dev | Default prod | Valores |
|----------|-------------|--------------|---------|
| `LOG_LEVEL` | `info` | `warn` | `info` \| `warn` \| `error` |

Para depurar temporalmente en producción sin redesplegar: cambiar `LOG_LEVEL=info` en las env vars del servicio de Render.

---

## Observabilidad con Betterstack (Logtail)

Betterstack recibe los logs vía HTTP push (fire-and-forget). Solo se activa si `BETTERSTACK_SOURCE_TOKEN` está configurado.

**En local**: la variable NO estará definida → los logs solo van a stdout → cero tráfico externo.

**Setup (una vez por proyecto):**

1. Crear cuenta gratuita en [betterstack.com](https://betterstack.com) (free tier: 1 GB/mes, 3 días retención).
2. Ir a **Telemetry → Sources → Connect source**.
3. Nombre: nombre del proyecto. Tipo: **HTTP** (o Node.js si prefieren auto-parsing).
4. Copiar el **Source token**.
5. En Render (o donde despliegues): añadir variable de entorno `BETTERSTACK_SOURCE_TOKEN=<token>`.
6. Opcionalmente añadir también a GitHub Secrets si necesitas que CI envíe logs (normalmente no hace falta).

**Variables de entorno para Betterstack:**

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `BETTERSTACK_SOURCE_TOKEN` | No (pero necesaria para enviar) | Token del source de Betterstack |
| `BETTERSTACK_HOST` | No | Default: `in.logs.betterstack.com` |

**Cómo buscar una traza de bug:**

Cuando un usuario reporta que "la habilidad X no funcionó":

1. Pedir al usuario la hora aproximada de la acción.
2. Ir a **Betterstack → Live Tail** o **Explore**.
3. Filtrar: `userId = "abc123"` + rango de tiempo.
4. Buscar el evento `skill_applying` → ver `atk_before`.
5. Buscar el evento `skill_applied` → ver `atk_after` y `delta`.
6. Si hay un `skill_unexpected_result`, verás exactamente qué esperaba el sistema y qué ocurrió.
7. Usar el `request_id` para correlacionar todos los logs de esa request específica.

**Búsqueda SQL en Betterstack** (Live Tail usa un SQL-like):
```sql
SELECT * FROM logs
WHERE json_value(message, '$.userId') = 'abc123'
  AND timestamp > now() - interval '1 hour'
ORDER BY timestamp DESC
```

**Comportamiento del buffer:**
- Los logs se acumulan en memoria y se envían en batch cada 1 segundo, o cuando hay 10+ entradas.
- Si el proceso termina, se hace un flush final con `beforeExit`.
- Si el envío a Betterstack falla (red, token inválido), los logs se descartan silenciosamente — la app no se ve afectada.

---

## Autenticación JWT

### Token con expiración

Los tokens JWT incluyen un claim `exp` (Unix timestamp en segundos). La duración es configurable:

| Variable | Default | Valores de ejemplo |
|----------|---------|-------------------|
| `JWT_EXPIRES_IN` | `7d` | `1d`, `7d`, `24h`, `3600s` |

La función `parseDurationToSeconds` (en `src/lib/duration.ts`) convierte formatos de duración a segundos. Unidades soportadas: `s`, `m`, `h`, `d`.

### Endpoints de auth

| Endpoint | Protección | Descripción |
|----------|-----------|-------------|
| `POST /api/auth/register` | Rate limit | Crea cuenta, devuelve JWT |
| `POST /api/auth/login` | Rate limit | Autentica, devuelve JWT |
| `GET /api/auth/me` | JWT guard | Devuelve perfil del usuario autenticado |
| `POST /api/auth/refresh` | JWT guard | Emite nuevo token con nueva expiración |

### Refresh token

El endpoint `POST /api/auth/refresh` (use-case `createRefreshToken`) verifica que el usuario sigue existiendo en BD y emite un token nuevo con `exp` renovado. Requiere un token **válido** (no acepta tokens expirados).

El frontend **no** hace refresh automático. Al recibir 401, `api-client.ts` limpia el token y redirige a `/login`.

---

## CORS

Configurado via `hono/cors` con la variable `CORS_ORIGIN`:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CORS_ORIGIN` | `*` | Origen permitido. En producción, pon el dominio del frontend (ej: `https://mi-app.pages.dev`) |

Si `NODE_ENV=production` y `CORS_ORIGIN=*`, el backend emite un warning en stdout al arrancar.
