# Guía de componentes frontend

Documento práctico para entender cómo funciona el sistema de componentes UI de este template, cómo personalizarlos y cómo crear nuevos. Orientado a alguien con más experiencia en backend que en frontend.

---

## 1. Cómo funciona el tema (`@theme`)

### El archivo `index.css`

Todo el sistema visual del proyecto parte de un único sitio: `apps/frontend/src/index.css`.

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

Las variables dentro de `@theme` son **CSS custom properties** que Tailwind v4 convierte automáticamente en clases de utilidad. No hay ningún archivo de configuración adicional.

### Cómo se traduce un color a clases

Cuando defines `--color-primary: #4f46e5`, Tailwind genera automáticamente **todas** estas clases:

| Custom property       | Clases Tailwind disponibles                          |
|-----------------------|------------------------------------------------------|
| `--color-primary`     | `bg-primary`, `text-primary`, `border-primary`       |
| `--color-primary-hover` | `bg-primary-hover`, `hover:bg-primary-hover`       |
| `--color-primary-light` | `bg-primary-light`, `text-primary-light`           |
| `--color-danger`      | `bg-danger`, `text-danger`, `border-danger`          |
| `--color-danger-light` | `bg-danger-light`                                   |

También puedes usar opacidad con `/`:
- `bg-primary/10` — fondo primary al 10% de opacidad
- `focus:ring-primary/30` — ring de focus al 30% (así lo usa `Input.tsx`)

### Cambiar los colores del proyecto

Si arrancas un proyecto nuevo desde este template y quieres usar verde en lugar de índigo, solo cambias los valores hex en `index.css`:

```css
@theme {
  --color-primary: #16a34a;        /* verde-600 */
  --color-primary-hover: #15803d;  /* verde-700 */
  --color-primary-light: #dcfce7;  /* verde-100 */
}
```

Todos los botones, inputs en focus y demás componentes que usan `bg-primary` se actualizan solos. No hay que tocar ningún componente.

### Añadir un color nuevo

Supón que necesitas un color `secondary` para botones secundarios:

**Paso 1** — Añade las variables en `index.css`:
```css
@theme {
  /* ... colores existentes ... */

  --color-secondary: #6b7280;
  --color-secondary-hover: #4b5563;
  --color-secondary-light: #f3f4f6;
}
```

**Paso 2** — Ya puedes usar `bg-secondary`, `text-secondary`, `hover:bg-secondary-hover` en cualquier componente o vista. Nada más que hacer.

---

## 2. Anatomía de un componente UI

Los componentes viven en `apps/frontend/src/components/ui/`. Son wrappers ligeros sobre HTML + Tailwind. No contienen lógica de negocio.

### Estructura básica

Todo componente tiene la misma forma:

```
1. Interface de props (qué acepta el componente)
2. Función que devuelve JSX
3. Clases calculadas a partir de los props
4. El HTML con las clases aplicadas
```

### `Button.tsx` anotado

```tsx
import type { JSX } from 'solid-js';

// 1. INTERFACE DE PROPS
// Define exactamente qué puede recibir este componente.
// Cada prop tiene un tipo. El '?' significa que es opcional.
interface ButtonProps {
  children: JSX.Element;                      // El texto/contenido del botón (obligatorio)
  onClick?: () => void;                       // Función a ejecutar al hacer click (opcional)
  type?: 'submit' | 'button';                 // Tipo HTML del botón (opcional, defecto: 'button')
  variant?: 'primary' | 'danger' | 'ghost';   // Estilo visual (opcional, defecto: 'primary')
  disabled?: boolean;                         // Si está deshabilitado (opcional)
  class?: string;                             // Clases extra desde fuera (opcional)
}

export function Button(props: ButtonProps) {
  // 2. CLASES BASE
  // Estas clases se aplican siempre, independientemente de la variante.
  const baseClasses = 'rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50';

  // 3. CLASES POR VARIANTE
  // Función reactiva (arrow function) que devuelve las clases
  // correspondientes a la variante solicitada.
  // 'props.variant ?? "primary"' significa: usa props.variant,
  // y si no se pasó, usa 'primary' por defecto.
  const variantClasses = () => {
    switch (props.variant ?? 'primary') {
      case 'primary':
        return 'bg-primary text-white px-4 py-2 hover:bg-primary-hover disabled:cursor-not-allowed';
      case 'danger':
        return 'text-danger hover:text-danger-hover';
      case 'ghost':
        return 'text-gray-500 hover:text-gray-700';
    }
  };

  // 4. COMBINAR CLASES
  // Junta base + variante + cualquier clase extra que venga de fuera.
  // 'props.class ?? ""' evita que aparezca "undefined" si no se pasa class.
  const classes = () => `${baseClasses} ${variantClasses()} ${props.class ?? ''}`;

  // 5. JSX
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      class={classes()}
    >
      {props.children}
    </button>
  );
}
```

### `Input.tsx` anotado

```tsx
interface InputProps {
  label?: string;           // Texto encima del input
  value: string;            // Valor actual (controlado desde el controlador)
  onInput: (value: string) => void;  // Callback cuando el usuario escribe
  type?: string;            // 'text', 'email', 'password', etc.
  placeholder?: string;     // Texto gris cuando está vacío
  error?: string;           // Mensaje de error inline (viene del controlador)
  class?: string;           // Clases extra para ajustar desde fuera (ej: 'flex-1')
}

export function Input(props: InputProps) {
  // Las clases del <input> cambian según si hay error o no.
  // Si hay error → rojo. Si no → gris/primary en focus.
  const inputClasses = () =>
    [
      'w-full bg-gray-50 border rounded-lg px-3 py-2 text-sm transition-colors',
      'focus:outline-none focus:bg-white focus:ring-2',
      props.error
        ? 'border-danger focus:ring-danger/30 text-danger placeholder:text-danger/50'
        : 'border-gray-200 focus:ring-primary/30 focus:border-primary',
      props.class ?? '',
    ].join(' ');  // join(' ') une el array en un string separado por espacios

  return (
    <div class="flex flex-col gap-1">
      {/* El label solo se renderiza si se pasó la prop */}
      {props.label && (
        <label class="text-sm font-medium text-gray-700">{props.label}</label>
      )}
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onInput={(e) => props.onInput(e.currentTarget.value)}
        placeholder={props.placeholder}
        class={inputClasses()}
      />
      {/* El error solo se renderiza si existe */}
      {props.error && (
        <p class="text-xs text-danger">{props.error}</p>
      )}
    </div>
  );
}
```

### El prop `class` — para extensión puntual

Los componentes tienen estilos base propios, pero a veces necesitas ajustarlos en un contexto concreto. Para eso existe el prop `class`:

```tsx
{/* En un formulario con layout horizontal, el input necesita ocupar el espacio disponible */}
<Input
  value={ctrl.state.newName}
  onInput={(v) => ctrl.setState('newName', v)}
  placeholder="Nombre del item..."
  class="flex-1"   {/* ← solo añade flex-1, no sobreescribe los estilos base */}
/>

{/* Un botón de submit que ocupa todo el ancho */}
<Button type="submit" class="w-full">
  Guardar
</Button>
```

Úsalo para **layout y tamaño** (`flex-1`, `w-full`, `mt-4`). No lo uses para cambiar colores — para eso están las variantes o el tema.

---

## 3. Recetas prácticas

### Receta 1: Añadir una variante a Button

**Ejemplo:** añadir `secondary` para acciones menos importantes.

**Paso 1** — Asegúrate de tener el color en `index.css` (si no, añádelo como se describe en la sección 1):
```css
@theme {
  --color-secondary: #6b7280;
  --color-secondary-hover: #4b5563;
}
```

**Paso 2** — Añade el nuevo valor al tipo en la interface de `Button.tsx`:
```tsx
// Antes
variant?: 'primary' | 'danger' | 'ghost';

// Después
variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
```

**Paso 3** — Añade el case en el switch:
```tsx
case 'secondary':
  return 'bg-secondary text-white px-4 py-2 hover:bg-secondary-hover disabled:cursor-not-allowed';
```

**Paso 4** — Ya puedes usarlo en cualquier vista:
```tsx
<Button variant="secondary">Cancelar</Button>
```

TypeScript te avisará si escribes mal el nombre de la variante (`variant="secundary"` dará error en el editor).

---

### Receta 2: Añadir un nuevo prop a un componente existente

**Ejemplo:** añadir `size` a Button para tener botones pequeños, medianos y grandes.

**Paso 1** — Añade la prop a la interface:
```tsx
interface ButtonProps {
  // ... props existentes ...
  size?: 'sm' | 'md' | 'lg';  // opcional, defecto: 'md'
}
```

**Paso 2** — Añade la lógica de clases (como `variantClasses`, crea `sizeClasses`):
```tsx
const sizeClasses = () => {
  switch (props.size ?? 'md') {
    case 'sm': return 'text-xs px-3 py-1.5';
    case 'md': return 'text-sm px-4 py-2';
    case 'lg': return 'text-base px-6 py-3';
  }
};
```

**Paso 3** — Incluye `sizeClasses()` en la combinación de clases. Ojo: si antes `variantClasses` incluía padding (`px-4 py-2`), hay que quitarlo de ahí para que no conflicte:
```tsx
const classes = () => `${baseClasses} ${variantClasses()} ${sizeClasses()} ${props.class ?? ''}`;
```

**Paso 4** — Uso:
```tsx
<Button size="sm" variant="ghost">Editar</Button>
<Button size="lg">Crear cuenta</Button>
```

---

### Receta 3: Crear un componente nuevo desde cero

**Ejemplo:** un componente `Badge` para mostrar etiquetas de estado (`active`, `inactive`).

**Checklist antes de crearlo:**
- [ ] ¿Lo voy a usar 3 o más veces en distintas vistas? Si solo lo usas una vez, ponlo inline en la vista.
- [ ] ¿Solo renderiza datos que recibe por props, sin lógica de negocio? Si necesita llamar a la API o acceder al store, no va en `ui/`.

**Paso 1** — Crea el archivo `apps/frontend/src/components/ui/Badge.tsx`:
```tsx
import type { JSX } from 'solid-js';

interface BadgeProps {
  children: JSX.Element;
  variant?: 'success' | 'neutral' | 'danger';
  class?: string;
}

export function Badge(props: BadgeProps) {
  const variantClasses = () => {
    switch (props.variant ?? 'neutral') {
      case 'success': return 'bg-green-100 text-green-700';
      case 'neutral': return 'bg-gray-100 text-gray-600';
      case 'danger':  return 'bg-danger-light text-danger';
    }
  };

  const classes = () =>
    `inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${variantClasses()} ${props.class ?? ''}`;

  return <span class={classes()}>{props.children}</span>;
}
```

**Paso 2** — Úsalo en una vista:
```tsx
import { Badge } from '../../components/ui/Badge';

// En la lista de items de Home.tsx
<Badge variant={item.status === 'active' ? 'success' : 'neutral'}>
  {item.status}
</Badge>
```

**Template base** para cualquier componente nuevo:

```tsx
import type { JSX } from 'solid-js';

interface NombreComponenteProps {
  // prop obligatoria de ejemplo
  children: JSX.Element;
  // props opcionales
  variant?: 'default' | 'otra';
  class?: string;  // siempre incluir esto
}

export function NombreComponente(props: NombreComponenteProps) {
  const classes = () =>
    `clases-base-aqui ${props.class ?? ''}`;

  return (
    <div class={classes()}>
      {props.children}
    </div>
  );
}
```

---

### Receta 4: Personalizar un componente puntualmente desde la vista

A veces el componente está bien pero en un contexto concreto necesita un ajuste mínimo. Opciones por orden de preferencia:

**Opción A — Usar el prop `class` (para layout y espaciado):**
```tsx
{/* El Input normalmente ocupa el 100% de su contenedor.
    En un form horizontal necesito que ocupe el espacio disponible. */}
<Input value={...} onInput={...} class="flex-1" />
```

**Opción B — Usar el prop `class` para sobrescribir (con cautela):**

Tailwind aplica las clases en orden de aparición en el CSS generado, no en el HTML. Esto puede hacer que sobrescribir con `class` no funcione siempre. Si necesitas sobrescribir un color o tamaño específico de forma consistente, es mejor añadir una variante al componente (Receta 2).

**Opción C — Envolver el componente en un contenedor:**
```tsx
{/* Si necesitas centrar un botón sin modificar Button */}
<div class="flex justify-center">
  <Button>Guardar</Button>
</div>
```

---

## 4. Reglas del template

### Cuándo extraer un componente a `ui/`

**Extrae cuando:**
- Lo repites **3 o más veces** en distintas vistas con la misma estructura
- Tiene lógica de presentación no trivial (como el cambio de clases por error en `Input`)

**No extraigas cuando:**
- Solo lo usas en un sitio — ponlo directamente en la vista
- Necesita acceder al store o llamar servicios — eso va en el controlador, no en `ui/`

### Siempre incluir el prop `class`

Todos los componentes de `ui/` deben aceptar un prop `class?: string` y aplicarlo al elemento raíz. Esto permite ajustes de layout sin modificar el componente:

```tsx
// ✅ Bien — el componente acepta class y lo aplica
const classes = () => `estilos-base ${props.class ?? ''}`;
<div class={classes()}>...</div>

// ❌ Mal — el componente ignora class, no se puede ajustar desde fuera
<div class="estilos-base">...</div>
```

### Los componentes `ui/` no tienen lógica de negocio

Un componente de `ui/` solo:
- Recibe datos por props
- Aplica estilos según esos datos
- Llama callbacks cuando el usuario interactúa

No debe:
- Importar servicios (`auth.service`, `item.service`)
- Importar el store o el controlador
- Hacer llamadas a la API
- Conocer conceptos del dominio (qué es un "item", qué es un "usuario")

```tsx
// ✅ Bien — el componente recibe un string y lo muestra
<Badge variant="success">active</Badge>

// ❌ Mal — el componente sabe lo que es un ItemResponse
function ItemBadge({ item }: { item: ItemResponse }) { ... }
```

### Dónde van los distintos tipos de componentes

| Tipo | Dónde | Ejemplo |
|------|-------|---------|
| Elemento UI reutilizable (3+ usos) | `components/ui/` | `Button`, `Input`, `Badge` |
| Layout y estructura de página | `components/` | `Layout.tsx` |
| Componente específico de una página | Dentro de `pages/[feature]/` | Un `ItemRow` solo usado en `Home.tsx` |
