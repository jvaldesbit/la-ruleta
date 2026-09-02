## Qué cambia

<!-- Una o dos frases: qué hace este PR y por qué. -->

## Contexto

<!-- Enlace a la spec o a la tarea: specs/001-la-ruleta/… -->

Relacionado con:

## Cómo se ha probado

<!-- Comandos concretos, no "lo he probado". -->

- [ ] `cd backend && uv run pytest -q`
- [ ] `cd backend && uv run ruff check . && uv run ruff format --check .`
- [ ] `cd frontend && pnpm run lint && pnpm run build`
- [ ] Probado a mano con `docker compose up --build` en http://localhost:8080

## Checklist

- [ ] El cambio respeta `docs/API_CONTRACT.md` (o el contrato se actualiza en este mismo PR)
- [ ] La regla de color del enunciado (par = rojo, impar = negro, 0 = rojo) sigue intacta
- [ ] No se añaden secretos ni credenciales al repo
- [ ] La documentación afectada (`README.md`, `docs/DEPLOY.md`) está al día

## Notas para quien revise

<!-- Decisiones discutibles, deuda asumida a propósito, qué mirar primero. -->
