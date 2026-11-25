# UNO! MENTIROSO 3D — integración Firebase Online

El modo online usa el HTML original de Three.js y su motor de reglas. El adaptador `liar-online.js` conecta el lobby y la partida a Firebase sin reemplazar el juego 3D.

## Qué incluye

- Crear sala con código de 6 caracteres.
- Unirse por código a salas de 2 a 6 jugadores.
- Reserva transaccional de asientos para evitar superar el límite de seis jugadores cuando entran varios al mismo tiempo.
- Lobby en tiempo real y salida limpia antes de iniciar.
- Firebase Authentication anónima, usando la sesión persistente del navegador.
- El anfitrión mantiene la autoridad del motor original.
- Manos privadas por UID: cada jugador solo puede leer su propia mano.
- Estado público con turno, objetivo, vidas, cantidad de cartas, declaración y pila; no publica las cartas privadas.
- Acciones de jugar, desafiar y avanzar ronda, con validación adicional del anfitrión.
- Sincronización de cartas 3D, animaciones, vidas, desafío, eliminación y final de partida.
- Revancha en la misma sala: el anfitrión puede iniciar otra partida con los mismos participantes.
- Reconexión de invitados mientras la sala siga activa.
- El modo local contra IA sigue disponible.

## Publicar las reglas

1. Abrí Firebase Console → proyecto `uno-club-dc29c` → Firestore Database → Rules.
2. Copiá el contenido completo del archivo `firestore.rules` de esta rama y reemplazá las reglas actuales.
3. Revisá que se conserven las reglas que usa el resto de UNO! CLUB; el archivo de esta rama conserva las reglas existentes de salas, leaderboard, usernames y perfiles.
4. Publicá las reglas.
5. En Firebase Authentication → Sign-in method, verificá que Anonymous esté habilitado.
6. No publiques el HTML online antes de publicar las reglas correspondientes.

## Rutas Firestore

| Ruta | Propósito |
|---|---|
| `artifacts/uno-club-official/public/data/uno_rooms/{roomId}` | Lobby y estado público de la partida |
| `artifacts/uno-club-official/public/data/uno_liar_private/{roomId}/members/{uid}` | Registro público mínimo del jugador en la sala |
| `artifacts/uno-club-official/public/data/uno_liar_private/{roomId}/hands/{uid}` | Mano privada del jugador |
| `artifacts/uno-club-official/public/data/uno_liar_actions/{roomId}/actions/{actionId}` | Cola de acciones que valida el anfitrión |

## Reglas de privacidad y autoridad

- Los documentos de manos solo permiten lectura al UID dueño.
- Solo el anfitrión puede crear o modificar manos.
- Los invitados solo pueden crear acciones siendo miembros y cuando el estado público indica que es su turno.
- El anfitrión valida la selección de cartas contra su mano autoritativa antes de ejecutar el motor.
- La reserva de un asiento se realiza mediante transacción; las reglas solo permiten agregar o quitar el UID propio, un asiento por operación y un máximo de seis.

## Límites que todavía requieren infraestructura de servidor

El anfitrión es una autoridad de cliente: debe mantener abierta su pestaña durante la partida. Si se desconecta inesperadamente, los invitados no pueden tomar automáticamente el control del motor. Para autoridad anti-trampas y recuperación completa tras la caída del anfitrión, la lógica debe trasladarse a Cloud Functions o a un backend confiable.

## Prueba obligatoria antes de anunciarlo como estable

- Dos navegadores con dos sesiones anónimas diferentes.
- Crear sala, entrar por código y comprobar límite de seis.
- Rechazo de códigos inexistentes y salas llenas.
- Reparto y privacidad de manos.
- Jugar 1, 2 y 3 cartas.
- Desafiar una mentira y desafiar una jugada verdadera.
- Regla obligatoria de desafiar si el jugador anterior se quedó sin cartas.
- Pérdida de vida, eliminación y victoria.
- Siguiente ronda y revancha.
- Salir del lobby antes de iniciar y reconectar a una partida en curso.

La sintaxis JavaScript del HTML y del adaptador se comprueba en cada actualización. La validación final de permisos necesita Firebase Emulator o una prueba real en el proyecto; no se debe afirmar que las reglas están desplegadas hasta publicarlas desde Firebase Console.
