# bun-monorepo-template

Fullstack TypeScript monorepo template with **Bun**, **Hono**, **SolidJS**, and **Drizzle ORM**.

## Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Runtime     | Bun                                 |
| Monorepo    | Bun workspaces                      |
| Backend     | Hono                                |
| Frontend    | SolidJS + Vite                      |
| Database    | Turso (libSQL) + Drizzle ORM        |
| Auth        | JWT (register + login + refresh)    |
| Validation  | Zod                                 |
| Styling     | TailwindCSS v4                      |
| Testing     | Bun test                            |
| Linting     | Biome                               |
| Deploy API  | Render (Docker, free tier)          |
| Deploy Web  | Cloudflare Pages (free, unlimited)  |

## Structure

```
├── apps/
│   ├── backend/          # Hono REST API
│   └── frontend/         # SolidJS SPA
├── packages/
│   └── shared/           # Shared types, schemas, Result type
├── docs/                 # Documentation
└── scripts/              # Template utilities
```

## Getting started

```bash
# Install dependencies (also sets up pre-push git hooks via lefthook)
bun install

# Copy environment variables
cp .env.example .env

# Apply migrations (creates local.db)
bun run db:migrate

# Start development (backend + frontend)
bun run dev
```

The backend runs on `http://localhost:3000` and the frontend on `http://localhost:5173` (with API proxy to backend).

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `bun run dev`      | Start all apps in dev mode           |
| `bun run dev:api`  | Start backend only                   |
| `bun run dev:web`  | Start frontend only                  |
| `bun run test`     | Run all tests                        |
| `bun run test:api` | Run backend tests only               |
| `bun run typecheck` | Type-check all apps with tsc        |
| `bun run lint`     | Lint with Biome                      |
| `bun run lint:fix` | Lint and auto-fix                    |
| `bun run build`    | Build all apps                       |
| `bun run db:generate` | Generate migration from schema changes |
| `bun run db:migrate`  | Apply pending migrations to database   |
| `bun run clean`    | Remove example items module          |

## Backend architecture

The backend follows a **vertical slice / feature modules** pattern with **DDD Lite** and **rich domain models**.

```
modules/
└── [feature]/
    ├── domain/
    │   └── [feature].ts          # Entity with behavior and invariants
    ├── infrastructure/
    │   ├── [feature].table.ts    # Drizzle table definition
    │   └── [feature].repository.ts  # Interface + factory (data access)
    ├── use-cases/
    │   ├── create-[feature].ts   # One factory function per operation
    │   └── ...
    ├── tests/
    │   ├── [feature].test.ts     # Entity tests
    │   └── create-[feature].test.ts  # One test file per use-case
    └── [feature].api.ts          # Hono sub-app (composition root)
```

### Key patterns

- **Result pattern**: Use-cases return `Result<T, AppError>` instead of throwing. See `packages/shared/src/result.ts`.
- **Rich domain**: Entities have behavior and enforce invariants. No anemic models.
- **Manual DI**: Use-cases receive the repository as a parameter. Easy to test with mocks.
- **Zod validation**: Input validated at the API layer with shared schemas from `@repo/shared`.

### API endpoints

**Auth** (public):
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/refresh` - Refresh JWT token (requires valid token)

**Items** (JWT protected):
- `GET /api/items` - List items (paginated)
- `GET /api/items/:id` - Get item
- `POST /api/items` - Create item
- `PATCH /api/items/:id` - Update item
- `POST /api/items/:id/activate` - Activate item
- `POST /api/items/:id/deactivate` - Deactivate item
- `DELETE /api/items/:id` - Delete item

**Health**:
- `GET /api/health` - Health check

## Deployment

The template includes CI/CD workflows for deploying to free-tier services:

- **API**: Render (Docker) — auto-deploys after CI passes via deploy hook
- **Frontend**: Cloudflare Pages — built and deployed via GitHub Actions
- **Database**: Turso — managed libSQL, migrations run automatically in CD pipeline

See [docs/deployment.md](docs/deployment.md) for full setup instructions.

## Docker

```bash
# Build backend
docker build -f Dockerfile.api -t app-api .

# Build frontend
docker build -f Dockerfile.web -t app-web .
```

## Starting fresh

Run `bun run clean` to remove the example items module. This leaves you with the auth system, infrastructure, and patterns ready for your own features. See [docs/adding-a-feature.md](docs/adding-a-feature.md) for a step-by-step guide.

## Documentation

- [Architecture](docs/architecture.md) — Project structure and design decisions
- [Backend](docs/backend.md) — API layer, middleware, error handling
- [Database](docs/database.md) — Turso, Drizzle ORM, migrations
- [Frontend](docs/frontend.md) — SolidJS, routing, API client
- [Testing](docs/testing.md) — TDD approach, test patterns
- [Result Pattern](docs/result-pattern.md) — Error handling without exceptions
- [Adding a Feature](docs/adding-a-feature.md) — Step-by-step guide
- [Deployment](docs/deployment.md) — Turso, Render, Cloudflare Pages setup
