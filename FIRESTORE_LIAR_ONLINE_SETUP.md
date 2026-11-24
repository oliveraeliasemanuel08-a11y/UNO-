# UNO! MENTIROSO 3D — preparación de Firestore

Este archivo de reglas conserva los permisos actuales de UNO! CLUB y añade dos espacios para el modo Mentiroso 3D:

- `uno_liar_private/{roomId}/hands/{uid}`: una mano por jugador. Solo ese jugador puede leerla; el anfitrión puede distribuirla y actualizarla.
- `uno_liar_actions/{roomId}/actions/{actionId}`: bandeja de acciones. Los jugadores envían una jugada o desafío cuando les corresponde; el anfitrión procesa y valida la acción.
- `uno_rooms/{roomId}`: el estado público del Mentiroso 3D solo puede ser actualizado por el anfitrión. Los otros modos conservan la regla de actualización anterior.

## Campos requeridos en una sala Mentiroso 3D

La sala debe incluir como mínimo:

- `gameType: "liar3d"`
- `hostId`: UID del anfitrión
- `memberUids`: lista de UIDs sentados
- `gameState.turnUid`: UID al que le corresponde actuar

Cada documento privado de mano debe incluir `uid` y `cards`.

Cada acción debe incluir `actorUid`, `type` (`play`, `challenge` o `next_round`) y `createdAt`. Las jugadas incluyen `cardIds` (entre 1 y 3).

## Aplicación

1. Abrí Firebase Console → Firestore Database → Rules.
2. Compará las reglas actuales con `firestore.rules`.
3. Publicá las reglas de este archivo cuando la integración del cliente esté lista para usarlas.

**Importante:** estas reglas preparan el modelo de privacidad y autoridad del anfitrión. No se deben publicar antes de que el cliente online escriba los campos requeridos. Las reglas de Firestore tampoco sustituyen la validación del motor: el anfitrión debe comprobar que las cartas enviadas realmente pertenecen a la mano del jugador y que la acción es válida.
