// Main App component with routing
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Transactions from './pages/Transactions';
import CreateTransaction from './pages/CreateTransaction';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import CreateEvent from './pages/CreateEvent';
import Promotions from './pages/Promotions';
import CreatePromotion from './pages/CreatePromotion';
import Users from './pages/Users';
import CreateUser from './pages/CreateUser';
import UserDetail from './pages/UserDetail';

import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app">
          <Navbar />
          <div className="app-content">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/reset-password/:resetToken"
                element={<ResetPassword />}
              />

              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/transactions"
                element={
                  <ProtectedRoute requiredRole="manager">
                    <Transactions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/create"
                element={
                  <ProtectedRoute requiredRole="cashier">
                    <CreateTransaction />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/events"
                element={
                  <ProtectedRoute>
                    <Events />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events/create"
                element={
                  <ProtectedRoute requiredRole="manager">
                    <CreateEvent />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events/:eventId/edit"
                element={
                  <ProtectedRoute requiredRole="manager">
                    <CreateEvent />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/events/:eventId"
                element={
                  <ProtectedRoute>
                    <EventDetail />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/promotions"
                element={
                  <ProtectedRoute>
                    <Promotions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/promotions/create"
                element={
                  <ProtectedRoute requiredRole="manager">
                    <CreatePromotion />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/promotions/:promotionId/edit"
                element={
                  <ProtectedRoute requiredRole="manager">
                    <CreatePromotion />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/users"
                element={
                  <ProtectedRoute requiredRole="manager">
                    <Users />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users/create"
                element={
                  <ProtectedRoute requiredRole="cashier">
                    <CreateUser />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/users/:userId"
                element={
                  <ProtectedRoute requiredRole="cashier">
                    <UserDetail />
                  </ProtectedRoute>
                }
              />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

