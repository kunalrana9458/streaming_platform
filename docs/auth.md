🔐 Auth Module

1. Overview
The Auth module is responsible for:
User registration
Email verification using OTP
Secure login with JWT
Refresh token rotation
Session tracking
Secure logout via token invalidation

This module is designed with security, scalability, and modular architecture in mind.

2. Architecture Structure
auth/
 ├── auth.model.ts
 ├── auth.controller.ts
 ├── auth.service.ts
 ├── auth.routes.ts
 ├── session.model.ts

3. User Schema Design
User Fields
name – User’s full name
email – Unique, indexed email
passwordHash – bcrypt hashed password
role – "user" or "admin"
isEmailVerified – Email verification status
tokenVersion – Used for refresh token invalidation
otp – Object for email verification
createdAt, updatedAt – Auto timestamps
OTP Object
otp: {
  codeHash: string
  expiresAt: Date
  attempts: number
  resendCount: number
}
Design Decisions
Passwords are never stored in plain text.
OTP is hashed before storing.
Email field is indexed for fast lookup.
tokenVersion allows global logout.

4. Authentication Flow
  4.1 Registration Flow
   Validate request body using Zod.
   Check if email already exists.
   Hash password using bcrypt.
   Create user with isEmailVerified = false.
   Generate OTP.
   Hash OTP and store in DB.
   Send OTP via email (future implementation).

  4.2 Email Verification Flow
   Validate email + OTP input.
   Check:
    User exists
    OTP issued
    OTP not expired
    Attempts < max allowed
   Compare hashed OTP.
   Mark isEmailVerified = true.
   Clear OTP object.
  Security protections:
   OTP expiration time
   Maximum attempt limit
   Resend limit
   Hashed OTP storage

  4.3 Login Flow
    Validate email + password.
     Check:
      User exists
      Email verified
      Password matches (bcrypt compare)
     Generate:
      Access Token (short-lived)
      Refresh Token (long-lived)
     Create session entry.
     Return tokens.

  4.4 Token Strategy
    Access Token
    Contains:
    {
    sub: userId
    role: userRole
    email: userEmail
    }
    Short expiry (default 15 minutes)
    Used for API authentication

    Refresh Token
    Contains:
    {
    sub: userId
    tv: tokenVersion
    }
    Longer expiry (default 7 days)
    Used to generate new tokens

   4.5 Refresh Token Rotation
    Refresh token verified using secret.
    tokenVersion is validated.
    New access + refresh tokens generated.
    Prevents reuse of invalidated tokens.

   4.6 Logout Flow
    tokenVersion incremented.
    All previous refresh tokens become invalid.
    Ensures secure global logout.

5. Session Tracking
    On login, a session document is created containing:
    userId
    refreshToken
    deviceInfo
    ipAddress
    userAgent
    lastUsedAt
    expiresAt

    Purpose:
        Track active devices
        Enable audit logging
        Future device-level logout support

6. Input Validation
    All request payloads are validated using Zod before reaching service layer.
    Benefits:
    Prevents malformed input
    Keeps business logic clean
    Improves reliability

7. Security Considerations

    bcrypt password hashing
    JWT secret-based signing
    OTP brute-force protection
    Token version invalidation
    Structured logging for monitoring
    Configurable security via environment variables

8. Environment Variables
    Required environment variables:
        JWT_ACCESS_SECRET
        JWT_REFRESH_SECRET
        ACCESS_TTL
        REFRESH_TTL
        BCRYPT_ROUNDS
        OTP_TTL_MINUTES
        OTP_LENGTH
        OTP_MAX_ATTEMPTS
        OTP_RESEND_LIMIT

9. Scalability Considerations
    Current strengths:
    Stateless JWT authentication
    Token invalidation strategy
    Email indexed lookup
    Clear modular separation
    Future improvements:
    Store hashed refresh tokens
    Move session storage to Redis
    Add rate limiting on login/OTP endpoints
    Integrate external email service