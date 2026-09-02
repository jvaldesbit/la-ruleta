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

Evaluado contra `.specify/memory/constitution.md` **v1.1.0**.

| Principio | Cómo lo cumple este plan | Estado |
|---|---|---|
| **I. El contrato de API es la fuente de verdad** | Los esquemas pydantic y los tipos TS se derivan de `docs/API_CONTRACT.md`; los tests de contrato afirman rutas, códigos y forma de cuerpos tal como el contrato los define. El frontend consume `/api/v1` por ruta relativa. Ningún endpoint fuera del contrato. El paso a MongoDB no altera ni un byte de la superficie HTTP. | ✅ PASS |
| **II. Dominio puro, separado del transporte** | `domain/` no importa FastAPI, ni `motor`, ni `pymongo`, ni `bson`: contiene `color_for_number`, `resolve_bet`, `payout_for` y las transiciones de estado como funciones puras sobre entidades propias. La persistencia entra por `RouletteRepository` (`Protocol`) con dos implementaciones intercambiables. La conversión `Decimal` ↔ `Decimal128` vive solo en `infrastructure/mongo_repository.py`. Los routers solo validan, delegan y mapean a HTTP. | ✅ PASS |
| **III. Toda regla de negocio tiene un test** | Tests unitarios para: paridad de color incluido `0 → red`, pago 5x, pago 1.8x, pago 0 en fallo; tests de API para rango 0..36, tope 10.000, `X-User-Id` ausente/vacío y las transiciones inválidas; y test de cierre concurrente para la atomicidad. La batería de repositorio corre contra las dos implementaciones, saltándose los casos de Mongo real si falta `MONGODB_TEST_URI`. El sorteo se inyecta para ser determinista. | ✅ PASS |
| **IV. El enunciado manda; la desviación se documenta** | La paridad literal (0 rojo) se implementa como pide el enunciado; el argumento vive una sola vez en `DECISIONES.md` (D-01) y el contrato, el spec (§A1) y el `README.md` lo citan por identificador, con test dedicado. Igual con D-02 (pago bruto), D-03 (cierre terminal), D-04 (sin saldo) y D-05 (límites). | ✅ PASS |
| **V. Despliegue reproducible y CI verde** | Dockerfiles separados para back y front, `compose` levanta backend + frontend + MongoDB local (podman) y deja el sistema funcional, nginx sirve el front y proxya `/api` bajo `ruleta.jcvb.com.co`, GitHub Actions ejecuta lint + tests, publica en GHCR y solo despliega llamando a la API de Dokploy con la CI en verde. Configuración por variables de entorno, incluida `MONGODB_URI`. | ✅ PASS |

**Resultado**: sin violaciones. La tabla de Complexity Tracking queda vacía.

**Nota sobre el `Protocol` de repositorio tras Fase 1**: mantener una interfaz con
dos implementaciones podría leerse como complejidad innecesaria ahora que hay una
base de datos real. No lo es, por dos motivos: el Principio II lo exige
explícitamente, y la implementación en memoria es lo que permite que la suite de
tests corra completa y rápida sin levantar MongoDB, que es precisamente lo que
hace cumplible el Principio III en CI.

**Riesgo vigilado**: con dos implementaciones existe el riesgo de que diverjan y
de que la de memoria oculte un fallo que solo aparece en Mongo (por ejemplo, la
atomicidad de la transición condicionada). Se mitiga con una batería de tests de
repositorio compartida que ambas deben pasar (T011b en `tasks.md`) y ejecutando el
job de MongoDB en CI con un servicio real.

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
│       │   ├── memory_repository.py# InMemoryRouletteRepository (tests, sin BD)
│       │   ├── mongo_repository.py # MongoRouletteRepository sobre motor
│       │   ├── mongo_client.py     # Cliente motor, ciclo de vida, índices
│       │   ├── mapping.py          # Decimal <-> Decimal128, documento <-> entidad
│       │   └── rng.py              # WinningNumberDrawer sobre secrets
│       └── api/
│           ├── deps.py             # Inyección de servicio y de X-User-Id
│           ├── schemas.py          # Esquemas pydantic v2 de request/response
│           ├── errors.py           # Handlers -> {"detail": "..."} + código HTTP
│           └── v1/
│               ├── roulettes.py    # POST /, /{id}/open, /{id}/bets, /{id}/close, GETs
│               └── health.py       # GET /health
├── tests/
│   ├── unit/                       # Dominio puro, sin HTTP y sin BD
│   │   ├── test_color_rules.py
│   │   ├── test_payouts.py
│   │   ├── test_state_machine.py
│   │   └── test_rng.py
│   ├── contract/                   # Forma de request/response por endpoint
│   │   ├── test_create_open.py
│   │   ├── test_bets.py
│   │   ├── test_close.py
│   │   ├── test_queries.py
│   │   └── test_health.py
│   ├── repository/                 # Misma batería para AMBAS implementaciones
│   │   └── test_repository_contract.py  # skip de Mongo sin MONGODB_TEST_URI
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

docker-compose.yml                  # backend + frontend(nginx) + MongoDB (podman)
DECISIONES.md                       # Decisiones D-01..D-11 (no se toca desde aquí)
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
  `ROUND_HALF_UP` (D-02). Los esquemas serializan `Decimal`, nunca `float`.
- **Errores**: excepciones de dominio propias (`RouletteNotFound`,
  `RouletteNotOpen`, `InvalidStateTransition`, `MissingUserId`) traducidas a HTTP
  por handlers registrados en la app. El dominio nunca lanza `HTTPException`.
- **Modelo de documento**: una sola colección, `roulettes`. Cada documento
  contiene la ruleta y su array `bets`, más `winning_number`, `winning_color` y
  `results` una vez cerrada. Ruleta y apuestas siempre se leen y se liquidan
  juntas, así que repartirlas en dos colecciones solo añadiría una escritura que
  coordinar en el cierre (D-08).
- **`Decimal128` en el borde**: `mapping.py` es el único módulo que conoce
  `bson.Decimal128`. Convierte a `Decimal` al leer y a `Decimal128` al escribir.
  Ni el dominio ni los routers ven un tipo del driver.
- **Transiciones atómicas**: abrir y cerrar usan
  `find_one_and_update({"_id": id, "status": <esperado>}, {"$set": {...}})`. Si el
  resultado es `None`, la ruleta no existe (se distingue con una segunda lectura)
  o no estaba en el estado esperado → 409. El sorteo del número ganador se genera
  antes y se escribe **dentro de esa misma actualización condicionada**, de modo
  que dos cierres simultáneos solo pueden persistir uno; el perdedor recibe 409 y
  su número sorteado se descarta sin haberse guardado (D-08, D-03).
- **Índices**: al arrancar la app se garantizan los índices necesarios
  (`status` y `created_at` para el listado ordenado). `_id` ya está indexado. La
  creación es idempotente y no rompe si la base ya existe.
- **Instancia de MongoDB compartida en Dokploy**: el proyecto usa su propia base
  de datos dentro de la instancia existente, con credenciales propias por variable
  de entorno. No se ejecuta nada de alcance global sobre el servidor.
- **Arranque sin base de datos**: una variable de entorno selecciona la
  implementación del repositorio. Sin `MONGODB_URI`, la app arranca con el
  repositorio en memoria; con ella, usa MongoDB. Esto mantiene barato el
  desarrollo y el arranque de pruebas.
- **Salud**: `/api/v1/health` reporta `status: ok` solo si el `ping` a MongoDB
  responde cuando el backend está configurado contra Mongo.
- **CORS**: en producción no es necesario porque nginx unifica el origen bajo
  `ruleta.jcvb.com.co`. Se habilita solo en desarrollo, condicionado por variable
  de entorno, para el `vite dev server` (D-09).
- **nginx**: `location /api { proxy_pass http://backend:8000; }` y `try_files`
  con fallback a `index.html` para las rutas del SPA.
- **CI/CD**: GitHub Actions ejecuta lint y tests (con un servicio de MongoDB para
  los tests marcados), construye las dos imágenes, las publica en **GHCR** y
  dispara el despliegue con una **llamada HTTP directa a la API de Dokploy**, sin
  acciones de terceros (D-10).

## Complexity Tracking

> Rellenar solo si el Constitution Check tiene violaciones que justificar.

Sin violaciones. Nada que justificar.
