# Despliegue de La Ruleta

La aplicación **ya está desplegada** en la instancia de Dokploy de
<https://cloud.kiware.co> y se sirve en **<https://ruleta.jcvb.com.co>**.
`/api/v1/health` responde `200` con `storage: mongo`.

Este documento describe cómo quedó montado y cómo reproducirlo por API; no es
una lista de pasos pendientes.

El pipeline es:

```
  push a main ──► CI (lint + tests) ──► docker build+push ──► GHCR
                                                                │
                                       curl POST compose.deploy │
  GitHub Actions ───────────────────────────────────────────────┤
                                                                ▼
                                       Dokploy hace `docker compose pull && up -d`
                                                                │
                                          Traefik ──► https://ruleta.jcvb.com.co
```

**GitHub Actions construye y publica las imágenes en GHCR y luego llama a la
API de Dokploy para que se las descargue y las levante.** Dokploy no compila
nada.

---

## 1. Cómo está montado hoy

El recurso de Dokploy **ya está creado**, y se creó **por API**, no a mano
desde la interfaz. Este es el estado actual:

| | |
| --- | --- |
| Instancia de Dokploy | `https://cloud.kiware.co` |
| Proyecto | `la-ruleta` |
| Recurso | **Compose**, provider **Raw** (`composeType: docker-compose`), `appName` real `la-ruleta-u457nw` |
| Contenido del compose | copia literal de [`../deploy/docker-compose.dokploy.yml`](../deploy/docker-compose.dokploy.yml) |
| Servicios | `api` (sin puertos publicados) y `web` (expone `80` a Traefik) |
| Imágenes | `ghcr.io/jvaldesbit/la-ruleta-api:latest` y `…-web:latest`, ambas **públicas** en GHCR |
| Dominio | `ruleta.jcvb.com.co` → servicio **`web`**, puerto `80`, HTTPS con Let's Encrypt. Registro `A` en Cloudflare **sin proxy** (nube gris) |
| Base de datos | la instancia de **MongoDB compartida** que ya existe en ese Dokploy (contenedor `mongo-shared-vqyoql`), alcanzada por `dokploy-network`. Este compose **no** levanta Mongo |
| Redes | `ruleta` (interna, resuelve `api` desde nginx) y `dokploy-network` (externa: Traefik y MongoDB) |

Un solo dominio para todo: `web` sirve el SPA y nginx hace de proxy de `/api/`
hacia `api:8000`. La API no tiene subdominio propio.

### Variables de entorno del recurso

Dokploy vuelca estas variables en un fichero `.env` junto al compose. El
compose las recoge de dos formas complementarias: `env_file: [.env]` las mete
en el contenedor, y `${MONGODB_URI}` las usa para interpolar. Sin `env_file`
no llegarían al proceso, porque **Dokploy no las inyecta solo**.

```
MONGODB_URI=mongodb://<usuario>:<password>@mongo-shared-vqyoql:27017/ruleta?authSource=admin
MONGODB_DB=ruleta
APP_ENV=production
LOG_LEVEL=info
```

`mongo-shared-vqyoql` es el **nombre del contenedor** de la instancia de
MongoDB compartida dentro de `dokploy-network`, no una IP: las IPs cambian en
cada redespliegue. `authSource=admin` porque el usuario está creado en la base
`admin`, no en `ruleta`. La credencial vive solo en la interfaz de Dokploy y
nunca en el repositorio.

Si `MONGODB_URI` faltara, la API arrancaría igual pero con almacenamiento en
memoria, y perdería el estado en cada reinicio.

---

## 2. Cómo reproducirlo por API

Todo lo anterior se puede recrear desde cero con `curl` contra
`https://cloud.kiware.co/api/...`, autenticando con la cabecera `x-api-key`.
El token se genera en Dokploy: avatar → **Settings → Profile → API/CLI →
Generate API Key** (se muestra una sola vez).

Las llamadas de abajo son las que se lanzaron realmente, con la respuesta que
dio cada una.

> **Esta instancia no publica su OpenAPI.** `/swagger` sirve la interfaz, pero
> el documento no está: `/swagger/json`, `/api/swagger.json`, `/openapi.json` y
> `/api/openapi.json` devuelven 404. No se puede contrastar un campo dudoso
> contra el esquema; la forma de verificarlo es lanzar la llamada y leer el
> error que devuelve.

```bash
export DOKPLOY_URL="https://cloud.kiware.co"
export DOKPLOY_TOKEN="<token>"

api() {  # helper: api <endpoint> <json>
  curl -fsS -X POST "$DOKPLOY_URL/api/$1" \
    -H "x-api-key: $DOKPLOY_TOKEN" \
    -H "content-type: application/json" \
    -d "$2"
}
```

### 2.1 Crear el proyecto

```bash
api project.create '{
  "name": "la-ruleta",
  "description": "Ruleta de apuestas online (MVP)"
}'
```

La respuesta trae **dos** objetos, no solo el proyecto:

```json
{
  "project":     {"projectId": "TQxvGl8ZX0TJDnQ-vmJQd", "...": "..."},
  "environment": {"environmentId": "IM0vAAi6E6wvciZWNuWCx",
                  "name": "production", "isDefault": true, "...": "..."}
}
```

Guarda el **`environmentId`**: es el dato que pide el paso siguiente, y el
`projectId` no vale para eso. Un proyecto nuevo ya viene con su entorno
`production` creado, así que no hay que crear ninguno a mano.

Si el proyecto ya existe, ambos ids se localizan con:

```bash
curl -fsS "$DOKPLOY_URL/api/project.all" -H "x-api-key: $DOKPLOY_TOKEN" \
  | jq -r '.[] | "\(.name)\t\(.projectId)\t\(.environments[]?.environmentId // "-")"'
```

### 2.2 Crear el recurso Compose

Ojo con el identificador: va **`environmentId`**, no `projectId`. Con
`projectId` la llamada no crea nada útil.

```bash
api compose.create '{
  "name": "la-ruleta",
  "description": "Front (nginx) + API (FastAPI) desde GHCR",
  "environmentId": "<ENVIRONMENT_ID>",
  "composeType": "docker-compose",
  "appName": "la-ruleta"
}'
```

```json
{"composeId": "2has9ckoEovKLB9RAFzcN",
 "appName": "la-ruleta-u457nw",
 "sourceType": "github", "...": "..."}
```

Dos cosas que sorprenden de la respuesta:

- **El `appName` que se envía no es el que queda.** Dokploy le añade un sufijo
  aleatorio (`la-ruleta` → `la-ruleta-u457nw`). Si necesitas el nombre real
  —para buscar contenedores, por ejemplo— léelo de la respuesta, no lo asumas.
- **El recurso nace con `sourceType: "github"`**, no `raw`. Por eso el paso
  2.3 no es opcional: sin él el recurso queda esperando un repositorio que no
  existe.

### 2.3 Cargar el compose como Raw y sus variables

Aquí es donde el recurso pasa de `github` a `raw`. El campo `composeFile`
lleva el YAML entero y `env` el bloque de variables, que es **una sola cadena
con una variable por línea**, no un objeto JSON. Se construye todo con `jq`
para no pelearse con el escapado:

```bash
jq -n \
  --arg composeId "<COMPOSE_ID>" \
  --arg composeFile "$(cat deploy/docker-compose.dokploy.yml)" \
  --arg env "APP_ENV=production
LOG_LEVEL=info
MONGODB_DB=ruleta
MONGODB_URI=mongodb://<usuario>:<password>@mongo-shared-vqyoql:27017/ruleta?authSource=admin" \
  '{composeId:$composeId, sourceType:"raw", composeType:"docker-compose",
    composeFile:$composeFile, env:$env}' \
| curl -fsS -X POST "$DOKPLOY_URL/api/compose.update" \
    -H "x-api-key: $DOKPLOY_TOKEN" \
    -H "content-type: application/json" \
    -d @-
```

### 2.4 Asignar el dominio

El dominio va al servicio **`web`**, nunca a `api`:

```bash
api domain.create '{
  "host": "ruleta.jcvb.com.co",
  "path": "/",
  "port": 80,
  "https": true,
  "certificateType": "letsencrypt",
  "serviceName": "web",
  "domainType": "compose",
  "composeId": "<COMPOSE_ID>"
}'
```

El DNS tiene que resolver antes de pedir el certificado:

```bash
dig +short ruleta.jcvb.com.co   # debe devolver la IP del servidor de Dokploy
```

El registro `A` está en Cloudflare **con el proxy desactivado** (nube gris).
Con el proxy activado, Cloudflare termina el TLS por su cuenta y el desafío
HTTP-01 de Let's Encrypt nunca llega a Traefik: el certificado no se emite.

### 2.5 Desplegar

```bash
api compose.deploy '{"composeId":"<COMPOSE_ID>"}'
# -> {"success":true,"message":"Deployment queued"}
```

La respuesta llega en cuanto el despliegue **entra en la cola**, no cuando
termina: un `success: true` aquí no significa todavía que la aplicación esté
arriba. Para esperar de verdad hay que sondear `compose.one` hasta que
`composeStatus` sea `done`:

```bash
until [ "$(curl -fsS "$DOKPLOY_URL/api/compose.one?composeId=<COMPOSE_ID>" \
             -H "x-api-key: $DOKPLOY_TOKEN" | jq -r '.composeStatus')" = "done" ]; do
  sleep 5
done
```

Verificación:

```bash
curl -fsS  https://ruleta.jcvb.com.co/api/v1/health   # {"status":"ok","storage":"mongo",...}
curl -fsSI https://ruleta.jcvb.com.co/ | head -1      # HTTP/2 200
```

`/api/v1/health` devuelve **`503`** con `status: degraded` si Mongo no
responde, no `200`. Por eso `curl -fsS` es una comprobación válida por sí sola
(falla con cualquier código >= 400) y por eso el `HEALTHCHECK` del contenedor
marca la API como *unhealthy* cuando pierde la base de datos: una API sin
persistencia no debería recibir tráfico. Si la respuesta trae
`storage: memory`, es que `MONGODB_URI` no llegó al contenedor.

### 2.6 De dónde sale el nombre del contenedor de MongoDB

`MONGODB_URI` apunta al Mongo compartido **por nombre**, y ese nombre es el
`appName` del recurso de base de datos, que Dokploy genera con un sufijo
aleatorio igual que hizo con el Compose. Se consulta junto con el usuario y la
contraseña:

```bash
curl -fsS "$DOKPLOY_URL/api/mongo.one?mongoId=<MONGO_ID>" \
  -H "x-api-key: $DOKPLOY_TOKEN" \
  | jq '{appName, databaseUser, databasePassword}'
```

En esta instancia salió `mongo-shared-vqyoql`, que es lo que va en la cadena de
conexión del paso 2.3.

> Los nombres exactos de los campos pueden variar entre versiones de Dokploy y,
> como esta instancia no publica su OpenAPI (ver el aviso al principio de esta
> sección), no hay esquema que consultar: si una llamada falla, el mensaje de
> error del propio endpoint es la mejor pista sobre qué campo falta o sobra.

---

## 3. Imágenes en GHCR

El job `build-and-push` deja publicadas, en cada push a `main`:

- `ghcr.io/jvaldesbit/la-ruleta-api:latest`
- `ghcr.io/jvaldesbit/la-ruleta-web:latest`

y, siempre, una etiqueta con el SHA del commit para poder volver atrás.

Los dos paquetes salieron **públicos solos**, heredando la visibilidad del
repositorio, así que no hizo falta registrar credenciales del registro en
Dokploy. No hay nada que configurar aquí; basta con comprobarlo, sin
credenciales y desde cualquier máquina:

```bash
docker pull ghcr.io/jvaldesbit/la-ruleta-api:latest
```

Si en algún momento un paquete apareciera como privado (por ejemplo si el repo
pasara a privado), habría dos salidas: hacerlo público desde *GitHub →
Packages → `la-ruleta-api` → Package settings → Change visibility*, o crear un
PAT classic con scope `read:packages` y registrarlo en *Dokploy → Settings →
Registry*.

---

## 4. Secretos de GitHub para el despliegue automático

**Los tres secretos ya están puestos**, así que el job `deploy` del workflow
ya no se salta y cada push a `main` despliega. Lo que sigue es cómo se
obtuvieron, por si hay que rotarlos o recrear el recurso.

El `composeId` se lee de la respuesta de `compose.create`, o de la URL del
recurso:

```
https://cloud.kiware.co/dashboard/project/<projectId>/services/compose/<composeId>
                                                                      ^^^^^^^^^^^
```

o por API. La búsqueda va recursiva (`..`) a propósito: los recursos cuelgan
de los entornos del proyecto, y esa anidación cambia entre versiones de
Dokploy:

```bash
curl -fsS "$DOKPLOY_URL/api/project.all" -H "x-api-key: $DOKPLOY_TOKEN" \
  | jq -r '.. | objects | select(.composeId) | "\(.name)\t\(.composeId)"'
```

Y se guardan así:

```bash
gh secret set DOKPLOY_URL        --repo jvaldesbit/la-ruleta --body "https://cloud.kiware.co"
gh secret set DOKPLOY_AUTH_TOKEN --repo jvaldesbit/la-ruleta --body "<TOKEN_DE_DOKPLOY>"
gh secret set DOKPLOY_COMPOSE_ID --repo jvaldesbit/la-ruleta --body "<COMPOSE_ID>"
```

Comprobar que están los tres:

```bash
gh secret list --repo jvaldesbit/la-ruleta
```

Si faltara alguno, el job `deploy` **no falla**: emite un aviso y se salta. Así
un fork o un repo recién clonado tiene el CI en verde desde el primer commit.

> Si en algún momento el recurso se recreara como **Application** en lugar de
> Compose, el endpoint pasa a ser `/api/application.deploy` con el cuerpo
> `{"applicationId": "..."}`. La variante está dejada comentada al final de
> `.github/workflows/ci.yml`.

---

## 5. Verificar que un cambio llega a producción

```bash
git commit --allow-empty -m "chore: probar pipeline de despliegue"
git push origin main
gh run watch --repo jvaldesbit/la-ruleta
```

Al terminar, la respuesta de `/api/v1/health` debe traer la versión nueva
(`APP_VERSION` se inyecta como build-arg con el SHA del commit).

---

## Problemas frecuentes

| Síntoma | Causa | Solución |
| ------- | ----- | -------- |
| El deploy pasa en verde pero la app no cambia | Docker reutiliza la imagen cacheada del tag `latest` | Confirma que ambos servicios tienen `pull_policy: always` |
| `denied` / `unauthorized` al hacer pull | Los paquetes de GHCR pasaron a privado | Hazlos públicos (sección 3) o registra el registry en Dokploy |
| `ruleta.jcvb.com.co` da 404 de Traefik | El dominio se asignó al servicio equivocado | Va a `web`, puerto `80`, no a `api` |
| El dominio da 502 | `web` no está en `dokploy-network`, o la API no arranca | Revisa `networks` en el compose y los logs de `api` |
| `/api/v1/health` devuelve `storage: memory` | `MONGODB_URI` no llegó y cayó al almacén en memoria | Revisa las variables del recurso y que el compose tenga `env_file: [.env]` |
| `/api/v1/health` devuelve `503` / `degraded` | La API arrancó pero Mongo no responde | Mira los logs de `api` y que `mongo-shared-vqyoql` esté levantado |
| Let's Encrypt no emite el certificado | El registro DNS está proxeado por Cloudflare (nube naranja) | Desactiva el proxy: el desafío HTTP-01 tiene que llegar a Traefik |
| `ServerSelectionTimeoutError` en los logs de `api` | El nombre del contenedor de Mongo no resuelve, o falta `dokploy-network` | Usa `mongo-shared-vqyoql`, no una IP; confirma que `api` está en `dokploy-network` |
| El job `deploy` se salta siempre | Faltan secretos | `gh secret list` y repite la sección 4 |
| Falla `--frozen-lockfile` en CI | El lockfile no cuadra con `package.json` | `pnpm install` en local y commitea `pnpm-lock.yaml` |
