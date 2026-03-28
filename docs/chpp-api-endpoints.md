# API CHPP — Endpoints para hattrictos-stats

Referencia de los endpoints de la API CHPP necesarios para sincronizar datos de ligas de Hattrick Arena.

Documentación oficial: https://www.hattrick.org/Community/CHPP/NewDocs/

---

## Base

| Parámetro | Valor |
|---|---|
| URL base | `https://chpp.hattrick.org/chppxml.ashx` |
| Formato de respuesta | XML |
| Autenticación | OAuth 1.0a (firma en cada petición) |
| Selector de recurso | Parámetro `file` en la query string |

Todas las peticiones deben ir firmadas con OAuth 1.0a. Ver `docs/chpp-oauth.md` para el flujo de firma.

---

## Regla de cacheo obligatoria

**Nunca llamar a la API CHPP si el dato ya existe en BD y no ha cambiado.**

- Los partidos ya finalizados nunca cambian: cachear para siempre.
- Los datos de equipo pueden cambiar: cachear con TTL razonable (ej: 24h).
- Los fixtures de un torneo activo pueden actualizarse: resincronizar periódicamente.
- Ante un error `429 Too Many Requests`: esperar y reintentar con backoff exponencial.

---

## Endpoints necesarios

### `matchesarchive` — Archivo de partidos de un equipo

Obtiene el listado de partidos jugados por un equipo en un rango de fechas.

```
file=matchesarchive
teamID=<id del equipo>
FirstMatchDate=YYYY-MM-DD HH:MM:SS   (opcional)
LastMatchDate=YYYY-MM-DD HH:MM:SS    (opcional)
matchType=<tipo>                      (ver tabla abajo)
```

**Tipos de partido (`matchType`) relevantes:**

| Valor | Descripción |
|---|---|
| `0` | Todos los partidos |
| `1` | Liga oficial |
| `2` | Copa |
| `3` | Amistoso |
| `4` | Internacional |
| `5` | Copa de la Liga |
| `6` | Copa de la Copa |
| `7` | Torneo de Hattrick (Hattrick Arena) |
| `8` | Torneo de master |

Para **Hattrick Arena** usar `matchType=7`.

**Respuesta XML clave:**

```xml
<MatchList>
  <Match>
    <MatchID>123456789</MatchID>
    <HomeTeamID>12345</HomeTeamID>
    <HomeTeamName>Mi Equipo</HomeTeamName>
    <AwayTeamID>67890</AwayTeamID>
    <AwayTeamName>Rival FC</AwayTeamName>
    <MatchDate>2025-03-15 18:00:00</MatchDate>
    <HomeGoals>2</HomeGoals>
    <AwayGoals>1</AwayGoals>
    <MatchType>7</MatchType>
    <TournamentID>98765</TournamentID>
  </Match>
</MatchList>
```

**Uso en hattrictos-stats:** iterar sobre todos los equipos participantes de la liga y obtener sus partidos de tipo `7` (Arena) en el rango de fechas de la temporada.

---

### `matchdetails` — Detalle de un partido

Obtiene el detalle completo de un partido: goles, eventos, alineaciones, incidencias.

```
file=matchdetails
matchID=<id del partido>
matchEvents=true    (incluir eventos del partido)
```

**Respuesta XML clave:**

```xml
<Match>
  <MatchID>123456789</MatchID>
  <HomeTeam>
    <HomeTeamID>12345</HomeTeamID>
    <HomeTeamName>Mi Equipo</HomeTeamName>
    <HomeGoals>2</HomeGoals>
  </HomeTeam>
  <AwayTeam>
    <AwayTeamID>67890</AwayTeamID>
    <AwayTeamName>Rival FC</AwayTeamName>
    <AwayGoals>1</AwayGoals>
  </AwayTeam>
  <Scorers>
    <Goal>
      <ScorerTeamID>12345</ScorerTeamID>
      <ScorerPlayerID>111111</ScorerPlayerID>
      <ScorerPlayerName>Juan García</ScorerPlayerName>
      <ScorerMinute>23</ScorerMinute>
      <ScorerHomeGoals>1</ScorerHomeGoals>
      <ScorerAwayGoals>0</ScorerAwayGoals>
      <IsOvertime>false</IsOvertime>
    </Goal>
  </Scorers>
  <EventList>
    <Event>
      <Minute>23</Minute>
      <SubjectPlayerID>111111</SubjectPlayerID>
      <ObjectPlayerID>222222</ObjectPlayerID>
      <EventTypeID>100</EventTypeID>
      <EventText>Juan García marcó un gol por la derecha</EventText>
    </Event>
  </EventList>
</Match>
```

**Uso en hattrictos-stats:** para cada matchID del archivo, obtener los goleadores y eventos individuales para calcular estadísticas de goleadores, tarjetas, etc.

**Nota:** Los partidos ya finalizados no cambian. Cachear indefinidamente una vez sincronizados.

---

### `matchlineup` — Alineación de un partido

Obtiene la alineación completa de ambos equipos en un partido específico.

```
file=matchlineup
matchID=<id del partido>
teamID=<id del equipo>    (opcional, para obtener solo uno de los dos)
```

**Respuesta XML clave:**

```xml
<MatchLineup>
  <Team>
    <TeamID>12345</TeamID>
    <TeamName>Mi Equipo</TeamName>
    <Attitude>1</Attitude>
    <Tactic>1</Tactic>
    <Players>
      <Player>
        <PlayerID>111111</PlayerID>
        <PlayerName>Juan García</PlayerName>
        <RoleID>100</RoleID>     <!-- posición en el partido -->
        <FirstName>Juan</FirstName>
        <LastName>García</LastName>
      </Player>
    </Players>
    <Substitutions>
      <Substitution>
        <PlayerIn>333333</PlayerIn>
        <PlayerOut>111111</PlayerOut>
        <Minute>65</Minute>
      </Substitution>
    </Substitutions>
  </Team>
</MatchLineup>
```

**Uso en hattrictos-stats:** calcular partidos jugados por jugador (apariciones en alineación), minutos jugados, y posiciones.

---

### `teamdetails` — Datos de un equipo

Obtiene información pública de un equipo.

```
file=teamdetails
teamID=<id del equipo>
```

**Respuesta XML clave:**

```xml
<Team>
  <TeamID>12345</TeamID>
  <TeamName>Mi Equipo FC</TeamName>
  <ShortTeamName>MEFC</ShortTeamName>
  <FoundedDate>2005-03-14 00:00:00</FoundedDate>
  <Arena>
    <ArenaID>111</ArenaID>
    <ArenaName>Estadio Grande</ArenaName>
  </Arena>
  <League>
    <LeagueID>50</LeagueID>
    <LeagueName>España</LeagueName>
  </League>
  <Manager>
    <UserID>99999</UserID>
    <Loginname>manager_username</Loginname>
  </Manager>
</Team>
```

**Uso en hattrictos-stats:** obtener nombre y datos del equipo para mostrar en la web. Cachear con TTL de 24h (el nombre puede cambiar raramente).

---

### `players` — Jugadores de un equipo

Obtiene la plantilla actual de un equipo.

```
file=players
teamID=<id del equipo>
```

**IMPORTANTE:** Las habilidades (skills) solo se devuelven para el **equipo propio** del token OAuth usado. Para equipos ajenos, solo se obtienen datos básicos.

**Respuesta XML clave (datos siempre accesibles):**

```xml
<PlayerList>
  <Player>
    <PlayerID>111111</PlayerID>
    <FirstName>Juan</FirstName>
    <LastName>García</LastName>
    <NickName></NickName>
    <PlayerNumber>9</PlayerNumber>
    <Age>25</Age>
    <AgeDays>100</AgeDays>
    <Nationality>50</Nationality>
    <CountryID>50</CountryID>
  </Player>
</PlayerList>
```

**Uso en hattrictos-stats:** relacionar playerID con nombre completo para mostrar en la tabla de goleadores.

---

### `tournamentdetails` — Detalles de un torneo de Hattrick Arena

Obtiene la estructura de un torneo privado (Hattrick Arena).

```
file=tournamentdetails
tournamentID=<id del torneo>
```

**Respuesta XML clave:**

```xml
<Tournament>
  <TournamentID>98765</TournamentID>
  <Name>Liga Comunidad Española S1</Name>
  <TournamentType>0</TournamentType>   <!-- 0=liga, 1=copa -->
  <NumberOfTeams>8</NumberOfTeams>
  <Creator>
    <UserID>99999</UserID>
    <Loginname>organizador</Loginname>
  </Creator>
  <Teams>
    <Team>
      <TeamID>12345</TeamID>
      <TeamName>Mi Equipo FC</TeamName>
    </Team>
  </Teams>
</Tournament>
```

**Uso en hattrictos-stats:** obtener la lista de equipos participantes en la liga para luego sincronizar sus partidos.

---

### `tournamentfixtures` — Calendario de un torneo

Obtiene el calendario completo de partidos de un torneo.

```
file=tournamentfixtures
tournamentID=<id del torneo>
```

**Respuesta XML clave:**

```xml
<TournamentFixtures>
  <TournamentID>98765</TournamentID>
  <Rounds>
    <Round>
      <RoundNumber>1</RoundNumber>
      <Matches>
        <Match>
          <MatchID>123456789</MatchID>
          <HomeTeamID>12345</HomeTeamID>
          <AwayTeamID>67890</AwayTeamID>
          <MatchDate>2025-03-08 18:00:00</MatchDate>
          <HomeGoals>2</HomeGoals>
          <AwayGoals>1</AwayGoals>
          <Status>Finished</Status>
        </Match>
      </Matches>
    </Round>
  </Rounds>
</TournamentFixtures>
```

**Uso en hattrictos-stats:** alternativa a `matchesarchive` para obtener directamente todos los partidos de un torneo por rondas.

---

## Flujo de sincronización recomendado

```
1. tournamentdetails(tournamentID)
      → obtener lista de equipos participantes y nombre del torneo

2. tournamentfixtures(tournamentID)
      → obtener todos los matchIDs del torneo

3. Para cada matchID no sincronizado aún:
   matchdetails(matchID, matchEvents=true)
      → obtener goles, eventos, resultado

4. Para cada playerID encontrado en los goles/eventos:
   (si no está ya en BD) players(teamID)
      → obtener nombre completo del jugador

5. Para cada equipo nuevo encontrado:
   (si no está ya en BD) teamdetails(teamID)
      → obtener nombre y datos del equipo
```

---

## Manejo de errores de la API

| Código HTTP | Significado | Acción |
|---|---|---|
| `200` | OK | Procesar XML |
| `401` | Token OAuth inválido o revocado | Marcar token como inactivo, notificar al admin |
| `429` | Rate limit superado | Esperar y reintentar con backoff exponencial |
| `500` | Error interno de Hattrick | Registrar error, reintentar más tarde |

**Nota:** CHPP también puede devolver `200` con un XML de error interno. Verificar siempre el elemento `<Error>` en la respuesta antes de procesar.

```xml
<!-- Ejemplo de error dentro de respuesta 200 -->
<HattrickData>
  <Error>No team data</Error>
</HattrickData>
```
