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
- **Database**: SQLite

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
npm install
```

**Start Command**:
```bash
npx prisma db push && node index.js 5000
```

**Port**: Railway automatically assigns a port via `PORT` environment variable

#### Backend Environment Variables

Add the following environment variables in Railway:

- `JWT_SECRET`: A secure random string for JWT token signing (generate with: `openssl rand -base64 32`)
- `DATABASE_URL`: The url for the database
- `PORT`: Railway sets this automatically, but you can reference it in your code
- `FRONTEND_URL`: The url for your frontend website

The next five variables come directly from the emailJS Service which we used for sending mails,
- `EMAILJS_SERVICE_ID`: <EMAILJS_SERVICE_ID>
- `EMAILJS_PRIVATE_KEY`: <EMAILJS_PRIVATE_KEY>
- `EMAILJS_PUBLIC_KEY`: <EMAILJS_PUBLIC_KEY>
- `EMAILJS_TEMPLATE_ID`: <EMAILJS_TEMPLATE_ID>
- `EMAILJS_WELCOME_TEMPLATE_ID`: <EMAILJS_WELCOME_TEMPLATE_ID>

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
npx serve -s dist
```

**Port**: Railway automatically assigns a port via `PORT` environment variable

#### Frontend Environment Variables

Add the following environment variable:

- `VITE_API_URL`: The URL of your backend service (e.g., `https://your-backend-service.railway.app`)
  - You can find this in Railway after the backend service is deployed
  - Railway provides a public URL for each service

#### **Verify Deployment**:
   - Check backend health: Visit `https://your-backend-service.railway.app` (should return API info or 404)
   - Check frontend: Visit `https://your-frontend-service.railway.app`
   - Ensure frontend can connect to backend (check browser console for API errors)

## Environment Variables Summary

### Backend Service
```
JWT_SECRET=<your-secret-key>
DATABASE_URL=<postgresql-connection-string>
PORT=<auto-set-by-railway>
FRONTEND_URL=<FRONTEND_URL>
EMAILJS_SERVICE_ID=<EMAILJS_SERVICE_ID>
EMAILJS_PRIVATE_KEY=<EMAILJS_PRIVATE_KEY>
EMAILJS_PUBLIC_KEY=<EMAILJS_PUBLIC_KEY>
EMAILJS_TEMPLATE_ID=<EMAILJS_TEMPLATE_ID>
EMAILJS_WELCOME_TEMPLATE_ID=<EMAILJS_WELCOME_TEMPLATE_ID>
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

### Frontend Issues

- **API connection errors**: Verify `VITE_API_URL` points to your backend service URL
- **Build failures**: Check that all dependencies are in `package.json`
- **CORS errors**: Ensure backend CORS settings allow your frontend domain

### General Issues

- **Service not starting**: Check Railway logs in the dashboard
- **Environment variables not working**: Ensure variables are set in Railway service settings, not just in code

## Local Development

For local development:

1. **Backend**:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma db push
   node prisma/seed.js
   # Set variables in .env file
   node index.js 5000
   ```

2. **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Additional Notes

- Railway automatically handles HTTPS/SSL certificates
- Consider setting up monitoring and alerts in Railway dashboard
- For production, enable Railway's auto-deploy from main branch
- Keep environment variables secure and never commit them to version control

