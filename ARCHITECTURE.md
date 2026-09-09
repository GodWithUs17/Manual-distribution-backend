# Backend Architecture Overview

This backend is structured as a classic Express service with Prisma as the data access layer and a route/controller separation for business logic.

## Runtime Flow

```text
HTTP Request
   ↓
Express app
   ↓
Route handler
   ↓
Controller logic
   ↓
Prisma client
   ↓
PostgreSQL database
```

## Core Components

### 1. Application Layer

- `server.js` starts the HTTP server and attaches the app.
- `src/app.js` configures Express, middleware, CORS, routes, and error handling.

### 2. Routing Layer

Routes are defined under `src/routes/`:

- `authRoutes.js` — login, forgot/reset password
- `manualRoutes.js` — manual listing and management
- `purchaseRoutes.js` — initialize payments, verify receipts, staff collection
- `adminRoutes.js` — staff and admin controls

### 3. Controller Layer

Controllers under `src/controllers/` contain business logic and database interactions.

- `authController.js` handles login and authentication.
- `adminController.js` handles password reset and staff management.
- `purchaseController.js` handles payment initialization, verification, QR, and receipts.

### 4. Middleware Layer

- `authMiddleware.js` validates JWTs and enforces roles.
- `errorHandler.js` formats unexpected errors into consistent JSON responses.

### 5. Data Layer

- Prisma ORM with schema in `prisma/schema.prisma`
- PostgreSQL database backend
- Migrations under `prisma/migrations/`

### 6. Utility Layer

- `logger.js` for structured JSON logs
- `jwt.js` for token generation
- `mailer.js` for email sending
- `prisma.js` for Prisma client instance

## Request Lifecycle

1. Request enters Express.
2. CORS and rate limiting are applied.
3. Route matching selects the correct controller.
4. Middleware validates auth/role requirements.
5. Controller performs Prisma operations.
6. Response is sent or error handler catches failure.

## Security Boundaries

- Environment variables are required for secrets.
- JWTs are validated on protected routes.
- Paystack webhooks are verified using signatures.
- Passwords are hashed before storage.
- Admin actions require appropriate role authorization.

## Deployment Considerations

- Use a managed PostgreSQL instance.
- Store secret variables in environment managers or hosting secrets store.
- Configure proper `FRONTEND_URL` and `BASE_URL` for payment callbacks and reset emails.
- Enable HTTPS in production.
