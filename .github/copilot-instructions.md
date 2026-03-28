# Copilot Instructions — hattrictos-stats

Responder siempre en **castellano**.

## Qué es este proyecto

Web pública de consulta de estadísticas históricas de ligas privadas de Hattrick Arena. Los datos provienen de la API CHPP de Hattrick. Los visitantes no necesitan login. Solo los admins sincronizan datos vía OAuth 1.0a.

## Stack

Bun monorepo · Hono (backend) · SolidJS + Vite + TailwindCSS v4 (frontend) · Turso + Drizzle ORM · Zod · JWT auth · Biome (lint/format)

## CHPP — Reglas estrictas

### NUNCA
- Web scraping contra hattrick.org
- Mostrar datos privados de equipos ajenos (habilidades, finanzas)
- Llamar a la API CHPP sin cachear en BD
- Hardcodear tokens OAuth en el código
- Usar OAuth 2.0 (CHPP usa 1.0a)
- Ignorar errores `429` de la API

### SIEMPRE
- Usar solo la API CHPP para datos de Hattrick
- Cachear XML de CHPP en BD antes de procesar
- Incluir atribución "Powered by CHPP" en el frontend
- Todas las llamadas a CHPP desde el backend, nunca desde el frontend
- Ver `docs/chpp-reglas.md` ante cualquier duda

## Arquitectura backend

### Result pattern — nunca throw

```ts
// CORRECTO
import { ok, err } from '@hattrictos-stats/shared';
return err(appError('NOT_FOUND', 'Not found'));

// INCORRECTO
throw new Error('Not found');
```

### Use-cases: factory function, un fichero por operación

```ts
export function createGetMatch(repo: MatchesRepository): GetMatch {
  return async (id) => {
    const match = await repo.findById(id);
    if (!match) return err(appError('NOT_FOUND', 'Match not found'));
    return ok(match.toResponse());
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
| Módulos/tablas | plural (`matches`, `matchesTable`) |
| Entidades/use-cases | singular (`Match`, `createMatch`) |
| Componentes Solid | PascalCase (`StandingsTable.tsx`) |
| Ficheros | kebab-case |

## Imports

- Package compartido: `@hattrictos-stats/shared`
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
