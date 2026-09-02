# Specification Analysis Report — 001-la-ruleta

**Fecha**: 2026-09-02
**Artefactos analizados**: `.specify/memory/constitution.md` (v1.1.0),
`specs/001-la-ruleta/spec.md`, `plan.md`, `tasks.md`,
`contracts/openapi-notes.md`, `docs/API_CONTRACT.md`, `DECISIONES.md` (D-01..D-11).

**Nota de procedimiento**: el flujo `speckit-analyze` es estrictamente de solo
lectura y no escribe archivos. Aquí se ha ejecutado con una instrucción explícita
que pedía además persistir el informe y **corregir** lo que apareciera. Por eso
este documento existe y por eso cada hallazgo lleva un estado
`CORREGIDO` / `ABIERTO` en lugar de limitarse a proponer remediación. Los
hallazgos corregidos se dejan registrados, no se borran.

**Prerrequisitos**: `.specify/scripts/bash/check-prerequisites.sh` falla en este
repositorio (`ERROR: Feature directory not found. Set SPECIFY_FEATURE_DIRECTORY
or run the specify command to create .specify/feature.json`) porque los
artefactos se crearon a mano sobre `main`, sin rama de feature y sin
`.specify/feature.json`. Las rutas se resolvieron manualmente a
`specs/001-la-ruleta/`, que es exactamente lo que el script habría devuelto
(verificado con `create-new-feature.sh --dry-run`). Ver hallazgo I5.

---

## Hallazgos

| ID | Categoría | Severidad | Ubicación | Resumen | Acción |
|----|-----------|-----------|-----------|---------|--------|
| **C1** | Constitution Alignment | CRITICAL | constitution.md §Restricciones técnicas (v1.0.0) | La constitución afirmaba "Sin ORM ni base de datos en el MVP: repositorio en memoria detrás de un `Protocol`", contradiciendo D-08 (MongoDB). Un principio MUST en conflicto con la decisión vigente. | **CORREGIDO** — enmienda a v1.1.0: MongoDB 8 con `motor`, dos implementaciones del `Protocol`, `Decimal128`, documento único, transiciones condicionadas, podman en local, instancia compartida en Dokploy. |
| **I1** | Inconsistency | CRITICAL | spec.md §Assumptions, §Edge Cases | El spec declaraba "la persistencia es en memoria del proceso; reiniciar el servicio borra ruletas y apuestas" y "el servicio se despliega como una única instancia". Ambas afirmaciones eran falsas tras D-08. | **CORREGIDO** — supuestos reescritos: persistencia duradera en MongoDB, estado fuera del proceso, instancia de Mongo compartida, sin migraciones en el MVP. El edge case de reinicio ahora dice que las ruletas **sobreviven**. |
| **I2** | Inconsistency | HIGH | plan.md §Technical Context, §Constitution Check, §Estructura | Todo el plan describía almacenamiento en memoria, "sustituible por Redis o Postgres", y un cerrojo en proceso como única defensa ante el cierre concurrente — insuficiente con estado externo y varias réplicas. | **CORREGIDO** — Storage, Constraints, Performance Goals, árbol de código, Constitution Check y decisiones técnicas actualizados. El cierre concurrente pasa a resolverse con `find_one_and_update` condicionado al `status` esperado. |
| **G1** | Coverage Gap | HIGH | spec.md §Requirements | No existía ningún requisito que exigiera **durabilidad** ni **unicidad del sorteo**: eran propiedades implícitas del almacén. Con MongoDB pasan a ser comportamiento observable y verificable. | **CORREGIDO** — añadidos **FR-032** (persistencia duradera, sobrevive al reinicio) y **FR-033** (una ruleta se sortea exactamente una vez bajo cierres concurrentes), con SC-007 y SC-008 y las tareas T011b, T035, T060b. |
| **A1** | Ambiguity | MEDIUM | spec.md §Edge Cases | "Monto con más de dos decimales: se rechaza **o** se normaliza". Dos comportamientos incompatibles en un requisito de dinero, y D-05 ya lo cerraba ("dos decimales como máximo"). | **CORREGIDO** — se rechaza con 422, explícitamente; no se normaliza en silencio para no liquidar un importe distinto del enviado. |
| **G2** | Coverage Gap | MEDIUM | tasks.md §Fase 8, spec.md SC-005 | El test estadístico del sorteo (T060) no decía qué esperar del color. Escrito de forma ingenua asumiría 50/50 y fallaría siempre, porque D-01 produce **19 rojos / 18 negros**. | **CORREGIDO** — T060 exige explícitamente el reparto 19/18, y el spec añade un edge case que documenta la asimetría como efecto esperado de D-01, no como defecto. |
| **D1** | Duplication | MEDIUM | spec.md §Ambigüedades vs. DECISIONES.md | Las secciones A1–A4 del spec reproducían la argumentación completa de D-01..D-04. Dos copias del mismo razonamiento divergen en cuanto una se edita. | **CORREGIDO** — A1–A4 reducidas a decisión + efecto + cita del identificador, con una tabla de correspondencia ambigüedad → decisión → FR. `DECISIONES.md` queda como única fuente del argumento, tal como exige el Principio IV enmendado. |
| **I3** | Inconsistency | MEDIUM | plan.md §Summary, constitution.md §Principio V | Ningún artefacto mencionaba el dominio de despliegue, y la constitución exigía literalmente `docker compose up` mientras D-08 fija **podman** como motor local. | **CORREGIDO** — `ruleta.jcvb.com.co` incorporado a la constitución (Restricciones técnicas), al plan (Summary, Target Platform, CORS, nginx) y a T053/T056b. El Principio V pasa a hablar de "un único `compose up` (con podman, motor de referencia en local)". |
| **G3** | Coverage Gap | MEDIUM | tasks.md §Fase 7 | El workflow de CI no preveía cómo ejecutar los tests que necesitan MongoDB, ni dónde se publican las imágenes, ni cómo se dispara el despliegue (D-10). | **CORREGIDO** — T055 exige servicio de MongoDB en CI con `MONGODB_TEST_URI` exportada, publicación en **GHCR** y despliegue por llamada HTTP directa a la API de Dokploy, sin acciones de terceros. Añadida T056b para la configuración en Dokploy. |
| **G4** | Coverage Gap | MEDIUM | spec.md SC-003 | SC-003 (usuario completa una ronda desde el navegador) no estaba citado por ninguna tarea. | **CORREGIDO** — mapeado a T050. |
| **I4** | Inconsistency | LOW | tasks.md §Fase 8 T058 | La verificación de pureza del dominio solo prohibía FastAPI y "la infraestructura concreta". Con MongoDB, la fuga probable es `bson.Decimal128` colándose en las entidades. | **CORREGIDO** — T058 prohíbe además `motor`, `pymongo` y `bson`, y pide un test que falle si aparecen. La constitución añade la misma regla al Principio II y sitúa la frontera en `infrastructure/mapping.py`. |
| **U1** | Underspecification | LOW | spec.md FR-027, docs/API_CONTRACT.md | `docs/API_CONTRACT.md` define `GET /api/v1/health` → `200 {"status":"ok","version":"..."}` y **no define la respuesta cuando el almacén no responde**. Con una base de datos externa, un `ok` incondicional es un health check que miente. | **PARCIAL / ABIERTO** — FR-027 y T015 ya exigen no reportar `ok` con Mongo caído, pero **el contrato no documenta ese caso**. No se ha tocado `docs/API_CONTRACT.md` (fuera del alcance asignado). Requiere acuerdo: ver Acciones pendientes. |
| **U2** | Underspecification | LOW | docs/API_CONTRACT.md §POST /bets | El contrato exige **400** si falta `X-User-Id`. FastAPI devuelve 422 por defecto para una cabecera requerida ausente, así que cumplirlo requiere una dependencia explícita, no la validación automática. | **SIN CAMBIO NECESARIO** — ya estaba previsto en T017 y verificado por T032. Se deja anotado como trampa de implementación conocida. |
| **U3** | Underspecification | LOW | docs/API_CONTRACT.md §open | El contrato dice "409 ... con `success:false` en el detalle", mientras la regla general del propio contrato es `{"detail": "..."}`. La forma exacta del cuerpo de ese 409 queda ambigua. | **ABIERTO** — no bloquea; se resuelve al implementar T036, pero conviene fijarlo en el contrato. Ver Acciones pendientes. |
| **I5** | Inconsistency | LOW | `.specify/` | No existe `.specify/feature.json` ni rama `001-la-ruleta`, así que `check-prerequisites.sh` falla y los comandos de spec-kit que dependen de él no funcionan sobre este repositorio. | **ACEPTADO** — decisión deliberada: se trabaja sobre `main` sin crear ramas, y los artefactos se crearon a mano en las rutas exactas que el script habría generado. Se documenta aquí para que no se lea como error. |

**Sin hallazgos** en: duplicación de requisitos funcionales, contradicciones de
stack (un único stack coherente en todos los artefactos), ordenación de tareas
(ninguna tarea de integración precede a su fundacional sin nota de dependencia),
ni placeholders sin resolver (`TODO`, `???`, `[NEEDS CLARIFICATION]`).

---

## Consistencia con `DECISIONES.md`

| Decisión | Reflejada en | Estado |
|---|---|---|
| D-01 color por paridad, 0 rojo | FR-018, spec §A1 + edge cases 0 y asimetría 19/18, constitución §IV, T018, T060 | ✅ Consistente |
| D-02 multiplicadores como pago bruto | FR-019, FR-020, FR-021, FR-024, spec §A2, plan §Pagos, T018 | ✅ Consistente |
| D-03 cierre terminal | FR-016, FR-033, spec §A4, plan §Transiciones atómicas, T019, T033, T035 | ✅ Consistente |
| D-04 sin validación de saldo | FR-013, spec §A3, constitución §Restricciones, T030 | ✅ Consistente |
| D-05 límites de la apuesta | FR-007..FR-010, edge case de decimales, T016, T031 | ✅ Consistente |
| D-06 repositorio único público | Estructura de `plan.md` (backend/ y frontend/ en un repo), T055 | ✅ Consistente |
| D-07 Python 3.14 + FastAPI, dominio separado | Constitución §II, plan §Technical Context, T058 | ✅ Consistente |
| D-08 MongoDB tras interfaz, podman local, Dokploy compartido | Constitución §Restricciones (enmienda v1.1.0), plan §Storage, T005b, T011b–T011e, T056b | ✅ Consistente **tras la enmienda** |
| D-09 React + Vite, nginx, dominio único | FR-030, plan §nginx y §CORS, T053 | ✅ Consistente **tras la corrección de dominio** |
| D-10 GitHub Actions + GHCR + API de Dokploy | Constitución §V, plan §CI/CD, T055 | ✅ Consistente **tras G3** |
| D-11 desarrollo con spec-kit | Existencia y estructura de estos artefactos | ✅ Consistente (con la salvedad I5) |

**Contradicciones detectadas entre `DECISIONES.md` y lo escrito previamente**:
solo dos, ambas causadas por que los artefactos se redactaron antes de esa
decisión —C1/I1/I2 (memoria vs. MongoDB) e I3 (dominio de despliegue)— y ambas
corregidas. **No hay ninguna contradicción interna en `DECISIONES.md`** ni
ninguna decisión suya que este spec, plan o constitución rechacen. El archivo no
se modificó.

---

## Coverage Summary

Todos los requisitos funcionales tienen al menos una tarea asociada.

| Rango | Requisitos | Con tarea | Tareas de ejemplo |
|---|---|---|---|
| FR-001..FR-005 (crear, abrir) | 5 | 5 | T021, T025, T026, T027, T034 |
| FR-006..FR-014 (apuestas) | 9 | 9 | T016, T017, T022, T028, T031, T032 |
| FR-015..FR-024 (cierre y pagos) | 10 | 10 | T010, T018, T023, T029, T035 |
| FR-025..FR-027 (consulta y salud) | 3 | 3 | T015, T039, T040, T042, T043 |
| FR-028..FR-030 (frontend) | 3 | 3 | T044, T045, T046, T050 |
| FR-031 (errores) | 1 | 1 | T013, T036 |
| FR-032..FR-033 (durabilidad, sorteo único) | 2 | 2 | T011b, T011d, T035, T060b |

| Criterio | Tarea | Nota |
|---|---|---|
| SC-001, SC-002 | T059 | Verificación explícita de trazabilidad FR ↔ test |
| SC-003 | T050 | Añadido en este análisis (G4) |
| SC-004 | T005b, T054 | Compose con podman incluyendo MongoDB |
| SC-005 | T060 | Con el reparto 19/18 explicitado (G2) |
| SC-006 | T024 | `total_bets == len(results)` |
| SC-007 | T060b | Durabilidad entre clientes distintos |
| SC-008 | T011b, T035 | 50 cierres concurrentes, un único ganador |
| SC-009 | T011b, T020, T055 | Suite ejecutable sin base de datos |

**Tareas sin requisito mapeado**: 5 — T001, T002, T003, T004, T005. Todas son
andamiaje de la Fase 1 (crear proyectos, esqueletos de paquetes y de tests,
linters). No prestan comportamiento y por tanto no mapean a un FR; no se
consideran alcance no acordado.

---

## Constitution Alignment

Evaluado contra **v1.1.0**. Sin violaciones abiertas.

| Principio | Veredicto | Evidencia |
|---|---|---|
| I. Contrato como fuente de verdad | ✅ | El cambio de almacén no altera la superficie HTTP; `docs/API_CONTRACT.md` no necesita enmienda por MongoDB. T061 la verifica. |
| II. Dominio puro | ✅ | `domain/` sin FastAPI ni driver; `Decimal128` confinado a `infrastructure/mapping.py`; T058 lo verifica con un test. |
| III. Test por regla | ✅ | Batería de repositorio compartida por ambas implementaciones (T011b), skip limpio sin `MONGODB_TEST_URI`, y CI con Mongo real para que no se salte nada allí. |
| IV. El enunciado manda, la desviación se documenta | ✅ | Argumentación centralizada en `DECISIONES.md`; spec, plan, constitución y README citan por identificador (D1 corregido). |
| V. Despliegue reproducible, CI verde | ✅ | Compose con podman incluyendo MongoDB, GHCR, despliegue por API de Dokploy condicionado a CI verde, dominio y certificado en T056b. |

**Riesgo vigilado, no violación**: dos implementaciones del `Protocol` pueden
divergir, y la de memoria puede ocultar un fallo de atomicidad que solo se
manifiesta contra Mongo. Mitigado por la batería compartida (T011b) y por
ejecutar el job de Mongo real en CI. Registrado también en `plan.md`.

---

## Metrics

- Requisitos funcionales: **33** (FR-001..FR-033; +2 en este análisis)
- Criterios de éxito: **9** (SC-001..SC-009; +3 en este análisis)
- Decisiones normativas: **11** (D-01..D-11), todas reflejadas
- Tareas: **69** (+8 en este análisis)
- Cobertura de requisitos (≥1 tarea): **100 %** (33/33)
- Cobertura de criterios de éxito: **100 %** (9/9)
- Tareas sin requisito: 5 (andamiaje de Fase 1, justificadas)
- Hallazgos: **15** — 2 CRITICAL, 2 HIGH, 7 MEDIUM, 4 LOW
- Corregidos en este pase: **11**; abiertos: **2** (U1, U3); aceptados sin
  cambio: **2** (U2, I5)
- Ambigüedades sin resolver: **0** `[NEEDS CLARIFICATION]` en el spec
- Duplicaciones: 1 detectada (D1), eliminada

---

## Acciones pendientes

Ninguna es bloqueante para empezar a implementar. Las dos abiertas afectan a
`docs/API_CONTRACT.md`, que está fuera del alcance de este trabajo y cuya edición
requiere acuerdo explícito (Principio I):

1. **U1 — respuesta de `/health` con el almacén caído.** El contrato solo
   documenta el `200 {"status":"ok"}`. Propuesta a acordar: `503` con
   `{"detail": "..."}` y un campo que distinga servicio vivo de almacén
   alcanzable. Hasta que se acuerde, FR-027 y T015 fijan el comportamiento pero
   el contrato no lo respalda.
2. **U3 — forma del cuerpo del `409` al abrir.** El contrato menciona
   `success:false` "en el detalle" mientras su regla general es
   `{"detail": "..."}`. Conviene fijar una sola forma antes de implementar T036.

Recomendación: resolver U1 y U3 con quien mantiene el contrato y luego proceder
con la implementación siguiendo `tasks.md` desde la Fase 1. No hay hallazgos
CRITICAL abiertos.
