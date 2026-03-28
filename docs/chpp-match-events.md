# Match Event Types — Referencia CHPP

Referencia completa de los tipos de eventos de partido devueltos por el endpoint `matchdetails` de la API CHPP. Necesaria para parsear correctamente goles, tarjetas, lesiones y otros eventos de los partidos sincronizados.

Fuente oficial: https://www.hattrick.org/Community/CHPP/ChppMatchEventTypes.aspx

---

## Estructura de un evento en el XML

```xml
<Event>
  <Minute>23</Minute>
  <SubjectPlayerID>111111</SubjectPlayerID>   <!-- jugador principal del evento -->
  <ObjectPlayerID>222222</ObjectPlayerID>     <!-- jugador secundario (asistente, sustituido, etc.) -->
  <EventTypeID>100</EventTypeID>              <!-- tipo de evento (ver tablas abajo) -->
  <EventText>Descripción del evento</EventText>
</Event>
```

| Campo | Descripción |
|---|---|
| `Minute` | Minuto del partido (1-90, o >90 para prórroga) |
| `SubjectPlayerID` | Jugador que protagoniza el evento (goleador, expulsado, lesionado, etc.) |
| `ObjectPlayerID` | Jugador secundario: asistente en un gol, jugador que entra en una sustitución |
| `EventTypeID` | Identificador numérico del tipo de evento |

---

## Goles (IDs 100–199)

Estos son los IDs de evento más importantes para las estadísticas de goleadores.

| EventTypeID | Descripción |
|---|---|
| `100` | Gol normal — ataque por la izquierda |
| `101` | Gol normal — ataque por el centro |
| `102` | Gol normal — ataque por la derecha |
| `103` | Gol de penalti |
| `104` | Gol de falta directa |
| `105` | Gol de jugada individual (winger) |
| `106` | Gol en contraataque |
| `107` | Gol de cabeza (corner) |
| `108` | Gol en jugada especial de presión alta |
| `109` | Gol por error del portero |
| `110` | Gol en tiempo añadido (minuto 90+) |
| `111` | Gol en prórroga |
| `112` | Gol de penalti en prórroga |

**Para estadísticas de goleadores:** cualquier evento con `EventTypeID` entre `100` y `199` es un gol. El `SubjectPlayerID` es el goleador. El `ObjectPlayerID` es el asistente (si aplica, puede ser `0` si no hay asistente registrado).

---

## Goles en contra / penaltis fallados

| EventTypeID | Descripción |
|---|---|
| `55` | Penalti fallado |
| `56` | Penalti parado por el portero |
| `57` | Penalti en la tanda de penaltis |
| `58` | Penalti fallado en la tanda |

---

## Tarjetas (IDs 500–599)

| EventTypeID | Descripción |
|---|---|
| `510` | Tarjeta amarilla |
| `511` | Segunda tarjeta amarilla (equivale a roja) |
| `512` | Tarjeta roja directa |

El `SubjectPlayerID` es el jugador amonestado/expulsado.

---

## Lesiones (IDs 60–89)

| EventTypeID | Descripción |
|---|---|
| `62` | Lesión leve — jugador continúa |
| `63` | Lesión — jugador sale del campo |
| `64` | Lesión con sustitución forzada |
| `65` | Lesión en partido sin sustituciones disponibles |

El `SubjectPlayerID` es el jugador lesionado.

---

## Sustituciones (IDs 70–79)

| EventTypeID | Descripción |
|---|---|
| `70` | Sustitución táctica |
| `71` | Sustitución por lesión |
| `72` | Sustitución en el descanso |

El `SubjectPlayerID` es el jugador que **entra**. El `ObjectPlayerID` es el jugador que **sale**.

---

## Otros eventos relevantes

| EventTypeID | Descripción |
|---|---|
| `1` | Comienzo del partido |
| `2` | Fin de la primera parte |
| `3` | Comienzo de la segunda parte |
| `4` | Fin del partido |
| `5` | Comienzo de la prórroga |
| `6` | Fin de la prórroga |
| `7` | Tanda de penaltis |
| `40` | Cambio táctico (sin sustitución de jugador) |
| `41` | Cambio de formación |

---

## Cómo usar para estadísticas de goleadores

```typescript
// Identificar si un evento es un gol
function isGoalEvent(eventTypeID: number): boolean {
  return eventTypeID >= 100 && eventTypeID <= 199;
}

// Identificar si un evento es una tarjeta
function isYellowCard(eventTypeID: number): boolean {
  return eventTypeID === 510 || eventTypeID === 511;
}

function isRedCard(eventTypeID: number): boolean {
  return eventTypeID === 511 || eventTypeID === 512;
}

// Extraer goleadores de la lista de eventos
function extractGoals(events: MatchEvent[]): Goal[] {
  return events
    .filter(e => isGoalEvent(e.eventTypeID))
    .map(e => ({
      scorerPlayerID: e.subjectPlayerID,
      assistPlayerID: e.objectPlayerID !== 0 ? e.objectPlayerID : null,
      minute: e.minute,
      eventTypeID: e.eventTypeID,
    }));
}
```

---

## Notas de implementación

- Los IDs de evento pueden cambiar con actualizaciones de Hattrick. Revisar la documentación oficial si aparecen IDs desconocidos.
- Si un `EventTypeID` no está en esta lista, registrarlo en logs para investigar.
- El `ObjectPlayerID` puede ser `0` si no aplica (ej: gol sin asistente registrado).
- Los eventos de Hattrick Arena (`matchType=7`) siguen los mismos tipos que los partidos normales.
- La documentación oficial (requiere login): https://www.hattrick.org/Community/CHPP/ChppMatchEventTypes.aspx
