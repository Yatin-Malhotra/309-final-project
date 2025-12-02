# Installation and Deployment Guide

This document provides step-by-step instructions for deploying the CSSU Rewards System on Railway.

## Prerequisites

- A Railway account (sign up at [railway.app](https://railway.app))
- Git repository access to this project
- Node.js 18+ (for local testing, Railway handles this automatically)

## Project Structure

This is a full-stack application with:
- **Backend**: Node.js/Express API server (located in `/backend`)
- **Frontend**: React application built with Vite (located in `/frontend`)
- **Database**: SQLite (development) / PostgreSQL (production recommended)

## Deployment Steps

### 1. Create Railway Project

1. Log in to your Railway account
2. Click "New Project"
3. Select "Deploy from GitHub repo" (or "Empty Project" if deploying manually)
4. Connect your repository and select this project

### 2. Set Up Backend Service

1. In your Railway project, click "New" → "Service"
2. Select "GitHub Repo" and choose your repository
3. Railway will auto-detect the service. Configure it as follows:

#### Backend Configuration

**Root Directory**: `backend`

**Build Command**:
```bash
npm install && npx prisma generate
```

**Start Command**:
```bash
npx prisma db push && node index.js
```

**Port**: Railway automatically assigns a port via `PORT` environment variable

#### Backend Environment Variables

Add the following environment variables in Railway:

- `JWT_SECRET`: A secure random string for JWT token signing (generate with: `openssl rand -base64 32`)
- `DATABASE_URL`: For PostgreSQL: `postgresql://user:password@host:port/database` (Railway provides this if you add a PostgreSQL service)
  - **Note**: For production, it's recommended to use PostgreSQL instead of SQLite. Railway provides managed PostgreSQL databases.
- `PORT`: Railway sets this automatically, but you can reference it in your code
- `NODE_ENV`: Set to `production`

#### Optional: Add PostgreSQL Database

1. In Railway project, click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically create a `DATABASE_URL` environment variable
3. Update your backend service to use this `DATABASE_URL`

**Important**: If using PostgreSQL, you'll need to update `prisma/schema.prisma`:
- Change `provider = "sqlite"` to `provider = "postgresql"`
- Run migrations: `npx prisma migrate deploy` (add this to build/start commands)

### 3. Set Up Frontend Service

1. In your Railway project, click "New" → "Service"
2. Select "GitHub Repo" and choose your repository
3. Configure it as follows:

#### Frontend Configuration

**Root Directory**: `frontend`

**Build Command**:
```bash
npm install && npm run build
```

**Start Command**:
```bash
npm run preview
```

**Port**: Railway automatically assigns a port via `PORT` environment variable

#### Frontend Environment Variables

Add the following environment variable:

- `VITE_API_URL`: The URL of your backend service (e.g., `https://your-backend-service.railway.app`)
  - You can find this in Railway after the backend service is deployed
  - Railway provides a public URL for each service

### 4. Database Setup (PostgreSQL)

If you're using PostgreSQL (recommended for production):

1. After adding the PostgreSQL database, Railway provides a `DATABASE_URL`
2. In your backend service, add a build step to run migrations:
   - Update build command to: `npm install && npx prisma generate && npx prisma migrate deploy`
3. Or add a one-time setup script in the start command

### 5. Database Setup (SQLite - Not Recommended)

If you must use SQLite (not recommended for Railway):
- SQLite files are ephemeral on Railway and will be lost on redeploy
- Consider using Railway's volume feature to persist the database file
- Add volume mount in Railway service settings

### 6. Post-Deployment Setup

After both services are deployed:

1. **Create Superuser** (if needed):
   - Connect to your backend service via Railway's shell/CLI
   - Run: `npm run createsuperuser`
   - Follow prompts to create an admin account

2. **Seed Database** (optional):
   - In Railway shell: `npm run seed`
   - This populates the database with initial data

3. **Verify Deployment**:
   - Check backend health: Visit `https://your-backend-service.railway.app` (should return API info or 404)
   - Check frontend: Visit `https://your-frontend-service.railway.app`
   - Ensure frontend can connect to backend (check browser console for API errors)

### 7. Custom Domains (Optional)

1. In Railway, go to your service settings
2. Click "Settings" → "Networking"
3. Add a custom domain or use Railway's provided domain

## Environment Variables Summary

### Backend Service
```
JWT_SECRET=<your-secret-key>
DATABASE_URL=<postgresql-connection-string>
NODE_ENV=production
PORT=<auto-set-by-railway>
```

### Frontend Service
```
VITE_API_URL=https://your-backend-service.railway.app
PORT=<auto-set-by-railway>
```

## Troubleshooting

### Backend Issues

- **Database connection errors**: Verify `DATABASE_URL` is set correctly
- **JWT errors**: Ensure `JWT_SECRET` is set
- **Port errors**: Railway sets `PORT` automatically, ensure your code uses `process.env.PORT`

### Frontend Issues

- **API connection errors**: Verify `VITE_API_URL` points to your backend service URL
- **Build failures**: Check that all dependencies are in `package.json`
- **CORS errors**: Ensure backend CORS settings allow your frontend domain

### General Issues

- **Service not starting**: Check Railway logs in the dashboard
- **Environment variables not working**: Ensure variables are set in Railway service settings, not just in code
- **Database migrations**: Run `npx prisma migrate deploy` in Railway shell if using PostgreSQL

## Local Development

For local development:

1. **Backend**:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma db push
   # Set JWT_SECRET in .env file
   node index.js
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   # Set VITE_API_URL=http://localhost:5000 in .env file
   npm run dev
   ```

## Additional Notes

- Railway automatically handles HTTPS/SSL certificates
- Railway provides persistent storage for PostgreSQL databases
- Consider setting up monitoring and alerts in Railway dashboard
- For production, enable Railway's auto-deploy from main branch
- Keep environment variables secure and never commit them to version control

