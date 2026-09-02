# Decisiones

Este documento recoge las decisiones tomadas sobre el enunciado y sobre la
construcción del producto, con el porqué de cada una. El enunciado de la prueba
es corto y deja varias cosas abiertas; aquí queda por escrito cómo se cerraron,
para que nadie tenga que adivinar leyendo el código.

Cada decisión tiene un identificador estable (D-01, D-02...). El README, la
especificación en `specs/001-la-ruleta/` y los comentarios del código pueden
citarlas por ese identificador.

---

## Reglas del juego

### D-01 · El color se calcula por paridad: par es rojo, impar es negro

**Qué dice el enunciado.** "Para seleccionar el color ganador se debe tener en
cuenta que los números pares son rojos y los impares son negros."

**El conflicto.** En una ruleta real los colores no siguen la paridad. El 1 es
rojo, el 2 es negro, y el reparto está fijado por el diseño físico de la rueda,
no por una fórmula. Además, en la ruleta europea el 0 es verde y no pertenece a
ningún color, precisamente para que la banca gane cuando sale.

**La decisión.** Se implementa literal lo que dice el enunciado. La función que
determina el color es `rojo si n % 2 == 0, negro si no`, para todo el rango
0..36. No se introduce el verde ni la tabla real de la rueda.

**La consecuencia que hay que tener presente.** El 0 es par, así que **el 0 es
rojo** y paga a quien apostó a rojo. Eso reparte los 37 números en 19 rojos
(los pares, contando el 0) y 18 negros, de modo que el rojo es ligeramente más
probable que el negro. En una ruleta real esa asimetría no existe.

**Por qué se elige lo literal.** Esto es una prueba técnica y el enunciado es la
especificación. Corregirlo hacia la ruleta real sería sustituir el requisito por
una opinión, y el resultado dejaría de ser verificable contra lo que se pidió.
La desviación respecto a la realidad se documenta aquí y en el README, que es lo
que corresponde: implementar lo pedido y dejar constancia de que se sabe que la
regla no es la del juego real.

---

### D-02 · Los multiplicadores 5x y 1.8x son pago bruto, no ganancia neta

**Qué dice el enunciado.** "Para las apuestas de tipo numérico se debe entregar
5 veces el dinero apostado si atinan al número ganador, para las apuestas de
color se debe entregar 1.8 veces el dinero apostado, todos los demás perderán el
dinero apostado."

**El conflicto.** "Entregar 5 veces el dinero apostado" admite dos lecturas:

| | Apuesta 100 a un número y acierta | Balance del jugador |
|---|---|---|
| Lectura A, pago bruto | recibe 500 | +400 |
| Lectura B, premio neto | recibe sus 100 más 500 de premio, 600 | +500 |

**La decisión.** Se usa la lectura A. `payout = amount * 5` para el número y
`payout = amount * 1.8` para el color. El campo `payout` de la respuesta es
**lo que se le entrega al jugador**, no su ganancia. Quien pierde tiene
`payout = 0`.

**Por qué la lectura A.** Tres razones, y la tercera es la que decide.

1. Es lo que dice la frase. "Entregar 5 veces el dinero apostado" es entregar
   500 cuando se apostaron 100. La lectura B añade una devolución del principal
   que el enunciado no menciona en ningún sitio.
2. La frase siguiente, "todos los demás perderán el dinero apostado", trata el
   dinero apostado como algo que ya salió del bolsillo del jugador al apostar.
   El que gana recibe un pago; el que pierde no recibe nada. No hay un paso de
   devolución separado.
3. **El 1.8 del color solo tiene sentido bajo la lectura A.** Una apuesta a
   color acierta aproximadamente la mitad de las veces. Bajo la lectura A el
   jugador recibe 1.8 por cada 1 apostado en la mitad de los casos, así que
   espera recuperar unos 0.9 por cada 1: la banca gana en torno al 10%. Bajo la
   lectura B recibiría 2.8 por cada 1 en la mitad de los casos, o sea 1.4 de
   media: la banca perdería dinero en cada tirada y el negocio sería
   imposible. Que el enunciado eligiera un número por debajo de 2 es
   exactamente lo que hace un casino, y solo funciona si 1.8 es el pago
   completo.

**Nota sobre los números elegidos.** No se parecen a los de una ruleta real. Un
pleno real paga 35 a 1, es decir devuelve 36 veces lo apostado; aquí devuelve 5.
Un color real paga 1 a 1, devuelve 2; aquí devuelve 1.8. Son cifras inventadas
para el ejercicio y se respetan tal cual.

**Precisión.** El dinero se maneja con `Decimal` en todo el recorrido, nunca con
coma flotante, y en MongoDB se guarda como `Decimal128`. El 1.8 aplicado a un
monto con centavos se redondea a 2 decimales con redondeo al alza en el empate
(`ROUND_HALF_UP`). Con coma flotante, `0.1 + 0.2` no es `0.3`, y un sistema que
mueve dinero no se puede permitir ese error.

---

### D-03 · Cerrar es terminal

**Confirmado.** Una ruleta recorre `created -> open -> closed` y `closed` es un
estado final. En concreto:

- Cerrar una ruleta ya cerrada devuelve 409, no vuelve a sortear.
- No se puede reabrir. No existe un endpoint para ello.
- Apostar en una ruleta cerrada devuelve 409.
- El sorteo ocurre una sola vez, en el cierre, y el número ganador queda
  guardado. Consultar la ruleta después devuelve siempre el mismo número.

**Por qué.** El enunciado dice que el cierre "debe devolver el resultado de las
apuestas hechas desde su apertura hasta el cierre". Ese resultado es un hecho
consumado: si la ruleta se pudiera reabrir y volver a cerrar, el mismo periodo
tendría dos números ganadores y las apuestas ya liquidadas quedarían en un
estado indefinido. Un sorteo que se puede repetir no es un sorteo.

---

### D-04 · No se valida el saldo del usuario

El enunciado dice explícitamente que "se debe asumir que el usuario ya tiene una
autenticación y una validación de que el cliente tiene el crédito necesario".
Así que no hay cuentas, ni saldos, ni descuentos. El identificador de usuario
llega en la cabecera `X-User-Id`, se exige que venga y no esté vacío, y se
confía en él.

Esto es correcto para el ejercicio y sería inaceptable en producción: cualquiera
podría apostar como cualquiera cambiando una cabecera. La frontera donde
entraría la autenticación real es la dependencia que hoy lee ese header.

---

### D-05 · Límites de la apuesta

- Números válidos: enteros de 0 a 36, ambos incluidos. Fuera de rango, 422.
- Colores válidos: `red` y `black`. Cualquier otro valor, 422.
- Monto: mayor que 0 y menor o igual que 10.000, con dos decimales como máximo.
  El enunciado fija el techo pero no el suelo; se exige mayor que 0 porque una
  apuesta de 0 no es una apuesta, y aceptarla obligaría a decidir qué significa
  ganar 5 veces nada.
- Una apuesta es a número **o** a color, nunca a las dos cosas. El cuerpo de la
  petición es una unión discriminada por el campo `type`, y enviar los dos
  campos a la vez es un error de validación, no un caso a interpretar.

---

## Decisiones de construcción

### D-06 · Repositorio público único, con backend y frontend juntos

`github.com/jvaldesbit/la-ruleta`, público. Un solo repositorio en vez de dos
porque el producto es pequeño, el contrato de API se comparte y así un único
pipeline construye y despliega las dos piezas de forma coherente.

### D-07 · Backend en Python 3.14 con FastAPI, dominio separado del transporte

Las reglas del juego (color por paridad, resolución de apuestas, cálculo de
pagos) viven en una capa de dominio sin FastAPI ni base de datos, y se prueban
sin levantar un servidor. El azar entra como una dependencia inyectable, así que
los tests fijan el número ganador y comprueban las liquidaciones de forma
determinista en vez de repetir tiradas y cruzar los dedos.

### D-08 · MongoDB como almacén, detrás de una interfaz

El acceso a datos está detrás de un `Protocol`. Hay dos implementaciones: una en
memoria, que usan los tests y el arranque sin base de datos, y una sobre MongoDB
con el driver asíncrono `motor`, que es la que corre en el despliegue. La ruleta
y sus apuestas se guardan en un único documento, porque siempre se leen y se
liquidan juntas y nunca por separado.

Las transiciones de estado se hacen con una actualización condicionada al estado
esperado, de forma que dos peticiones simultáneas para cerrar la misma ruleta no
puedan sortear dos veces.

En local Mongo se levanta con **podman**. En el despliegue se usa la instancia de
MongoDB que ya existe en Dokploy.

### D-09 · Frontend en React con Vite, servido por nginx bajo el mismo dominio

Una sola pantalla que recorre el flujo completo: crear, abrir, apostar, cerrar y
ver resultados. Se sirve en `ruleta.jcvb.com.co` y nginx pasa `/api` al backend
por la red interna. Un solo dominio significa un solo certificado y ningún
problema de CORS en producción.

### D-10 · GitHub Actions y GHCR, con despliegue por API a Dokploy

El repositorio es público, así que los runners de GitHub y el registro de
imágenes de GitHub salen gratis y la imagen queda pública. El pipeline prueba,
construye las dos imágenes y llama a la API de Dokploy para desplegar. El
despliegue se dispara con una llamada HTTP directa, sin acciones de terceros,
que es una dependencia menos que auditar en un repositorio público.

Este es el mismo patrón que usaba `olympus-ms-back` antes de migrar a Woodpecker.
Aquella migración se hizo porque el repositorio es privado y la imagen debía ir a
un registro propio; aquí no aplica ninguna de las dos razones.

### D-11 · El desarrollo sigue GitHub spec-kit

La especificación, el plan y las tareas viven en `specs/001-la-ruleta/` y la
constitución del proyecto en `.specify/memory/constitution.md`. El contrato de
API en `docs/API_CONTRACT.md` es la fuente de verdad compartida entre backend y
frontend, y se acordó antes de escribir código en cualquiera de los dos lados.
