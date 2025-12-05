# CSSU Rewards

Final Project Group # 63

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Production Deployment (Railway)](#production-deployment-railway)
- [URLs](#urls)
- [Demo Database](#demo-database)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Security Measures](#security-measures)
- [Advanced Features](#advanced-features)
  - [QR Code Integration](#1-qr-code-integration)
  - [PDF Export](#2-pdf-export)
  - [Analytics Engine](#3-analytics-engine)
  - [Email Notifications](#4-email-notifications)
  - [Advanced Filtering & Sorting](#5-advanced-filtering--sorting)

---

## Prerequisites

- Node.js (v18 or higher)
- npm

---

## Local Development

### 1. Clone the Repository

```bash
git clone https://github.com/Yatin-Malhotra/309-final-project.git
cd 309-final-project
```

### 2. Start Backend

#### Commands

```bash
cd backend
npm install
npx prisma generate
npx prisma db push
node prisma/seed.js
node index.js 5000
```

#### Backend Environment Variables

1. Create a .env file in the backend folder and add the following variables

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | `146ff9d90105efa2c2e50cb00d929d10` (or any other 32-bit random number) |
| `DATABASE_URL` | `file:./dev.db` |

By default, instead of mailing in development we simply console.log the mails that would have been mailed but if you need mail functionality in development mode, add the following variables with their values from the emailJS service.

- `EMAILJS_SERVICE_ID`: <EMAILJS_SERVICE_ID>
- `EMAILJS_PRIVATE_KEY`: <EMAILJS_PRIVATE_KEY>
- `EMAILJS_PUBLIC_KEY`: <EMAILJS_PUBLIC_KEY>
- `EMAILJS_TEMPLATE_ID`: <EMAILJS_TEMPLATE_ID>
- `EMAILJS_WELCOME_TEMPLATE_ID`: <EMAILJS_WELCOME_TEMPLATE_ID>

### 3. Start Frontend

#### Commands

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

#### Frontend Environment Variables

None needed, defaults are configured

---

## Production Deployment (Railway)

See `INSTALL.md` for detailed Railway deployment instructions.

### Backend Service

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npx prisma db push && node index.js 5000` |

#### Backend Environment Variables (Prod)

Add the following environment variables in Railway:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | `146ff9d90105efa2c2e50cb00d929d10` (or any other 32-bit random number) |
| `FRONTEND_URL` | `https://frontend-production-083a.up.railway.app` |
| `DATABASE_URL` | `file:./dev.db` |

The next five variables come directly from the emailJS service which we used for sending mails:

- `EMAILJS_SERVICE_ID`: <EMAILJS_SERVICE_ID>
- `EMAILJS_PRIVATE_KEY`: <EMAILJS_PRIVATE_KEY>
- `EMAILJS_PUBLIC_KEY`: <EMAILJS_PUBLIC_KEY>
- `EMAILJS_TEMPLATE_ID`: <EMAILJS_TEMPLATE_ID>
- `EMAILJS_WELCOME_TEMPLATE_ID`: <EMAILJS_WELCOME_TEMPLATE_ID>

### Frontend Service

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Build Command | `npm install && npm run build` |
| Start Command | `npx serve -s dist` |

#### Frontend Environment Variables (Prod)

| Variable | Value |
|---------|-------|
| `VITE_BACKEND_URL` | `https://backend-production-ae98.up.railway.app` |

---

## URLs

### Local Development

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |

### Production (Railway)

| Service | URL |
|---------|-----|
| Frontend | https://frontend-production-083a.up.railway.app |
| Backend API | https://backend-production-ae98.up.railway.app |

---

## Demo Database

### Accounts (Not all accounts shown for readability purposes)

The seeded database includes the following demo accounts (all use password: `password`):

| Role | UTORid | Email | Points |
|------|--------|-------|--------|
| Superuser | super01 | super.admin@mail.utoronto.ca | 1000 |
| Manager | manager1 | manager.one@mail.utoronto.ca | 500 |
| Cashier | cashier1 | cashier.one@mail.utoronto.ca | 200 |
| Regular | user001 | krit.grover@mail.utoronto.ca | 350 |
| Regular | user002 | gursimar.singh@mail.utoronto.ca | 150 |
| Regular | user003 | yatin.malhotra@mail.utoronto.ca | 750 |
| Regular | user004 | diana.prince@mail.utoronto.ca | 50 |
| Regular | user005 | eve.wilson@mail.utoronto.ca | 600 |

### Sample Events (Not all events shown for readability purposes)

| Event Name | Location | Capacity | Published |
|------------|----------|----------|-----------|
| CSSU Annual Hackathon | Bahen Centre, Room 1200 | 100 | Yes |
| CSSU Game Night | CSSU Office, Sandford Fleming Building | 30 | Yes |
| Workshop: Building REST APIs | Bahen Centre, Room 2175 | 40 | No |
| CSSU Career Fair | Myhal Centre, Room 150 | 150 | Yes |
| Database Design Seminar | Sanford Fleming Building, Room 2101 | 35 | No |

### Sample Promotions (Not all promotions shown for readability purposes)

| Name | Type | Min Spending | Bonus Points/Rate |
|------|------|--------------|-------------------|
| Double Points Weekend | Automatic | N/A | 0.02 rate |
| New Member Bonus | One-time | $10.00 | 100 points |
| Holiday Special | One-time | $50.00 | 50 points |
| Flash Sale Points | Automatic | N/A | 0.03 rate |
| Big Spender Reward | One-time | $100.00 | 200 points |

---

## Architecture

### System Architecture

This document provides a high-level overview of the CSSU Rewards System architecture, detailing the interaction between the frontend client, backend API, and database layer.

#### 1. High-Level Overview

The application follows a traditional **Client-Server architecture** separated into two distinct directories within a monorepo structure:

- **Frontend (`/frontend`):** A Single Page Application (SPA) built with React and Vite.
- **Backend (`/backend`):** A RESTful API built with Node.js and Express.
- **Database:** Relational data storage managed via Prisma ORM (SQLite for development).

#### 2. Frontend Architecture

The client-side is designed for responsiveness and interactivity, managing its own state and routing.

**Core Technologies**

- **Framework:** React 18
- **Build Tool:** Vite (for fast HMR and optimized builds)
- **Routing:** `react-router-dom` v6
- **HTTP Client:** Axios

**Key Components**

- **Context API:** Global state management is handled via React Context.
  - `AuthContext`: Manages user session, login/logout logic, and token persistence.
  - `ThemeContext`: Manages UI theming (Light/Dark modes).
- **Service Layer (`src/services/api.js`):**
  - Centralizes all HTTP requests.
  - Uses **Axios Interceptors** to automatically attach the JWT Bearer token to outgoing requests and handle 401 Unauthorized responses (auto-logout).
- **Protected Routes:** A Higher-Order Component (`ProtectedRoute.jsx`) wraps authenticated pages to enforce login requirements and Role-Based Access Control (RBAC) before rendering.
- **Custom Hooks:** Encapsulates complex logic, such as `useTableSort` for client-side data sorting and `useAnimatedNumber` for visual effects.

#### 3. Backend Architecture

The server-side implements a layered MVC-style architecture (Model-View-Controller, though "View" is JSON responses).

**Core Technologies**

- **Runtime:** Node.js
- **Framework:** Express.js
- **ORM:** Prisma Client
- **Validation:** Zod

**Structural Layers**

1. **Entry Point (`index.js`):** Initializes the Express app, applies global middleware (CORS, JSON parsing), and mounts route groups.
2. **Routes (`/routes`):** Defines API endpoints segregated by domain (`auth`, `users`, `transactions`, `events`, `analytics`).
3. **Middleware (`/middleware/index.js`):** A centralized hub for cross-cutting concerns:
   - `authenticate`: Verifies JWT tokens.
   - `requireRole`: Enforces RBAC (hierarchy: Regular < Cashier < Manager < Superuser).
   - `validate`: Generic middleware that accepts a Zod schema to validate request bodies/queries before reaching the handler.
   - `upload`: Multer configuration for handling file uploads (User Avatars).
4. **Utilities:**
   - `emailUtils`: Abstraction layer for EmailJS integration.
   - `jwtUtils`: Handles token generation and verification.

#### 4. Database Design

The system uses a relational database schema defined in `schema.prisma`.

**Key Models**

- **User:** Stores credentials, profile data, and role. Relations to Transactions (as creator, subject, or processor).
- **Transaction:** The central ledger entity.
  - **Types:** Purchase, Redemption, Adjustment, Event, Transfer.
  - **Audit Trail:** Tracks `userId` (customer), `createdBy` (cashier), and `processedBy` (for redemptions).
- **Event:** Manages gatherings with capacity limits and point allocations.
- **Promotion:** Dynamic rules (Automatic or One-time) for bonus point calculations.
- **SavedFilter:** Stores JSON configurations for user-customized views.

#### 5. Security Architecture

Security is enforced at multiple levels of the stack.

- **Authentication:**
  - Stateless **JWT (JSON Web Token)** authentication.
  - Tokens are signed with a server-side secret and expire every 24 hours.
- **Authorization:**
  - **Hierarchical RBAC:** Roles are treated as levels (0-3). A "Manager" (Level 2) implicitly has permissions of "Cashier" (Level 1).
- **Input Validation:**
  - Strict schema validation using **Zod** ensures that invalid or malicious data structures (e.g., negative transaction amounts, malformed emails) are rejected before reaching the database.
- **Password Security:**
  - Passwords are hashed (implied via `bcrypt` in dependencies) before storage.

#### 6. Testing Strategy

The project utilizes modern testing frameworks for reliability.

- **Frontend:** `Vitest` and `React Testing Library` for component and unit testing.
- **Backend:** `Jest` and `Supertest` for integration testing of API endpoints against a test database.
- **CI/CD:** GitHub Actions workflows (`frontend-tests.yml`, `backend-tests.yml`) automate these tests on every push.

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS, React Router |
| Backend | Node.js, Express.js |
| Database | SQLite with Prisma ORM |
| Auth | JWT (JSON Web Tokens), bcrypt |
| Security | httpOnly Cookies, Restrictive CORS, Zod Validation, Mime Check|

---

## Security Measures

1. Mime Check in Multer to ensure only correct file types are allowed, prevents spoofing.
2. JWT is stored in httpOnly cookies to prevent the risk of XSS and CSRF.
    ````js
    res.cookie('token', token, {
        httpOnly: true,    // Prevents XSS (JS cannot read the cookie)
        secure: true,      // Cookie only sent over HTTPS
        sameSite: 'strict' // Blocks the cookie on cross-site requests (Prevents CSRF)
    });
    ````
3. CORS is configured to only allow FRONTEND_URL. Requests without an origin have been allowed to allow Avatar uploads.

## Advanced Features

This section outlines the technical implementation and functionality of the advanced features in the CSSU Rewards System, including QR Code integration, PDF Export, Analytics, Email Notifications, and the Filtering/Sorting engine.

### 1. QR Code Integration

The system utilizes QR codes to streamline user identification and transaction processing, minimizing manual entry errors.

**Implementation Details**

- **Library:** `qrcode.react` (Frontend)
- **Component:** `QRCodeModal.jsx`
- **Data Encoded:** The QR code encodes the user's unique **UTORid**.

**Functionality**

1. **Generation:** When a user opens the "My QR Code" modal, the system dynamically generates a QR SVG based on their logged-in UTORid.
2. **Usage:**
   - **User Side:** Displays a high-contrast QR code suitable for scanning.
   - **Cashier Side:** (Inferred from dependencies) Cashiers can scan these codes using `html5-qrcode` to instantly populate the user field during transaction creation, speeding up the checkout/redemption process.

### 2. PDF Export

Users and managers can export transaction histories into a formatted PDF document for record-keeping or auditing purposes.

**Implementation Details**

- **Libraries:** `jspdf` (Core PDF generation), `jspdf-autotable` (Table layout).
- **File:** `frontend/src/pages/Transactions.jsx`

**Logic Flow**

1. **Data Gathering:**
   - The system checks if client-side filters are active.
   - If filters are active, it uses the currently visible dataset.
   - If server-side pagination is active, the system automatically fetches **all** pages of data matching the current criteria in batches (up to the backend limit) to ensure the PDF contains the complete history, not just the current page.
2. **Formatting:** Data is mapped to a table structure suitable for PDF, including columns for ID, User (if applicable), Type, Amount, Date, and Status.
3. **Metadata:** The PDF includes generation metadata:
   - Title: "CSSU Rewards Transaction History"
   - Generated By: User's UTORid.
   - Timestamp.
   - **Active Filters:** A summary of filters applied at the time of export (e.g., "Type: Purchase", "Status: Processed") is printed at the top of the document.
4. **Styling:** Uses a custom color scheme (Blue/Grey headers) to match the application theme.

### 3. Analytics Engine

The system features a robust analytics backend that aggregates data to provide actionable insights for Cashiers and Managers.

**Implementation Details**

- **Backend:** `backend/routes/analytics.js`
- **Database:** Complex `Prisma` aggregations and groupings.

**Metrics by Role**

**Manager (System Overview)**

- **Points Economics:** Tracks total points in circulation, points earned vs. spent (burn rate), and net flow over specific periods (week/month).
- **Growth:** Visualizes new user registrations and verifies user ratios.
- **Financials:** Calculates total money spent (real currency), average transaction value, and the "Points per Dollar" ratio to monitor reward economy inflation.
- **Event & Promotion:** Detailed stats on event attendance rates and promotion usage frequency to gauge engagement.

**Cashier (Performance)**

- **Personal Stats:** Tracks transactions and redemptions processed specifically by the logged-in cashier.
- **Efficiency:** Calculates a "Processing Rate" (percentage of assigned redemptions completed).
- **Daily Volume:** A 7-day rolling window of transaction counts to visualize workload trends.

### 4. Email Notifications

The system integrates with EmailJS to handle transactional email delivery, specifically for account security.

**Implementation Details**

- **Library:** `@emailjs/nodejs` (Backend integration)
- **Context:** Used primarily in the **Password Reset** flow (`ResetPassword.jsx` and backend auth routes).

**Functionality**

- **Password Reset:** When a user requests a password reset, the backend generates a secure token. This token is likely sent via EmailJS to the user's registered email address, containing a link to the reset page. This offloads the complexity of SMTP server management to a dedicated service.

### 5. Advanced Filtering & Sorting

The application implements a hybrid filtering and sorting strategy to handle large datasets efficiently while maintaining a responsive user experience.

**Sorting (`useTableSort.js`)**

A custom React hook provides a reusable sorting logic capable of handling:

- **Data Types:** Automatically detects and sorts Numbers, Strings, and Dates.
- **Nested Data:** Specific accessors allow sorting by nested properties (e.g., sorting transactions by `user.utorid`).
- **Direction:** Toggles between Ascending and Descending orders.

**Filtering System (`Transactions.jsx` & `savedFilters.js`)**

1. **Server-Side Filtering:**
   - Primary filters (Transaction Type, Processed Status) are passed to the API to reduce data transfer.
2. **Client-Side Filtering:**
   - Search functionality (by ID or UTORid) filters the loaded dataset instantly for immediate feedback.
3. **Saved Filters:**
   - **Persistence:** Users can save complex combinations of filters (e.g., "Pending Redemptions for User X").
   - **Backend Storage:** These configurations are serialized and stored in the database (`SavedFilter` model), allowing users to retrieve their commonly used views across sessions.
