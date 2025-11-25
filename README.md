# 🎬 StreamSphere (Backend) — Scalable OTT Platform

StreamSphere is the core backend service for a highly scalable Over-The-Top (OTT) media platform. It is engineered for resilience, high throughput, and security, utilizing modern cloud-native patterns like asynchronous workers, S3-compatible object storage, and specialized media delivery layers.

---

## 📖 Table of Contents
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Deployment & Services](#-deployment--services)
- [Secure Media Delivery Layer](#-secure-media-delivery-layer)
- [Billing & Data Integrity](#-billing--data-integrity)
- [Quick Start](#-quick-start)

---

## 🏗️ Architecture & Tech Stack

The platform is built on a segregated architecture where critical financial operations, media processing, and API serving are handled by dedicated components.

| Component | Technology | Role | Operational Mode |
| :--- | :--- | :--- | :--- |
| **API/Web** | Node.js + Express.js | Handles core API routes (Auth, Catalog, Delivery). | Low-Latency |
| **Database** | MongoDB | Primary data store for users, catalog, and media metadata. | Persistence |
| **File Storage** | **MinIO (S3 compatible)** | Object storage for raw media, HLS segments, and preview assets. | High-Availability |
| **Queueing** | Redis + **BullMQ** | Reliable message broker for asynchronous processing. | Resilience |
| **Processing** | BullMQ Workers + **FFmpeg** | Handles video transcoding, thumbnail generation, and file cleanup. | High-Compute |
| **Auth** | JWT (Access + Refresh) | Secure session management, supporting token rotation. | Security |

---

## 🚀 Deployment & Services

The system requires dedicated processes for workers and scheduled tasks to maintain stability and prevent blocking the main API thread.

### 1. Core API Endpoints

Handles user authentication, content metadata access, and the initiation of secure delivery flows.

| Module | Purpose | Protected Routes Example |
| :--- | :--- | :--- |
| **Auth** | User registration, login, token refresh, and profile management. | `GET /auth/profile` |
| **Catalog** | Content management (Titles, Episodes). | `POST /catalog/title` (Admin Role Required) |
| **Billing** | Manages Stripe customer records and checkout sessions. | `POST /api/billing/create-checkout-session` |

### 2. Dedicated Background Workers

These processes must be run continuously and independently of the main API server (e.g., via PM2, Kubernetes, or ECS).

| Script | Purpose | Concurrency Model | Execution Command |
| :--- | :--- | :--- | :--- |
| **`webhookWorker.ts`** | Real-time processing of **Stripe webhook events** (low latency, high volume). | **High** (I/O Bound) | `pm2 start scripts/webhookWorker.ts` |
| **`media-worker.ts`** | Asynchronous processing of media files (FFmpeg, HLS, VTT). | **Low** (CPU Bound) | `pm2 start scripts/media-worker.ts` |

### 3. Scheduled Reliability Jobs

These are critical maintenance and integrity checks scheduled during off-peak hours.

| Script | Purpose | Schedule | Risk Mitigation |
| :--- | :--- | :--- | :--- |
| **`reconciliation.ts`** | **Data Integrity Check** for all Stripe subscriptions against local DB. | Daily Cron (e.g., 02:00 AM) | Guards against missed webhooks; optimized for rate limits. |
| **`failedJobs.ts`** | **System Health Monitoring** of the BullMQ dead-letter queue. | Hourly Cron | Alerts developers to permanently failed jobs requiring manual fix. |

---

## 🚚 Secure Media Delivery Layer

This module implements production-grade security for streaming media, ensuring assets in MinIO are never directly exposed.

### A. Media Ingestion Pipeline

The flow is event-driven, triggered by the client-side completion of a direct upload to MinIO.

1.  **Presign:** Client requests a signed `PUT` URL from `/media/presign`, which also creates the **Media** and **DeliveryPolicy** records.
2.  **Upload:** Client uses the signed URL to upload the raw file directly to MinIO.
3.  **Complete:** Client notifies the server via `/media/:id/complete`, which enqueues the processing job in BullMQ.
4.  **Process:** The worker downloads the file, runs **FFprobe** for metadata, converts to **HLS**, generates **Thumbnails/Sprites/VTT**, and uploads the outputs back to MinIO.

### B. Streaming Access Control

The delivery route validates access rules and provides secure streaming tokens, abstracting the origin URL.

| Access Mode | Validation Mechanism | Security Benefit |
| :--- | :--- | :--- |
| **CDN + Signed Cookie** | Delivery route sets an HMAC-signed cookie; CDN validates cookie against user session. | **Industry Standard.** Protects the MinIO origin URL and leverages global CDN caching. |
| **Direct Presigned URL**| Delivery route returns a time-limited **Presigned GET URL** to the asset in MinIO. | Used for non-browser clients (e.g., mobile) or testing. |

### C. Delivery Policy Enforcement

Access is controlled by the **DeliveryPolicy** model, which is checked by the `/delivery/media/:id/url` route:

* **Regional/IP Filtering:** Restricts access based on user location.
* **Embargo Dates:** Prevents streaming before a specified release date.
* **Variant Selection:** Chooses the correct HLS stream (e.g., watermarked or specific bitrate) based on policy.

---

## 💰 Billing & Data Integrity

The billing system utilizes Stripe's webhooks for real-time state synchronization, backed by dedicated reliability layers.

### Webhook Event Handling

All Stripe events (`checkout.session.completed`, `invoice.payment_succeeded`, etc.) are received by the webhook endpoint, verified, and immediately pushed to the **`webhookQueue`** for asynchronous processing by the `webhookWorker`.

### Reconciliation Protocol

The daily execution of **`reconciliation.ts`** ensures that critical statuses are corrected automatically.

1.  **Stripe-to-Local Check:** Confirms all active Stripe subscriptions exist locally.
2.  **Status Correction:** Auto-fixes any status drift (e.g., `active` locally vs. `canceled` on Stripe), making Stripe the ultimate source of truth.

---

## 🛠️ Quick Start

### Prerequisites

* Node.js (>= 18)
* Docker Compose (for MongoDB, MinIO, Redis)
* Stripe CLI for local webhook forwarding

### Deployment Commands (Example)

```bash
# 1. Start Docker services (DB, Storage, Queue)
docker compose up -d

# 2. Start the main API server
npm run dev

# 3. Start the worker processes (separate terminals/services)
pm2 start scripts/webhookWorker.ts
pm2 start scripts/media-worker.ts

# 4. Seed plans (optional)
curl -X POST http://localhost:4242/api/billing/seed-plan \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_xxx"}'

# 5. Forward webhooks locally (REQUIRED for testing billing)
stripe listen --forward-to localhost:4242/api/billing/webhook