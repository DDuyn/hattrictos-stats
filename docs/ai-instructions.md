# Instrucciones para el Modelo

Reglas y preferencias para cualquier modelo de IA que trabaje en este proyecto o en proyectos derivados de este template.

---

## Comunicación

- **Hablar siempre en castellano** (español de España)
- **Código y documentación técnica en inglés** (nombres de variables, funciones, commits, comentarios en código, nombres de archivos)
- Ser directo y conciso, sin rodeos ni cumplidos innecesarios
- Si algo no tiene sentido o hay una forma mejor, decirlo directamente

---

## Perfil del usuario

- Desarrollador solo (no hay equipo)
- Backend es su punto fuerte, frontend es secundario
- Valora la simplicidad — no sobreingeniería
- Prefiere entender cada decisión antes de implementarla
- TDD como metodología de desarrollo

---

## Convenciones de código

### Estructura de archivos (backend)

Cada feature module sigue el patrón de **vertical slices con use-cases**:

```
modules/[feature]/
├── domain/
│   └── [entity].ts               # Entidad con comportamiento
├── infrastructure/
│   ├── [feature].table.ts        # Tabla Drizzle
│   └── [feature].repository.ts   # Interfaz + factory de acceso a datos
├── use-cases/
│   ├── create-[entity].ts        # Una factory function por operación
│   ├── get-[entity].ts
│   └── ...
├── tests/
│   ├── [entity].test.ts          # Tests de la entidad
│   ├── create-[entity].test.ts   # Un test file por use-case
│   └── ...
└── [feature].api.ts              # Sub-app Hono (composition root, conecta use-cases)
```

No todos los módulos necesitan todas las capas. Si no hay lógica de negocio (ej: health), un solo archivo basta.

### Manejo de errores

- **Nunca usar `throw` para errores de negocio.** Siempre retornar `Result<T, AppError>`
- Las excepciones son solo para errores inesperados (problemas de conexión, corrupción de datos)
- El middleware global `errorHandler` captura excepciones no controladas

### Entidades de dominio

- Constructor `private`
- Factory `create()` que valida y retorna `Result`
- `fromPersistence()` para reconstruir desde BD (sin validar)
- `toResponse()` para convertir a la forma de la API
- Transiciones de estado como métodos explícitos

### Use-cases

- Cada operación es una función independiente con su propio archivo
- Exportan un **type** (firma de la función) y una **factory** (crea la función con dependencias inyectadas)
- Retornan `Promise<Result<T, AppError>>`
- Reciben el repositorio como parámetro (DI manual)
- Orquestan lógica de negocio, no contienen lógica de infraestructura

### API handlers

- Validar input con Zod (`safeParse`)
- Llamar al use-case
- Mapear `Result` a respuesta HTTP (`ok` → 200/201, `err` → status según `ErrorCode`)

### Schemas compartidos

- Definir en `packages/shared/src/schemas/`
- Exportar desde `packages/shared/src/index.ts`
- Los schemas Zod son la fuente de verdad para tipos compartidos entre backend y frontend

---

## Testing

- **TDD**: escribir el test primero, implementar después
- Testear **dominio y use-cases**, no API routes ni repositorios
- **Mock repositories** con `Map` en memoria, sin librerías de mocking
- Un comportamiento por test
- Nombres de tests descriptivos que lean como especificaciones
- Patrón Arrange-Act-Assert
- Un archivo de test por entidad y uno por use-case, dentro de `tests/`

---

## Reglas de implementación

### Hacer

- Seguir la estructura existente de archivos y carpetas (`domain/`, `infrastructure/`, `use-cases/`, `tests/`)
- Usar el Result pattern para todos los errores de negocio
- Crear un archivo por use-case en `use-cases/` con type + factory function
- Añadir schemas Zod en `@repo/shared` para todo dato que cruce la frontera backend/frontend
- Exportar las tablas nuevas desde `infrastructure/db/schema.ts`
- Montar rutas nuevas en `app.ts`
- Generar migraciones con `db:generate` después de cambios de esquema
- Seguir el checklist de `docs/adding-a-feature.md` al crear nuevos módulos

### No hacer

- No usar `throw` para errores esperados de negocio
- No usar librerías de mocking — solo mock repositories con `Map`
- No usar contenedores de DI — inyección manual por parámetros
- No poner lógica de negocio en los API handlers — eso va en el use-case
- No poner validación de invariantes en el use-case — eso va en la entidad de dominio
- No crear archivos innecesarios — si un módulo no necesita dominio, no crear `domain/`
- No sobreingeniería — si algo simple funciona, no añadir abstracciones innecesarias
- No usar `db:push` — siempre `db:generate` + `db:migrate`

---

## Git

- **Commits en inglés**, concisos, siguiendo conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`
- No commitear archivos `.env`, credenciales ni tokens
- Las migraciones SQL generadas sí se commitean (son parte del historial)
- Pre-push hook (Lefthook) ejecuta lint + typecheck + test antes de cada push

---

## Deploy

- Cada proyecto nuevo necesita su propia infraestructura (Turso DB, Render service, Cloudflare Pages project)
- Seguir `docs/deployment.md` para la configuración paso a paso
- Render Auto-Deploy debe estar **desactivado** — solo Deploy Hook desde GitHub Actions
- Las migraciones se ejecutan en CD **antes** del deploy del backend

---

## CHPP (API de Hattrick)

Este proyecto consume datos de la **API CHPP de Hattrick**. Estas reglas son **no negociables**.

### NUNCA hacer

- Implementar web scraping contra hattrick.org o cualquier subdominio
- Acceder a datos privados de equipos ajenos: habilidades de jugadores, finanzas, órdenes de entrenamiento
- Hacer llamadas a la API CHPP sin cachear el resultado en BD (excepto durante el flujo OAuth)
- Almacenar `consumer_key`, `consumer_secret`, `access_token` o `access_token_secret` en el código fuente o en archivos comiteados
- Usar OAuth 2.0 — CHPP usa OAuth 1.0a exclusivamente
- Ignorar errores `429` de la API — siempre implementar backoff exponencial
- Hacer fetch directo a hattrick.org desde el frontend — todas las llamadas a CHPP son desde el backend

### SIEMPRE hacer

- Usar la API CHPP para obtener datos (nunca scraping, nunca fetch manual a HTML de HT)
- Cachear respuestas en BD local antes de devolver datos al frontend
- Parsear las respuestas XML de CHPP a objetos TypeScript antes de procesar
- Incluir atribución "Powered by CHPP" visible en el frontend
- Manejar el error `401` de la API: marcar token como inactivo y notificar al admin
- Consultar `docs/chpp-reglas.md` ante cualquier duda sobre qué datos se pueden mostrar
- Verificar el elemento `<Error>` en cada respuesta XML antes de procesarla (CHPP puede devolver `200` con error interno)

### Datos que se pueden mostrar de equipos ajenos

- Resultados de partidos
- Goles y eventos de partido (goleadores, tarjetas, lesiones)
- Alineaciones de partidos ya jugados
- Nombre, ID y datos básicos de jugadores
- Nombre y datos públicos del equipo

### Datos que NUNCA se pueden mostrar de equipos ajenos

- Habilidades (skills) de jugadores
- Finanzas del club
- Cualquier dato marcado como privado por la API

### Arquitectura de sincronización

```
Admin OAuth → Backend job → CHPP API → Parsear XML → Guardar en BD → API REST → Frontend
```

Los visitantes nunca interactúan con CHPP directamente. Solo el backend backend accede a la API.

### Documentación CHPP del proyecto

- `docs/chpp-reglas.md` — Reglas completas y modelo de acceso
- `docs/chpp-api-endpoints.md` — Endpoints, parámetros y estructura XML
- `docs/chpp-oauth.md` — Flujo OAuth 1.0a y gestión de tokens
- `docs/chpp-match-events.md` — Tipos de eventos para parsear goles, tarjetas, etc.

---

## Contexto adicional

- Leer `docs/project-context.md` para entender qué es hattrictos-stats, su propósito y arquitectura
- Leer `docs/adding-a-feature.md` para la guía paso a paso de crear un módulo nuevo
- Leer `docs/result-pattern.md` para entender el patrón Result en detalle
- Leer `docs/testing.md` para las convenciones de testing
- Leer `docs/deployment.md` para la guía de despliegue (en castellano)
