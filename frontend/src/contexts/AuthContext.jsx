// Authentication context for managing user state
import { createContext, useContext, useState, useEffect } from 'react';
import { userAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const roleHierarchy = { regular: 0, cashier: 1, manager: 2, superuser: 3 };
  const roles = ['regular', 'cashier', 'manager', 'superuser']
  const [currentRole, setCurrentRole] = useState(null)
  const [allowedRoles, setAllowedRoles] = useState([])

  // Load user from localStorage and verify token
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');

      if (token && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          // Verify token is still valid by fetching current user
          const response = await userAPI.getMe();
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
        } catch (error) {
          // Token invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  useEffect(() => {
    if (!user) return;
    setCurrentRole(user.role)
    setAllowedRoles(roles.slice(0, roleHierarchy[user.role] + 1))
  }, [user.role])

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateLocalUser = async () => {
    const response = await userAPI.getMe();
    setUser(response.data);
    localStorage.setItem('user', JSON.stringify(response.data));
  };

  const hasRole = (requiredRole) => {
    if (!user) return false;

    const userLevel = roleHierarchy[currentRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
  };

  const value = {
    user,
    loading,
    currentRole,
    setCurrentRole,
    login,
    logout,
    updateLocalUser,
    hasRole,
    allowedRoles,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

