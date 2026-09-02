# `deploy/` — despliegue en Dokploy

Este directorio contiene lo único que hay que llevar al servidor:
[`docker-compose.dokploy.yml`](docker-compose.dokploy.yml).

La aplicación corre en <https://cloud.kiware.co> y se sirve en
**<https://ruleta.jcvb.com.co>**. La guía completa —cómo está montado el
recurso, cómo recrearlo por API y la resolución de problemas— está en
[`../docs/DEPLOY.md`](../docs/DEPLOY.md). Aquí queda la versión corta.

## Qué es este compose y en qué se diferencia del de la raíz

| | `docker-compose.yml` (raíz) | `deploy/docker-compose.dokploy.yml` |
| --- | --- | --- |
| Origen de las imágenes | `build:` desde el código local | `image:` desde GHCR |
| Para qué | desarrollo en tu máquina (podman o Docker) | producción en Dokploy |
| MongoDB | servicio `mongo` propio (`mongo:8.2`), con volumen local | la instancia compartida que **ya existe** en Dokploy |
| Puertos publicados | `8000`, `8080` y `27017` | ninguno; entra Traefik |
| Quién lo arranca | tú, con `podman compose up` | Dokploy, tras el push a `main` |

## Estado actual

Está **desplegado y respondiendo**: `/api/v1/health` devuelve `storage: mongo`.
El recurso se creó **por API**, no a mano desde la interfaz:

- Proyecto `la-ruleta`, recurso de tipo **Compose** con provider **Raw**, cuyo
  contenido es una copia literal de `docker-compose.dokploy.yml`.
- Imágenes en GHCR: `ghcr.io/jvaldesbit/la-ruleta-api:latest` y `…-web:latest`,
  con `pull_policy: always` en ambos servicios. Salieron **públicas solas**,
  heredando la visibilidad del repositorio, así que no hubo que registrar
  credenciales del registro en Dokploy.
- Dominio `ruleta.jcvb.com.co` apuntando al servicio **`web`**, puerto `80`,
  HTTPS con Let's Encrypt. Un único dominio: nginx pasa `/api/` al backend. El
  registro `A` está en Cloudflare **sin proxy** (nube gris): con el proxy
  activado el desafío HTTP-01 no llega a Traefik y el certificado no se emite.
- Variables de entorno del recurso:

  ```
  MONGODB_URI=mongodb://<usuario>:<password>@mongo-shared-vqyoql:27017/ruleta?authSource=admin
  MONGODB_DB=ruleta
  APP_ENV=production
  LOG_LEVEL=info
  ```

- Secretos ya puestos en GitHub (`DOKPLOY_URL`, `DOKPLOY_AUTH_TOKEN`,
  `DOKPLOY_COMPOSE_ID`), así que cada push a `main` dispara
  `POST /api/compose.deploy` y el job de deploy ya no se salta.

Recrearlo por API, con los `curl` exactos: `../docs/DEPLOY.md`, sección 2.

## Las cuatro decisiones que no son obvias

- **`pull_policy: always`.** Sin esto Dokploy vuelve a levantar la imagen que
  ya tiene cacheada bajo el tag `latest` y el despliegue no cambia nada, aunque
  salga en verde. Es el fallo número uno con tags móviles.
- **Aquí no hay servicio `mongo`.** La base de datos es la instancia compartida
  que ya corre en el Dokploy del usuario, con su propio volumen y su propio
  ciclo de vida. Declarar otra aquí crearía una segunda base vacía y confusa.
  La conexión llega como `${MONGODB_URI}`, interpolada desde el `.env` que
  genera Dokploy, apuntando al contenedor `mongo-shared-vqyoql` por nombre (no
  por IP, que cambia en cada redespliegue), para que la credencial no viva en
  el repositorio.
- **`api` sin `ports`.** Solo `web` habla con la API, por la red interna de
  Compose (`http://api:8000`, ver `frontend/nginx.conf`). Publicar el 8000 en
  el host la dejaría accesible sin TLS y sin pasar por el proxy.
- **`web` y `api` en `dokploy-network`.** Traefik y el MongoDB compartido viven
  en esa red externa; si los contenedores no están en ella, el dominio responde
  502 y la API no encuentra la base de datos.
