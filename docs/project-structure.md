# Project Structure

```text
project-lensaya/
|-- frontend/
|   |-- src/
|   |   |-- app/
|   |   |-- sections/
|   |   |-- App.tsx
|   |   |-- main.tsx
|   |   `-- index.css
|   |-- .env.example
|   |-- package.json
|   `-- vite.config.ts
|-- backend/
|   |-- prisma/
|   |   `-- schema.prisma
|   |-- scripts/
|   |   |-- backup-postgres.js
|   |   |-- backup-r2-manifest.js
|   |   |-- restore-postgres-snapshot.js
|   |   `-- run-daily-backups.js
|   |-- src/
|   |   |-- config/
|   |   |-- controllers/
|   |   |-- db/
|   |   |-- middleware/
|   |   |-- routes/
|   |   |-- services/
|   |   |-- utils/
|   |   |-- app.js
|   |   `-- server.js
|   |-- .env.example
|   |-- package.json
|   `-- src/server.js
|-- database/
|   |-- scripts/
|   |   |-- run-daily-backup.ps1
|   |   `-- register-daily-backup-task.ps1
|   |-- seeds/
|   |   `-- seed.sql
|   |-- init.sql
|   `-- README.md
`-- docs/
    |-- architecture.md
    |-- environment-variables.md
    |-- infrastructure-operations.md
    |-- multi-tenant-routing.md
    `-- project-structure.md
```
