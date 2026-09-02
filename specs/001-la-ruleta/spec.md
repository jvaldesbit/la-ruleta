# Feature Specification: La Ruleta — MVP de ruleta de apuestas online

**Feature Branch**: `001-la-ruleta`

**Created**: 2026-09-02

**Status**: Draft

**Input**: Enunciado de prueba técnica. API de ruleta con cuatro operaciones:
crear ruleta, abrir ruleta, apostar a número (0..36) o color (rojo/negro) por un
máximo de 10.000 USD con el id de usuario en headers, y cerrar apuestas
devolviendo el resultado. Número ganador elegido por la aplicación al cerrar.
Acierto a número paga 5x, acierto a color paga 1.8x, el resto pierde. Para el
color: pares rojos, impares negros.

**Contrato vigente**: `docs/API_CONTRACT.md` (fuente de verdad de rutas, códigos
y forma de los cuerpos JSON). Esta especificación describe el *qué*; el contrato
fija el *cómo* concreto de la superficie HTTP. No pueden contradecirse.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ciclo completo de una ronda de ruleta (Priority: P1)

Un operador crea una ruleta, la abre para recibir apuestas, uno o varios usuarios
apuestan a números y colores, y el operador cierra la ruleta. Al cerrar, el
sistema sortea el número ganador, resuelve todas las apuestas recibidas desde la
apertura y devuelve el detalle de cada una con lo que gana o pierde.

**Why this priority**: Es el enunciado completo. Sin este ciclo no hay producto;
con él solo, el MVP ya es demostrable y evaluable de punta a punta.

**Independent Test**: Se prueba ejecutando la secuencia crear → abrir → apostar
(número y color) → cerrar, y comprobando que la respuesta de cierre contiene el
número ganador, su color, y un resultado por cada apuesta con el pago correcto.

**Acceptance Scenarios**:

1. **Given** no existe ninguna ruleta, **When** se crea una ruleta, **Then** el
   sistema devuelve un identificador único y el estado `created`.
2. **Given** una ruleta en estado `created`, **When** se abre, **Then** el sistema
   confirma la operación como exitosa y la ruleta queda en estado `open`.
3. **Given** una ruleta en estado `open`, **When** un usuario identificado apuesta
   100 al número 17, **Then** la apuesta queda registrada y asociada a esa ruleta
   y a ese usuario.
4. **Given** una ruleta `open` con una apuesta de 100 al número 17 y otra de 100
   al color rojo, **When** se cierra la ruleta y el número sorteado es 17,
   **Then** la apuesta al número recibe un pago bruto de 500, la apuesta a rojo
   recibe 0 porque 17 es impar (negro), y la ruleta queda en estado `closed`.
5. **Given** una ruleta `open` con una apuesta de 200 al color rojo, **When** se
   cierra y el número sorteado es 12 (par → rojo), **Then** esa apuesta recibe un
   pago bruto de 360.
6. **Given** una ruleta `open` sin ninguna apuesta, **When** se cierra, **Then**
   la operación tiene éxito, se devuelve el número ganador y una lista de
   resultados vacía con totales en cero.

---

### User Story 2 - Rechazo de operaciones inválidas (Priority: P2)

El sistema protege la integridad de la ronda: rechaza apuestas sobre ruletas que
no existen o que no están abiertas, apuestas con número fuera de rango, color no
soportado, monto fuera del rango permitido o sin identificación de usuario, y
transiciones de estado imposibles como reabrir o recerrar una ruleta cerrada.

**Why this priority**: El enunciado exige explícitamente confirmar si la operación
fue exitosa o denegada. Sin estas validaciones el ciclo feliz es frágil y la
evaluación de la prueba técnica queda incompleta.

**Independent Test**: Se prueba enviando cada operación inválida de forma aislada
y comprobando que el sistema la rechaza con el código de error del contrato y sin
alterar el estado de la ruleta.

**Acceptance Scenarios**:

1. **Given** una ruleta en estado `created`, **When** un usuario intenta apostar,
   **Then** la apuesta se rechaza por conflicto de estado y no queda registrada.
2. **Given** una ruleta en estado `open`, **When** se intenta apostar sin
   identificación de usuario, **Then** la apuesta se rechaza.
3. **Given** una ruleta en estado `open`, **When** se apuesta al número 37 o a
   -1, **Then** la apuesta se rechaza por número fuera del rango 0..36.
4. **Given** una ruleta en estado `open`, **When** se apuesta 10.000,01 o 0,
   **Then** la apuesta se rechaza por monto fuera de rango.
5. **Given** una ruleta en estado `closed`, **When** se intenta abrirla o cerrarla
   de nuevo, **Then** la operación se rechaza y el estado no cambia.
6. **Given** un identificador de ruleta inexistente, **When** se intenta abrir,
   apostar o cerrar, **Then** el sistema responde que no existe.

---

### User Story 3 - Consulta del estado de las ruletas (Priority: P3)

Un operador consulta la lista de ruletas con su estado, y el detalle de una
ruleta concreta con sus apuestas y, si ya está cerrada, sus resultados.

**Why this priority**: No lo exige el enunciado, pero sin consulta el frontend no
puede mostrar nada entre operaciones ni permitir retomar una ruleta abierta. Es
soporte de la interfaz, no lógica de negocio nueva.

**Independent Test**: Se prueba creando dos ruletas, cerrando una, y comprobando
que el listado refleja ambos estados y que el detalle de la cerrada incluye el
número ganador y los resultados.

**Acceptance Scenarios**:

1. **Given** dos ruletas, una `open` y otra `closed`, **When** se consulta el
   listado, **Then** aparecen ambas con su estado y su número de apuestas.
2. **Given** una ruleta `closed`, **When** se consulta su detalle, **Then**
   incluye el número y color ganador y el resultado de cada apuesta.

---

### User Story 4 - Interfaz web para jugar la ronda (Priority: P3)

Un usuario abre la aplicación web, se le asigna o recupera un identificador local,
crea o selecciona una ruleta, la abre, coloca apuestas a número o color y la
cierra, viendo el resultado en pantalla.

**Why this priority**: Hace la entrega demostrable sin herramientas de línea de
comandos. Depende por completo de las historias anteriores; no aporta reglas.

**Independent Test**: Se prueba con el sistema desplegado, completando una ronda
entera desde el navegador y comprobando que la pantalla de resultado coincide con
lo que devuelve el cierre.

**Acceptance Scenarios**:

1. **Given** un usuario que entra por primera vez, **When** carga la aplicación,
   **Then** se le asigna un identificador persistente en su navegador que se envía
   en todas sus apuestas.
2. **Given** una ruleta abierta en pantalla, **When** el usuario apuesta un monto
   fuera del rango permitido, **Then** la interfaz lo impide o muestra el error
   devuelto sin romper la sesión.

---

### Edge Cases

- **Número 0**: es par, por tanto **rojo** según el enunciado. Una apuesta a rojo
  gana si sale el 0; una apuesta a negro pierde. Divergencia consciente respecto
  de la ruleta real (ver Ambigüedades, A1).
- **Ruleta cerrada sin apuestas**: se sortea igualmente el número ganador y se
  devuelven listas y totales vacíos/en cero.
- **Cierre concurrente**: dos peticiones de cierre simultáneas sobre la misma
  ruleta; solo una puede resolver y sortear, la otra debe recibir conflicto.
- **Apuesta en el instante del cierre**: una apuesta que llega después de que la
  ruleta pasó a `closed` se rechaza; no participa en el sorteo.
- **Doble acierto del mismo usuario**: un usuario con apuesta a número y a color
  que aciertan ambas cobra los dos pagos, calculados de forma independiente.
- **Monto con más de dos decimales**: se rechaza o se normaliza a dos decimales
  de forma determinista; nunca se acumula error de coma flotante.
- **`X-User-Id` presente pero vacío o solo espacios**: se trata como ausente.
- **Reinicio del servicio**: el almacenamiento del MVP es en memoria, por lo que
  las ruletas y apuestas se pierden. Es una limitación aceptada y documentada.

## Requirements *(mandatory)*

### Functional Requirements

**Creación de ruleta (endpoint 1 del enunciado)**

- **FR-001**: El sistema MUST permitir crear una ruleta nueva sin necesidad de
  datos de entrada, y MUST devolver el identificador único de la ruleta creada.
- **FR-002**: Toda ruleta recién creada MUST quedar en estado `created`, sin
  aceptar apuestas todavía, y MUST registrar su instante de creación.

**Apertura de ruleta (endpoint 2 del enunciado)**

- **FR-003**: El sistema MUST permitir abrir una ruleta identificada por su id,
  pasándola de `created` a `open`, y MUST devolver una confirmación explícita de
  si la operación fue exitosa o denegada.
- **FR-004**: El sistema MUST denegar la apertura de una ruleta que ya está `open`
  o `closed`, sin alterar su estado.
- **FR-005**: El sistema MUST denegar cualquier operación sobre un identificador
  de ruleta que no existe, indicándolo como recurso no encontrado.

**Apuestas (endpoint 3 del enunciado)**

- **FR-006**: El sistema MUST aceptar apuestas únicamente sobre ruletas en estado
  `open`, y MUST rechazar por conflicto de estado las apuestas sobre ruletas
  `created` o `closed`.
- **FR-007**: El sistema MUST soportar dos tipos de apuesta y solo dos: a un
  número concreto, o a un color.
- **FR-008**: El sistema MUST aceptar como número apostado únicamente enteros en
  el rango 0..36 inclusive, y MUST rechazar cualquier valor fuera de ese rango o
  no entero.
- **FR-009**: El sistema MUST aceptar como color apostado únicamente `red` o
  `black`, y MUST rechazar cualquier otro valor.
- **FR-010**: El sistema MUST aceptar montos de apuesta en el rango
  `0 < amount <= 10000` USD, y MUST rechazar montos nulos, negativos, cero o
  superiores a 10.000.
- **FR-011**: El sistema MUST exigir el identificador de usuario en el header
  `X-User-Id` como cadena no vacía, y MUST rechazar la apuesta si falta o está
  vacío.
- **FR-012**: El sistema MUST registrar cada apuesta aceptada asociada a su
  ruleta, su usuario, su tipo, su selección (número o color) y su monto, con
  identificador propio e instante de creación, y MUST devolver ese registro.
- **FR-013**: El sistema MUST NOT validar el crédito o saldo del usuario; se
  asume autenticado y con fondos suficientes, tal como establece el enunciado.
- **FR-014**: El sistema MUST permitir múltiples apuestas del mismo usuario y de
  usuarios distintos sobre la misma ruleta abierta, sin límite de cantidad.

**Cierre y resolución (endpoint 4 del enunciado)**

- **FR-015**: El sistema MUST permitir cerrar una ruleta en estado `open`,
  pasándola a `closed`, y MUST rechazar el cierre de una ruleta `created` o
  `closed`.
- **FR-016**: El estado `closed` MUST ser terminal: una ruleta cerrada no puede
  reabrirse, no puede volver a cerrarse y no puede recibir apuestas nuevas.
- **FR-017**: Al cerrar, el sistema MUST elegir automáticamente el número ganador
  de forma aleatoria y uniforme entre 0 y 36 inclusive, sin intervención del
  cliente, usando una fuente de aleatoriedad criptográficamente segura.
- **FR-018**: El sistema MUST determinar el color ganador a partir del número
  sorteado aplicando la regla del enunciado: número **par → `red`**, número
  **impar → `black`**. El 0, por ser par, es `red`.
- **FR-019**: El sistema MUST resolver toda apuesta a número como ganadora si y
  solo si el número apostado coincide con el número sorteado, y MUST pagar en ese
  caso un importe **bruto** igual a `monto * 5`.
- **FR-020**: El sistema MUST resolver toda apuesta a color como ganadora si y
  solo si el color apostado coincide con el color del número sorteado, y MUST
  pagar en ese caso un importe **bruto** igual a `monto * 1.8`.
- **FR-021**: El sistema MUST asignar pago `0` a toda apuesta no ganadora; el
  usuario pierde el monto apostado.
- **FR-022**: El sistema MUST resolver, al cerrar, todas y solo las apuestas
  recibidas entre la apertura y el cierre de esa ruleta.
- **FR-023**: La respuesta de cierre MUST incluir el número ganador, el color
  ganador, el estado resultante, el instante de cierre, el número total de
  apuestas, el total apostado, el total pagado y el detalle por apuesta con su
  condición de ganadora y su pago.
- **FR-024**: Los importes monetarios MUST tratarse con precisión decimal exacta
  de dos decimales en cálculo y en respuesta, sin aritmética de coma flotante.

**Consulta (soporte del frontend)**

- **FR-025**: El sistema MUST permitir listar las ruletas existentes con su
  estado, instantes relevantes, número ganador si lo hay y cantidad de apuestas.
- **FR-026**: El sistema MUST permitir consultar el detalle de una ruleta
  concreta, incluyendo sus apuestas y, si está cerrada, sus resultados.
- **FR-027**: El sistema MUST exponer un endpoint de salud que confirme que el
  servicio responde.

**Frontend**

- **FR-028**: El frontend MUST generar o recuperar un identificador de usuario
  persistente en el navegador y enviarlo en el header `X-User-Id` en cada apuesta.
- **FR-029**: El frontend MUST permitir completar el ciclo crear → abrir →
  apostar → cerrar y mostrar el resultado del cierre.
- **FR-030**: El frontend MUST comunicarse con el backend por rutas relativas
  bajo `/api/v1`, sirviéndose desde el mismo origen que la API en producción.

**Errores y contrato**

- **FR-031**: Todas las respuestas de error MUST usar la forma
  `{"detail": "..."}` y los códigos de estado definidos en `docs/API_CONTRACT.md`:
  400 para falta de `X-User-Id`, 404 para ruleta inexistente, 409 para conflicto
  de estado, 422 para validación de número, color o monto.

### Key Entities

- **Ruleta**: una ronda de juego. Atributos: identificador único, estado
  (`created` | `open` | `closed`), instante de creación, instante de apertura,
  instante de cierre, número ganador y color ganador (solo una vez cerrada).
  Contiene cero o más apuestas.
- **Apuesta**: intención de un usuario de arriesgar un monto sobre una selección.
  Atributos: identificador único, ruleta a la que pertenece, identificador de
  usuario, tipo (`number` | `color`), número seleccionado o color seleccionado
  (exactamente uno de los dos), monto, instante de creación.
- **Resultado de apuesta**: la resolución de una apuesta tras el cierre.
  Atributos: la apuesta resuelta, si ganó, y el pago bruto asignado.
- **Resultado de ronda**: el desenlace del cierre de una ruleta. Atributos:
  número ganador, color ganador, instante de cierre, totales agregados
  (apuestas, monto apostado, monto pagado) y la lista de resultados de apuesta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los cuatro endpoints del enunciado (crear, abrir, apostar, cerrar)
  están implementados y cada uno tiene al menos un test que cubre su camino feliz
  y al menos uno que cubre su rechazo principal.
- **SC-002**: El 100% de las reglas de negocio listadas en `docs/API_CONTRACT.md`
  (paridad de color incluido el 0, pagos 5x y 1.8x, rango 0..36, tope 10.000,
  header obligatorio, máquina de estados) está cubierto por tests automatizados
  que fallan si la regla se rompe.
- **SC-003**: Un usuario puede completar una ronda entera desde el navegador
  (crear, abrir, apostar, cerrar y ver resultado) sin errores y sin recargar la
  página manualmente.
- **SC-004**: El sistema completo se levanta desde un repositorio limpio con un
  único comando de contenedores y responde correctamente al endpoint de salud.
- **SC-005**: Sobre 10.000 cierres simulados, la distribución de números ganadores
  cubre los 37 valores posibles sin ningún valor imposible y sin sesgo evidente
  hacia un extremo del rango.
- **SC-006**: Ninguna apuesta aceptada queda sin resolver tras el cierre de su
  ruleta: `total_bets` coincide con la longitud de `results` en toda respuesta de
  cierre.

## Ambigüedades del enunciado y cómo se resolvieron

El enunciado de la prueba técnica deja cuatro puntos abiertos. Todos se han
cerrado con una decisión explícita, ya reflejada en `docs/API_CONTRACT.md`.

### A1 — "Par = rojo, impar = negro" contradice la ruleta real

**Ambigüedad**: el enunciado dice literalmente que los números pares son rojos y
los impares negros. En una ruleta europea real los colores no siguen la paridad
(el 2 es negro, el 3 es rojo) y el 0 no es rojo ni negro, sino verde.

**Decisión**: se implementa **literal el enunciado**. `numero % 2 == 0 → red`,
`numero % 2 == 1 → black`. Como consecuencia directa, **el 0 es rojo** y una
apuesta a `red` gana cuando sale el 0.

**Motivo**: la entrega se evalúa contra el enunciado, no contra el reglamento del
casino. Reproducir la ruleta real exigiría inventar una tabla de colores y una
regla para el verde que el enunciado no menciona, y haría que el resultado no
coincidiera con lo que el evaluador espera al leer su propio texto.

**Rastro**: documentado en `docs/API_CONTRACT.md`, en esta sección y en el
`README.md`, con un test específico para el caso `0 → red`.

### A2 — "Paga 5 veces" / "paga 1.8 veces": ¿bruto o ganancia neta?

**Ambigüedad**: "una apuesta acertada a número paga 5 veces lo apostado" puede
leerse como devolver `monto * 5` en total (bruto) o como devolver el monto más
`monto * 5` de ganancia (neto sobre la apuesta devuelta).

**Decisión**: se interpreta como **pago bruto**. El campo `payout` es el importe
total que recibe el usuario: `monto * 5` para número y `monto * 1.8` para color.
Una apuesta ganadora de 100 a un número devuelve 500 en total, no 600.

**Motivo**: es la lectura literal de "paga N veces lo apostado" y es la
convención habitual al expresar cuotas en formato decimal. La lectura neta
haría que el multiplicador 1.8 del color produjera un retorno de 2.8x, que se
aleja de cualquier cuota razonable para una apuesta de color.

**Consecuencia visible**: el campo se llama `payout` y no `profit`, y
`total_amount_paid` es la suma de pagos brutos, no de ganancias.

### A3 — Validación de saldo del usuario

**Ambigüedad**: el enunciado dice "se asume que el usuario ya está autenticado y
que tiene crédito suficiente", pero no aclara si el sistema debe llevar cuenta.

**Decisión**: **no se valida saldo ni se lleva contabilidad de crédito**. No
existe entidad usuario con balance. `X-User-Id` se acepta como identidad ya
verificada por un sistema externo, con la única validación de que sea una cadena
no vacía.

**Motivo**: el enunciado lo declara como supuesto dado. Añadir una cartera
implicaría inventar reglas de recarga, bloqueo de fondos y pago de premios que no
están en el alcance de la prueba.

**Consecuencia visible**: no hay endpoints de usuario ni de saldo, y ninguna
apuesta se rechaza por fondos insuficientes.

### A4 — ¿Puede reabrirse una ruleta cerrada?

**Ambigüedad**: el enunciado describe apertura y cierre, pero no dice si una
ruleta cerrada puede volver a abrirse para una segunda ronda.

**Decisión**: **no**. `closed` es un estado terminal. La máquina de estados es
estrictamente `created → open → closed`, sin transiciones de vuelta. Para jugar
otra ronda se crea una ruleta nueva.

**Motivo**: el endpoint de cierre "devuelve el resultado de las apuestas hechas
desde su apertura hasta el cierre", lo que ata cada ruleta a exactamente una
ronda y un único número ganador. Permitir la reapertura obligaría a modelar
rondas dentro de una ruleta, con un histórico de resultados que el enunciado no
pide, y dejaría ambiguo qué devuelve un segundo cierre.

**Consecuencia visible**: abrir o cerrar una ruleta `closed` devuelve conflicto,
y el campo `winning_number` de una ruleta se escribe una sola vez.

**Decisiones pendientes**: ninguna. No queda ningún `[NEEDS CLARIFICATION]` en
esta especificación.

## Assumptions

- El usuario llega ya autenticado por un sistema externo; `X-User-Id` es una
  identidad de confianza y no se verifica contra ningún directorio.
- No hay control de acceso ni roles: cualquier cliente puede crear, abrir y
  cerrar ruletas. Distinguir operador de apostador queda fuera del MVP.
- La persistencia es en memoria del proceso; reiniciar el servicio borra ruletas
  y apuestas. Se acepta para el MVP y se sustituye después implementando la misma
  interfaz de repositorio.
- El servicio se despliega como una única instancia; no hay estado compartido
  entre réplicas. Escalar horizontalmente requiere primero un almacén externo.
- Los importes están en dólares estadounidenses. No hay conversión de divisa ni
  redondeo dependiente de configuración regional.
- El frontend y el backend se sirven desde el mismo origen en producción, con
  nginx haciendo de proxy de `/api`; por eso el frontend usa rutas relativas.
- No hay auditoría, límites de tasa ni prevención de fraude en el MVP.
