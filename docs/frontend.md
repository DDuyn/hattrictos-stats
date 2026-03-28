# Frontend

## Stack

- **SolidJS** — reactive UI framework (fine-grained reactivity, no virtual DOM)
- **@solidjs/router** — client-side routing
- **Vite** — dev server and bundler
- **TailwindCSS v4** — utility-first CSS (via Vite plugin)
- **TypeScript** — with `jsxImportSource: "solid-js"`

## Project structure

```
apps/frontend/
├── index.html                  # HTML shell, Google Fonts preconnect
├── vite.config.ts              # Vite + SolidJS + Tailwind plugins
├── tsconfig.json               # SolidJS JSX config
└── src/
    ├── index.tsx               # Entry point: Router setup, route definitions
    ├── index.css               # Tailwind import + @theme custom properties
    ├── components/
    │   ├── Layout.tsx          # Shared nav + main wrapper
    │   └── ui/
    │       ├── Button.tsx      # Reusable button (primary / danger / ghost)
    │       └── Input.tsx       # Reusable input with optional inline error
    ├── domain/
    │   ├── validation.ts       # FieldErrors type, ValidationResult<T>, zodIssuesToFieldErrors()
    │   ├── auth/
    │   │   ├── auth.api.ts     # Raw fetch calls to /api/auth/*
    │   │   ├── auth.validations.ts  # Client-side Zod validation → FieldErrors
    │   │   └── auth.service.ts # Orchestrates validation + API, returns AuthServiceResult<T>
    │   └── item/
    │       ├── item.api.ts     # Raw fetch calls to /api/items/*
    │       ├── item.validations.ts  # Client-side Zod validation → FieldErrors
    │       └── item.service.ts # Orchestrates validation + API, returns ItemServiceResult<T>
    ├── pages/
    │   ├── home/
    │   │   ├── home.ctrl.ts    # Home controller (state, handlers)
    │   │   └── Home.tsx        # Home view (renders ctrl state)
    │   └── login/
    │       ├── login.ctrl.ts   # Login controller (state, handlers)
    │       └── Login.tsx       # Login view (renders ctrl state)
    └── lib/
        └── api-client.ts       # request(), setToken(), clearToken(), isAuthenticated()
```

## Architecture: 3-layer pattern

Every feature page follows the same layered structure:

```
View (*.tsx)
  └── reads state from controller, calls controller handlers
Controller (*.ctrl.ts)
  └── manages UI state with createStore, calls domain services
Domain service (domain/[feature]/[feature].service.ts)
  └── validates input, calls API, returns tagged union result
```

**Why this separation:**
- Views are pure renderers — no fetch calls, no business logic
- Controllers hold all state transitions — easy to reason about
- Domain services are reusable across controllers and testable in isolation

### Domain service results

Services return a **tagged union** with three possible shapes:

```ts
type ServiceResult<T> =
  | { ok: true; value: T }           // success
  | { ok: false; fieldErrors: FieldErrors }  // validation failed (client-side)
  | { ok: false; error: AppError }   // API/server error
```

Controllers distinguish between the two failure cases using `'fieldErrors' in result`:

```ts
const result = await login(email, password);
if (!result.ok) {
  if ('fieldErrors' in result) {
    setState({ errors: result.fieldErrors }); // show inline field errors
  } else {
    setState({ generalError: result.error.message }); // show banner error
  }
  return;
}
setToken(result.value.token);
navigate('/');
```

### Validation types

`src/domain/validation.ts` defines the frontend-only validation types:

```ts
// Map of field name → error message
export type FieldErrors = Record<string, string>;

// Result of client-side validation before any API call
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: FieldErrors };
```

These types are **frontend-only**. `AppError` in `@repo/shared` is unchanged.

## Controllers

Controllers are factory functions that return state + handlers:

```ts
export function createLoginCtrl(navigate: Navigator) {
  const [state, setState] = createStore({
    email: '',
    password: '',
    loading: false,
    errors: {} as FieldErrors,
    generalError: '',
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    setState({ errors: {}, generalError: '', loading: true });

    const result = await login(state.email, state.password);
    setState('loading', false);

    if (!result.ok) {
      if ('fieldErrors' in result) {
        setState({ errors: result.fieldErrors });
      } else {
        setState({ generalError: result.error.message });
      }
      return;
    }

    setToken(result.value.token);
    navigate('/');
  }

  return { state, setState, handleLogin };
}
```

**Key points:**
- `createStore` is the default for page state — access is without parentheses (`state.email`, not `email()`)
- `errors: {} as FieldErrors` — map of field name to error message, empty when no errors
- `generalError: ''` — for API-level errors that don't belong to a specific field
- Always clear both before a new submission

## UI components

Reusable components live in `src/components/ui/`. They are thin wrappers over HTML + Tailwind and always accept a `class` prop for extension.

### `Button`

```tsx
<Button>Save</Button>                          // primary (default)
<Button variant="danger">Delete</Button>       // text-only danger style
<Button variant="ghost">Cancel</Button>        // text-only muted style
<Button type="submit" disabled={loading}>      // submit button
<Button onClick={fn} class="w-full">          // with extra classes
```

Props: `variant?: 'primary' | 'danger' | 'ghost'`, `type?`, `disabled?`, `onClick?`, `class?`

### `Input`

```tsx
<Input
  label="Email"
  value={state.email}
  onInput={(v) => setState('email', v)}
  type="email"
  placeholder="you@example.com"
  error={state.errors.email}   // shows red border + error text below when set
/>
```

Props: `label?`, `value`, `onInput`, `type?`, `placeholder?`, `error?`, `class?`

When `error` is set the border turns red, focus ring turns red, and a small error message appears below the field.

## Theme system

Custom design tokens are defined in `src/index.css` using TailwindCSS v4's `@theme` directive:

```css
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

Each `--color-*` variable automatically generates Tailwind utility classes:

| CSS variable | Generated utilities |
|---|---|
| `--color-primary` | `bg-primary`, `text-primary`, `border-primary`, `ring-primary`, `bg-primary/30` … |
| `--color-danger` | `bg-danger`, `text-danger`, `border-danger`, `ring-danger` … |

To change the brand color, edit `--color-primary` in `index.css` — no other files need changing.

## API client

`src/lib/api-client.ts` is the HTTP transport layer. It is **not** organized by resource — resource-specific calls live in `domain/[feature]/[feature].api.ts`.

```ts
// Generic request function
export async function request<T>(path: string, options?: RequestInit): Promise<T>

// Token management
export function setToken(token: string): void
export function clearToken(): void
export function isAuthenticated(): boolean
```

`request()` behavior:
- Prepends `/api` (or `VITE_API_URL`) to all paths
- Adds `Content-Type: application/json` automatically
- Attaches JWT from `localStorage` as `Authorization: Bearer <token>` if present
- Throws `Error` with the server's error message on non-2xx responses
- Returns `undefined` for 204 (No Content) responses

Domain API files call `request()` directly:

```ts
// domain/auth/auth.api.ts
export const authApi = {
  login: (data: LoginInput) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: RegisterInput) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
};
```

## Routing

Routes are defined in `src/index.tsx`:

```tsx
render(
  () => (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
    </Router>
  ),
  root,
);
```

`Layout` is the `root` prop — it wraps every page and receives `RouteSectionProps` (which includes `props.children`). Use `RouteSectionProps`, not `ParentProps`, because the SolidJS router v0.15 requires it for route wrapper components.

## SolidJS patterns

### `createStore` for page state

```ts
const [state, setState] = createStore({
  email: '',
  loading: false,
  errors: {} as FieldErrors,
});

// Read — no parentheses needed (unlike signals)
state.email
state.errors.email

// Write — path-style update
setState('email', newValue);
setState({ errors: result.fieldErrors, loading: false });
```

Use `createSignal` only for 1-2 isolated values. For anything with 3+ related fields, use `createStore`.

### `<Show>` for conditional rendering

```tsx
<Show when={!state.loading} fallback={<p>Loading...</p>}>
  <Show when={state.items.length > 0} fallback={<p>No items yet.</p>}>
    {/* items list */}
  </Show>
</Show>
```

### `<For>` for lists

```tsx
<For each={state.items}>
  {(item) => <li>{item.name}</li>}
</For>
```

`<For>` tracks individual items and only updates the DOM nodes that changed — more efficient than `.map()` in React.

## Vite configuration

```ts
export default defineConfig({
  plugins: [solid(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
```

The dev server proxies `/api/*` to the backend at `localhost:3000` — no CORS issues in development. In production, nginx routes `/api/*` to the backend container.

## Adding a new page

1. **Domain layer** — create `src/domain/[feature]/`:
   - `[feature].api.ts` — raw fetch calls using `request()`
   - `[feature].validations.ts` — client-side Zod validation returning `ValidationResult<T>`
   - `[feature].service.ts` — orchestrates validation + API, returns tagged union result

2. **Controller** — create `src/pages/[feature]/[feature].ctrl.ts`:
   - Use `createStore` for state
   - State includes `errors: {} as FieldErrors` and `generalError: ''`
   - Handlers call service functions and branch on `'fieldErrors' in result`

3. **View** — create `src/pages/[feature]/[feature].tsx`:
   - Instantiate controller with `const ctrl = createFeatureCtrl(navigate)`
   - Render `ctrl.state.*` values; pass `ctrl.handle*` functions as event handlers
   - Pass `ctrl.state.errors.[field]` to each `<Input error={...} />`
   - Show `ctrl.state.generalError` in a banner above the form

4. **Route** — add to `src/index.tsx`:
   ```tsx
   import Feature from './pages/feature/Feature';
   <Route path="/feature" component={Feature} />
   ```

See [Adding a Feature](adding-a-feature.md) for the complete guide including the backend steps.
