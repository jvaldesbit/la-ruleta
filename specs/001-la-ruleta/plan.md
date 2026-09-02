# Implementation Plan: La Ruleta — MVP de ruleta de apuestas online

**Branch**: `001-la-ruleta` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-la-ruleta/spec.md`

**Contrato normativo**: [`docs/API_CONTRACT.md`](../../docs/API_CONTRACT.md)

**Decisiones normativas**: [`DECISIONES.md`](../../DECISIONES.md) (D-01..D-11).
Este plan las cita por identificador y no reproduce su argumentación.

## Summary

Entregar los cuatro endpoints del enunciado (crear, abrir, apostar, cerrar) más
los de consulta y salud que necesita el frontend, con la lógica de negocio
—color por paridad, resolución de apuestas y pagos 5x/1.8x— aislada en una capa
de dominio pura y testeable, sin dependencias de FastAPI ni de almacenamiento.

El transporte es FastAPI con routers finos que validan con pydantic v2, invocan a
un servicio de aplicación y mapean el resultado a los códigos HTTP del contrato.

La persistencia es **MongoDB** detrás de un `Protocol` de repositorio, con dos
implementaciones: una **en memoria** para tests y arranque sin base de datos, y
una sobre **MongoDB con el driver asíncrono `motor`** para el despliegue (D-08).
La ruleta y sus apuestas viven en un único documento, los importes se guardan
como `Decimal128`, y las transiciones de estado se hacen con una actualización
condicionada al estado esperado para que el cierre sea atómico.

El frontend es React + Vite + TypeScript hablando por rutas relativas `/api/v1`.
Backend y frontend van en contenedores separados; nginx sirve el build estático
del front y hace de proxy de `/api` hacia el backend, de modo que ambos comparten
origen bajo **`ruleta.jcvb.com.co`** (D-09). Despliegue en Dokploy disparado por
GitHub Actions, con imágenes en GHCR y llamada directa a la API de Dokploy
(D-10), con la CI en verde como precondición.

## Technical Context

**Language/Version**: Python 3.14 (backend), TypeScript 5.x en modo estricto
sobre Node 22 LTS solo para build (frontend).

**Primary Dependencies**: FastAPI, pydantic v2, uvicorn, `motor` (driver
asíncrono de MongoDB) (backend); React 19, Vite, TypeScript (frontend); nginx
(sirve estáticos y proxy `/api`).

**Storage**: MongoDB 8, detrás de `RouletteRepository` (`typing.Protocol`), sin
ORM: el acceso se escribe a mano contra el driver. Dos implementaciones del mismo
`Protocol` (D-08):

- `InMemoryRouletteRepository` — tests y arranque sin base de datos.
- `MongoRouletteRepository` — despliegue, sobre `motor`.

Ruleta y apuestas en un único documento; importes como `Decimal128`; transiciones
de estado con `find_one_and_update` condicionado al estado esperado. En local,
MongoDB se levanta con **podman**; en despliegue se usa la instancia de MongoDB
que ya existe en Dokploy, compartida con otros servicios, con base de datos
propia para este proyecto.

**Testing**: pytest + `httpx`/`TestClient` de FastAPI. Tests unitarios de dominio
sin HTTP y tests de contrato/integración por endpoint. La fuente de aleatoriedad
se inyecta para que los tests sean deterministas. La batería de tests de
repositorio se ejecuta contra las dos implementaciones; los casos que requieren un
Mongo real se marcan y se **saltan limpiamente si no hay `MONGODB_TEST_URI`** en
el entorno, de modo que la suite siga siendo ejecutable sin base de datos.

**Target Platform**: Contenedores Linux desplegados en Dokploy bajo el dominio
`ruleta.jcvb.com.co`. Navegadores modernos evergreen para el frontend.

**Project Type**: Web application — backend HTTP (API JSON) + frontend SPA.

**Performance Goals**: MVP sin carga real. Objetivo indicativo: < 100 ms p95 por
endpoint contra un MongoDB local, dado que toda operación toca un único documento
localizado por `_id` y es O(n) sobre las apuestas de esa ruleta.

**Constraints**: Importes con `Decimal` de 2 decimales y `ROUND_HALF_UP`,
prohibido `float`; en Mongo, `Decimal128`. Sorteo con `secrets` (uniforme sobre
0..36). Las transiciones de estado no pueden leer-decidir-escribir: deben ser una
única actualización condicionada, para soportar réplicas y cierres concurrentes.
El dominio no puede importar `motor`, `pymongo` ni `bson`. La instancia de
MongoDB en Dokploy es compartida: nada de operaciones de alcance global sobre el
servidor.

**Scale/Scope**: 6 endpoints de negocio + 1 de salud, 4 entidades de dominio,
31 requisitos funcionales, una pantalla principal en el frontend.

## Constitution Check

*GATE: Debe pasar antes de la Fase 0 e revisarse tras la Fase 1.*

Evaluado contra `.specify/memory/constitution.md` v1.0.0.

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| **I. El contrato de API es la fuente de verdad** | Los esquemas pydantic y los tipos TS se derivan de `docs/API_CONTRACT.md`; los tests de contrato afirman rutas, códigos y forma de cuerpos tal como el contrato los define. El frontend consume `/api/v1` por ruta relativa. Ningún endpoint fuera del contrato. | ✅ PASS |
| **II. Dominio puro, separado del transporte** | `domain/` no importa FastAPI ni el repositorio concreto: contiene `color_for_number`, `resolve_bet`, `payout_for` y las transiciones de estado como funciones puras sobre entidades propias. La persistencia entra por `RouletteRepository` (`Protocol`). Los routers solo validan, delegan y mapean a HTTP. `Decimal` en todo importe. | ✅ PASS |
| **III. Toda regla de negocio tiene un test** | Se planifican tests unitarios para: paridad de color incluido `0 → red`, pago 5x, pago 1.8x, pago 0 en fallo; y tests de API para rango 0..36, tope 10.000, `X-User-Id` ausente/vacío y las tres transiciones inválidas de la máquina de estados. El sorteo se inyecta en test para ser determinista. | ✅ PASS |
| **IV. El enunciado manda; la desviación se documenta** | La paridad literal (0 rojo) se implementa como pide el enunciado y queda documentada en el contrato, en la sección A1 del spec y en el `README.md`, con test dedicado. | ✅ PASS |
| **V. Despliegue reproducible y CI verde** | Dockerfiles separados para back y front, `docker-compose.yml` levanta el sistema completo, nginx sirve el front y proxya `/api`, GitHub Actions ejecuta lint + tests y solo despliega a Dokploy con la CI en verde. Configuración por variables de entorno. | ✅ PASS |

**Resultado**: sin violaciones. La tabla de Complexity Tracking queda vacía.

**Nota sobre el repositorio tras Fase 1**: introducir un `Protocol` para un único
almacén en memoria podría leerse como complejidad prematura. No lo es: el
Principio II lo exige explícitamente ("la persistencia MUST estar detrás de una
interfaz definida por el dominio"), y el coste es un archivo de ~20 líneas frente
al beneficio de mantener el dominio ignorante del almacén.

## Project Structure

### Documentation (this feature)

```text
specs/001-la-ruleta/
├── plan.md              # Este archivo
├── spec.md              # Especificación funcional
├── tasks.md             # Tareas accionables
└── contracts/
    └── openapi-notes.md # Nota que apunta al contrato vigente
```

`research.md`, `data-model.md` y `quickstart.md` no se generan: el enunciado está
cerrado, el modelo de datos cabe en la sección "Key Entities" del spec y el
arranque se documenta en el `README.md` del repositorio.

### Source Code (repository root)

```text
backend/
├── src/
│   └── la_ruleta/
│       ├── main.py                 # App FastAPI, montaje de routers, CORS, /health
│       ├── config.py               # Settings por variables de entorno
│       ├── domain/                 # PURO: sin FastAPI, sin repositorio concreto
│       │   ├── models.py           # Roulette, Bet, BetResult, RoundResult, enums
│       │   ├── rules.py            # color_for_number, resolve_bet, payout_for
│       │   ├── errors.py           # RouletteNotFound, InvalidStateTransition, ...
│       │   └── repository.py       # RouletteRepository (typing.Protocol)
│       ├── services/
│       │   └── roulette_service.py # Orquesta dominio + repositorio + sorteo
│       ├── infrastructure/
│       │   ├── memory_repository.py# InMemoryRouletteRepository
│       │   └── rng.py              # WinningNumberDrawer sobre secrets
│       └── api/
│           ├── deps.py             # Inyección de servicio y de X-User-Id
│           ├── schemas.py          # Esquemas pydantic v2 de request/response
│           ├── errors.py           # Handlers -> {"detail": "..."} + código HTTP
│           └── v1/
│               ├── roulettes.py    # POST /, /{id}/open, /{id}/bets, /{id}/close, GETs
│               └── health.py       # GET /health
├── tests/
│   ├── unit/                       # Dominio puro, sin HTTP
│   │   ├── test_color_rules.py
│   │   ├── test_payouts.py
│   │   └── test_state_machine.py
│   ├── contract/                   # Forma de request/response por endpoint
│   │   ├── test_create_open.py
│   │   ├── test_bets.py
│   │   └── test_close.py
│   └── integration/
│       └── test_full_round.py      # Ciclo crear -> abrir -> apostar -> cerrar
├── pyproject.toml
└── Dockerfile

frontend/
├── src/
│   ├── api/
│   │   ├── client.ts               # fetch sobre /api/v1, inyecta X-User-Id
│   │   └── types.ts                # Tipos TS derivados del contrato
│   ├── components/
│   │   ├── RouletteBoard.tsx       # Selección de número y color
│   │   ├── BetForm.tsx             # Monto y envío de apuesta
│   │   └── ResultPanel.tsx         # Resultado del cierre
│   ├── pages/
│   │   └── RoulettePage.tsx        # Pantalla principal de la ronda
│   ├── hooks/
│   │   └── useUserId.ts            # Id persistente en localStorage
│   └── main.tsx
├── nginx.conf                      # Sirve estáticos + proxy /api -> backend
├── package.json
├── tsconfig.json
├── vite.config.ts
└── Dockerfile

docs/
└── API_CONTRACT.md                 # Contrato vigente (no se toca desde aquí)

.github/workflows/
└── ci-cd.yml                       # Lint + tests + build + deploy a Dokploy

docker-compose.yml                  # backend + frontend(nginx) en local
README.md
```

**Structure Decision**: estructura de aplicación web con `backend/` y
`frontend/` separados, ya presente en el repositorio. Dentro del backend, las
capas están separadas por directorio y la dirección de dependencias es
`api → services → domain`, con `infrastructure` implementando interfaces que
declara `domain`. `domain/` no importa nada de las otras capas: esa regla es
verificable con una simple inspección de imports y es lo que hace cumplible el
Principio II.

## Decisiones técnicas relevantes

- **Discriminación de apuestas**: el cuerpo de apuesta usa unión discriminada por
  `type` (`Literal["number"] | Literal["color"]`) en pydantic v2, de modo que un
  cuerpo con `type: "number"` sin campo `number` falla en validación (422) sin
  necesidad de comprobaciones manuales en el router.
- **Rangos declarativos**: `number` se valida con `Field(ge=0, le=36)` y `amount`
  con `Field(gt=0, le=10000, decimal_places=2)`. Las reglas de rango viven en el
  esquema, no dispersas en el servicio.
- **`X-User-Id`**: se resuelve como dependencia FastAPI que devuelve 400 si falta
  o si es cadena vacía tras `strip()`. Se aplica solo al endpoint de apuesta,
  que es donde el contrato lo exige.
- **Sorteo inyectable**: `WinningNumberDrawer` es un `Protocol` con una única
  operación `draw() -> int`. La implementación de producción usa
  `secrets.randbelow(37)`. En tests se sustituye por un doble que devuelve un
  número fijo, lo que hace deterministas las aserciones de pago.
- **Pagos con `Decimal`**: los multiplicadores son `Decimal("5")` y
  `Decimal("1.8")`. El resultado se cuantiza a dos decimales con
  `ROUND_HALF_UP`. Los esquemas serializan `Decimal`, nunca `float`.
- **Errores**: excepciones de dominio propias (`RouletteNotFound`,
  `RouletteNotOpen`, `InvalidStateTransition`, `MissingUserId`) traducidas a HTTP
  por handlers registrados en la app. El dominio nunca lanza `HTTPException`.
- **Concurrencia en el cierre**: la transición a `closed` y el sorteo ocurren
  bajo un cerrojo por ruleta en el repositorio en memoria, de modo que dos
  cierres simultáneos no puedan sortear dos números; el segundo recibe 409.
- **CORS**: en producción no es necesario porque nginx unifica el origen. Se
  habilita solo en desarrollo, condicionado por variable de entorno, para el
  `vite dev server`.
- **nginx**: `location /api { proxy_pass http://backend:8000; }` y `try_files`
  con fallback a `index.html` para las rutas del SPA.

## Complexity Tracking

> Rellenar solo si el Constitution Check tiene violaciones que justificar.

Sin violaciones. Nada que justificar.
