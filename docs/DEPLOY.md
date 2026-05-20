# Deploy

Clag deploya na plataforma [did.lu](https://did.lu). Subdomínio: `clag.did.lu`.

Fonte de verdade do processo de deploy: `~/ved/devops-workflow-2026/DEPLOY-GUIDE.md`. Esse doc só descreve o que é específico de clag.

---

## Anatomia

```
clag/
├── public/             # arquivos servidos estáticos (HTML, JS, CSS)
│   ├── index.html
│   └── src/
│       ├── *.js
│       ├── styles.css
│       └── providers/
├── server.js           # Express minúsculo, só serve public/ + /api/health
├── package.json        # express only
├── Dockerfile
├── did.json            # manifest da plataforma
├── docs/
└── screenshots/
```

Clag não tem DB, não tem Logto, não tem migrations — é static-only. O `server.js` existe apenas porque a plataforma did.lu espera um container que escuta numa porta + tem `/api/health`. Tudo da engine vive em `public/`.

## did.json

```json
{
  "name": "clag",
  "port": 5045,
  "database": false,
  "logto": false
}
```

Porta `5045` é o slot dedicado de clag — verificar disponibilidade no `~/ved/devops-workflow-2026/` antes de bater (cada app tem uma).

## Deploy

```powershell
cd ~/ved/devops-workflow-2026
.\scripts\did.ps1 deploy clag
```

Comando único faz tudo: clone na VM (primeira vez), pull, `docker compose up --build`, healthcheck.

## Logs / status

```powershell
.\scripts\did.ps1 logs clag
.\scripts\did.ps1 status
```

## Sem deploy estático em GCS

Anteriormente versões prévias de `scene-ide/` eram hospedadas em `st.did.lu/scene-ide/vN/`. A partir de clag, a única URL pública oficial é `clag.did.lu`. Snapshots históricos podem continuar no GCS, mas o link compartilhado deve ser sempre `clag.did.lu`.

## Rodar local

Sem precisar do Docker:

```bash
cd clag/public
python -m http.server 4792
# http://localhost:4792/
```

Ou via Node se quiser exercitar o `server.js`:

```bash
cd clag
npm install
npm start
# http://localhost:5045/
```
