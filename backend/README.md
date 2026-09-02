# La Ruleta — backend

API REST de La Ruleta: FastAPI sobre Python 3.14, gestionada con [uv](https://docs.astral.sh/uv/).

## Requisitos

- Python 3.14 (uv lo descarga solo si no está en el sistema)
- uv >= 0.12

## Puesta en marcha

```bash
uv sync --extra dev
uv run uvicorn ruleta.main:app --reload --port 8000
```

- API: <http://localhost:8000/api/v1>
- Documentación interactiva: <http://localhost:8000/api/v1/docs>
- Salud: <http://localhost:8000/api/v1/health>

## Variables de entorno

| Variable          | Por defecto     | Descripción                                     |
| ----------------- | --------------- | ----------------------------------------------- |
| `APP_ENV`         | `development`   | Entorno de ejecución.                            |
| `APP_VERSION`     | `0.1.0`         | Versión que devuelve `/health`.                  |
| `HTTP_PORT`       | `8000`          | Puerto de escucha al arrancar con `python -m`.   |
| `ALLOWED_ORIGINS` | `*`             | Orígenes CORS separados por comas.               |

No hay secretos ni base de datos: el estado vive en memoria mientras corre el proceso.

## Calidad

```bash
uv run ruff check . && uv run ruff format --check .
uv run pytest -q
```

## Reglas de negocio

- Números 0..36; colores `red` y `black`.
- **Color del número: par = rojo, impar = negro**, literal según el enunciado. Por
  tanto el 0 (par) cuenta como **rojo**, a diferencia de la ruleta real donde es verde.
- Monto: `0 < amount <= 10000`, con 2 decimales como máximo (`Decimal`, ROUND_HALF_UP).
- Pago bruto: 5x al acertar un número, 1.8x al acertar un color, 0 si falla.
- El usuario llega en la cabecera `X-User-Id`; se asume autenticado y con saldo.
- Estados: `created` → `open` → `closed` (terminal). El número se sortea al cerrar
  con `secrets`, a través de un spinner inyectable (los tests lo fijan).

## Estructura

```
src/ruleta/
  domain/        entidades y reglas puras (sin FastAPI ni pydantic)
  repositories/  puerto RouletteRepository + implementación en memoria
  api/           routers, esquemas, dependencias y manejo de errores
  service.py     casos de uso
  config.py      configuración por entorno
  main.py        creación de la app y montaje en /api/v1
```
