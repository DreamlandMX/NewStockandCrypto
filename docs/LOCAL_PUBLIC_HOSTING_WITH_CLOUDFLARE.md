# Local Public Hosting with Cloudflare Tunnel

This project can be exposed to the public internet for free by keeping the full stack on your local machine and publishing only the Node entrypoint with Cloudflare Tunnel.

## Why this works

- The Node server in [unified-server.js](/e:/NewStockandCrypto/unified-server.js) already serves the frontend and proxies `/api/model-explorer/*`.
- The Python model service can stay local on `127.0.0.1:8000`.
- Cloudflare only needs to expose the Node port, which keeps the public surface area small.

## One-time setup

1. Install Node dependencies:

```powershell
npm install
```

2. Ensure the ML service environment exists:

```powershell
cd ml-service
.\.venv-gpu\Scripts\python.exe -m pip install -r requirements.txt
cd ..
```

3. Download `cloudflared` automatically when needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Get-Cloudflared.ps1 -DownloadIfMissing
```

## Start the local public site

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Start-LocalPublicSite.ps1 -ModelMode live -DownloadCloudflared
```

What the script does:

- starts the Node server on `127.0.0.1:9000`
- starts the ML service on `127.0.0.1:8000`
- starts a Cloudflare quick tunnel to `http://127.0.0.1:9000`
- automatically falls back to nearby free ports if `9000` or `8000` are already occupied
- waits for the public URL to respond before opening it in your browser
- writes the current state to `logs/local-public/public-site-status.json`
- writes the current public URL to `logs/local-public/public-url.txt`
- prints the `https://*.trycloudflare.com` public URL

## Stop everything

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Stop-LocalPublicStack.ps1
```

## Check current status

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Get-LocalPublicStatus.ps1
```

## Verification

After startup, verify:

```powershell
Invoke-WebRequest http://127.0.0.1:9000/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:9000/api/model-explorer/health -UseBasicParsing
Invoke-WebRequest https://<your-random>.trycloudflare.com/ -UseBasicParsing
Invoke-WebRequest https://<your-random>.trycloudflare.com/api/model-explorer/health -UseBasicParsing
```

## Important notes

- Your computer must stay on and connected to the internet.
- The temporary `trycloudflare.com` address can change between runs.
- If the preferred local ports are busy, the startup script will pick nearby free ports and record them in the status file.
- This is not GitHub Pages hosting. GitHub Pages only works for static sites.
- This route is meant for free public access without moving the app into paid cloud infrastructure.
