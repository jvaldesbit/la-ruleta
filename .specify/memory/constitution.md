<!--
SYNC IMPACT REPORT — enmienda vigente
Cambio de versión: 1.0.0 → 1.1.0
Fecha: 2026-09-02
Motivo del bump: MINOR. Se amplía materialmente la guía de persistencia y de
entorno de despliegue, y se añade DECISIONES.md como registro normativo de
decisiones citables. Ningún principio se elimina ni se redefine de forma
incompatible: el Principio II mantiene intacta su regla (el dominio no conoce el
almacén); lo que cambia es cuál es la implementación concreta detrás del Protocol.

Motivo de la enmienda: la persistencia del MVP deja de ser exclusivamente en
memoria y pasa a ser MongoDB (decisión D-08 de DECISIONES.md). La versión 1.0.0
afirmaba "sin ORM ni base de datos en el MVP: repositorio en memoria detrás de un
Protocol", lo cual ya no es cierto.

Principios modificados:
- II. Dominio puro, separado del transporte — sin cambio normativo. Solo se
  actualizan los ejemplos de implementación concreta: "(memoria, Redis, Postgres)"
  → "(memoria para tests, MongoDB en despliegue)".
- I, III, IV, V — sin cambios.

Secciones modificadas:
- Restricciones técnicas — reescrita la entrada de almacenamiento: MongoDB 8 con
  driver asíncrono `motor`, dos implementaciones del Protocol (memoria y Mongo),
  importes como Decimal128, ruleta y apuestas en un único documento, transiciones
  con actualización condicionada al estado esperado, Mongo local con podman,
  instancia compartida de MongoDB en Dokploy para el despliegue.
- Restricciones técnicas — añadida entrada de despliegue con el dominio
  ruleta.jcvb.com.co.
- Governance — DECISIONES.md incorporado a la jerarquía documental y al
  procedimiento de enmienda.

Secciones añadidas: ninguna nueva de primer nivel.
Secciones eliminadas: ninguna.

TODOs diferidos: ninguno.

Archivos dependientes revisados en esta enmienda:
- ✅ specs/001-la-ruleta/plan.md — Technical Context, Constitution Check,
  estructura de código y decisiones técnicas actualizados a MongoDB; dominio de
  despliegue corregido a ruleta.jcvb.com.co.
- ✅ specs/001-la-ruleta/spec.md — supuestos de persistencia e instancia única
  reescritos; sección de ambigüedades ahora cita D-01..D-05.
- ✅ specs/001-la-ruleta/tasks.md — añadidas tareas de repositorio MongoDB,
  índices al arrancar y tests condicionados a MONGODB_TEST_URI.
- ✅ specs/001-la-ruleta/contracts/openapi-notes.md — sin impacto (no menciona
  almacenamiento).
- ✅ docs/API_CONTRACT.md — sin impacto: el almacén no es superficie de API.
- ✅ DECISIONES.md — leído, no modificado (es del usuario). Se cita, no se duplica.

--- Historial ---
1.0.0 (2026-09-02): ratificación inicial. Cinco principios de gobierno definidos
a partir del scaffold del template ([PRINCIPLE_1..5_NAME], [SECTION_2_NAME],
[SECTION_3_NAME] resueltos).
-->

# La Ruleta Constitution

Constitución del proyecto "La Ruleta", MVP funcional de una ruleta de apuestas
online (backend FastAPI + frontend React), desarrollado a partir de un enunciado
de prueba técnica cerrado.

## Core Principles

### I. El contrato de API es la fuente de verdad

`docs/API_CONTRACT.md` es el único acuerdo vinculante entre backend y frontend.
Define rutas, códigos de estado, forma de los cuerpos JSON y reglas de negocio
derivadas del enunciado.

Reglas no negociables:

- Ningún lado (back o front) MUST implementar un cambio de contrato que no esté
  ya escrito en `docs/API_CONTRACT.md`. El orden es: se acuerda, se escribe en el
  contrato, se implementa en ambos lados.
- El frontend MUST consumir el backend por el base path `/api/v1` y por rutas
  relativas; no puede depender de un host absoluto en producción.
- Los errores MUST viajar siempre como `{"detail": "..."}` con el código HTTP que
  el contrato indica para ese caso.
- Un spec, un plan o un test que contradiga al contrato es un defecto: se corrige
  el artefacto o se enmienda el contrato de forma explícita, nunca se ignora.

Razón: es un proyecto con dos superficies desarrolladas en paralelo. Sin un
documento normativo compartido, la integración se descubre tarde y a mano.

### II. Dominio puro, separado del transporte

La lógica de negocio (color de un número, resolución de una apuesta, cálculo de
pagos, transiciones de estado de la ruleta) MUST vivir en una capa de dominio sin
importar FastAPI, sin `Request`/`Response`, sin acceso directo a almacenamiento.

Reglas no negociables:

- Las funciones de dominio MUST ser invocables desde un test unitario sin levantar
  un servidor HTTP ni un cliente de test.
- La persistencia MUST estar detrás de una interfaz (`Protocol`) definida por el
  dominio. El dominio no conoce la implementación concreta (memoria para tests,
  MongoDB en despliegue); cambiar el almacén no puede obligar a tocar el cálculo
  de pagos. Ver D-08 en `DECISIONES.md`.
- Ninguna clase de dominio MUST importar `motor`, `pymongo`, `bson` ni tipo
  alguno del driver. `Decimal128` es un detalle de la capa de infraestructura: la
  conversión a `Decimal` y de vuelta ocurre en el repositorio, nunca en el dominio.
- Los routers MUST limitarse a: validar entrada, invocar dominio/servicio, mapear
  el resultado a código HTTP y esquema de respuesta. Sin reglas de negocio.
- Los importes de dinero MUST usar `Decimal`, nunca `float`, en dominio y en
  serialización.

Razón: las reglas del enunciado son el núcleo de valor de esta entrega y deben
poder verificarse y evolucionar sin arrastrar el andamiaje HTTP.

### III. Toda regla de negocio tiene un test (NO NEGOCIABLE)

Cada regla de negocio enunciada en `docs/API_CONTRACT.md` MUST tener al menos un
test automatizado que falle si la regla se rompe.

Cobertura mínima obligatoria, sin excepciones:

- Color por paridad, incluyendo el caso `0` (par → rojo).
- Pago bruto `5x` en acierto a número y `1.8x` en acierto a color; `0` en fallo.
- Rango de número `0..36` rechazado fuera de rango.
- Rango de monto `0 < amount <= 10000` rechazado fuera de rango.
- Header `X-User-Id` ausente o vacío rechazado.
- Máquina de estados `created → open → closed`, con `closed` terminal
  (cerrar dos veces, abrir una cerrada, apostar en una no abierta).
- Atomicidad del cierre: dos cierres simultáneos sobre la misma ruleta producen
  un único sorteo; el segundo recibe conflicto.

Además, la batería de tests de repositorio MUST ejecutarse contra las dos
implementaciones del `Protocol`. Los tests que requieren un MongoDB real MUST
saltarse limpiamente cuando no hay `MONGODB_TEST_URI` en el entorno, de modo que
la suite completa siga siendo ejecutable sin base de datos.

Reglas de proceso:

- Una regla nueva o modificada MUST llegar acompañada de su test en el mismo
  cambio. Un cambio de comportamiento sin test es un cambio rechazable.
- Los tests de dominio MUST ser deterministas: el sorteo se inyecta o se fija en
  el test, nunca se depende del azar real para afirmar un resultado.

Razón: el enunciado es la especificación del cliente; la suite de tests es la
prueba de que se cumple, endpoint a endpoint y regla a regla.

### IV. El enunciado manda; la desviación se documenta

Cuando el enunciado de la prueba técnica contradice el comportamiento de una
ruleta real, se implementa lo que dice el enunciado.

Reglas no negociables:

- Caso vigente: "los números pares son rojos y los impares negros" (**D-01**).
  Esto hace que el `0` sea **rojo**, lo cual no ocurre en una ruleta real (donde
  es verde y los colores no siguen la paridad), y reparte los 37 números en 19
  rojos y 18 negros. Se implementa literal.
- Toda desviación de este tipo MUST quedar registrada en `DECISIONES.md` con un
  identificador estable (D-NN), y citarse por ese identificador desde el contrato
  (`docs/API_CONTRACT.md`), la especificación funcional y el `README.md`. El
  argumento se escribe **una sola vez**, en `DECISIONES.md`; el resto lo referencia.
- Una desviación MUST explicar qué dice el enunciado, qué haría el mundo real y
  por qué se eligió el enunciado. No basta con dejar el comportamiento raro sin
  nota.

Razón: la entrega se evalúa contra el enunciado, pero un revisor debe poder ver
que la rareza fue una decisión consciente y no un error de implementación.

### V. Despliegue reproducible y CI verde antes de desplegar

El proyecto MUST poder levantarse desde cero con un solo comando de contenedores,
y ningún artefacto llega a Dokploy sin que la CI haya pasado.

Reglas no negociables:

- Backend y frontend MUST ser imágenes de contenedor separadas, construidas desde
  Dockerfiles versionados en el repo.
- Un único `compose up` (con **podman**, que es el motor de referencia en local)
  MUST levantar el sistema completo y funcional —backend, frontend y MongoDB—
  sin pasos manuales fuera del repo más allá de variables de entorno documentadas.
- nginx MUST servir el build estático del frontend y hacer de proxy de `/api`
  hacia el backend, de modo que front y back compartan origen.
- El workflow de GitHub Actions MUST ejecutar lint y la suite de tests, y el
  despliegue a Dokploy MUST estar condicionado a que esos pasos terminen en verde.
- La configuración por entorno MUST llegar por variables de entorno, nunca por
  valores incrustados en la imagen.

Razón: un MVP que solo funciona en la máquina de quien lo escribió no es una
entrega; la reproducibilidad es parte del producto.

## Restricciones técnicas

- **Backend**: Python 3.14, FastAPI, pydantic v2, pytest. Sin ORM: el acceso a
  datos se escribe a mano contra el driver, detrás del `Protocol` de repositorio.
- **Frontend**: React + Vite + TypeScript. TypeScript en modo estricto; los tipos
  de la API se derivan del contrato.
- **Almacenamiento**: MongoDB 8, con el driver asíncrono `motor`. El `Protocol` de
  repositorio MUST tener exactamente dos implementaciones:
  - **en memoria**, que usan los tests y el arranque sin base de datos;
  - **MongoDB**, que es la que corre en el despliegue.
  Ambas MUST satisfacer la misma batería de tests de repositorio. Si una pasa y la
  otra no, el `Protocol` está mal definido o una implementación está incompleta.
- **Modelo de documento**: la ruleta y sus apuestas MUST guardarse en un único
  documento. Siempre se leen y se liquidan juntas, nunca por separado, así que no
  hay motivo para repartirlas en dos colecciones y sí lo hay para no tener que
  coordinar dos escrituras al cerrar.
- **Importes en Mongo**: todo importe monetario MUST persistirse como `Decimal128`,
  nunca como `double`. La conversión `Decimal` ↔ `Decimal128` ocurre solo en el
  repositorio MongoDB.
- **Transiciones de estado atómicas**: abrir y cerrar una ruleta MUST hacerse con
  una única actualización condicionada al estado esperado (del tipo "pasa a
  `closed` **solo si** ahora mismo estás `open`"). Si la actualización no encuentra
  documento, la transición se rechaza con conflicto. Esto MUST garantizar que dos
  peticiones de cierre simultáneas no puedan sortear dos números para la misma
  ruleta. Leer, decidir en Python y escribir después es una condición de carrera y
  está prohibido para las transiciones.
- **Aleatoriedad**: el número ganador se sortea con `secrets` (0..36), no con
  `random`, y el punto de sorteo MUST ser sustituible en tests.
- **Dinero**: `Decimal` con 2 decimales de extremo a extremo, con `ROUND_HALF_UP`.
  Prohibido `float` para importes en dominio, API y almacenamiento. Ver D-02.
- **MongoDB local**: se levanta con **podman**, no con Docker. El arranque local
  sin base de datos MUST seguir siendo posible usando la implementación en memoria.
- **MongoDB en despliegue**: se usa la instancia de MongoDB **ya existente en
  Dokploy**, compartida con otros servicios. Por tanto el proyecto MUST usar su
  propia base de datos dentro de esa instancia y MUST NOT asumir uso exclusivo del
  servidor ni ejecutar operaciones de alcance global sobre él.
- **Dominio de despliegue**: `ruleta.jcvb.com.co`. Frontend y API comparten origen
  bajo ese dominio; nginx sirve el frontend y proxya `/api` al backend por la red
  interna. Un solo dominio, un solo certificado, sin CORS en producción (D-09).
- **Autenticación**: fuera de alcance. `X-User-Id` se acepta como identidad ya
  autenticada y no se valida saldo, tal como asume el enunciado (D-04).

## Flujo de trabajo y puertas de calidad

1. **Especificación antes que código**: una funcionalidad entra por
   `specs/<###-nombre>/spec.md` con requisitos numerados (FR-XXX) antes de
   implementarse.
2. **Plan antes que tareas**: `plan.md` MUST superar el Constitution Check contra
   los cinco principios de arriba; cualquier violación se justifica en la tabla de
   Complexity Tracking o se elimina.
3. **Trazabilidad**: cada tarea de `tasks.md` MUST mapear a uno o más FR del spec.
   Un FR sin tarea es trabajo perdido; una tarea sin FR es alcance no acordado.
4. **Puerta de test**: la suite MUST estar verde antes de fusionar. Un test roto
   bloquea el merge; no se marca como `skip` para desbloquear.
5. **Puerta de contrato**: si un cambio toca la superficie HTTP, la revisión MUST
   verificar que `docs/API_CONTRACT.md` ya lo refleja.
6. **Puerta de despliegue**: solo se despliega desde un commit cuya CI está en
   verde.

## Governance

Esta constitución prevalece sobre cualquier otra práctica, preferencia personal o
costumbre del equipo. Ante un conflicto entre esta constitución y otro documento
del repo, gana la constitución, con dos delegaciones expresas:

- `docs/API_CONTRACT.md` es el detalle normativo de la **forma concreta de la
  API** (rutas, códigos, cuerpos), delegado por el Principio I.
- `DECISIONES.md` es el registro normativo de las **decisiones sobre el
  enunciado y sobre la construcción**, con identificadores estables D-NN,
  delegado por el Principio IV. Es la única fuente donde se argumenta cada
  decisión; el resto de artefactos la citan por identificador y no repiten el
  razonamiento.

Jerarquía documental, de más general a más concreto: constitución → `DECISIONES.md`
→ `docs/API_CONTRACT.md` → `specs/001-la-ruleta/`. Una capa no puede contradecir a
las de arriba.

**Procedimiento de enmienda**:

1. Se propone el cambio por escrito, indicando principio afectado y motivo.
2. Se actualiza este archivo junto con el Sync Impact Report de la cabecera.
3. Se revisan y actualizan los artefactos dependientes (`plan.md` y su
   Constitution Check, `spec.md`, `tasks.md`, `docs/API_CONTRACT.md`,
   `DECISIONES.md`, `README.md`), y se listan en el Sync Impact Report.
4. La enmienda entra en vigor al fusionarse, no antes.

**Política de versionado** (semántico sobre la constitución, independiente de la
versión de la aplicación):

- **MAJOR**: se elimina o se redefine un principio de forma incompatible con lo
  ya construido.
- **MINOR**: se añade un principio o una sección, o se amplía materialmente una
  guía existente.
- **PATCH**: aclaraciones de redacción, correcciones tipográficas, refinamientos
  sin cambio de semántica.

**Revisión de cumplimiento**: toda revisión de código verifica explícitamente los
Principios I (contrato), II (dominio puro), III (test por regla) y IV (desviación
documentada). El Principio V se verifica en cada cambio que toque Dockerfiles,
`docker-compose*.yml` o los workflows de GitHub Actions. La complejidad añadida
MUST justificarse; a igualdad de resultado, gana la opción más simple.

**Version**: 1.1.0 | **Ratified**: 2026-09-02 | **Last Amended**: 2026-09-02
