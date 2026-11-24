# UNO! MENTIROSO 3D — integración online

El HTML original conserva Three.js, sus animaciones, el motor de reglas y la IA local. `liar-online.js` añade el lobby Firebase y sincroniza la partida online.

## Flujo online

- Crear sala genera un código de 6 caracteres y registra al anfitrión.
- Los invitados entran con el código; las salas admiten de 2 a 6 jugadores.
- El anfitrión inicia la partida y actúa como autoridad del motor original.
- El estado público contiene turnos, vidas, jugadores, cantidades de cartas y la declaración; nunca contiene las manos.
- Cada mano se guarda en `uno_liar_private/{roomId}/hands/{uid}`. Solo su dueño puede leerla; el anfitrión la distribuye.
- Los clientes envían acciones (`play`, `challenge`, `next_round`) y el anfitrión valida UID, turno y pertenencia de cada carta a la mano antes de ejecutar el motor.
- Un jugador invitado puede reconectarse con el mismo navegador/sesión anónima y el mismo código. El anfitrión debe mantener abierta su pestaña durante la partida porque conserva el motor autoritativo en memoria.

## Firestore

1. Abrí Firebase Console → Firestore Database → Rules.
2. Reemplazá las reglas actuales por el contenido completo de `firestore.rules` de esta rama, conservando los permisos existentes que ya utiliza UNO! CLUB.
3. Publicá las reglas.
4. Confirmá que el proveedor de autenticación anónima siga habilitado en Firebase Authentication (el juego principal de UNO! CLUB ya lo utiliza).

## Archivos de esta integración

- `el_mentiroso_uno_3d_ia_desconfiada.html`: HTML 3D original con controles de lobby y un puente pequeño hacia su motor.
- `liar-online.js`: conexión Firebase, salas, miembros, manos privadas, acciones y sincronización.
- `firestore.rules`: reglas para salas, miembros, manos privadas y acciones.

## Antes de publicarlo

- Esta rama todavía requiere una prueba real con dos navegadores y dos sesiones distintas.
- No publicar las reglas ni fusionar la PR hasta comprobar creación de sala, ingreso con código, reparto privado, jugadas, desafíos, vidas, siguiente ronda y reconexión de un invitado.
- El anfitrión es una autoridad de cliente, no un servidor confiable. Para anti-trampas fuerte y recuperación de partida si el anfitrión cierra la pestaña, el siguiente paso sería trasladar la autoridad a Cloud Functions o un backend.
- Las reglas privadas impiden que un invitado lea las manos ajenas; aun así, un anfitrión que controla su propio navegador podría manipular el estado que publica.

## Colecciones

| Ruta | Uso |
|---|---|
| `uno_rooms/{roomId}` | Lobby y estado público de la partida |
| `uno_liar_private/{roomId}/members/{uid}` | Registro de cada jugador |
| `uno_liar_private/{roomId}/hands/{uid}` | Mano privada por jugador |
| `uno_liar_actions/{roomId}/actions/{actionId}` | Acciones que el anfitrión valida |

El `appId` de la ruta Firestore es `uno-club-official`, igual que en la aplicación principal.