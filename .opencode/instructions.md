# Instrucciones del proyecto

Responder siempre en **castellano**.

## Proyecto

Monorepo fullstack TypeScript con Bun workspaces. Stack: Hono (backend) + SolidJS (frontend) + Turso/Drizzle (BD) + Zod (validación).

Referencia completa de decisiones técnicas: `docs/project-context.md`.

---

## Reglas de arquitectura — Backend

### Patrón obligatorio: Result<T, E>

**Nunca** usar `throw`. Todos los errores se retornan como `Result`:

```ts
// CORRECTO
return err(appError('NOT_FOUND', 'Item not found'));

// INCORRECTO
throw new Error('Item not found');
```

### Use-cases: factory functions, un fichero por operación

```ts
// use-cases/create-item.ts
export type CreateItem = (input: CreateItemInput, userId: string) => Promise<Result<ItemResponse, AppError>>;

export function createCreateItem(repo: ItemsRepository): CreateItem {
  return async (input, userId) => {
    const result = Item.create(input.name, userId);
    if (!result.ok) return result;
    await repo.create(result.value);
    return ok(result.value.toResponse());
  };
}
```

### Entidades del dominio: clases con constructor private

```ts
export class Item {
  private constructor(public readonly id: string, ...) {}
  static create(...): Result<Item, AppError> { ... }
  static fromPersistence(...): Item { ... }
  toResponse(): ItemResponse { ... }
}
```

### Infrastructure: factory functions (NO clases)

```ts
// CORRECTO
export function createItemsRepository(db: DrizzleDb): ItemsRepository { ... }

// INCORRECTO
export class ItemsRepository { ... }
```

### Logging

Usar `c.var.log` (RequestLogger) en las API routes. En use-cases, aceptar `log?: RequestLogger` como parámetro opcional. **Nunca** `console.log` en código de producción.

```ts
log?.info('item_created', { itemId: item.id, userId });
log?.warn('item_not_found', { itemId });
```

---

## Reglas de arquitectura — Frontend

### 3 capas: Vista → Controlador → Service

```
Vista (.tsx)  →  Controlador (.ctrl.ts)  →  Service (.service.ts)  →  API + Validations
```

- **Vista**: solo JSX, sin lógica
- **Controlador**: `createStore` de solid-js/store, handlers, conoce SolidJS pero no la API
- **Service**: valida con Zod + llama a la API, retorna `ServiceResult<T>`

### Estado reactivo

Usar `createStore` por defecto (no múltiples `createSignal`):

```ts
const [state, setState] = createStore({
  loading: false,
  errors: {} as FieldErrors,
  generalError: '',
});
```

---

## Naming conventions

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Módulo/tabla/repositorio | plural kebab-case | `user-profiles`, `userProfilesTable` |
| Entidad/use-case | singular | `UserProfile`, `createUserProfile` |
| Ficheros | kebab-case | `create-user-profile.ts` |
| Componentes React/Solid | PascalCase | `UserProfile.tsx` |

---

## Workflow de desarrollo

### TDD (backend)

1. Escribir el test primero
2. Implementar hasta que pase
3. Refactorizar

### Antes de commitear

```bash
bun run typecheck && bun run lint && bun run test && bun run arch-check
```

El pre-push hook ejecuta estos 4 automáticamente.

### Generador de features

```bash
bun run generate feature <nombre>
# Genera módulo CRUD completo (backend + shared, no frontend)
```

---

## Imports

- Shared package: `@repo/shared` (en template) / `@{projectName}/shared` (en proyectos clonados)
- No importar entre `apps/backend` y `apps/frontend` directamente — solo a través de `packages/shared`
