# Backend API Reference

This document describes the main endpoints exposed by the backend.

## Base URL

```text
http://localhost:5000
```

## Authentication

Protected endpoints require a bearer token in the `Authorization` header:

```http
Authorization: Bearer <jwt-token>
```

## Public Endpoints

### GET /

Returns basic server status and manual count.

Response:

```json
{
  "message": "Manual Distribution Backend API is running",
  "manualsCount": 12
}
```

### GET /health

Returns a health-check response.

Response:

```text
Server is healthy and awake!
```

### POST /api/auth/login

Login for staff/admin users.

Request body:

```json
{
  "email": "admin@example.com",
  "password": "secret"
}
```

### POST /api/auth/forgot-password

Request a password reset email.

Request body:

```json
{
  "email": "user@example.com"
}
```

### POST /api/auth/reset-password

Reset a user password using a reset token.

Request body:

```json
{
  "token": "reset-token",
  "newPassword": "newStrongPassword"
}
```

## Manual Endpoints

### GET /api/manuals

Returns active/manual catalog data.

## Purchase Endpoints

### POST /api/purchases/initialize

Initialize a purchase and generate Paystack checkout link.

Request body:

```json
{
  "manualId": 3,
  "fullName": "Jane Doe",
  "matricNo": "CPE/2021/0001",
  "department": "Computer Science",
  "level": 300,
  "email": "jane@example.com"
}
```

### POST /api/purchases/verify

Verify a Paystack transaction reference.

Request body:

```json
{
  "reference": "T-ABC123"
}
```

### POST /api/purchases/receipt

Get a receipt payload for a paid purchase.

Request body:

```json
{
  "matricNo": "CPE/2021/0001",
  "reference": "T-ABC123"
}
```

### GET /api/purchases/verify/:reference

Validate a purchase by QR token or transaction reference.

### POST /api/purchases/recover-reference

Recover a reference for an already-paid purchase.

### GET /api/purchases/download-receipt

Download a PDF receipt by matric number and course code.

### POST /api/purchases/paystack-webhook

Paystack webhook endpoint.

## Staff/Admin Endpoints

### POST /api/purchases/collect

Marks a manual as collected by a staff member.

Protected by role access.

### GET /api/purchases/all

Returns all purchases. Requires admin privileges.

### GET /api/purchases/staff-history

Gets staff collection history.

### GET /api/admin/staff

Gets the list of staff/admin accounts.

### POST /api/admin/create-staff

Creates a new staff account. Requires super admin.

### PATCH /api/admin/staff/:userId/disable

Disables a staff user.

### PATCH /api/admin/staff/:userId/enable

Enables a staff user.

### DELETE /api/admin/staff/:userId

Deletes a staff user. Requires super admin.

### GET /api/admin/download-purchases

Exports manual purchase list as Excel.

## Status Codes

- `200` OK
- `201` Created
- `400` Bad Request
- `401` Unauthorized
- `403` Forbidden
- `404` Not Found
- `500` Internal Server Error

## Notes

- All admin/staff endpoints require JWT auth.
- Use production-safe secret values in env variables.
- For payment verification, ensure webhook signature validation is enabled and properly configured.
