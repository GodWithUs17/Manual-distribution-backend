# LAUTECH Manual Distribution Backend

A production-oriented REST API powering a digital manual purchasing and collection platform for the **Ladoke Akintola University of Technology (LAUTECH)**.

The system replaces a manual lecturer → course representative → student distribution workflow with a centralized platform for **manual management, student purchases, online payments, digital receipts, QR verification, staff collection, and administrative operations**.

> **Flagship project:** Full-stack academic commerce and distribution system built with Node.js, Express, Prisma, PostgreSQL, Flutterwave, Resend, and Cloudinary.

---

## What Problem Does It Solve?

Traditional manual distribution can create problems such as:

* delayed manual collection
* incomplete payment records
* difficulty tracking students who have paid
* manual reconciliation of sales
* missing or duplicated records
* limited visibility for administrators
* difficulty verifying whether a student has already collected a manual

This backend centralizes the workflow and provides a structured digital record of purchases from payment through physical collection.

---

## Core Features

### Student Purchase Flow

* Browse available manuals
* Submit student information
* Validate manual availability
* Initialize online payment
* Verify Paystack transactions
* Track purchase references
* Recover payment references
* Retrieve digital receipts

### Payment Processing

* Paystack payment initialization
* Transaction verification
* Paystack webhook handling
* Purchase status tracking
* Payment reference generation
* Duplicate pending-purchase cleanup
* Payment-to-purchase record association

### Digital Receipts

After successful payment, the system can:

* generate a PDF receipt
* generate a QR verification token
* associate the receipt with the purchase
* deliver the receipt by email

### QR Verification & Collection

Staff can verify a student's purchase and record the physical collection of the manual.

The collection workflow records:

* purchase
* collection status
* collection timestamp
* staff member responsible for collection

### Manual Management

Authorized administrators can:

* create manuals
* update manual information
* upload manual images
* activate/deactivate manuals
* manage stock
* restock manuals
* delete manuals

### Staff & Administration

The system supports role-based access for:

* `super_admin`
* `admin`
* `staff`

Administrative capabilities include staff management, purchase records, and operational reporting.

---

## Architecture

```text
Student / Staff / Admin
          │
          ▼
      React Frontend
          │
          ▼
    REST API (Express)
          │
     ┌────┴─────┐
     ▼          ▼
   Prisma    External APIs
     │        ├─ Paystack
     │        ├─ Resend
     │        └─ Cloudinary
     ▼
 PostgreSQL
```

The backend follows a layered Express architecture:

```text
Request
   ↓
Express Middleware
   ↓
Routes
   ↓
Controllers
   ↓
Prisma ORM
   ↓
PostgreSQL
```

---

## Tech Stack

| Technology | Purpose                   |
| ---------- | ------------------------- |
| Node.js    | JavaScript runtime        |
| Express.js | REST API framework        |
| Prisma     | ORM and database access   |
| PostgreSQL | Relational database       |
| Paystack   | Online payment processing |
| Resend     | Transactional email       |
| Cloudinary | Image storage             |
| JWT        | Authentication            |
| Multer     | File uploads              |
| PDFKit     | PDF receipt generation    |
| QRCode     | QR token generation       |
| ExcelJS    | Purchase data export      |

---

## Project Structure

```text
manual-distribution-backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.js
│
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   ├── assets/
│   └── app.js
│
├── cloudinaryConfig.js
├── prisma.config.ts
├── server.js
├── package.json
├── API.md
├── ARCHITECTURE.md
├── .env.example
├── .gitignore
└── README.md
```

---

## API Modules

| Module           | Responsibility                               |
| ---------------- | -------------------------------------------- |
| `/api/auth`      | Authentication and password recovery         |
| `/api/manuals`   | Manual catalog and inventory management      |
| `/api/purchases` | Purchases, payments, receipts and collection |
| `/api/admin`     | Staff and administrative operations          |

See [`API.md`](./API.md) for the endpoint reference.

---

## Authentication & Authorization

Protected operations use JWT authentication and role-based authorization.

The API separates:

* public student operations
* authenticated staff operations
* administrator operations
* super administrator operations

This allows students to complete the purchase process without exposing privileged management functionality.

---

## Payment Flow

```text
Student selects manual
        ↓
Purchase initialized
        ↓
Pending purchase created
        ↓
Paystack checkout
        ↓
Payment completed
        ↓
Webhook / verification
        ↓
Purchase marked as paid
        ↓
QR token generated
        ↓
PDF receipt generated
        ↓
Receipt delivered by email
        ↓
Student presents QR/reference
        ↓
Staff verifies purchase
        ↓
Manual marked as collected
```

---

## Database Model

The core database entities are:

```text
User
 │
 └── Purchase

Manual
 │
 └── Purchase
```

A purchase stores the student's information, selected manual, payment information, collection status, QR token, and staff collection record.

---

## Local Development

### Requirements

* Node.js 20+
* PostgreSQL
* Paystack account/API credentials
* Cloudinary account/API credentials
* Resend account/API credentials

### Installation

```bash
npm install
```

Create your environment file:

```bash
cp .env.example .env
```

Configure the required environment variables.

Generate Prisma Client:

```bash
npx prisma generate
```

Run database migrations:

```bash
npx prisma migrate deploy
```

Start development:

```bash
npm run dev
```

The API will run on:

```text
http://localhost:5000
```

---

## Environment Variables

The application uses environment variables for credentials and deployment configuration.

Typical configuration includes:

```text
PORT
BASE_URL
FRONTEND_URL
DATABASE_URL
DIRECT_URL
JWT_SECRET
PAYSTACK_SECRET_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
RESEND_API_KEY
SEED_ADMIN_EMAIL
SEED_ADMIN_PASSWORD
```

**Never commit real credentials or `.env` files to GitHub.**

---

## Available Scripts

```bash
npm run dev
npm start
```

---

## Related Frontend

The backend is designed to work with the companion React frontend.

**Frontend repository:** `Manual-distribution-frontend`

---

## Engineering Highlights

This project demonstrates practical full-stack engineering beyond a simple CRUD application:

* REST API design
* relational database modeling
* Prisma ORM
* JWT authentication
* role-based authorization
* payment gateway integration
* webhook processing
* transactional purchase workflows
* PDF generation
* QR-based verification
* cloud image storage
* transactional email
* inventory management
* staff collection tracking
* administrative reporting

---

## Project Status

This repository is actively being refined with a focus on:

* maintainable architecture
* reliable payment processing
* secure authentication
* database integrity
* production deployment practices
* clear API documentation
* automated testing

---

## Author

**Oguntoke Emmanuel Omotayo**

Full-Stack Web Developer

I build web applications that solve real operational problems — from business websites and booking systems to custom platforms with payments, dashboards, databases, and automation.
