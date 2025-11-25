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


### Day 8 — Thumbnails, Sprite & WebVTT (Preview / Hover Thumbnails)

**Objective:**
Generate video preview assets so the client can show timeline hover thumbnails and quick previews. This includes generating multiple thumbnails, stitching them into a sprite image, producing a WebVTT file, uploading all assets to MinIO, and exposing signed URLs via the API.

---

## What I Implemented

### 1. Worker Enhancements

After HLS processing (or even without it), the worker now performs the following:

* **Generates 10–12 thumbnails** spaced evenly across the video duration.

  * Example files: `thumb-001.png`, `thumb-002.png`, ...

* **Creates a sprite image** using FFmpeg tile filter.

  * Example: `sprite.jpg`
  * Arranged in a grid (e.g., 4 columns × N rows)

* **Builds a WebVTT file** that links specific time ranges to positions within the sprite image.

  * Example: `sprite.vtt`

* **Uploads all generated assets to MinIO** under:

  ```
  thumbnails/<mediaId>/
  ```

* **Updates the Media document** with object keys:

  ```json
  thumbnails: ["thumbnails/<mediaId>/thumb-001.png", ...],
  spriteKey: "thumbnails/<mediaId>/sprite.jpg",
  vttKey: "thumbnails/<mediaId>/sprite.vtt"
  ```

* **Improved worker logging & progress tracking** for transparency during the processing pipeline.

---

## 2. API Enhancements

### `GET /media/:id/thumbnails`

Returns presigned URLs for thumbnails, sprite image, and VTT file.

**Response example:**

```json
{
  "thumbnails": ["<signed-url>", "<signed-url>", ...],
  "sprite": "<signed-url>",
  "vtt": "<signed-url>"
}
```

### `GET /media/:id`

Now includes DB fields:

* `thumbnails[]`
* `spriteKey`
* `vttKey`

These are MinIO object keys from which presigned URLs are generated.

---

## 3. Robustness Improvements

* Thumbnail/sprite/VTT errors **do not break the main pipeline**.
* Video playback (HLS) still becomes available even if preview assets fail.
* Worker logs failures in `processingLogs` for debugging.
* Worker cleans all temporary directories after processing.

---

# 📘 StreamSphere — Secure Delivery Layer & Media Streaming

### **Daily Learning Log — 17 Nov 2025**

This document summarizes everything learned and implemented today about building a **secure, production-grade OTT Delivery Layer**, including presigned streaming, CDN-based access control, delivery policies, and streaming variants.

---

# 🔥 1. What Was Implemented Today

### ✅ DeliveryPolicy Model

A per-asset policy that controls:

* Allowed regions
* Allowed IP ranges
* Embargo (future release date)
* Whether watermarked content is required

### ✅ Delivery Route

**`GET /delivery/media/:id/url`**
This route:

* Validates embargo
* Checks region + IP
* Chooses the correct video variant
* Supports cookie-based CDN flow
* Generates presigned GET URLs for streaming

### ✅ CDN Mock (Local CDN Simulator)

A local reverse-proxy that:

* Validates signed cookies
* Uses presigned URLs to fetch MinIO content
* Streams playlist + segments using `pipe()`
* Mimics real CDNs like Akamai/CloudFront

### ✅ Full Understanding of Media Pipeline

```
POST /media/presign → Client uploads → POST /media/:id/complete → Worker processes
→ Delivery route returns secure streaming URL → Client plays video
```

---

# 🎬 2. How a User Finally Plays a Video

Two streaming modes were learned and implemented:

---

## **A) Direct Presigned URL Flow**

**Used for:** Mobile apps, local testing, simple clients

1. Client calls:
   `GET /delivery/media/:id/url`
2. Delivery layer:

   * Checks policy
   * Picks the right variant
   * Returns **presigned GET URL**
3. Player streams video directly from MinIO using this URL.

**Pros:** Simple, easy to test
**Cons:** No CDN caching, URL exposes origin path (temporarily)

---

## **B) CDN + Signed Cookie Flow**

**Used in production OTT platforms**

1. Client calls:
   `GET /delivery/media/:id/url?cookie=true`
2. Delivery layer:

   * Checks policy
   * Creates **signed cookie**
   * Returns CDN URL
3. Player accesses:
   `/cdn/:assetId/master.m3u8`
4. CDN mock:

   * Checks cookie
   * Fetches origin using presigned URL
   * Streams data back to player

**Pros:**
✔ CDN caching
✔ No exposure of MinIO URLs
✔ Tied to user/session
✔ Industry-standard

---

# 🧠 3. Why DeliveryPolicy.assetId = Media._id

Each Media asset needs policy rules.
Therefore the DeliveryPolicy references the Media document:

```
DeliveryPolicy.assetId  → Media._id
```

This allows the Delivery route to quickly evaluate the rules for a specific media file.

---

# 🏗️ 4. Where to Create DeliveryPolicy (MOST IMPORTANT)

✔ **Create DeliveryPolicy inside `POST /media/presign`**
This is the moment you create the Media record — so it’s the perfect place to also attach a default DeliveryPolicy.

**Do NOT create in**:

* Worker
* `/media/:id/complete`
* Delivery routes

Correct flow:

```
POST /media/presign  
    → create Media  
    → create DeliveryPolicy  
    → return presigned PUT  
```

---

# 🎞️ 5. Variant Selection Logic (Simple & Clean)

When choosing a variant to stream:

```
1. If watermark is required → pick watermarked variant  
2. If client requested variant → pick that  
3. Else → pick first/best available variant  
4. If no variants → fallback to original ONLY for download mode
```

This supports:

```
/delivery/media/:id/url?variant=1080p
```

---

# 🔐 6. Cookie vs Presigned URL (Beginner-Friendly)

### Presigned URL

* Temporary access to object storage (MinIO/S3)
* Expires after TTL
* Used by mobile/testing

### Signed Cookie

* Given by Delivery route
* Validated by CDN
* Does NOT expose origin URL
* Used in real OTT systems

Developer advice:
Base64 cookies are for DEV ONLY → use **HMAC + secret key** in production.

---

# 📡 7. CDN Mock Explained

The CDN mock imitates a real CDN:

1. Browser requests `/cdn/<assetId>/master.m3u8`
2. CDN mock checks cookie (`cdn_token`)
3. CDN mock uses presigned URL to fetch MinIO object:

   ```js
   const upstream = await fetch(minioPresignedUrl);
   upstream.body.pipe(res);
   ```
4. Streams playlist and segments to player.

This perfectly simulates:

```
Player → CDN → Origin (MinIO) → CDN → Player
```

---

# 🧩 8. Key Concepts Learned Today

### ✔ DeliveryPolicy

### ✔ Variant selection logic

### ✔ Embargo + regional restrictions

### ✔ IP filtering

### ✔ CDN cookie flow

### ✔ Presigned GET URL generation

### ✔ Worker → HLS → Delivery pipeline

This gives your backend **real-world OTT-grade streaming security**.

---

# 📚 9. Today’s Complete Takeaways
* DeliveryPolicy should always be created at `/media/presign`
* Delivery route is the correct place for all policy checks
* Worker is only for video processing, not policy logic
* CDN mock allows local testing of production CDN behavior
* Direct presigned URLs are simple but less secure
* Cookie-based access is the true OTT standard
* Variant selection is essential for ABR + watermark handling
* Cookies should be signed with HMAC (not plain base64)
---


# Streamsphere — Billing MVP

Stripe Checkout + MongoDB (Mongoose, TypeScript) — minimal working Billing integration for Streamsphere.

This module lets authenticated users create Stripe customers, open a Stripe Checkout (subscription) session, and keeps a minimal local mirror of Stripe objects via webhooks.

---

## **Included**

### **TypeScript Mongoose Models**

* BillingCustomer
* Plan
* BillingSubscription
* BillingInvoice
* WebhookEvent

### **Express Route — `routes/billing.ts`**

* `POST /api/billing/create-customer`
* `POST /api/billing/create-checkout-session`
* `POST /api/billing/seed-plan`
* `POST /api/billing/webhook` (raw body, Stripe signature verified)

### **Configs**

* `.env.example`
* `.gitignore`
* README with Stripe CLI testing instructions

This module expects your existing **User** model at `src/models/User` (adjust imports if needed) and your auth middleware to set `(req as any).userId`. If not available, the module will fall back to email/userId from request body.

---

## **Prerequisites**

* Node.js >= 18
* npm or yarn
* MongoDB (local or cloud)
* Stripe account (test mode)
* Stripe CLI

---

## **Quick Start**

### **Install dependencies**

```bash
npm install
# or inside a larger project:
npm install stripe express body-parser cookie-parser dotenv
npm install -D @types/express @types/cookie-parser
```

### **Create `.env` from `.env.example`:**

```
PORT=4242
MONGO_URI=mongodb://localhost:27017/streamsphere
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
BASE_URL=http://localhost:4242
FRONTEND_URL=http://localhost:3000
```

### **Start server**

```bash
npm run dev
# or
node dist/server.js
```

---

## **Stripe Setup (Test Mode)**

1. Create Product + Price in Stripe Dashboard.
2. Use a recurring price (monthly/yearly) → copy `price_xxx`.
3. Seed the plan (optional):

```bash
curl -X POST http://localhost:4242/api/billing/seed-plan \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_xxx"}'
```

### **Create Checkout Session**

```bash
curl -X POST http://localhost:4242/api/billing/create-checkout-session \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_xxx"}'
```

This returns a URL — open it and pay using:

```
4242 4242 4242 4242
```

### **Forward Webhooks Locally**

```bash
stripe listen --forward-to localhost:4242/api/billing/webhook
```

Copy the `whsec_...` secret into `.env` → `STRIPE_WEBHOOK_SECRET`.
Restart server.

---

## **Webhook Flow**

The webhook handler processes:

* `checkout.session.completed` → create subscription, attach plan
* `invoice.payment_succeeded` → create invoice, mark subscription active
* `invoice.payment_failed` → mark subscription past_due
* `customer.subscription.updated` → update subscription data
* `customer.subscription.deleted` → cancel subscription

All events are saved in **WebhookEvent** for idempotency.

---

## **API Endpoints**

### **POST /api/billing/create-customer**

Body:

```json
{ "email": "?", "userId": "?" }
```

Uses `req.userId` automatically if authenticated.

### **POST /api/billing/create-checkout-session**

Body:

```json
{
  "priceId": "price_xxx",
  "stripeCustomerId": "optional",
  "successUrl": "optional",
  "cancelUrl": "optional"
}
```

Response:

```json
{ "url": "https://checkout.stripe.com/...", "id": "cs_test_xxx" }
```

### **POST /api/billing/seed-plan**

Body:

```json
{ "priceId": "price_xxx" }
```

Creates local plan from Stripe price.

### **POST /api/billing/webhook**

* Uses raw body
* Verifies Stripe signature
* Handles subscription lifecycle events

---

## **Models Summary**

### **BillingCustomer**

Mirror of Stripe customer linked to User.

### **Plan**

Mirror of Stripe Price.

### **BillingSubscription**

Mirror of Stripe subscription + period dates.

### **BillingInvoice**

Mirror of Stripe invoice.

### **WebhookEvent**

Stores raw events for audit + idempotency.

---

## **Notes**

* Replace paths as needed for your project structure.
* This module handles only minimal billing logic — upgrade/downgrade flows can be added later.

---

# 🏦 Billing & Subscription Reliability System

This repository contains the backend services and scripts responsible for ensuring robust, low-latency, and consistent synchronization of billing and subscription data between **Stripe** and the local **MongoDB** database.

The system is designed with a three-layer defense to handle network failures, worker crashes, and human errors:

1.  **Real-Time Processing:** Handled by `webhookWorker.ts` and the BullMQ queue.
2.  **Failure Alerting:** Handled by `failedJobs.ts`.
3.  **Eventual Consistency:** Handled by `reconciliation.ts`.

---

## 🛠️ Components Overview

| Script | Purpose | Execution | Key Function |
| :--- | :--- | :--- | :--- |
| **`webhookWorker.ts`** | Real-time processing of Stripe events. | Dedicated long-running process. | Low-latency DB updates and business logic execution. |
| **`reconciliation.ts`** | Scheduled check for data drift. | Daily Cron Job (off-peak hours). | Compares **all** Stripe records against local DB records and auto-fixes mismatches. |
| **`failedJobs.ts`** | Monitoring and alerting on worker failures. | Hourly Scheduled Script. | Inspects the BullMQ dead-letter queue (failed jobs) for permanent errors. |

---

## 🚀 Setup and Deployment

1.  **Dependencies:** Requires Node.js, Mongoose, the Stripe Node client, and a running **Redis instance** for BullMQ.
2.  **Environment:** Ensure `MONGO_URI` and `STRIPE_SECRET_KEY` are configured in your environment variables.
3.  **Deployment:**
    * **Workers:** Deploy `webhookWorker.ts` as a separate, persistent service (using PM2 or a container orchestration tool).
    * **Schedules:** Set up `reconciliation.ts` and `failedJobs.ts` using your cloud provider's cron/scheduler service (e.g., AWS EventBridge/Lambda).
2. scripts/reconciliation.ts
Markdown

# `scripts/reconciliation.ts`

## 🛡️ Reconciliation Script

This script enforces **eventual consistency** by comparing the entire dataset between Stripe and MongoDB. It is the definitive safety net for events that were missed or incorrectly processed by the real-time workers.

### Execution Details

* **Schedule:** Daily at 02:00 AM (or another designated off-peak time).
* **Optimization:** Uses pagination and a local `Set` of Stripe IDs to perform the **Local -> Stripe** check locally, preventing rate-limit issues from unnecessary API calls.

### Mismatch Categories

1.  **`missing_local_subscription`:** Found on Stripe, but missing locally. Requires local creation.
2.  **`status_mismatch`:** Status on Stripe differs from the status in the local DB. **Auto-fixed** by updating the local record to match Stripe.
3.  **`missing_stripe_subscription`:** Found locally, but missing or deleted on Stripe. Requires local soft-deletion or manual review.

### Usage

```bash
# Execute as a scheduled job
node scripts/reconciliation.ts

---

### 3. `scripts/webhookWorker.ts`

```markdown
# `scripts/webhookWorker.ts`

## ⚡ Webhook Processing Worker

This is the **real-time processor** for all Stripe events received by the application endpoint. Events are pushed to the BullMQ queue upon receipt and verification, and this worker handles the heavy lifting.

### Execution Details

* **Process Type:** Long-running, dedicated background process.
* **Concurrency:** Configured for high concurrency to handle the volume of incoming events quickly.
* **Role:** Primarily **I/O bound** (database updates, email triggers).

### Key Logic

1.  **Data Synchronization:** Updates local `BillingSubscription` and `BillingCustomers` records based on the event payload (`invoice.payment_succeeded`, `customer.subscription.updated`, etc.).
2.  **Idempotency:** Must handle potential duplicate events or retries gracefully.
3.  **Error Handling:** Utilizes BullMQ's built-in retry mechanism for transient errors before failing the job permanently.

### Usage

```bash
# Start the worker process (e.g., using PM2)
pm2 start scripts/webhookWorker.ts --name webhook-worker

---

### 4. `scripts/failedJobs.ts`

```markdown
# `scripts/failedJobs.ts`

## 🚨 Failed Job Inspector

This script is a **monitoring tool** used to check the health of the BullMQ `webhookQueue`. It identifies critical events that have failed all attempts and moved to the permanent dead-letter queue.

### Execution Details

* **Schedule:** Hourly (or multiple times per day).
* **Role:** Diagnostic and Alerting.

### Function

1.  Calls `webhookQueue.getFailed()` to retrieve the list of unrecoverable jobs.
2.  Logs the `job.id`, `job.name`, and the full `job.failedReason` (error message/stack trace).
3.  **Action Plan:** The logged output should be consumed by an alerting system (Sentry, Slack, or email) to notify developers that manual intervention is required for the failed event.

### Usage

```bash
# Execute periodically to check for failures
node scripts/failedJobs.ts