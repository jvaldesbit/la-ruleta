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

| Variable          | Por defecto   | Descripción                                              |
| ----------------- | ------------- | -------------------------------------------------------- |
| `APP_ENV`         | `development` | Entorno de ejecución.                                     |
| `APP_VERSION`     | `0.1.0`       | Versión que devuelve `/health`.                           |
| `HTTP_PORT`       | `8000`        | Puerto de escucha al arrancar con `python -m ruleta.main`.|
| `ALLOWED_ORIGINS` | `*`           | Orígenes CORS separados por comas.                        |
| `MONGODB_URI`     | *(vacío)*     | Si está definida se usa MongoDB; si no, memoria.          |
| `MONGODB_DB`      | `ruleta`      | Base de datos de MongoDB.                                 |

No hay secretos. Sin `MONGODB_URI` la app arranca igual con el almacén en memoria
y lo avisa por log (los datos se pierden al reiniciar el proceso).

## Persistencia

- **Memoria** (por defecto): `InMemoryRouletteRepository`, un lock de asyncio
  serializa las transiciones. Es lo que usan los tests y el desarrollo sin base de datos.
- **MongoDB**: `MongoRouletteRepository` con `motor`. Una sola colección
  `roulettes` guarda el documento completo con las **apuestas embebidas** (siempre
  se leen y liquidan junto a su ruleta) y `_id` es el uuid de la ruleta. Los montos
  se guardan como `Decimal128`, nunca como float. Los índices por `status` y
  `created_at` se crean en el arranque (lifespan). Abrir, apostar y cerrar usan
  actualizaciones condicionadas al estado esperado, así que son atómicas ante
  peticiones concurrentes.
- `GET /api/v1/health` informa del backend en uso: 200 con
  `{"status":"ok","version":"...","storage":"memory|mongo"}`. Con Mongo hace un
  ping y, si no responde, devuelve **503** con `status: "degraded"`: lo consultan
  el healthcheck del contenedor y el proxy, y una API que no alcanza su base de
  datos no debe seguir recibiendo tráfico. Con almacén en memoria no hay 503
  posible, porque no hay nada externo que pueda caerse.

> Deuda técnica conocida: `motor` está deprecado en favor del driver asíncrono
> incluido en `pymongo`. La migración se limita a `repositories/mongo.py`; el
> resto del código no toca el driver.

### MongoDB en local con podman

```bash
podman run -d --name ruleta-mongo -p 27017:27017 docker.io/library/mongo:8
export MONGODB_URI="mongodb://localhost:27017"
export MONGODB_DB="ruleta"
uv run uvicorn ruleta.main:app --reload --port 8000
```

> En kernels 6.19 o superiores, `mongo:8` (8.0.x) se niega a arrancar por una
> incompatibilidad conocida (SERVER-121912); usa `docker.io/library/mongo:8.2`.

## Calidad

```bash
uv run ruff check . && uv run ruff format --check .
uv run pytest -q
```

Los tests de MongoDB están marcados con `mongo` y se **saltan** si no hay
`MONGODB_TEST_URI` (es lo que ocurre hoy en CI, que solo ejecuta los de memoria):

```bash
podman run -d --name ruleta-mongo -p 27017:27017 docker.io/library/mongo:8
MONGODB_TEST_URI="mongodb://localhost:27017" uv run pytest -q          # toda la suite
MONGODB_TEST_URI="mongodb://localhost:27017" uv run pytest -q -m mongo # solo los de Mongo
```

Cada test de Mongo trabaja sobre una base efímera propia y la borra al terminar.

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
  domain/        entidades y reglas puras (sin FastAPI, pydantic ni driver)
  repositories/  puerto RouletteRepository + adaptadores memoria y mongo
  api/           routers, esquemas, dependencias y manejo de errores
  service.py     casos de uso
  storage.py     elige el repositorio según MONGODB_URI
  config.py      configuración por entorno
  main.py        app, lifespan (índices) y montaje en /api/v1
```
