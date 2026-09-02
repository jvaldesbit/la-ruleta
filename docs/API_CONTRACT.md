# Contrato de API — La Ruleta (v1)

Fuente de verdad compartida entre backend (FastAPI) y frontend (React).
Cualquier cambio aquí se acuerda antes de implementarlo en un solo lado.

Base path: `/api/v1`. Todo JSON. Errores con `{"detail": "..."}`.

## Reglas de negocio (decididas a partir del enunciado)

- Números válidos para apostar: enteros 0..36.
- Colores válidos: `red` (rojo) y `black` (negro).
- Color del número: **par = rojo, impar = negro**, literal según el enunciado.
  El 0 es par, por tanto **rojo**. Esto se aparta de la ruleta real (donde el 0
  es verde y los colores no siguen la paridad); se implementa como pide el
  enunciado y se documenta en el README.
- Monto de apuesta: `0 < amount <= 10000` (USD, decimal con 2 decimales).
- Pago **bruto** (lo que se devuelve al usuario, no la ganancia neta):
  - acierto a número: `amount * 5`
  - acierto a color: `amount * 1.8`
  - fallo: `0`
- El id de usuario llega en el header `X-User-Id` (string no vacío). Se asume
  autenticado y con crédito suficiente; no se valida saldo.
- Estados de ruleta: `created` -> `open` -> `closed`. `closed` es terminal.
- El número ganador se elige aleatoriamente (0..36) al cerrar, con `secrets`.

## Endpoints

### POST /api/v1/roulettes
Crea una ruleta. Sin body.
201 -> `{"id": "<uuid>", "status": "created", "created_at": "<iso8601>"}`

### POST /api/v1/roulettes/{roulette_id}/open
200 -> `{"success": true, "roulette_id": "...", "status": "open", "message": "Ruleta abierta"}`
404 si no existe. 409 si ya está abierta o cerrada.
Todos los errores, sin excepción, viajan como `{"detail": "<mensaje en español>"}`.
El campo `success` solo aparece en la respuesta 200, donde siempre vale `true`;
la operación denegada se comunica con el código HTTP, no con un `success:false`.

### POST /api/v1/roulettes/{roulette_id}/bets
Header obligatorio: `X-User-Id: <string>`
Body (una de las dos formas, discriminadas por `type`):
```json
{"type": "number", "number": 17, "amount": 100.00}
{"type": "color",  "color": "red", "amount": 100.00}
```
201 -> `{"bet_id":"<uuid>","roulette_id":"...","user_id":"...","type":"number","number":17,"color":null,"amount":100.00,"created_at":"<iso8601>"}`
- 400 si falta `X-User-Id`.
- 404 si la ruleta no existe.
- 409 si la ruleta no está abierta.
- 422 si el número está fuera de 0..36, el color no es red/black, o el monto no cumple el rango.

### POST /api/v1/roulettes/{roulette_id}/close
Cierra la ruleta, sortea el número y resuelve todas las apuestas.
200 ->
```json
{
  "roulette_id": "...",
  "status": "closed",
  "winning_number": 17,
  "winning_color": "black",
  "closed_at": "<iso8601>",
  "total_bets": 2,
  "total_amount_bet": 200.00,
  "total_amount_paid": 500.00,
  "results": [
    {"bet_id":"...","user_id":"u1","type":"number","number":17,"color":null,
     "amount":100.00,"won":true,"payout":500.00}
  ]
}
```
404 si no existe. 409 si no estaba abierta.

### GET /api/v1/roulettes
200 -> lista de `{"id","status","created_at","opened_at","closed_at","winning_number","winning_color","bets_count"}`

### GET /api/v1/roulettes/{roulette_id}
200 -> el mismo objeto de la lista más `bets` (apuestas) y, si está cerrada, `results`.

### GET /api/v1/health
Comprueba que la aplicación responde y que su almacén está vivo.

200 -> `{"status":"ok","version":"...","storage":"memory|mongo"}`
503 -> `{"status":"degraded","version":"...","storage":"mongo"}`

`storage` dice qué implementación de almacenamiento está en uso, que es lo
primero que hay que saber cuando el estado desaparece entre peticiones: sin
`MONGODB_URI` la aplicación arranca contra memoria y pierde los datos en cada
reinicio, y desde fuera eso es indistinguible de una base de datos vacía.

El 503 es deliberado y no un 200 con un campo que diga que algo va mal. Este
endpoint es el que consultan el healthcheck del contenedor y el proxy: una API
que no alcanza su base de datos no puede atender apuestas, y decir "ok" con
letra pequeña haría que se le siguiera enviando tráfico. Con almacén en
memoria nunca hay 503, porque no hay nada externo que pueda caerse.

## Notas de front

- El front habla con el backend por rutas relativas `/api/v1/...` (mismo origen,
  nginx hace de proxy). Variable opcional `VITE_API_BASE_URL` para desarrollo.
- El id de usuario se guarda en localStorage y se envía en `X-User-Id`.
