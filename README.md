# StreamSphere (Backend) — Scalable OTT Platform

StreamSphere is a backend project built to learn and demonstrate **real-world scalable backend engineering**, including **authentication**, **object storage (MinIO)**, and a planned **microservices architecture**. The project is developed **step-by-step (day-wise)** for deeper understanding rather than copy-pasting code.

---

## 📅 Progress Timeline

| Day   | Topic                 | Status      | Description                                                          |
| ----- | --------------------- | ----------- | -------------------------------------------------------------------- |
| Day 1 | Base Setup            | ✅ Completed | Project setup, TypeScript, Docker, MongoDB, MinIO                    |
| Day 2 | Authentication System | ✅ Completed | Register, Email OTP Verification, Login, JWT Access + Refresh Tokens |
| Day 3 | Catalog Service       | 🔜 Next     | Title model + CRUD + Admin control                                   |
| Day 4 | Media Service         | ✅ Completed | File upload, MinIO integration, Redis (job queue), bucket management |

---

## 🏗️ Tech Stack

* **Backend:** Node.js + Express.js + TypeScript
* **Database:** MongoDB (Docker)
* **File Storage:** MinIO (S3 compatible)
* **Auth:** JWT (Access + Refresh Tokens) + Email OTP Verification
* **Validation:** Zod
* **Queue / Worker:** Redis + BullMQ (for future background processing)
* **Runtime:** Docker Compose

---

## 📂 Project Structure (excerpt)

```
streamsphere/
├─ src/
│  ├─ modules/
│  │  ├─ auth/
│  │  │  ├─ user.model.ts
│  │  │  ├─ auth.service.ts
│  │  │  ├─ auth.controller.ts
│  │  │  └─ auth.routes.ts
│  │  ├─ catalog/
│  │  │  └─ ...
│  │  └─ media/
│  │     └─ media.controller.ts
│  ├─ middleware/
│  │  └─ authMiddleware.ts
│  ├─ utils/
│  ├─ config/
│  └─ server.ts
├─ docker-compose.yml
├─ package.json
└─ tsconfig.json
```

---

## ✅ Day 1 — Setup Summary

**What was done**

* Initialized Node + TypeScript project
* Configured Express server
* Docker Compose with MongoDB and MinIO
* Dev scripts and TypeScript config

**Commands used**

```bash
npm init -y
npm install express cors dotenv bcrypt jsonwebtoken mongoose multer
npm install -D typescript ts-node-dev @types/express @types/node @types/bcrypt @types/jsonwebtoken @types/cors @types/multer
npx tsc --init
npm run dev
# Start Docker services
docker compose up -d
```

**Service access**

* MongoDB: `mongodb://localhost:27017`
* MinIO UI: `http://localhost:9001`
* MinIO API: `http://localhost:9000`

---

## 🔒 Day 2 — Authentication System

**Features implemented**

* Registration with hashed passwords (bcrypt)
* Email OTP verification (store OTP hashed)
* Login only after verification
* JWT access & refresh tokens
* Logout invalidates refresh tokens using tokenVersion rotation
* Protected route middleware (`requireAuth`)

**Auth API (summary)**

| Method | Endpoint           | Auth Required | Purpose                             |
| ------ | ------------------ | ------------- | ----------------------------------- |
| POST   | `/auth/register`   | ❌             | Register user + send OTP            |
| POST   | `/auth/verify-otp` | ❌             | Verify OTP and activate user        |
| POST   | `/auth/login`      | ❌             | Login → Get Access + Refresh tokens |
| POST   | `/auth/refresh`    | ❌             | Renew tokens                        |
| GET    | `/auth/profile`    | ✅             | Fetch user info                     |
| POST   | `/auth/logout`     | ✅             | Invalidate refresh session          |

---

## 🎬 Day 3 — Catalog Service (Movies / Series Metadata)

**Goal:** Create a content-management module for titles with role-based protection.

**Endpoints (planned)**

* `POST /catalog/title` — *Admin* — Create title
* `GET /catalog/titles?page=1&limit=10` — *Public* — List titles (pagination)
* `GET /catalog/title/:id` — *Public* — Get title by ID
* `PUT /catalog/title/:id` — *Admin* — Update title
* `DELETE /catalog/title/:id` — *Admin* — Delete title

**Concepts used**

* Mongoose Models
* Zod validation
* Service layer pattern
* Role-based middleware (`requireRole('admin')`)
* Pagination & filtering

---

## 📁 Day 4 — Media Service (File Upload + MinIO + Redis)

**What we implemented**

* **Media model**: stores metadata (original name, key, url, size, mimetype, status, linked titleId)
* **Upload flow**: `multer` → temporary `/uploads` → put object to MinIO → save metadata to MongoDB → delete temp file
* **MinIO**: S3-compatible client configured; bucket auto-created (e.g., `videos`)
* **Redis**: Added service for background jobs (transcoding, thumbnailing) via BullMQ
* **Access control**: Upload endpoint protected by `requireAuth` + `requireRole('admin')`
* **Auto-cleanup**: Temporary files removed after successful upload

**Upload endpoint**

```
POST /media/upload
Headers:
  Authorization: Bearer <admin_token>
Content-Type: multipart/form-data
Body (form-data):
  - file: <binary file>
  - titleId: <existing Title _id> (optional)
```

**Example response**

```json
{
  "message": "File uploaded successfully",
  "media": {
    "titleId": "67318f...d8",
    "originalName": "sample.mp4",
    "url": "http://localhost:9000/videos/1762580684113-sample.mp4",
    "status": "uploaded"
  }
}
```

---

## ⚙️ MinIO — Common Notes & Troubleshooting

* If you get `AccessDenied` when accessing an object directly, ensure either:

  * The bucket is public (`mc policy set public myminio/videos`) or
  * Generate a presigned URL for private objects using the MinIO client SDK.

* Use `mc` (MinIO client) for quick checks:

```bash
mc alias set myminio http://localhost:9000 <ACCESS_KEY> <SECRET_KEY>
mc ls myminio/videos
mc policy get myminio/videos
```

* For browser-based JS requests, configure CORS on the bucket.

---

## ✅ Debugging Tips (for uploads & routes)

1. **Export the router instance** — `export default router` (not `Router`).
2. **Mount routes in your app** — `app.use('/media', mediaRoutes)`.
3. **Check middleware** — ensure `requireAuth` and `requireRole` call `next()` or they will block the chain.
4. **Send correct form-data** — `multer.single('file')` expects field name `file`.
5. **Log inside middleware** to verify the flow.
6. **Inspect MinIO keys & bucket** with `mc ls`.

---

## 🛠️ Useful Code Snippets

### Mounting the Router (example)

```ts
// server.ts
import express from 'express'
import mediaRoutes from './modules/media/media.routes'

const app = express()
app.use(express.json())

// mount
app.use('/media', mediaRoutes)

app.listen(3000, () => console.log('Server running on 3000'))
```

---

### Day 5 — Presigned Uploads + Worker (10-minute presign; simulated processing)

**Objective:** Allow clients to upload directly to MinIO using presigned PUT URLs; return presigned GET URLs for streaming once the worker finishes processing. Add a BullMQ worker to process uploads (simulated).

**What I implemented**
- `POST /media/presign` — returns presigned PUT URL and creates Media DB record (`upload_pending`).
- `POST /media/:id/complete` — client notifies server after successful direct upload; server enqueues processing job.
- `GET /media/:id/url` — returns presigned GET URL if media is `ready`.
- `media-worker` — BullMQ consumer that simulates processing (5s), updates status `processing` -> `ready`.
- MinIO client wrapper and Queue helper added.


**Next steps**
- Replace simulated worker with FFmpeg pipeline & store derived outputs.
- Add MinIO bucket notifications to auto-enqueue jobs (optional).
- Add more robust file validations, size checks, content-type checks, and virus scanning.

**Commit message suggestion**
`feat(media): add presigned upload/get endpoints + BullMQ worker (simulated processing)`

**Interview bullet (1–2 lines)**  
Implemented direct S3-compatible presigned uploads to MinIO for scalable media ingestion and added a BullMQ worker to simulate asynchronous transcoding — demonstrates event-driven media pipelines and scalable background processing.

### Day 6 — Media Metadata + Progress

**Objective:** Extract real video metadata (ffprobe) after upload, track processing progress, and expose a media details API.

**What’s implemented**
- Worker now uses ffprobe to extract `duration, width, height, codecs, format, bitrate`.
- Media schema extended with `metadata`, `progress`, `processingLogs`, `outputUrl` (placeholder).
- Progress tracked via BullMQ `updateProgress()` and saved to Mongo.
- New endpoint: `GET /media/:id` returns full media document.


### Day 7 — Single-bitrate HLS (FFmpeg → MinIO)

**Objective:** Transcode uploaded videos to HLS (one bitrate), upload artifacts to MinIO, and return signed URLs to the master m3u8.

**What I implemented**
- Worker: downloads source, runs FFmpeg to generate HLS, uploads folder to MinIO, updates `outputUrlKey`.
- Media model: added `outputUrlKey` (MinIO key for master.m3u8).
- `/media/:id/url` now returns a signed URL to `.m3u8` when ready (fallback to original object if no HLS).
- Content-Type set for `.m3u8` and `.ts` on upload.

**How to run**
1. `docker compose up -d mongo minio redis`
2. `pnpm dev` (API)
3. `pnpm worker` (Worker)
4. Flow: presign → PUT upload → complete → worker → `GET /media/:id/url`
