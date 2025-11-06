# SlotSwapper

A peer-to-peer time-slot scheduling application. Users can mark calendar events as swappable and request swaps with other users. Includes authentication (JWT), backend swap logic, and a React frontend with simple state management via React Query.

## Tech Stack
- Backend: Node.js, Express, MongoDB (Mongoose), JWT, bcrypt
- Frontend: React (Vite), React Router, React Query

## Monorepo Structure
- `server/` – Express API
- `client/` – React web app

---

## Quick Start

Prerequisites:
- Node.js 18+
- MongoDB running locally (or a connection string)

### 1) Backend

1. Copy env and install deps
```
cp server/.env.example server/.env
```
Edit `server/.env` with your values.

2. Install & run
```
cd server
npm install
npm run dev
```
Server starts on http://localhost:4000

### 2) Frontend

1. Install & run
```
cd client
npm install
npm run dev
```
Frontend dev server starts (default) on http://localhost:5173

If your backend runs on a different URL, set `VITE_API_URL` in `client/.env`:
```
VITE_API_URL=http://localhost:4000
```

---

## API Overview

Auth
- POST `/api/auth/signup` { name, email, password } → { token, user }
- POST `/api/auth/login` { email, password } → { token, user }

Events (authenticated)
- GET `/api/events` → list your events
- POST `/api/events` { title, startTime, endTime, status? } → create
- PUT `/api/events/:id` → update (owner only)
- DELETE `/api/events/:id` → delete (only if not SWAP_PENDING)

Swap Logic (authenticated)
- GET `/api/swappable-slots` → all others' `SWAPPABLE` events
- POST `/api/swap-request` { mySlotId, theirSlotId } → create pending request and set both events to `SWAP_PENDING`
- GET `/api/requests` → { incoming, outgoing }
- POST `/api/swap-response/:requestId` { accept: boolean }
  - accept=false → request=REJECTED; events reset to `SWAPPABLE`
  - accept=true → exchange owners; both events set to `BUSY`; request=ACCEPTED

Notes:
- Swap acceptance attempts to run in a MongoDB transaction if available; falls back to conditional updates if not.

---

## Docker (local)

Build & run API, client, and MongoDB locally:
```
docker compose up --build
```
- API: http://localhost:4000
- Client: http://localhost:5173 (served by nginx)
- MongoDB: mongodb://localhost:27017/slotswapper

Stop:
```
docker compose down
```

---

## Scripts

Backend
- `npm run dev` – start with nodemon
- `npm start` – start without nodemon

Frontend
- `npm run dev` – Vite dev server
- `npm run build` – production build
- `npm run preview` – preview build

---

## Deployment

Frontend (Vercel)
- Connect the `client/` folder as a Vercel project (or push to a repo and import in Vercel).
- Vercel will run `npm ci` then `npm run build` and serve `dist/`.
- Set environment variable `VITE_API_URL` to your backend URL (e.g., the Render service URL like `https://slotswapper-server.onrender.com`).
- vercel.json is included for SPA routing fallback.

Backend (Render)
- Use the included `render.yaml` as a blueprint, or create a Web Service from the repo using `server/Dockerfile`.
- Set env vars in Render:
  - `MONGO_URI` – your MongoDB connection string (Atlas recommended in production)
  - `JWT_SECRET` – long random secret
  - `PORT` – Render commonly uses 10000 (set in render.yaml). The app respects `PORT`.

---

## Environment Variables

server/.env
```
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/slotswapper
JWT_SECRET=replace_with_a_long_random_string
```

client/.env (optional)
```
VITE_API_URL=http://localhost:4000
```

---

## Bonus
- The codebase is structured to allow easy addition of WebSocket notifications (e.g., when a swap request is created/accepted).
- Add tests under `server/tests` as desired (not included by default here).
