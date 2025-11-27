# CSSU Rewards Frontend

React frontend application for the CSSU Rewards System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (optional, defaults to localhost:5000):
```
VITE_API_URL=http://localhost:5000
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Features

- **Authentication**: Login and password reset functionality
- **Dashboard**: Overview of user points, transactions, and quick actions
- **Profile Management**: Update profile information and change password
- **Transaction Management**: 
  - View all transactions (role-based)
  - Create transactions (cashiers)
  - Process redemptions (cashiers)
  - View personal transaction history
- **Event Management**:
  - View all events
  - Register/unregister for events (regular users)
  - Create and manage events (managers)
- **Promotion Viewing**: View all active and upcoming promotions
- **User Management**: 
  - View and search users (managers)
  - Create new users (cashiers)

## Role-Based Access

- **Regular**: View dashboard, profile, transactions, events, promotions
- **Cashier**: All regular permissions + create transactions, process redemptions, create users
- **Manager**: All cashier permissions + manage events, promotions, users
- **Superuser**: Full access

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable components (Navbar, ProtectedRoute)
│   ├── contexts/        # React contexts (AuthContext)
│   ├── pages/           # Page components
│   ├── services/        # API service layer
│   ├── App.jsx          # Main app component with routing
│   ├── App.css          # App-specific styles
│   ├── index.css        # Global styles
│   └── main.jsx         # Entry point
├── index.html
├── package.json
└── vite.config.js
```

## Backend Connection

The frontend connects to the backend API running on `http://localhost:5000` by default. Make sure the backend server is running before starting the frontend.

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

