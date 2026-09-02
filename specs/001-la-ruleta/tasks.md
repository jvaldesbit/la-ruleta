---

description: "Lista de tareas para el MVP de La Ruleta"
---

# Tasks: La Ruleta — MVP de ruleta de apuestas online

**Input**: Documentos de diseño en `/specs/001-la-ruleta/`

**Prerequisites**: [plan.md](./plan.md) (requerido), [spec.md](./spec.md)
(historias de usuario y FR), [contracts/openapi-notes.md](./contracts/openapi-notes.md),
[`docs/API_CONTRACT.md`](../../docs/API_CONTRACT.md) (contrato normativo),
[`DECISIONES.md`](../../DECISIONES.md) (decisiones D-01..D-11)

**Tests**: SÍ, obligatorios. El Principio III de la constitución exige que toda
regla de negocio tenga un test que falle si la regla se rompe.

**Organization**: agrupadas por fase; dentro de cada fase, por historia de
usuario, para poder entregar el MVP incrementalmente.

## Format: `[ID] [P?] [Story] Descripción → FR cubiertos`

- **[P]**: paralelizable (archivos distintos, sin dependencias entre sí)
- **[Story]**: US1 (ciclo completo), US2 (rechazos), US3 (consulta), US4 (frontend)
- Cada tarea indica ruta de archivo exacta y los FR de `spec.md` que cubre

## Path Conventions

Aplicación web: `backend/src/la_ruleta/`, `backend/tests/`, `frontend/src/`.
Rutas según la estructura fijada en `plan.md`.

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: dejar ambos proyectos arrancables y con herramientas de calidad.

- [ ] T001 [P] Crear `backend/pyproject.toml` con Python 3.14, FastAPI, pydantic v2, uvicorn, `motor`, pytest, `pytest-asyncio` y ruff; registrar el marcador `mongo` de pytest y configurar ruff en el mismo archivo
- [ ] T002 [P] Inicializar `frontend/` con Vite + React + TypeScript (`package.json`, `tsconfig.json` en modo `strict`, `vite.config.ts`)
- [ ] T003 [P] Crear el esqueleto de paquetes en `backend/src/la_ruleta/` (`domain/`, `services/`, `infrastructure/`, `api/v1/`) con sus `__init__.py`
- [ ] T004 [P] Crear el esqueleto de tests en `backend/tests/` (`unit/`, `contract/`, `repository/`, `integration/`) con `conftest.py` vacío
- [ ] T005 [P] Configurar ESLint + Prettier en `frontend/` alineados con TypeScript estricto
- [ ] T005b [P] Añadir el servicio `mongo` (MongoDB 8) a `docker-compose.yml` para levantarlo en local con **podman**, con volumen de datos y credenciales por variable de entorno → D-08, SC-004

**Checkpoint**: ambos proyectos instalan dependencias, ejecutan lint sin errores y `podman compose up mongo` levanta una base de datos accesible.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**⚠️ CRÍTICO**: ninguna historia de usuario puede empezar hasta completar esta fase.

**Purpose**: el núcleo de dominio puro y sus contratos internos, de los que dependen todas las historias.

- [ ] T006 [P] Definir entidades y enums de dominio en `backend/src/la_ruleta/domain/models.py`: `Roulette`, `Bet`, `BetResult`, `RoundResult`, `RouletteStatus`, `BetType`, `Color`; importes como `Decimal` → FR-002, FR-012, FR-023, FR-024
- [ ] T007 [P] Definir excepciones de dominio en `backend/src/la_ruleta/domain/errors.py`: `RouletteNotFound`, `RouletteNotOpen`, `InvalidStateTransition`, `MissingUserId` → FR-005, FR-006, FR-011, FR-031
- [ ] T008 [P] Definir `RouletteRepository` como `typing.Protocol` en `backend/src/la_ruleta/domain/repository.py`. Operaciones: `create`, `get`, `list`, `add_bet`, y **transiciones condicionadas** `transition_status(id, expected, changes) -> Roulette | None` que devuelve `None` si el estado actual no era el esperado. Sin tipos del driver en la firma → FR-012, FR-025, FR-026, FR-032, FR-033
- [ ] T009 [P] Definir `WinningNumberDrawer` como `Protocol` en `backend/src/la_ruleta/domain/repository.py` o módulo propio, con `draw() -> int` → FR-017
- [ ] T010 Implementar `backend/src/la_ruleta/domain/rules.py`: `color_for_number` (par→red, impar→black, 0→red), `payout_for` (5x número, 1.8x color, 0 fallo, `Decimal` cuantizado a 2 decimales con `ROUND_HALF_UP`), `resolve_bet`, y las transiciones válidas de estado (depende de T006, T007) → FR-016, FR-018, FR-019, FR-020, FR-021, FR-024
- [ ] T011 [P] Implementar `InMemoryRouletteRepository` en `backend/src/la_ruleta/infrastructure/memory_repository.py` cumpliendo el `Protocol`, con cerrojo por ruleta que emule la semántica de la transición condicionada (depende de T008) → FR-032, FR-033
- [ ] T011b Escribir la **batería compartida de tests de repositorio** en `backend/tests/repository/test_repository_contract.py`, parametrizada por implementación: crear, recuperar, listar, añadir apuesta, transición válida, transición desde estado inesperado que devuelve `None`, y dos transiciones concurrentes de las que solo una gana. Los casos sobre MongoDB se marcan con `@pytest.mark.mongo` y se **saltan con `pytest.skip` si no hay `MONGODB_TEST_URI`** en el entorno (depende de T008, T011) → FR-032, FR-033, SC-008, SC-009
- [ ] T011c [P] Implementar `mapping.py` en `backend/src/la_ruleta/infrastructure/`: conversión entidad ↔ documento y `Decimal` ↔ `Decimal128`, único módulo que importa `bson` (depende de T006) → FR-024, D-02, D-08
- [ ] T011d Implementar `MongoRouletteRepository` en `backend/src/la_ruleta/infrastructure/mongo_repository.py` sobre `motor`: ruleta y apuestas en un único documento de la colección `roulettes`, apuestas con `$push`, transiciones con `find_one_and_update` filtrando por `_id` **y** por `status` esperado (depende de T008, T011c) → FR-032, FR-033, D-08
- [ ] T011e [P] Implementar `mongo_client.py` en `backend/src/la_ruleta/infrastructure/`: creación del cliente `motor`, ciclo de vida ligado al `lifespan` de la app, `ping` para salud y **aseguramiento idempotente de índices** (`status`, `created_at`) al arrancar (depende de T014) → FR-027, D-08
- [ ] T012 [P] Implementar `SecretsWinningNumberDrawer` en `backend/src/la_ruleta/infrastructure/rng.py` usando `secrets.randbelow(37)` (depende de T009) → FR-017
- [ ] T013 Crear la app FastAPI en `backend/src/la_ruleta/main.py` con montaje de routers bajo `/api/v1`, `lifespan` que abre y cierra el cliente de MongoDB, handlers de excepción que devuelven `{"detail": "..."}` con el código del contrato, y CORS condicionado por entorno (depende de T007, T011e) → FR-031
- [ ] T014 [P] Crear `backend/src/la_ruleta/config.py` con settings por variables de entorno: entorno, versión, CORS, `MONGODB_URI` y `MONGODB_DB`. **Sin `MONGODB_URI` la app arranca con el repositorio en memoria**; con ella, usa MongoDB → D-08
- [ ] T015 [P] Implementar `GET /api/v1/health` en `backend/src/la_ruleta/api/v1/health.py`, haciendo `ping` al almacén y sin devolver `ok` si no responde (depende de T011e) → FR-027
- [ ] T016 [P] Definir esquemas pydantic v2 en `backend/src/la_ruleta/api/schemas.py`: unión discriminada por `type` para la apuesta, `number` con `ge=0, le=36`, `amount` con `gt=0, le=10000, decimal_places=2`, y los esquemas de respuesta del contrato → FR-007, FR-008, FR-009, FR-010, FR-023
- [ ] T017 Implementar dependencias en `backend/src/la_ruleta/api/deps.py`: proveedor del servicio y extractor de `X-User-Id` que devuelve 400 si falta o queda vacío tras `strip()` (depende de T013) → FR-011
- [ ] T018 [P] Escribir tests unitarios del dominio en `backend/tests/unit/test_color_rules.py` y `test_payouts.py`, incluyendo explícitamente `0 → red`, 5x, 1.8x y pago 0 (depende de T010) → FR-018, FR-019, FR-020, FR-021
- [ ] T019 [P] Escribir tests unitarios de la máquina de estados en `backend/tests/unit/test_state_machine.py`: `created→open→closed`, `closed` terminal, transiciones inválidas (depende de T010) → FR-004, FR-015, FR-016
- [ ] T020 [P] Crear `backend/tests/conftest.py` con fixtures: cliente de test, repositorio en memoria limpio por test, doble determinista de `WinningNumberDrawer`, y una fixture de MongoDB que lee `MONGODB_TEST_URI`, usa una base de datos desechable por sesión y la borra al terminar; ausente la variable, marca los tests `mongo` como saltados (depende de T011, T011d, T012) → SC-009

**Checkpoint**: el dominio está implementado, sus tests pasan sin levantar HTTP ni base de datos, las dos implementaciones de repositorio pasan la misma batería, y las historias pueden avanzar en paralelo.

---

## Phase 3: User Story 1 — Ciclo completo de una ronda (Priority: P1) 🎯 MVP

**Goal**: los cuatro endpoints del enunciado funcionando de punta a punta.

**Independent Test**: ejecutar crear → abrir → apostar (número y color) → cerrar y verificar número ganador, color y pago por apuesta.

### Tests para US1 (escribir primero, deben fallar) ⚠️

- [ ] T021 [P] [US1] Test de contrato de creación y apertura en `backend/tests/contract/test_create_open.py`: 201 con `id`/`status: created`, 200 con `success: true`/`status: open` → FR-001, FR-002, FR-003
- [ ] T022 [P] [US1] Test de contrato de apuesta válida en `backend/tests/contract/test_bets.py`: apuesta a número y a color sobre ruleta abierta devuelven 201 con el registro completo → FR-006, FR-007, FR-012
- [ ] T023 [P] [US1] Test de contrato de cierre en `backend/tests/contract/test_close.py` con sorteo fijado: número ganador, color ganador, totales y `results` con `won` y `payout` correctos → FR-015, FR-017, FR-018, FR-019, FR-020, FR-021, FR-023
- [ ] T024 [P] [US1] Test de integración del ciclo completo en `backend/tests/integration/test_full_round.py`, incluyendo cierre sin apuestas y `total_bets == len(results)` → FR-022, SC-006

### Implementación de US1

- [ ] T025 [US1] Implementar `RouletteService` en `backend/src/la_ruleta/services/roulette_service.py`: `create`, `open`, `place_bet`, `close` orquestando dominio, repositorio y sorteo. `open` y `close` usan `transition_status` con el estado esperado; si devuelve `None`, se distingue 404 de 409 con una lectura posterior. El número ganador se sortea **antes** y se persiste dentro de la misma transición condicionada (depende de T010, T011, T012) → FR-001..FR-006, FR-012, FR-015, FR-017, FR-022, FR-033
- [ ] T026 [US1] Implementar `POST /api/v1/roulettes` en `backend/src/la_ruleta/api/v1/roulettes.py` (depende de T025) → FR-001, FR-002
- [ ] T027 [US1] Implementar `POST /api/v1/roulettes/{id}/open` en el mismo router, devolviendo la confirmación explícita de éxito (depende de T025) → FR-003
- [ ] T028 [US1] Implementar `POST /api/v1/roulettes/{id}/bets` con la dependencia de `X-User-Id` y la unión discriminada (depende de T016, T017, T025) → FR-006..FR-012, FR-014
- [ ] T029 [US1] Implementar `POST /api/v1/roulettes/{id}/close` con sorteo, resolución de todas las apuestas y agregados (depende de T025) → FR-015, FR-017..FR-023
- [ ] T030 [US1] Verificar que ninguna validación de saldo se introduce en el servicio ni en el router; dejar comentario que cite el supuesto del enunciado → FR-013

**Checkpoint**: US1 completa. El enunciado está cubierto y es demostrable con `curl` o desde `/docs`.

---

## Phase 4: User Story 2 — Rechazo de operaciones inválidas (Priority: P2)

**Goal**: toda operación inválida se rechaza con el código del contrato y sin alterar estado.

**Independent Test**: enviar cada operación inválida por separado y comprobar código de error y estado inalterado.

### Tests para US2 ⚠️

- [ ] T031 [P] [US2] Tests de validación de apuesta en `backend/tests/contract/test_bets.py`: número 37 y -1 → 422; monto 0, negativo y 10000.01 → 422; color inválido → 422 → FR-008, FR-009, FR-010
- [ ] T032 [P] [US2] Tests de `X-User-Id` en `backend/tests/contract/test_bets.py`: header ausente → 400; header vacío o solo espacios → 400 → FR-011
- [ ] T033 [P] [US2] Tests de estado en `backend/tests/contract/test_create_open.py` y `test_close.py`: apostar en `created`/`closed` → 409; abrir una `open` o `closed` → 409; cerrar una `created` o `closed` → 409 → FR-004, FR-006, FR-015, FR-016
- [ ] T034 [P] [US2] Tests de recurso inexistente: abrir, apostar y cerrar con un id desconocido → 404 → FR-005
- [ ] T035 [P] [US2] Test de cierre concurrente en `backend/tests/integration/test_full_round.py`: 50 cierres simultáneos sobre la misma ruleta, exactamente uno responde 200 y el resto 409, y el número ganador persistido es único. Se ejecuta contra ambas implementaciones de repositorio → FR-033, SC-008

### Implementación de US2

- [ ] T036 [US2] Ajustar los handlers de excepción de `backend/src/la_ruleta/api/errors.py` para mapear cada excepción de dominio a 400/404/409 con `{"detail": "..."}` (depende de T007, T013) → FR-031
- [ ] T037 [US2] Asegurar en `RouletteService` que las transiciones inválidas lanzan la excepción de dominio adecuada antes de mutar nada (depende de T025) → FR-004, FR-006, FR-015, FR-016
- [ ] T038 [US2] Asegurar que ambas implementaciones rechazan la transición desde un estado inesperado sin mutar nada: cerrojo por ruleta en `InMemoryRouletteRepository` y filtro por `status` en el `find_one_and_update` de `MongoRouletteRepository` (depende de T011, T011d) → FR-033

**Checkpoint**: US1 + US2 funcionan. La API es robusta frente a entradas inválidas y frente a peticiones concurrentes.

---

## Phase 5: User Story 3 — Consulta del estado de las ruletas (Priority: P3)

**Goal**: listar ruletas y consultar el detalle de una, para que el frontend tenga qué mostrar.

**Independent Test**: crear dos ruletas, cerrar una, y verificar listado y detalle.

### Tests para US3 ⚠️

- [ ] T039 [P] [US3] Test de listado en `backend/tests/contract/test_queries.py`: estados, instantes y `bets_count` correctos → FR-025
- [ ] T040 [P] [US3] Test de detalle en `backend/tests/contract/test_queries.py`: incluye `bets`, y `results` + ganadores solo si está cerrada → FR-026
- [ ] T041 [P] [US3] Test de `GET /api/v1/health` en `backend/tests/contract/test_health.py` → FR-027

### Implementación de US3

- [ ] T042 [US3] Implementar `GET /api/v1/roulettes` en `backend/src/la_ruleta/api/v1/roulettes.py` (depende de T025) → FR-025
- [ ] T043 [US3] Implementar `GET /api/v1/roulettes/{id}` con apuestas y resultados condicionales (depende de T025) → FR-026

**Checkpoint**: la API está completa según `docs/API_CONTRACT.md`.

---

## Phase 6: User Story 4 — Interfaz web para jugar la ronda (Priority: P3)

**Goal**: completar una ronda entera desde el navegador.

**Independent Test**: con el sistema desplegado, jugar una ronda completa y comprobar que la pantalla coincide con la respuesta de cierre.

### Implementación de US4

- [ ] T044 [P] [US4] Definir los tipos TypeScript del contrato en `frontend/src/api/types.ts`, derivados de `docs/API_CONTRACT.md` → FR-030
- [ ] T045 [P] [US4] Implementar `useUserId` en `frontend/src/hooks/useUserId.ts`: genera un UUID la primera vez y lo persiste en `localStorage` → FR-028
- [ ] T046 [US4] Implementar el cliente HTTP en `frontend/src/api/client.ts` sobre rutas relativas `/api/v1`, inyectando `X-User-Id` y normalizando el error `{"detail": "..."}` (depende de T044, T045) → FR-028, FR-030, FR-031
- [ ] T047 [P] [US4] Implementar `RouletteBoard.tsx` con selección de número 0..36 y de color rojo/negro → FR-029
- [ ] T048 [P] [US4] Implementar `BetForm.tsx` con validación de monto en cliente (0 < monto ≤ 10000) y mensajes de error de la API → FR-010, FR-029
- [ ] T049 [P] [US4] Implementar `ResultPanel.tsx` mostrando número y color ganador, y el detalle por apuesta con `won` y `payout` → FR-023, FR-029
- [ ] T050 [US4] Implementar `RoulettePage.tsx` orquestando crear → abrir → apostar → cerrar con estados de carga y error (depende de T046, T047, T048, T049) → FR-029, SC-003

**Checkpoint**: el MVP es demostrable de punta a punta desde el navegador.

---

## Phase 7: Empaquetado y despliegue

**Purpose**: cumplir el Principio V de la constitución.

- [ ] T051 [P] Escribir `backend/Dockerfile` (Python 3.14 slim, instalación de dependencias, uvicorn) → Principio V
- [ ] T052 [P] Escribir `frontend/Dockerfile` multi-etapa: build de Vite y servido por nginx → Principio V
- [ ] T053 [P] Escribir `frontend/nginx.conf`: estáticos con `try_files` a `index.html` y `location /api` con `proxy_pass` al backend por la red interna, bajo el dominio `ruleta.jcvb.com.co` → FR-030, D-09
- [ ] T054 Escribir `docker-compose.yml` que levante backend, frontend y MongoDB con **podman**, y deje el sistema funcional en local (depende de T005b, T051, T052, T053) → Principio V, SC-004
- [ ] T055 Escribir `.github/workflows/ci-cd.yml`: lint + tests de backend con un **servicio de MongoDB** y `MONGODB_TEST_URI` exportada para que los tests marcados `mongo` no se salten en CI, typecheck + build de frontend, publicación de ambas imágenes en **GHCR**, y despliegue por **llamada HTTP directa a la API de Dokploy** condicionado a que todo esté en verde (depende de T054) → Principio V, D-10, SC-009
- [ ] T056 [P] Crear `.env.example` con todas las variables documentadas, incluidas `MONGODB_URI`, `MONGODB_DB` y `MONGODB_TEST_URI` → D-08
- [ ] T056b Configurar el servicio en Dokploy contra la **instancia de MongoDB ya existente**, con base de datos y credenciales propias del proyecto, y el dominio `ruleta.jcvb.com.co` con su certificado (depende de T055) → D-08, D-09

---

## Phase 8: Polish y cierre

- [ ] T057 Escribir el `README.md` del repositorio con arranque local (con y sin MongoDB), arranque por contenedores con podman, y una **sección de desviaciones del enunciado que cite `DECISIONES.md` por identificador** (D-01 paridad y 0 rojo, D-02 pago bruto, D-03 cierre terminal, D-04 sin validación de saldo, D-05 límites) sin repetir su argumentación → Principio IV, spec §A1–A4
- [ ] T058 Verificar que `backend/src/la_ruleta/domain/` no importa FastAPI, pydantic, `motor`, `pymongo`, `bson` ni la infraestructura concreta; añadir un test que falle si aparece alguno de esos imports → Principio II
- [ ] T059 Verificar la trazabilidad FR ↔ test: que cada FR-001..FR-033 tenga al menos un test que lo cubra → Principio III, SC-001, SC-002
- [ ] T060 [P] Test estadístico del sorteo: 10.000 extracciones cubren los 37 valores y ninguno fuera de rango, en `backend/tests/unit/test_rng.py`. La comprobación de color debe esperar el reparto **19 rojos / 18 negros**, no 50/50 → FR-017, FR-018, SC-005, D-01
- [ ] T060b [P] Test de durabilidad en `backend/tests/repository/test_repository_contract.py`: con MongoDB real, una ruleta escrita por un cliente se recupera íntegra por otro cliente nuevo (simula el reinicio del proceso), con importes que siguen siendo `Decimal` de 2 decimales tras el viaje a `Decimal128` → FR-024, FR-032, SC-007
- [ ] T061 Revisión final contra `docs/API_CONTRACT.md`: rutas, códigos y forma de cuerpos coinciden endpoint a endpoint → Principio I
- [ ] T062 Revisión final contra `DECISIONES.md`: cada decisión D-01..D-11 está reflejada o citada donde corresponde, y ningún artefacto la contradice → Principio IV

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Fase 1 (Setup)**: sin dependencias, arranca de inmediato.
- **Fase 2 (Foundational)**: depende de la Fase 1. **BLOQUEA todas las historias.**
- **Fase 3 (US1, P1)**: depende de la Fase 2. Es el MVP.
- **Fase 4 (US2, P2)**: depende de la Fase 2; se apoya en los endpoints de US1 para los tests de rechazo.
- **Fase 5 (US3, P3)**: depende de la Fase 2; independiente de US2.
- **Fase 6 (US4, P3)**: depende funcionalmente de US1 y US3 (necesita los endpoints reales para ser demostrable), pero T044, T045, T047, T048 y T049 pueden escribirse en paralelo desde el contrato, sin esperar al backend.
- **Fase 7 (Despliegue)**: los Dockerfiles y nginx pueden escribirse en paralelo desde la Fase 1; el workflow de CI necesita que existan tests que ejecutar.
- **Fase 8 (Polish)**: depende de que las historias deseadas estén completas.

### Dentro de cada historia

- Los tests se escriben ANTES y deben fallar antes de implementar.
- Modelos antes que servicios; servicios antes que routers.
- Una historia se cierra y valida antes de pasar a la siguiente prioridad.

### Oportunidades de paralelización

- Fase 1: T001–T005b son todas [P].
- Fase 2: T006–T009 en paralelo; luego T010; después T011, T011c, T012, T014, T016, T018, T019 en paralelo. T011d depende de T011c; T011e depende de T014; T011b y T020 cierran la fase cuando existen ambas implementaciones.
- Fase 3: T021–T024 (tests) en paralelo entre sí.
- Fase 4: T031–T035 en paralelo entre sí.
- Fase 6: T044, T045, T047, T048, T049 en paralelo.
- Fase 7: T051, T052, T053, T056 en paralelo; T054 y luego T055, T056b en serie.
- Con dos personas: una toma backend (Fases 2–5) y otra frontend + despliegue (Fases 6–7) trabajando contra `docs/API_CONTRACT.md`.

---

## Parallel Example: Fase 3 (US1)

```bash
# Lanzar los tests de US1 juntos (deben fallar antes de implementar):
Task: "Test de contrato de creación y apertura en backend/tests/contract/test_create_open.py"
Task: "Test de contrato de apuesta válida en backend/tests/contract/test_bets.py"
Task: "Test de contrato de cierre en backend/tests/contract/test_close.py"
Task: "Test de integración del ciclo completo en backend/tests/integration/test_full_round.py"
```

---

## Implementation Strategy

### MVP primero (solo US1)

1. Fase 1: Setup.
2. Fase 2: Foundational (crítica, bloquea todo).
3. Fase 3: US1.
4. **PARAR y VALIDAR**: los cuatro endpoints del enunciado funcionan y sus tests pasan.
5. En este punto la prueba técnica ya está satisfecha en lo esencial.

### Entrega incremental

1. Setup + Foundational → base lista.
2. + US1 → **MVP**, enunciado cubierto.
3. + US2 → API robusta ante entradas inválidas.
4. + US3 → soporte de consulta para la interfaz.
5. + US4 → demostrable desde el navegador.
6. + Fase 7 → desplegable y reproducible.
7. + Fase 8 → documentado y trazable.

---

## Notes

- `[P]` = archivos distintos, sin dependencias entre sí.
- Cada tarea mapea a uno o más FR de `spec.md`; un FR sin tarea es trabajo perdido y una tarea sin FR es alcance no acordado (constitución, §Flujo de trabajo, punto 3).
- Verificar que los tests fallan antes de implementar.
- El sorteo se inyecta en todos los tests que afirman pagos; nunca se depende del azar real para una aserción.
- No se toca `docs/API_CONTRACT.md` desde estas tareas: cualquier cambio de superficie se acuerda primero allí.
- Tampoco se toca `DECISIONES.md`: es el registro normativo del usuario. Se cita por identificador (D-NN), no se reescribe.
- Los tests que requieren MongoDB real llevan `@pytest.mark.mongo` y se saltan sin `MONGODB_TEST_URI`. La suite debe seguir pasando entera sin base de datos (SC-009); en CI, el servicio de MongoDB hace que no se salte ninguno.
- Ningún módulo bajo `domain/` puede importar `motor`, `pymongo` ni `bson`. La frontera está en `infrastructure/mapping.py`.
