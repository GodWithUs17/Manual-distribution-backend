# Manual Distribution Backend

This backend powers the manual sales, payment verification, receipt generation, admin workflows, and staff collection process for the LAUTECH distribution platform.

It is built with Node.js, Express, Prisma, and PostgreSQL, and integrates with Paystack for payment processing, Resend for email delivery, and Cloudinary for image uploads.

## Overview

The service provides the following core capabilities:

- user authentication and role-based access control
- manual catalog management for admins
- public manual browsing and purchase flow
- Paystack payment initialization and verification
- webhook-based payment confirmation
- Digital receipt generation and email delivery
- staff collection and record tracking
- admin dashboards for manual and staff management

## Tech Stack

- Node.js 22+
- Express.js
- Prisma ORM
- PostgreSQL
- Paystack
- Resend
- Cloudinary
- JWT-based authentication

## Project Structure

```text
manual-distribution-backend/
├── prisma/
│   ├── schema.prisma
│   ├── seed.js
│   └── migrations/
├── src/
│   ├── app.js
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   ├── assets/
│   └── uploads/
├── .env.example
├── .gitignore
├── cloudinaryConfig.js
├── package.json
├── server.js
├── README.md
└── uploads/
```

## Requirements

Before running the project, ensure you have:

- Node.js 20 or later
- PostgreSQL database running
- valid environment variables configured in a local `.env` file
- access to Paystack secret keys and optional email provider credentials

## Environment Configuration

Create a local environment file based on your project template:

```bash
cp .env.example .env
```

Then populate the file with the required values, including:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `PAYSTACK_SECRET_KEY`
- `FRONTEND_URL`
- `BASE_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `RESEND_API_KEY`
- `PORT` (optional)

## Database Setup

Generate the Prisma client:

```bash
npx prisma generate
```

Run the database migrations:

```bash
npx prisma migrate deploy
```

For local development, you may also initialize data using:

```bash
node prisma/seed.js
```

## Local Development

Install dependencies:

```bash
npm install
```

Start the app in development mode:

```bash
npm run dev
```

The backend is served on:

```text
http://localhost:5000
```

## Production Start

```bash
npm start
```

## Main API Groups

- `/` — API status message
- `/health` — health check endpoint
- `/api/auth` — authentication, password reset, and account access
- `/api/manuals` — public and admin manual operations
- `/api/purchases` — payment initialization, verification, webhooks, receipts, and student history
- `/api/admin` — admin and staff management

## Authentication and Authorization

Protected routes use JWT-based authentication and role checks. The application distinguishes between:

- public browsing and purchase flows
- staff/admin-only protected operations

This separation ensures that public students can browse and pay for manuals while privileged routes remain guarded.

## Payment Flow

The payment system supports the following process:

1. client submits manual purchase details
2. backend creates a pending purchase record
3. Paystack initializes the transaction
4. student completes the payment on Paystack
5. Paystack webhook and verification endpoints confirm the transaction
6. the system marks the purchase as paid
7. a receipt PDF is generated and emailed

## Receipt and Email Workflow

After successful payment, the backend generates a receipt document and sends it by email with the student’s payment details and QR verification information.

This process is designed to be transactional and reliable, with duplicate-payment protection and webhook idempotency checks.

## Security Guidelines

To keep the platform production-safe:

- never commit `.env` files
- rotate API and secret keys regularly
- use HTTPS in production
- validate all incoming payloads
- keep JWT secrets separate from payment secrets
- protect all admin/staff endpoints with proper authorization
- ensure webhook signatures are verified before processing

## Scripts

```bash
npm install
npm run dev
npm run start
```

## Operational Notes

- the platform expects the frontend to send valid JWT tokens for protected requests
- admin inventory may be configured from the dashboard
- stock availability is enforced on the backend to prevent overselling
- webhook processing should always be validated and treated as idempotent-safe

## Contributing

Contributions should be made with careful attention to security, DB integrity, route protection, and app stability. Any change involving payment processing, authentication, or webhook handling should be tested thoroughly before deployment.
