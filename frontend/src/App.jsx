// Main App component with routing
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
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

import './styles/App.css';
import './styles/Toast.css';

function AppContent() {
  const location = useLocation();
  const { theme } = useTheme();
  const hideNavbar = location.pathname === '/login' || location.pathname.startsWith('/reset-password');

  return (
    <div className="app">
      {!hideNavbar && <Navbar />}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={theme}
        className="custom-toast-container"
      />
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
                  <ProtectedRoute>
                    <Transactions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions/create"
                element={
                  <ProtectedRoute>
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
                  <ProtectedRoute>
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
                  <ProtectedRoute requiredRole="manager">
                    <UserDetail />
                  </ProtectedRoute>
                }
              />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

