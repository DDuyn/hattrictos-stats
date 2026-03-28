# Reglas CHPP — hattrictos-stats

Referencia de las normas del programa CHPP (Certified Hattrick Product Program) aplicadas a este proyecto. Cualquier modelo de IA que trabaje aquí debe respetar estas reglas sin excepción.

Fuente oficial: https://www.hattrick.org/Community/CHPP/ChppRules.aspx

---

## Qué es CHPP

CHPP es la API oficial de Hattrick para aplicaciones de terceros. Para usarla hay que:

1. Registrar la aplicación en https://chpp.hattrick.org
2. Obtener `consumer_key` y `consumer_secret`
3. Autorizar la app con una cuenta de Hattrick real (flujo OAuth 1.0a)

---

## Arquitectura de acceso para este proyecto

```
Admin (cuenta HT autorizada) → OAuth 1.0a → Backend sincroniza datos → BD Turso
                                                                           ↓
                                                              Web pública de solo lectura
```

- Los visitantes **no necesitan cuenta de Hattrick ni login**.
- Solo los administradores del sistema autorizan la app vía OAuth.
- El backend usa el token de admin para sincronizar datos periódicamente.
- La web muestra datos históricos almacenados en la BD local.

---

## Lo que está PERMITIDO

- Acceder a datos públicos de **cualquier equipo**, no solo el propio:
  - Resultados y historial de partidos (`matchesarchive`)
  - Detalles de partidos ya jugados (`matchdetails`)
  - Datos públicos de equipos (`teamdetails`)
  - Alineaciones de partidos (`matchlineup`)
  - Jugadores (datos básicos) de cualquier equipo (`players`)
  - Estructura y fixtures de torneos/ligas privadas (`tournamentdetails`, `tournamentfixtures`)
- Almacenar datos de la API en la BD propia para consulta histórica.
- Mostrar estadísticas derivadas: clasificaciones, goleadores, head-to-head, historial.
- Operar con un único token de administrador para todas las sincronizaciones.
- Publicar la web sin requerir login de los visitantes.
- Usar los datos para informar y mostrar historial a la comunidad.

---

## Lo que está PROHIBIDO

- **Web scraping** de hattrick.org o cualquier subdominio. Siempre usar la API CHPP.
- Mostrar **datos privados** de equipos ajenos:
  - Habilidades (skills) de jugadores de otros equipos
  - Finanzas del club
  - Órdenes de entrenamiento
  - Estrategias de partido no reveladas
- **Redistribuir o vender** datos crudos obtenidos de la API.
- Usar la API para **automatizar acciones** en el juego (fichajes, entrenamientos, alineaciones).
- **Ignorar rate limits**: si la API responde `429 Too Many Requests`, hay que esperar antes de reintentar. No bombardear la API.
- **Cachear resultados sin límite de re-petición**: no llamar a la API para datos que ya están en BD y no han cambiado.
- Almacenar tokens OAuth en texto plano en el código fuente o en archivos comiteados al repo.
- Usar la API para fines distintos al objetivo declarado de la aplicación al registrarla en CHPP.
- Compartir el `consumer_key` y `consumer_secret` de la aplicación.

---

## Lo que es OBLIGATORIO

- **Atribución CHPP**: mostrar el logo "Powered by CHPP" con enlace a Hattrick en el frontend.
  - Logo disponible en: https://www.hattrick.org/Community/CHPP/
  - Debe ser visible en la aplicación, no enterrado en un footer oculto.
- **OAuth 1.0a**: es el único mecanismo de autenticación soportado por CHPP. No existe alternativa.
- **Respetar rate limits**: implementar backoff exponencial si se recibe error `429`.
- **Manejar tokens de forma segura**: variables de entorno, nunca hardcoded.
- **No almacenar tokens OAuth revocados**: detectar tokens inválidos (error `401` de la API) y marcarlos como inactivos en BD.

---

## Datos públicos vs. privados en CHPP

| Tipo de dato | ¿Accesible de cualquier equipo? | Notas |
|---|---|---|
| Resultados de partidos | Sí | Públicos para cualquier matchID |
| Eventos de partido (goles, tarjetas) | Sí | Vienen en `matchdetails` |
| Alineaciones de partido | Sí | Vienen en `matchlineup` |
| Datos básicos del equipo | Sí | Nombre, país, liga, manager |
| Lista de jugadores (nombre, ID, edad) | Sí | Vía `players` con teamID ajeno |
| Habilidades de jugadores | **Solo del equipo propio** | Nunca de equipos ajenos |
| Finanzas del club | **Solo del equipo propio** | Nunca mostrar de otros |
| Órdenes de entrenamiento | **Solo del equipo propio** | Nunca mostrar de otros |
| Fixtures y estructura de torneos | Sí | Vía `tournamentdetails` / `tournamentfixtures` |

---

## Buenas prácticas de implementación

- **Sincronización incremental**: guardar el último matchID/fecha procesado. En cada sync, pedir solo partidos nuevos desde ese punto.
- **Deduplicación**: antes de insertar un partido en BD, verificar que el matchID no existe ya.
- **Separar sync de consulta**: el proceso de sincronización (backend job) debe ser independiente de las consultas de los usuarios.
- **Logs de sincronización**: registrar qué datos se sincronizaron, cuándo y si hubo errores, para auditar el uso de la API.
- **Variables de entorno para credenciales**: ver `.env.example` para la lista completa de variables CHPP necesarias.

---

## Referencias

- Reglas CHPP: https://www.hattrick.org/Community/CHPP/ChppRules.aspx
- Documentación de la API: https://www.hattrick.org/Community/CHPP/NewDocs/
- OAuth en CHPP: https://www.hattrick.org/Community/CHPP/oauth/
- Match Event Types: https://www.hattrick.org/Community/CHPP/ChppMatchEventTypes.aspx
- Registro de apps CHPP: https://chpp.hattrick.org
