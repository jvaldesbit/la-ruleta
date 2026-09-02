# Despliegue de La Ruleta en Dokploy

Guía reproducible para dejar el proyecto corriendo en la instancia de Dokploy
de <https://cloud.kiware.co>, con dominio y HTTPS, y con despliegue automático
en cada push a `main`.

El resumen es: **GitHub Actions construye y publica las imágenes en GHCR, y
luego llama a la API de Dokploy para que se las descargue y las levante.**
Dokploy no compila nada.

```
  push a main ──► CI (lint + tests) ──► docker build+push ──► GHCR
                                                                │
                                       curl POST compose.deploy │
  GitHub Actions ───────────────────────────────────────────────┤
                                                                ▼
                                          Dokploy hace `docker compose pull && up -d`
```

---

## 0. Requisitos

- Acceso de administrador a <https://cloud.kiware.co>.
- El repositorio `jvaldesbit/la-ruleta` ya en GitHub, con el workflow
  `.github/workflows/ci.yml` en `main`.
- `gh` (GitHub CLI) autenticado en local: `gh auth status`.
- Un dominio o subdominio apuntando por DNS (registro `A`) a la IP del
  servidor de Dokploy. Por ejemplo `ruleta.kiware.co`.

---

## 1. Publicar las imágenes en GHCR

La primera vez, haz un push a `main` (o lanza el workflow a mano desde la
pestaña *Actions*) y espera a que termine el job **build-and-push**. Al acabar
existirán:

- `ghcr.io/jvaldesbit/la-ruleta-api:latest`
- `ghcr.io/jvaldesbit/la-ruleta-web:latest`

### Hacerlas públicas (recomendado)

Por defecto un paquete de GHCR nace **privado**, y Dokploy no podrá bajarlo.
Con el repo público lo más simple es hacer públicos también los paquetes:

1. GitHub → tu perfil → **Packages** → `la-ruleta-api`.
2. **Package settings** → *Danger Zone* → **Change visibility** → *Public*.
3. Repetir con `la-ruleta-web`.

Comprobación desde cualquier máquina, sin credenciales:

```bash
docker pull ghcr.io/jvaldesbit/la-ruleta-api:latest
```

### Alternativa: mantenerlas privadas

Si prefieres no publicarlas, hay que registrar el registry en Dokploy:

1. Crea un **Personal Access Token (classic)** en GitHub con el scope
   `read:packages`.
2. En Dokploy: **Settings → Registry → Add Registry**.
   - Registry URL: `ghcr.io`
   - Username: tu usuario de GitHub (`jvaldesbit`)
   - Password: el PAT
3. Al crear el recurso, selecciona ese registry.

---

## 2. Crear el proyecto en Dokploy

1. Entra en <https://cloud.kiware.co>.
2. **Projects → Create Project**.
   - Name: `la-ruleta`
   - Description: `Ruleta de apuestas online (MVP)`

---

## 3. Crear el recurso Compose

1. Dentro del proyecto: **Create Service → Compose**.
   - Name: `la-ruleta`
   - Provider / Source Type: **Raw**
2. En el editor de Compose, pega **tal cual** el contenido de
   [`deploy/docker-compose.dokploy.yml`](../deploy/docker-compose.dokploy.yml).
3. Guarda (**Save**). Todavía no despliegues.

> Se usa *Raw* y no *Git* a propósito: así Dokploy no necesita acceso al repo
> ni reconstruye nada; solo tira las imágenes ya publicadas.

### Variables de entorno

En la pestaña **Environment** del servicio, pon lo que necesite la aplicación.
Para el MVP basta con:

```
APP_ENV=production
LOG_LEVEL=info
```

Dokploy escribe estas variables en un fichero `.env` junto al compose, pero
**no las inyecta solas** en los contenedores: por eso el compose declara
`env_file: [.env]` en ambos servicios. Si quitas esa línea, todo lo que pongas
aquí se ignora en silencio.

No hay secretos que configurar: la aplicación no usa base de datos ni APIs
externas.

---

## 4. Dominio y certificado

1. Comprueba que el DNS ya resuelve: `dig +short ruleta.kiware.co` debe
   devolver la IP del servidor de Dokploy.
2. En el recurso Compose, pestaña **Domains → Add Domain**:
   - **Service Name**: `web` ← importante, el dominio va al frontend, nunca a
     `api`. La API se alcanza a través del proxy de nginx en `/api/`.
   - **Host**: `ruleta.kiware.co`
   - **Path**: `/`
   - **Container Port**: `80`
   - **HTTPS**: activado
   - **Certificate Provider**: `Let's Encrypt`
3. Guarda. Traefik pedirá el certificado en el primer acceso; puede tardar
   unos segundos.

---

## 5. Primer despliegue

Pulsa **Deploy** en el recurso. Cuando termine, verifica:

```bash
curl -fsS https://ruleta.kiware.co/api/v1/health
# {"status":"ok","version":"..."}

curl -fsSI https://ruleta.kiware.co/ | head -1
# HTTP/2 200
```

Si `/api/v1/health` da 502, casi siempre es una de estas dos cosas: el servicio
`api` aún no ha pasado su healthcheck, o el servicio `web` no está en la red
`dokploy-network` (revisa la sección `networks` del compose).

---

## 6. Conectar el despliegue automático

### 6.1 Obtener el token de API de Dokploy

1. En Dokploy: avatar → **Settings → Profile → API/CLI**.
2. **Generate API Key**. Dale un nombre (`github-actions-la-ruleta`).
3. Copia el token **ahora**: no se vuelve a mostrar.

### 6.2 Obtener el `composeId`

Es el UUID del recurso Compose. La forma más directa es leerlo de la URL
mientras tienes el recurso abierto en el navegador:

```
https://cloud.kiware.co/dashboard/project/<projectId>/services/compose/<composeId>
                                                                      ^^^^^^^^^^^
```

O por API:

```bash
curl -fsS "https://cloud.kiware.co/api/project.all" \
  -H "x-api-key: <TU_TOKEN>" | jq -r \
  '.[].compose[]? | "\(.name)\t\(.composeId)"'
```

### 6.3 Guardar los secretos en GitHub

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

### 6.4 Probar el disparo a mano

```bash
curl -fsS -X POST "https://cloud.kiware.co/api/compose.deploy" \
  -H "x-api-key: <TOKEN_DE_DOKPLOY>" \
  -H "content-type: application/json" \
  -d '{"composeId":"<COMPOSE_ID>"}'
```

Si responde 200 y en Dokploy aparece un despliegue nuevo, GitHub Actions hará
exactamente lo mismo en cada push a `main`.

> Si en algún momento el recurso se recrea como **Application** en lugar de
> Compose, el endpoint pasa a ser `/api/application.deploy` con el cuerpo
> `{"applicationId": "..."}`. La variante está dejada comentada al final de
> `.github/workflows/ci.yml`.

---

## 7. Verificar que un cambio llega a producción

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
| `denied` / `unauthorized` al hacer pull | Los paquetes de GHCR siguen privados | Hazlos públicos (paso 1) o registra el registry en Dokploy |
| El dominio da 404 de Traefik | El dominio se asignó al servicio equivocado | El dominio va a `web`, puerto `80` |
| El dominio da 502 | `web` no está en `dokploy-network`, o la API no arranca | Revisa `networks` en el compose y los logs de `api` |
| Las variables de entorno no llegan | Falta `env_file: [.env]` | Está en el compose; no lo borres al editarlo en la UI |
| El job `deploy` se salta siempre | Faltan secretos | `gh secret list` y repite el paso 6.3 |
| Falla `--frozen-lockfile` en CI | El lockfile no cuadra con `package.json` | `pnpm install` en local y commitea `pnpm-lock.yaml` |
