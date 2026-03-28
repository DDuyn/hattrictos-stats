# Architecture

## Overview

This is a fullstack TypeScript monorepo managed by **Bun workspaces**. All code — backend, frontend, and shared libraries — lives in a single repository, sharing types and validation schemas at compile time.

## Directory structure

```
bun-monorepo-template/
├── apps/
│   ├── backend/              # Hono REST API (Bun runtime)
│   └── frontend/             # SolidJS SPA (Vite + TailwindCSS v4)
├── packages/
│   └── shared/               # Shared types, Zod schemas, Result type
├── docs/                     # This documentation
├── package.json              # Root workspace config
├── tsconfig.base.json        # Shared TypeScript config
├── biome.json                # Linter/formatter config
├── bunfig.toml               # Bun-specific settings
├── Dockerfile.api            # Backend container
├── Dockerfile.web            # Frontend container (nginx)
├── .github/workflows/ci.yml  # CI pipeline
└── .env.example              # Environment variable template
```

## Workspaces

Defined in the root `package.json`:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

This gives us three workspaces:
- `apps/backend` — the Hono API server
- `apps/frontend` — the SolidJS client
- `@repo/shared` — shared code consumed by both

When you run `bun install` at the root, Bun resolves `"@repo/shared": "workspace:*"` in each app's `package.json` and symlinks the package. No build step needed for shared code — both apps import TypeScript source directly.

## Dependency flow

```
apps/backend  ──depends on──▸  @repo/shared
apps/frontend ──depends on──▸  @repo/shared
```

The `@repo/shared` package has zero dependencies on either app. It only depends on `zod` for schema definitions.

**What lives where:**

| Package | Contains | Example |
|---------|----------|---------|
| `@repo/shared` | Result type, AppError, Zod schemas, TypeScript interfaces | `Result<T, E>`, `loginInputSchema`, `JwtPayload` |
| `apps/backend` | API routes, services, repositories, domain entities, DB config | `auth.service.ts`, `items.domain.ts`, Drizzle tables |
| `apps/frontend` | UI components, pages, controllers, domain services, routing | `pages/home/`, `domain/auth/`, `lib/api-client.ts` |

## Why this structure

**Single source of truth for types.** Zod schemas in `@repo/shared` define both the runtime validation (backend) and the TypeScript types (both apps). When you change a schema, both sides see the update immediately — no code generation, no syncing.

**Independent deployment.** Each app has its own `Dockerfile`, `tsconfig.json`, and build script. The backend compiles with `bun build` targeting the Bun runtime; the frontend compiles with Vite targeting the browser. They share nothing at runtime.

**Minimal coupling.** The shared package only contains data shapes and utilities. It has no knowledge of Hono, SolidJS, or Drizzle. This means you could swap the frontend framework or the backend runtime without touching `@repo/shared`.

## TypeScript configuration

All workspaces extend `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "isolatedModules": true
  }
}
```

Each workspace overrides what it needs (e.g., the frontend adds `"jsx": "preserve"` and `"jsxImportSource": "solid-js"`).

The base config uses `"moduleResolution": "bundler"` because both apps use bundlers (Bun for backend, Vite for frontend) rather than Node's CommonJS resolution.

## Scripts

All scripts are defined at the root and delegate to workspaces:

```bash
bun run dev          # Start all apps (--watch for backend, Vite for frontend)
bun run dev:api      # Backend only
bun run dev:web      # Frontend only
bun run test         # Run tests in all workspaces
bun run lint         # Biome check across the entire repo
bun run build        # Build all apps
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Apply Drizzle migrations
```

Bun's `--filter` flag routes commands to the correct workspace by matching the `name` field in each workspace's `package.json`.

## CI pipeline

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push/PR to `main`:

1. Install dependencies (`bun install --frozen-lockfile`)
2. Lint (`bun run lint`)
3. Test (`bun run test`)
4. Build (`bun run build`)

The `JWT_SECRET` environment variable is set to a test value in CI so the backend's env validation doesn't fail during tests.
