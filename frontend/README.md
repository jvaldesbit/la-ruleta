# La Ruleta — frontend

Interfaz de una sola pantalla para el MVP de La Ruleta: crear ruletas, abrirlas,
apostar a número o color y cerrarlas para ver el sorteo y los resultados.

React 19 + Vite + TypeScript estricto, sin librerías de UI: estilos propios en
`src/styles/app.css`.

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
proxy de Vite. Define `VITE_API_BASE_URL` solo si el backend vive en otro origen.
Ver `.env.example`.

## Regla de color del enunciado

El color de un número se decide por su paridad: **par = rojo, impar = negro**.
Por tanto el **0 es rojo**. Esto se aparta de la ruleta real (donde el 0 es verde
y los colores no siguen la paridad) y se implementa así porque lo pide el
enunciado. La interfaz lo advierte en una nota visible.

Pagos brutos: acierto a número ×5, acierto a color ×1,8. Monto máximo por
apuesta 10.000.

## Identidad de usuario

No hay autenticación: se escribe un identificador que se guarda en
`localStorage` y viaja en la cabecera `X-User-Id` de cada apuesta. Sin
identificador el formulario de apuesta queda bloqueado.

## Estructura

```
src/
  api/        cliente HTTP, tipos del contrato y traducción de errores
  lib/        reglas del enunciado, validación, formateo, hook de identidad
  components/ piezas de interfaz (lista, formulario, tablas, ruleta)
  styles/     hoja de estilos única
```

El contrato de la API es `docs/API_CONTRACT.md` en la raíz del repositorio; los
tipos de `src/api/types.ts` lo reflejan uno a uno.
