# La Ruleta — frontend

Una sola pantalla: la mesa vista desde arriba. Eliges mesa, apilas fichas, las
pones sobre un número o un color, giras la rueda y lees el marcador de pagos.

React 19 + Vite + TypeScript estricto. Sin librerías de interfaz: la rueda es un
SVG propio y todo el estilo son tres hojas de CSS escritas a mano.

## Requisitos

Node 22 y pnpm 10.

## Uso

```bash
pnpm install
pnpm run dev      # http://localhost:5173, proxy de /api hacia http://localhost:8000
pnpm run lint
pnpm test
pnpm run build    # genera dist/
pnpm run preview
```

## Configuración

El cliente habla con la API por la ruta relativa `/api/v1`: en producción nginx
sirve el estático y hace de proxy hacia el backend, y en desarrollo lo hace el
proxy de Vite. Define `VITE_API_BASE_URL` solo si el backend vive en otro
origen. Ver `.env.example`.

## Regla de color del enunciado

El color de un número se decide por su paridad: **par = rojo, impar = negro**.
Por tanto el **0 es rojo**, a diferencia de la ruleta real, donde es verde y los
colores no siguen la paridad. Se implementa así porque lo pide el enunciado.

En la rueda las casillas van en orden natural 0..36, de modo que los colores
quedan alternos y la regla se ve sin leerla; el empalme 36-0 deja dos rojas
juntas, que es justo donde el enunciado se aparta de la ruleta real. La
interfaz lo explica en el icono de información del pie.

Pagos brutos: acierto a número ×5, acierto a color ×1,8. Tope por apuesta
10.000, con fichas de 5, 25, 100, 500 y 1000 más entrada manual del importe
exacto.

## Identidad de usuario

No hay autenticación: se escribe un nombre que se guarda en `localStorage` y
viaja en la cabecera `X-User-Id` de cada apuesta. Sin nombre, la barra de
apuesta queda bloqueada y lo dice.

## Estructura

```
src/
  api/        cliente HTTP, tipos del contrato y traducción de errores
  lib/        reglas del enunciado, fichas, geometría de la rueda, validación
  components/ marquesina, rueda, tapete, riel de fichas, marcador
  styles/     base (tapete y marquesina), table (rueda, tapete, fichas), board
```

`docs/API_CONTRACT.md`, en la raíz del repositorio, es la fuente de verdad del
backend; los tipos de `src/api/types.ts` lo reflejan uno a uno.

## Decisiones visuales

La pantalla es la mesa vista desde arriba bajo el foco, no un panel de tarjetas
con una ruleta dentro: se apuesta poniendo fichas sobre el tapete. De ahí salen
el resto de decisiones. Tapete verde con viñeta y luz cálida centrada; latón y
oro para filetes, cifras y la barra de apostar; rojo y negro laca en las
casillas; hueso para el dato. Bodoni Moda de rótulo contra Archivo de dato, con
cifras tabulares para que las columnas de dinero cuadren.

La rueda es un SVG propio con sus 37 casillas en orden natural 0..36: con la
regla de paridad los colores quedan alternos y la regla se ve sin leerla, y el
empalme 36-0 deja dos rojas juntas, que es justo donde el enunciado se aparta de
la ruleta real. Las fichas son gradientes cónicos con máscara, no imágenes. No
hay librerías de interfaz ni iconos de terceros: los iconos son SVG dibujados a
un solo grosor de trazo.

El texto explicativo se redujo a lo mínimo: la regla de paridad vive tras el
icono de información del pie, y el botón de apostar dice siempre lo que hace,
con el motivo por el que no se puede en una línea aparte.

## Accesibilidad y movimiento

Todos los controles son elementos nativos enfocables con foco visible, las
casillas del tapete son botones con `aria-pressed` y la rueda expone el
resultado como texto. Con `prefers-reduced-motion` se desactivan el giro, el
rebote de las fichas, el contador y el destello: la rueda se coloca
directamente sobre el número ganador. El sonido es cosa aparte: se controla con
su propio interruptor, no con `prefers-reduced-motion`.
