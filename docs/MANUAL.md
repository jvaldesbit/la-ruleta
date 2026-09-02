# Manual de uso

Guía para jugar en <https://ruleta.jcvb.com.co>. Está pensada para leerse con la
aplicación abierta al lado: cada paso dice dónde está el control y qué pasa al
usarlo.

Todo ocurre en una sola pantalla. De arriba abajo: el rótulo con tu nombre de
jugador, la rueda con los controles de la mesa, el tapete donde se apuesta, el
carril de fichas y, cuando la mesa termina, el marcador.

---

## 1. Identificarte

Arriba a la derecha, junto al rótulo, hay un campo con un icono de persona y el
texto `tu nombre`. Escribe ahí como quieras llamarte.

- Ese texto es tu **identificador de jugador**. Viaja con cada apuesta que
  hagas, y es lo que aparece luego en el marcador para distinguir tus apuestas
  de las de otros.
- Se guarda en **este navegador**, así que la próxima vez que entres ya estará
  puesto. No es una cuenta ni lleva contraseña: si entras desde otro navegador o
  borras los datos del sitio, tendrás que escribirlo de nuevo.
- **Sin nombre no se puede apostar.** El botón dorado de apostar queda apagado y
  debajo aparece el aviso `Escribe tu nombre arriba`.

Al lado del campo hay dos indicadores más:

- Un **punto redondo** que informa de la conexión con el servidor: verde cuando
  la mesa responde, rojo cuando no hay conexión, y parpadeando en dorado
  mientras lo comprueba. Si está rojo, ninguna acción va a funcionar.
- Un **altavoz** para encender o apagar el sonido de la mesa. Su estado también
  se guarda en el navegador.

## 2. Abrir la mesa

Bajo la rueda hay una fila de pastillas numeradas (`01`, `02`…) y, debajo, un
botón que cambia según en qué punto esté la mesa seleccionada.

Una mesa recién creada **existe pero todavía no acepta apuestas**. Hay que
abrirla primero. El botón te va llevando por los tres estados:

| El botón dice | Significa | Qué pasa al pulsarlo |
|---|---|---|
| **Abrir mesa** | La mesa está creada pero cerrada al público | Empieza a aceptar apuestas |
| **Girar** | La mesa está abierta y admite apuestas | Se sortea el número y la mesa termina |
| **Mesa nueva** | La mesa ya terminó | Crea otra mesa, lista para abrir |

Si acabas de entrar y no hay ninguna mesa, usa el botón con el **signo más**, a
la derecha de las pastillas, para crear la primera.

## 3. Apostar

Apostar son tres gestos: elegir ficha, elegir dónde, confirmar.

**Elige la ficha.** En el carril bajo el tapete hay cinco fichas: 5, 25, 100,
500 y 1000. Cada vez que pulsas una, su valor se suma al importe de la apuesta
que estás preparando. Puedes pulsar varias veces y mezclar valores. El total se
ve en grande junto al carril, bajo la palabra `APUESTA`.

**Elige dónde.** En el tapete, pulsa el número que quieras (el `0` ocupa la
franja de arriba, del `1` al `36` van en la cuadrícula) o una de las dos
casillas grandes de abajo, **Rojo** o **Negro**. La casilla elegida se marca con
un filete dorado y verás tus fichas apiladas encima.

**Confirma.** El botón dorado de abajo muestra el importe: `Apostar 250,00 US$`.
Al pulsarlo la apuesta se envía y el tapete queda libre en el acto para la
siguiente.

Junto al carril tienes tres ayudas:

- **Quitar**: retira la última ficha que pusiste.
- **Vaciar**: deja el importe a cero sin tocar la casilla elegida.
- **Importe exacto**: despliega un campo para escribir una cantidad concreta,
  por ejemplo `137,50`. Al escribir ahí se descartan las fichas del carril, y al
  volver a pulsar una ficha se descarta lo escrito. Mandan las últimas.

Dos cosas que conviene saber:

- **El tope por apuesta son 10.000.** Si una ficha te pasaría de ahí, al
  pulsarla aparece el aviso `El tope por apuesta son 10.000,00 US$` y no se
  suma.
- **Puedes hacer varias apuestas antes de girar.** Confirma una, prepara otra y
  vuelve a confirmar. Cada apuesta se envía al servidor por separado y todas se
  van acumulando en la tira que aparece bajo el botón dorado, con su casilla, su
  importe y el nombre de quien la hizo.

Si el botón dorado está apagado, la línea que hay justo debajo dice por qué:
`Escribe tu nombre arriba`, `Elige una mesa`, `Abre la mesa`, `Elige número o
color`, `Pon fichas` o `Mesa terminada`.

## 4. Girar

Cuando estén hechas todas las apuestas, pulsa **Girar**.

El servidor sortea el número, la rueda gira unos segundos y frena con la bola
sobre el número ganador, que se queda iluminado en dorado.

**Girar cierra la mesa para siempre.** No se puede reabrir ni volver a girar, y
tampoco se pueden añadir apuestas después. Para jugar otra ronda hay que crear
una mesa nueva, con el botón que aparece justo donde estaba el de girar.

## 5. Leer el resultado

Bajo la rueda aparece una placa con el **número ganador** en grande y su color
debajo.

Más abajo se despliega el marcador, con tres cifras:

- **Apostado**: la suma de todas las apuestas de esa mesa.
- **Pagado**: lo que la casa entrega en total.
- **Neto jugadores**: la diferencia entre lo pagado y lo apostado. En positivo
  ganaron los jugadores, en negativo ganó la casa.

Debajo hay una línea por apuesta: quién la hizo, a qué apostó, cuánto puso, si
ganó o perdió, **cuánto se le paga** y **la diferencia** respecto a lo que puso.
Las ganadoras se ven en verde con el pago en dorado; las perdidas quedan
apagadas.

La columna del pago es **lo que se entrega, no la ganancia**. Por eso una
apuesta ganadora de 500 al color muestra **900 pagados** (500 × 1,8) y **+400 de
diferencia**: de esos 900, quinientos son la devolución de lo que ya habías
puesto.

## 6. Varias mesas a la vez

Las pastillas numeradas bajo la rueda son las mesas. Cada una es **independiente**:
tiene su propio estado y sus propias apuestas.

- Pulsa una pastilla para cambiarte a ella. El tapete, el marcador y el botón de
  acción pasan a referirse a esa mesa.
- El punto de la esquina de cada pastilla indica cómo está: apagado si está
  creada pero cerrada, verde si admite apuestas, rojo si ya terminó.
- El botón del **signo más** crea una mesa nueva y te lleva a ella.

Puedes tener una mesa terminada que quieras seguir consultando y otra abierta
para jugar; cambiar entre ellas no pierde nada.

## 7. Qué esperar cuando algo falla

| Qué haces | Qué ves | Por qué |
|---|---|---|
| Apostar sin haber escrito tu nombre | El botón dorado apagado y debajo `Escribe tu nombre arriba` | Cada apuesta tiene que ir firmada por un jugador; el servidor la rechaza sin nombre |
| Pulsar una ficha que pasaría de 10.000 | El aviso `El tope por apuesta son 10.000,00 US$` y la ficha no se suma | Es el máximo por apuesta. Puedes hacer varias apuestas de hasta 10.000 cada una |
| Apostar en una mesa ya girada | El botón apagado con `Mesa terminada` | Cerrar una mesa es definitivo |
| Apostar en una mesa creada pero sin abrir | El botón apagado con `Abre la mesa` | Una mesa no acepta apuestas hasta abrirla |

Si el servidor rechaza algo por su cuenta, el motivo aparece **tal cual lo
manda**, en rojo bajo el botón dorado si es un problema con la apuesta, o en un
aviso al pie de la pantalla en los demás casos. Nunca vas a ver una ventana
emergente del navegador.

---

## Reglas del juego

Lo que necesitas para decidir dónde poner las fichas:

- **Acertar el número paga 5 veces lo apostado.** Pones 100 al 19 y sale el 19:
  se te entregan 500.
- **Acertar el color paga 1,8 veces lo apostado.** Pones 500 al rojo y sale un
  número rojo: se te entregan 900.
- **El color de un número sale de su paridad**: los **pares son rojos** y los
  **impares son negros**. Como el cero es par, **el cero es rojo**.

Esa última regla se aparta de la ruleta de casino, donde el cero es verde y los
colores no siguen la paridad. Está así a propósito: el porqué está explicado en
[DECISIONES.md](../DECISIONES.md).

### Una partida de ejemplo

Una ronda completa, con los números que verías en pantalla:

1. Creas una mesa y la abres.
2. Apuestas **100 al número 19** y confirmas.
3. Apuestas **500 al rojo** y confirmas. La tira de abajo muestra ya las dos.
4. Pulsas **Girar**. Sale el **26**.

El 26 es par, así que es **rojo**. El resultado:

| Apuesta | Puesto | ¿Gana? | Pagado | Diferencia |
|---|---|---|---|---|
| Número 19 | 100 | No, salió el 26 | 0 | −100 |
| Rojo | 500 | Sí, el 26 es rojo | 900 | +400 |

Y en el marcador: **600 apostado**, **900 pagado**, **+300 neto** para el
jugador.
