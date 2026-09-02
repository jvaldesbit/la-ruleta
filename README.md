# La Ruleta

[![CI](https://github.com/jvaldesbit/la-ruleta/actions/workflows/ci.yml/badge.svg)](https://github.com/jvaldesbit/la-ruleta/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Desplegado en <https://ruleta.jcvb.com.co>**

MVP de una **ruleta de apuestas online**: una API en FastAPI que gestiona el
ciclo de vida de una ruleta (crear → abrir → apostar → cerrar) y un frontend en
React desde el que se juega. El estado se guarda en **MongoDB**; si no hay
base de datos configurada, la API arranca igual con un almacén en memoria. Es
un ejercicio, no un casino.

---

## El flujo, en texto

```
  ┌──────────┐   POST /roulettes         Se crea una ruleta. Estado: created.
  │ created  │   ───────────────────►    Todavía no admite apuestas.
  └────┬─────┘
       │  POST /roulettes/{id}/open
       ▼
  ┌──────────┐   Ahora sí se puede apostar. Cada apuesta indica un número
  │   open   │   (0..36) o un color (red/black) y un monto (0 < x <= 10000).
  └────┬─────┘   El usuario viaja en la cabecera X-User-Id.
       │  POST /roulettes/{id}/close
       ▼
  ┌──────────┐   Se sortea un número con `secrets`, se resuelven TODAS las
  │  closed  │   apuestas y se devuelve el detalle: quién ganó y cuánto se
  └──────────┘   le paga. Estado terminal: no se reabre ni se reapuesta.
```

## El ejercicio, resumido

Construir una API de ruleta con estas operaciones:

1. **Crear** una ruleta y devolver su identificador.
2. **Abrir** una ruleta para que acepte apuestas.
3. **Apostar** a un número (0 a 36) o a un color (rojo o negro), con un monto
   máximo de 10 000 USD. El usuario se identifica por una cabecera, se asume
   autenticado y con crédito suficiente.
4. **Cerrar** la ruleta: se deja de aceptar apuestas, se sortea el resultado y
   se devuelve el estado de cada apuesta con su ganancia.
5. **Listar** las ruletas existentes.

## Endpoints

Base path `/api/v1`. Detalle completo en [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

| Método | Ruta | Qué hace |
| ------ | ---- | -------- |
| `POST` | `/api/v1/roulettes` | Crea una ruleta. Devuelve `id` y estado `created`. |
| `POST` | `/api/v1/roulettes/{id}/open` | Abre la ruleta para apuestas. |
| `POST` | `/api/v1/roulettes/{id}/bets` | Registra una apuesta. Requiere `X-User-Id`. |
| `POST` | `/api/v1/roulettes/{id}/close` | Cierra, sortea y resuelve todas las apuestas. |
| `GET`  | `/api/v1/roulettes` | Lista las ruletas con su estado. |
| `GET`  | `/api/v1/roulettes/{id}` | Detalle de una ruleta, con apuestas y resultados. |
| `GET`  | `/api/v1/health` | Healthcheck. `200` con `status: ok`; `503` con `status: degraded` si Mongo no responde. |

Cuerpos de apuesta aceptados:

```json
{"type": "number", "number": 17, "amount": 100.00}
{"type": "color",  "color": "red", "amount": 100.00}
```

---

## ⚠️ La regla de color: par = rojo, impar = negro

**Esto se aparta de la ruleta real, y es a propósito.**

El enunciado define el color de un número por su paridad:

- número **par** → **rojo**
- número **impar** → **negro**

Como el **0 es par**, en esta implementación **el 0 es rojo**.

En una ruleta de verdad el 0 es verde y los colores no siguen la paridad en
absoluto (el 1 es rojo, el 2 negro, el 4 negro, el 9 rojo…). Se ha implementado
la regla del enunciado, no la del casino, porque el enunciado es la
especificación. La decisión está registrada en `docs/API_CONTRACT.md` y
cubierta por tests; si algún día hay que usar la disposición real, el cambio se
concentra en la función que asigna color a número.

## Pagos

Los multiplicadores son **pago bruto**: es lo que se devuelve al usuario, no la
ganancia neta sobre lo apostado.

| Acierto | Pago bruto | Ejemplo con 100 USD |
| ------- | ---------- | ------------------- |
| Al número exacto | `monto × 5` | se devuelven **500** (400 de beneficio) |
| Al color | `monto × 1.8` | se devuelven **180** (80 de beneficio) |
| Fallo | `0` | se devuelve **0** |

---

## Cómo correrlo

### Con contenedores (lo más rápido)

El `docker-compose.yml` de la raíz levanta tres servicios: `mongo`, `api` y
`web`. Está escrito para funcionar igual con **podman** y con Docker (imágenes
totalmente cualificadas, sin `version:` y sin extensiones propias de Docker).

```bash
# Con podman (lo que usa este proyecto)
podman compose up --build
# o, si tienes el wrapper en Python:
podman-compose up --build

# Con Docker
docker compose up --build
```

- Frontend: <http://localhost:8080>
- API directa: <http://localhost:8000/api/v1/health>
- Documentación interactiva: <http://localhost:8000/docs>
- MongoDB: `mongodb://localhost:27017` (base `ruleta`)

nginx sirve el frontend y hace de proxy de `/api/` hacia el contenedor de la
API, así que el navegador habla siempre con el mismo origen y no hay CORS.

Para parar y borrar también los datos de Mongo:

```bash
podman compose down -v
```

### Sin contenedores

Backend (Python 3.14 + [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
uv sync --extra dev

# Con MongoDB levantado aparte:
#   podman run -d -p 27017:27017 docker.io/library/mongo:8.2
# (8.2 y no 8.0.x: las 8.0.x no arrancan en kernels 6.19+, fallo SERVER-121912)
export MONGODB_URI="mongodb://localhost:27017"
export MONGODB_DB="ruleta"

# O sin nada: si MONGODB_URI no está definida, la API usa el almacén en memoria
uv run uvicorn ruleta.main:app --reload --port 8000
```

| Variable | Por defecto | Para qué |
| -------- | ----------- | -------- |
| `MONGODB_URI` | *(sin definir)* | Cadena de conexión a MongoDB. Si falta, se usa memoria. |
| `MONGODB_DB` | `ruleta` | Nombre de la base de datos. |

Frontend (Node 22 + [pnpm](https://pnpm.io/)):

```bash
cd frontend
pnpm install
pnpm run dev          # http://localhost:5173
```

En desarrollo el frontend apunta a la API con `VITE_API_BASE_URL`; si no se
define, usa rutas relativas `/api/v1/...`.

### Tests y calidad

```bash
# Backend
cd backend
uv run pytest -q
uv run ruff check .
uv run ruff format --check .

# Frontend
cd frontend
pnpm run lint
pnpm run build        # incluye `tsc -b`, así que valida tipos
pnpm run test
```

Es exactamente lo que ejecuta CI, así que si pasa en local pasa en el PR.

---

## Arquitectura

```
                          ┌──────────────────────────────┐
     navegador  ─────────►│  web  (nginx:1.27-alpine)    │
     :8080 / dominio      │  • sirve el bundle de Vite   │
                          │  • fallback SPA a index.html │
                          │  • proxy /api/ ──────────┐   │
                          └──────────────────────────┼───┘
                                                     │  red interna de Docker
                                                     ▼
                          ┌──────────────────────────────┐
                          │  api  (python:3.14-slim)     │
                          │  • FastAPI + Pydantic v2     │
                          │  • uvicorn en :8000          │
                          │  • motor (driver async)  ────┼──┐
                          └──────────────────────────────┘  │
                                                            ▼
                          ┌──────────────────────────────┐
                          │  mongo  (mongo:8.2)          │
                          │  • local: servicio del compose│
                          │  • prod: instancia de Dokploy │
                          └──────────────────────────────┘

     backend/src/ruleta/
       main.py        entrypoint ASGI (ruleta.main:app)
       api/           routers de /api/v1
       models/        esquemas Pydantic del contrato
       services/      reglas del juego: color, pagos, sorteo, transiciones
       storage/       repositorio: MongoDB (motor) o memoria, misma interfaz

     frontend/src/    React 19 + TypeScript, cliente del contrato
```

El repositorio está aislado detrás de una interfaz: la implementación de
MongoDB y la de memoria son intercambiables y las reglas del juego no saben
cuál está activa. Sin `MONGODB_URI` se usa la de memoria, que es lo que hace
que los tests corran sin base de datos y que el proyecto se pueda arrancar en
frío sin instalar nada.

En producción **no** se levanta un Mongo propio: se reutiliza la instancia que
ya corre en el Dokploy del usuario, por la red interna.

---

## CI/CD

`.github/workflows/ci.yml`, en GitHub Actions:

```
  push / PR ──► backend  (ruff check + ruff format --check + pytest)
            └─► frontend (eslint + tsc + vite build)
                     │
                     ▼   (solo push a main o tag v*)
              build-and-push ──► ghcr.io/jvaldesbit/la-ruleta-api:latest
                     │           ghcr.io/jvaldesbit/la-ruleta-web:latest
                     ▼   (solo push a main)
                  deploy ──► POST /api/compose.deploy en Dokploy (cloud.kiware.co)
                                    └─► https://ruleta.jcvb.com.co
```

Detalles:

- Las imágenes se etiquetan con `latest` en main, con el nombre del tag en las
  releases `v*`, y **siempre** con el SHA del commit, para poder volver atrás a
  una versión concreta.
- El compose de producción usa `pull_policy: always`, porque con un tag móvil
  como `latest` Docker no vuelve a mirar el registry si ya tiene una imagen
  guardada con ese nombre.
- El job de deploy no rompe el build si los secretos de Dokploy todavía no
  están configurados: avisa y se salta.

Guía de despliegue paso a paso: [`docs/DEPLOY.md`](docs/DEPLOY.md) y
[`deploy/README.md`](deploy/README.md).

---

## Desarrollo guiado por especificación

El proyecto sigue [GitHub spec-kit](https://github.com/github/spec-kit): antes
del código hay una especificación, un plan y una lista de tareas, y el código
se escribe contra eso. Todo vive en
[`specs/001-la-ruleta/`](specs/001-la-ruleta/), y el contrato de API compartido
entre backend y frontend en [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md).

## Licencia

MIT — ver [LICENSE](LICENSE).
