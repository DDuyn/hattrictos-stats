# OAuth 1.0a para CHPP — hattrictos-stats

Guía del flujo OAuth 1.0a para autenticar con la API CHPP de Hattrick. **CHPP usa OAuth 1.0a, no OAuth 2.0.** No usar librerías de OAuth 2.0.

Fuente oficial: https://www.hattrick.org/Community/CHPP/oauth/

---

## Prerrequisitos

1. Registrar la aplicación en https://chpp.hattrick.org
2. Obtener `consumer_key` y `consumer_secret` (identifican la app, no al usuario)
3. Definir una `callback_url` a la que Hattrick redirigirá tras la autorización del usuario

---

## URLs de OAuth CHPP

| Paso | URL |
|---|---|
| Request Token | `https://chpp.hattrick.org/oauth/request_token.ashx` |
| Autorización usuario | `https://chpp.hattrick.org/oauth/authorize.aspx` |
| Access Token | `https://chpp.hattrick.org/oauth/access_token.ashx` |
| API CHPP | `https://chpp.hattrick.org/chppxml.ashx` |

---

## Flujo OAuth 1.0a — paso a paso

### Paso 1: Obtener Request Token

Petición firmada desde el **backend** al endpoint de request_token. No interviene el usuario aún.

```
POST https://chpp.hattrick.org/oauth/request_token.ashx

Headers:
  Authorization: OAuth oauth_callback="<callback_url_encoded>",
                       oauth_consumer_key="<CHPP_CONSUMER_KEY>",
                       oauth_nonce="<nonce>",
                       oauth_signature_method="HMAC-SHA1",
                       oauth_timestamp="<unix_timestamp>",
                       oauth_version="1.0",
                       oauth_signature="<firma_hmac_sha1>"
```

Respuesta: `oauth_token=xxx&oauth_token_secret=yyy&oauth_callback_confirmed=true`

Guardar `oauth_token` y `oauth_token_secret` temporalmente (session o BD, TTL corto).

### Paso 2: Redirigir al usuario a Hattrick para autorizar

```
GET https://chpp.hattrick.org/oauth/authorize.aspx?oauth_token=<oauth_token_del_paso1>
```

El admin es redirigido a Hattrick donde autoriza la app. Hattrick devuelve el control a la `callback_url` con:

```
GET <callback_url>?oauth_token=<token>&oauth_verifier=<verifier>
```

### Paso 3: Intercambiar por Access Token

Con el `oauth_verifier` recibido, hacer otra petición firmada para obtener el token definitivo.

```
POST https://chpp.hattrick.org/oauth/access_token.ashx

Headers:
  Authorization: OAuth oauth_consumer_key="<CHPP_CONSUMER_KEY>",
                       oauth_token="<oauth_token_del_paso1>",
                       oauth_nonce="<nuevo_nonce>",
                       oauth_signature_method="HMAC-SHA1",
                       oauth_timestamp="<unix_timestamp>",
                       oauth_verifier="<oauth_verifier>",
                       oauth_version="1.0",
                       oauth_signature="<firma>"
```

Respuesta: `oauth_token=ACCESS_TOKEN&oauth_token_secret=ACCESS_TOKEN_SECRET`

**Guardar de forma segura**: estos son los tokens definitivos. Almacenarlos en variables de entorno o en BD cifrada.

### Paso 4: Usar el Access Token para llamadas a la API

Cada petición a `chppxml.ashx` debe ir firmada con:
- `oauth_consumer_key` + `oauth_consumer_secret` (de la app)
- `oauth_token` + `oauth_token_secret` (del usuario autorizado)

---

## Modelo para hattrictos-stats (token de admin único)

A diferencia de aplicaciones multi-usuario, este proyecto usa **un único token de administrador**:

```
Estado inicial: no hay tokens en BD
       ↓
Admin abre /admin/oauth/connect
       ↓
Backend genera Request Token → redirige a Hattrick
       ↓
Admin autoriza en Hattrick → callback a /admin/oauth/callback
       ↓
Backend obtiene Access Token → guarda en BD (cifrado) o env vars
       ↓
Backend usa ese token para todas las sincronizaciones automáticas
```

Los visitantes de la web nunca pasan por OAuth.

---

## Persistencia del token

Los tokens de acceso CHPP **no tienen fecha de expiración** por defecto, pero pueden ser revocados por el usuario desde su cuenta de Hattrick.

| Situación | Acción |
|---|---|
| Token válido | Usar para todas las llamadas |
| API devuelve `401` | Token revocado — marcar como inactivo, notificar al admin |
| Admin quiere reconectar | Repetir el flujo desde el Paso 1 |

**Almacenamiento recomendado:**
- Opción A (simple): variables de entorno `CHPP_ACCESS_TOKEN` y `CHPP_ACCESS_TOKEN_SECRET` en el servidor
- Opción B (si hay múltiples admins): tabla `oauth_tokens` en BD con el token cifrado

---

## Variables de entorno necesarias

```bash
# Credenciales de la aplicación registrada en CHPP (nunca cambiarán)
CHPP_CONSUMER_KEY=tu_consumer_key
CHPP_CONSUMER_SECRET=tu_consumer_secret

# Token del admin obtenido tras el flujo OAuth (se actualiza si se revoca y reconecta)
CHPP_ACCESS_TOKEN=access_token_del_admin
CHPP_ACCESS_TOKEN_SECRET=access_token_secret_del_admin

# URL base de la app (para el callback OAuth)
APP_URL=https://tu-app.com
```

Ver `.env.example` para la lista completa.

---

## Librería recomendada: `oauth-1.0a`

```bash
bun add oauth-1.0a
```

Ejemplo de firma de petición:

```typescript
import OAuth from 'oauth-1.0a';
import { createHmac } from 'crypto';

const oauth = new OAuth({
  consumer: {
    key: env.CHPP_CONSUMER_KEY,
    secret: env.CHPP_CONSUMER_SECRET,
  },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return createHmac('sha1', key).update(base_string).digest('base64');
  },
});

// Firmar una petición a la API CHPP
const requestData = {
  url: 'https://chpp.hattrick.org/chppxml.ashx?file=teamdetails&teamID=12345',
  method: 'GET',
};

const token = {
  key: env.CHPP_ACCESS_TOKEN,
  secret: env.CHPP_ACCESS_TOKEN_SECRET,
};

const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

const response = await fetch(requestData.url, {
  headers: {
    ...authHeader,
    Accept: 'application/xml',
  },
});
```

---

## Seguridad

- **Nunca** hardcodear `consumer_key`, `consumer_secret`, `access_token` o `access_token_secret` en el código fuente.
- **Nunca** comitear estos valores al repositorio (están en `.gitignore` via `.env`).
- Si se sospecha que las credenciales han sido expuestas: revocar inmediatamente desde la cuenta de Hattrick y volver a autorizar.
- El `consumer_secret` es de la **app**, no del usuario. Si se filtra, cualquiera puede suplantar tu aplicación.
