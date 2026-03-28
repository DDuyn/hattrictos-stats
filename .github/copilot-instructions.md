# Copilot Instructions — bun-monorepo-template

Responder siempre en **castellano**.

## Stack

Bun monorepo · Hono (backend) · SolidJS + Vite + TailwindCSS v4 (frontend) · Turso + Drizzle ORM · Zod · JWT auth · Biome (lint/format)

## Arquitectura backend

### Result pattern — nunca throw

```ts
// CORRECTO
import { ok, err } from '@repo/shared';
return err(appError('NOT_FOUND', 'Not found'));

// INCORRECTO
throw new Error('Not found');
```

### Use-cases: factory function, un fichero por operación

```ts
export function createGetItem(repo: ItemsRepository): GetItem {
  return async (id, userId) => {
    const item = await repo.findById(id);
    if (!item) return err(appError('NOT_FOUND', 'Item not found'));
    if (item.userId !== userId) return err(appError('UNAUTHORIZED', 'Forbidden'));
    return ok(item.toResponse());
  };
}
```

### Dominio: clases con `private constructor` + static `create()` + `fromPersistence()`

### Infrastructure y API: **factory functions** (no clases)

### Logging

Usar `c.var.log?.info/warn/error(event, data)`. **Nunca** `console.log`.

## Arquitectura frontend (SolidJS)

```
Vista (.tsx) → Controlador (.ctrl.ts) → Service (.service.ts) → api.ts + validations.ts
```

- Vista: solo JSX
- Controlador: `createStore` de `solid-js/store`, handlers
- Service: Zod validation + fetch, retorna `{ ok: true; value } | { ok: false; fieldErrors } | { ok: false; error }`

## Naming

| Qué | Convención |
|-----|-----------|
| Módulos/tablas | plural (`user-profiles`, `userProfilesTable`) |
| Entidades/use-cases | singular (`UserProfile`, `createUserProfile`) |
| Componentes Solid | PascalCase (`UserProfile.tsx`) |
| Ficheros | kebab-case |

## Imports

- Package compartido: `@repo/shared` (template) / `@{projectName}/shared` (proyectos clonados)
- No importar entre `apps/backend` ↔ `apps/frontend` directamente

## Checks obligatorios antes de commit

```bash
bun run typecheck && bun run lint && bun run test && bun run arch-check
```

El hook pre-push los ejecuta automáticamente.

## Generador

```bash
bun run generate feature <nombre>   # CRUD completo backend + shared
```
