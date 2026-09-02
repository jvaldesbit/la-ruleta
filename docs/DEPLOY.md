# Despliegue de La Ruleta

La aplicación corre en la instancia de Dokploy de <https://cloud.kiware.co> y
se sirve en **<https://ruleta.jcvb.com.co>**.

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
| Recurso | **Compose**, provider **Raw** (`composeType: docker-compose`) |
| Contenido del compose | copia literal de [`../deploy/docker-compose.dokploy.yml`](../deploy/docker-compose.dokploy.yml) |
| Servicios | `api` (sin puertos publicados) y `web` (expone `80` a Traefik) |
| Imágenes | `ghcr.io/jvaldesbit/la-ruleta-api:latest` y `…-web:latest`, ambas **públicas** en GHCR |
| Dominio | `ruleta.jcvb.com.co` → servicio **`web`**, puerto `80`, HTTPS con Let's Encrypt |
| Base de datos | la instancia de **MongoDB que ya existe** en ese Dokploy, alcanzada por `dokploy-network`. Este compose **no** levanta Mongo |
| Redes | `ruleta` (interna, resuelve `api` desde nginx) y `dokploy-network` (externa: Traefik y MongoDB) |

Un solo dominio para todo: `web` sirve el SPA y nginx hace de proxy de `/api/`
hacia `api:8000`. La API no tiene subdominio propio.

### Variables de entorno del recurso

Dokploy vuelca estas variables en un fichero `.env` junto al compose. El
compose las recoge de dos formas complementarias: `env_file: [.env]` las mete
en el contenedor, y `${MONGODB_URI}` las usa para interpolar. Sin `env_file`
no llegarían al proceso, porque **Dokploy no las inyecta solo**.

```
MONGODB_URI=mongodb://<usuario>:<password>@<servicio-mongo>:27017/ruleta?authSource=admin
MONGODB_DB=ruleta
APP_ENV=production
LOG_LEVEL=info
```

`<servicio-mongo>` es el **nombre del contenedor** de MongoDB dentro de
`dokploy-network` (el que muestra Dokploy en el recurso de la base de datos),
nunca una IP: las IPs cambian en cada redespliegue. La credencial vive solo en
la interfaz de Dokploy y nunca en el repositorio.

Si `MONGODB_URI` faltara, la API arrancaría igual pero con almacenamiento en
memoria, y perdería el estado en cada reinicio.

---

## 2. Cómo reproducirlo por API

Todo lo anterior se puede recrear desde cero con `curl` contra
`https://cloud.kiware.co/api/...`, autenticando con la cabecera `x-api-key`.
El token se genera en Dokploy: avatar → **Settings → Profile → API/CLI →
Generate API Key** (se muestra una sola vez).

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
# -> {"projectId":"..."}
```

Si ya existe, se localiza con:

```bash
curl -fsS "$DOKPLOY_URL/api/project.all" -H "x-api-key: $DOKPLOY_TOKEN" \
  | jq -r '.[] | "\(.name)\t\(.projectId)"'
```

### 2.2 Crear el recurso Compose

```bash
api compose.create '{
  "name": "la-ruleta",
  "description": "API + web servidos tras nginx",
  "projectId": "<PROJECT_ID>",
  "composeType": "docker-compose",
  "appName": "la-ruleta"
}'
# -> {"composeId":"..."}
```

### 2.3 Cargar el compose como Raw y sus variables

El campo `composeFile` lleva el YAML entero, y `env` el bloque de variables.
Se construye el JSON con `jq` para no pelearse con el escapado:

```bash
jq -n \
  --arg composeId "<COMPOSE_ID>" \
  --arg composeFile "$(cat deploy/docker-compose.dokploy.yml)" \
  --arg env "MONGODB_URI=mongodb://<usuario>:<password>@<servicio-mongo>:27017/ruleta?authSource=admin
MONGODB_DB=ruleta
APP_ENV=production
LOG_LEVEL=info" \
  '{composeId:$composeId, sourceType:"raw", composeFile:$composeFile, env:$env}' \
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

### 2.5 Desplegar

```bash
api compose.deploy '{"composeId":"<COMPOSE_ID>"}'
```

Verificación:

```bash
curl -fsS  https://ruleta.jcvb.com.co/api/v1/health   # {"status":"ok","version":"..."}
curl -fsSI https://ruleta.jcvb.com.co/ | head -1      # HTTP/2 200
```

> Los nombres exactos de los campos pueden variar entre versiones de Dokploy.
> El catálogo vivo de endpoints está en `https://cloud.kiware.co/swagger`.

---

## 3. Imágenes en GHCR

El job `build-and-push` deja publicadas, en cada push a `main`:

- `ghcr.io/jvaldesbit/la-ruleta-api:latest`
- `ghcr.io/jvaldesbit/la-ruleta-web:latest`

y, siempre, una etiqueta con el SHA del commit para poder volver atrás.

Un paquete de GHCR nace **privado** y entonces Dokploy no puede bajarlo. Como
el repositorio es público, los paquetes están puestos en público desde *GitHub
→ Packages → `la-ruleta-api` → Package settings → Change visibility → Public*
(y lo mismo con `la-ruleta-web`). Comprobación sin credenciales:

```bash
docker pull ghcr.io/jvaldesbit/la-ruleta-api:latest
```

Alternativa si se quisieran privadas: PAT classic con scope `read:packages` y
registrarlo en *Dokploy → Settings → Registry*.

---

## 4. Secretos de GitHub para el despliegue automático

El job `deploy` del workflow necesita tres secretos. El `composeId` se lee de
la respuesta de `compose.create`, o de la URL del recurso:

```
https://cloud.kiware.co/dashboard/project/<projectId>/services/compose/<composeId>
                                                                      ^^^^^^^^^^^
```

o por API:

```bash
curl -fsS "$DOKPLOY_URL/api/project.all" -H "x-api-key: $DOKPLOY_TOKEN" \
  | jq -r '.[].compose[]? | "\(.name)\t\(.composeId)"'
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

Mientras falte alguno, el job `deploy` **no falla**: emite un aviso y se salta.
Así un repo recién clonado tiene el CI en verde desde el primer commit.

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
| `denied` / `unauthorized` al hacer pull | Los paquetes de GHCR volvieron a privado | Hazlos públicos (sección 3) o registra el registry en Dokploy |
| `ruleta.jcvb.com.co` da 404 de Traefik | El dominio se asignó al servicio equivocado | Va a `web`, puerto `80`, no a `api` |
| El dominio da 502 | `web` no está en `dokploy-network`, o la API no arranca | Revisa `networks` en el compose y los logs de `api` |
| La API responde pero pierde el estado al reiniciar | `MONGODB_URI` no llegó y cayó al almacén en memoria | Revisa las variables del recurso y que el compose tenga `env_file: [.env]` |
| `ServerSelectionTimeoutError` en los logs de `api` | El nombre del servicio de Mongo no resuelve, o falta `dokploy-network` | Usa el nombre del contenedor de Mongo, no una IP; confirma que `api` está en `dokploy-network` |
| El job `deploy` se salta siempre | Faltan secretos | `gh secret list` y repite la sección 4 |
| Falla `--frozen-lockfile` en CI | El lockfile no cuadra con `package.json` | `pnpm install` en local y commitea `pnpm-lock.yaml` |
