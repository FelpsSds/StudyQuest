# StudyQuest frontend

The main interface uses React 19 and Vite. It includes registration and login, dashboard progression, subject and quest creation, quest completion, profile name editing, and study session tracking. The previous interface remains available at `/legacy.html` for plan generation, quest editing, achievements, Boss Fights, leaderboard, and advanced session history while those features move to React.

## Local development

Start the backend from the repository root as described in the root README. Then run:

```powershell
npm ci
npm run dev
```

Vite serves the frontend at `http://localhost:5173` and proxies `/api` to `http://127.0.0.1:8000`. Build the production assets with `npm run build`.

## Docker

The frontend image builds the Vite app, serves it with Nginx, and proxies `/api` to the backend container. Use `docker compose up --build` from the repository root.
