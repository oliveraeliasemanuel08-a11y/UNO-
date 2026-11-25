# UNO! CLUB — Póker online seguro

Esta rama mueve las operaciones competitivas de UNO Hold'em a Cloud Functions. El navegador ya no puede crear/modificar salas de Póker, repartir cartas, alterar apuestas ni acreditar fichas.

## Qué cambia

- `createPokerRoom`: crea una sala privada y reserva el buy-in en el perfil.
- `joinPokerRoom`: valida cupo/estado y reserva el buy-in.
- `startPokerHand`: el servidor genera el mazo y las manos privadas.
- `actPoker`: valida turno y acción, actualiza apuestas/pozo y resuelve la mano.
- `leavePokerRoom`: reembolsa la entrada si se sale del lobby o registra fold durante la partida.
- Las manos viven en `uno_poker_private/{roomId}/hands/{uid}`; cada jugador solo puede leer su propio documento.
- El mazo restante vive en `uno_poker_private/{roomId}/server/state`; las reglas niegan todo acceso desde clientes.
- El saldo `pokerChips` solo lo modifica Admin SDK. La sincronización de perfil del navegador ya no lo sobrescribe.

Las fichas son virtuales, no tienen valor monetario real. El motor actual admite 2–4 jugadores, fold/call/raise, flop/turn/river, evaluación de manos y reparto de side pots.

## Despliegue

Requisitos: Node.js 20, Firebase CLI actualizado y proyecto Firebase con Cloud Functions habilitadas. El despliegue de Cloud Functions normalmente requiere el plan Blaze y facturación configurada.

Desde la raíz del repositorio:

```bash
npm install -g firebase-tools
firebase login
cd functions
npm install
cd ..
firebase use uno-club-dc29c
firebase deploy --only functions,firestore:rules
```

No despliegues solo las reglas: el cliente actualizado llama a las funciones `createPokerRoom`, `joinPokerRoom`, `startPokerHand`, `actPoker` y `leavePokerRoom`.

## Pruebas manuales después del despliegue

1. Iniciar sesión con dos cuentas distintas en dos navegadores/perfiles.
2. En UNO! CLUB → Arcade → UNO HOLD'EM ONLINE, crear una mesa con 100/250/500/1000 fichas.
3. Unirse desde el segundo navegador con el código de seis caracteres.
4. Iniciar desde el anfitrión y comprobar que cada jugador ve solo sus dos cartas.
5. Probar fold, call y raise alternando turnos; completar una mano hasta showdown.
6. Comprobar que el saldo se actualiza desde el perfil en Firestore al finalizar.
7. En DevTools, intentar actualizar directamente `uno_rooms/{code}`, leer la mano del rival, leer `server/state` y modificar `users/{uid}.pokerChips`: todas esas operaciones deben fallar con `permission-denied`.

## Nota de migración

Las salas antiguas de Póker creadas por la versión cliente no son compatibles con el nuevo protocolo. Crea una sala nueva después del despliegue. Los saldos históricos `pokerChips` existentes se conservan como saldo inicial; si antes de desplegar las reglas un cliente los alteró, hay que revisar esos perfiles antes de confiar en ellos.
