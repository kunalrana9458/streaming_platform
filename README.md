# StreamSphere (Backend) — Scalable OTT Platform (Learning in Progress)

StreamSphere is a backend project developed to learn and demonstrate **real-world scalable backend engineering**, including **authentication**, **object storage**, and future **microservices architecture**.  
This project is being built **step-by-step (Day-wise)** to ensure deep understanding instead of just copy-paste coding.

---

## 📅 Progress Timeline

| Day | Topic | Status | Description |
|-----|------|--------|-------------|
| Day 1 | Base Setup | ✅ Completed | Project setup, TypeScript, Docker, MongoDB, MinIO |
| Day 2 | Authentication System | ✅ Completed | Register, Email OTP Verification, Login, JWT Access + Refresh Tokens |
| Day 3 | Catalog Service | 🔜 Next | Title model + CRUD + Admin control |

---

## 🏗️ Tech Stack (Current)

| Part | Technology |
|------|------------|
| Backend | Node.js + Express.js + TypeScript |
| Database | MongoDB (Docker) |
| File Storage | MinIO (S3 compatible) |
| Auth | JWT (Access + Refresh Tokens) + OTP Email Verification |
| Security | bcrypt password hashing |
| Validation | Zod |
| Runtime Services | Docker Compose |

---

## 📂 Project Structure
streamsphere/
   src/
    modules/
     auth/
      user.model.ts
      auth.service.ts
      auth.controller.ts
      auth.routes.ts
    middleware/
      authMiddleware.ts
    utils/
    config/
    server.ts
docker-compose.yml
package.json
tsconfig.json
README.md


---

# 🚀 Day 1 — Setup Summary

### ✅ Achievements
- Initialized Node + TypeScript project
- Set up Express server
- Configured Docker Compose to run:
  - **MongoDB** (database)
  - **MinIO** (local S3 bucket storage)
- Verified server runs successfully

### Commands Used
```bash
npm init -y
npm install express cors dotenv bcrypt jsonwebtoken mongoose multer
npm install -D typescript ts-node-dev @types/express @types/node @types/bcrypt @types/jsonwebtoken @types/cors
npx tsc --init
npm run dev
Start Docker Services - docker compose up -d
```

# Services Access
MongoDB                mongodb://localhost:27017
MinIO UI               http://localhost:9001
MinIO API Endpoint     http://localhost:9000


# Day 2 - Authentication System

```Features Built```
- User Registration with hashed password
- OTP Email Verification (secure → OTP stored hashed)
- Login only after email verification
- JWT Access Token for protected routes
- JWT Refresh Token for session renewa
- Logout invalidates refresh tokens (tokenVersion rotation)
- Protected route middleware (requireAuth)

```API Endpoints```
Method	 Endpoint	            Auth Required        Purpose
POST	   /auth/register	         ❌                Register user + send OTP
POST	   /auth/verify-otp	       ❌	              Verify OTP and activate user
POST	   /auth/login	           ❌	              Login → Get Access + Refresh token
POST	   /auth/refresh	         ❌	              Renew tokens
GET	     /auth/profile	         ✅	              Fetch user info
POST	   /auth/logout	           ✅ 	              Invalidate refresh session

``` Authentication Flow Diagram ```
User Registration
      ↓
OTP Send to Email
      ↓
Email Verified = true
      ↓
User Logs in -> Access Token + Refresh Token
      ↓
User Access Token for protected route
      ↓
If Access Token expires -> use Refresh Token
      ↓
Logout -> refresh token invalidated (tokenVersion++)