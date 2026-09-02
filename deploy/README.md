# `deploy/` — despliegue en Dokploy

Este directorio contiene lo único que hay que llevar al servidor:
[`docker-compose.dokploy.yml`](docker-compose.dokploy.yml).

La guía completa, con capturas mentales de cada pantalla y la resolución de
problemas, está en [`../docs/DEPLOY.md`](../docs/DEPLOY.md). Aquí queda la
versión corta para cuando ya sabes lo que haces.

## Qué es este compose y en qué se diferencia del de la raíz

| | `docker-compose.yml` (raíz) | `deploy/docker-compose.dokploy.yml` |
| --- | --- | --- |
| Origen de las imágenes | `build:` desde el código local | `image:` desde GHCR |
| Para qué | desarrollo en tu máquina | producción en Dokploy |
| Puertos publicados | `8000` (api) y `8080` (web) | ninguno; entra Traefik |
| Quién lo arranca | tú, con `docker compose up` | Dokploy, tras el push a `main` |

## Receta corta

1. **Imágenes publicadas.** Un push a `main` deja en GHCR
   `ghcr.io/jvaldesbit/la-ruleta-api:latest` y `…-web:latest`. Hazlos
   **públicos** desde *GitHub → Packages → Package settings → Change
   visibility*, o registra `ghcr.io` en *Dokploy → Settings → Registry* con un
   PAT que tenga `read:packages`.

2. **Proyecto y recurso.** En <https://cloud.kiware.co>: *Create Project*
   `la-ruleta` → *Create Service* → **Compose** → Source Type **Raw** → pega el
   contenido de `docker-compose.dokploy.yml` → *Save*.

3. **Variables.** Pestaña *Environment*:

   ```
   APP_ENV=production
   LOG_LEVEL=info
   ```

   Dokploy las vuelca en un `.env` junto al compose, y el compose las recoge
   con `env_file: [.env]`. Sin esa línea no llegan a los contenedores.

4. **Dominio.** Pestaña *Domains → Add Domain*: servicio **`web`** (no `api`),
   host `ruleta.kiware.co`, path `/`, puerto `80`, HTTPS activado, certificado
   **Let's Encrypt**. El DNS debe apuntar ya al servidor.

5. **Deploy** y verificación:

   ```bash
   curl -fsS https://ruleta.kiware.co/api/v1/health
   ```

6. **Automatizarlo.** Token en *Settings → Profile → API/CLI*, `composeId` de
   la URL del recurso, y luego:

   ```bash
   gh secret set DOKPLOY_URL        --repo jvaldesbit/la-ruleta --body "https://cloud.kiware.co"
   gh secret set DOKPLOY_AUTH_TOKEN --repo jvaldesbit/la-ruleta --body "<TOKEN_DE_DOKPLOY>"
   gh secret set DOKPLOY_COMPOSE_ID --repo jvaldesbit/la-ruleta --body "<COMPOSE_ID>"
   ```

   A partir de ahí, cada push a `main` que pase los tests reconstruye las
   imágenes y llama a `POST /api/compose.deploy`.

## Las tres decisiones que no son obvias

- **`pull_policy: always`.** Sin esto Dokploy vuelve a levantar la imagen que
  ya tiene cacheada bajo el tag `latest` y el despliegue no cambia nada, aunque
  salga en verde. Es el fallo número uno con tags móviles.
- **`api` sin `ports`.** Solo `web` habla con la API, por la red interna de
  Compose (`http://api:8000`, ver `frontend/nginx.conf`). Publicar el 8000 en
  el host la dejaría accesible sin TLS y sin pasar por el proxy.
- **`web` en `dokploy-network`.** Traefik vive en esa red externa; si el
  contenedor no está en ella, el dominio responde 502.
