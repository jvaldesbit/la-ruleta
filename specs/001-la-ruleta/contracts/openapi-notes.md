# Contratos de la feature 001-la-ruleta

## Contrato vigente

El contrato de API de este proyecto **no vive en esta carpeta**. Vive en:

→ [`docs/API_CONTRACT.md`](../../../docs/API_CONTRACT.md)

Ese documento es la fuente de verdad compartida entre backend y frontend, tal
como establece el Principio I de `.specify/memory/constitution.md`. Define:

- El base path `/api/v1` y el formato de error `{"detail": "..."}`.
- Las reglas de negocio derivadas del enunciado (rango 0..36, tope de 10.000,
  paridad de color con el 0 en rojo, pagos brutos 5x y 1.8x, `X-User-Id`
  obligatorio, máquina de estados `created → open → closed`).
- Los seis endpoints de negocio más el de salud, con sus códigos de estado y la
  forma exacta de cada cuerpo JSON.

Cualquier cambio de superficie HTTP se acuerda y se escribe allí **antes** de
implementarse en cualquiera de los dos lados.

## Por qué no hay un `openapi.yaml` en este repositorio

No se mantiene un OpenAPI escrito a mano. FastAPI genera el esquema OpenAPI 3.1
automáticamente a partir de los esquemas pydantic v2 y las firmas de los routers,
y lo expone en tiempo de ejecución:

- **Swagger UI**: `/docs`
- **ReDoc**: `/redoc`
- **Esquema JSON crudo**: `/openapi.json`

Duplicar esa especificación a mano garantizaría que las dos copias divergieran.
El reparto de responsabilidades es:

| Artefacto | Rol | Quién lo mantiene |
|---|---|---|
| `docs/API_CONTRACT.md` | Acuerdo normativo entre front y back, en prosa | Se edita a mano, por acuerdo |
| `/openapi.json` (FastAPI) | Descripción mecánica de lo implementado | Se genera solo desde el código |
| `backend/tests/contract/` | Prueba de que el código cumple el acuerdo | Se escribe junto al código |

Si el OpenAPI generado y `docs/API_CONTRACT.md` no coinciden, es un defecto: se
corrige la implementación, o se enmienda el contrato de forma explícita. Nunca se
deja pasar.

## Verificación

Los tests de `backend/tests/contract/` afirman, endpoint a endpoint, los códigos
de estado y la forma de los cuerpos que fija `docs/API_CONTRACT.md`. Son el
mecanismo que impide que el código y el contrato se separen en silencio.
