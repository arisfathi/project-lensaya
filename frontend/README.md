# Lensaya Frontend

React + Vite frontend that renders different surfaces based on hostname:

- `lensaya.com` -> marketing site
- `app.lensaya.com` -> photographer dashboard
- `admin.lensaya.com` -> admin panel
- `username.lensaya.com` -> tenant photographer website

## Run

```bash
npm install
npm run dev
```

## Host Preview in Local Development

Use the query parameter `previewHost` to test any host mode locally:

- `http://localhost:5173/?previewHost=app.lensaya.com`
- `http://localhost:5173/?previewHost=admin.lensaya.com`
- `http://localhost:5173/?previewHost=amelia.lensaya.com`
