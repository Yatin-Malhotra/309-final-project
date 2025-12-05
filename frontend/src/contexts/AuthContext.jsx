// Authentication context for managing user state
import { createContext, useContext, useState, useEffect } from 'react';
import { userAPI, authAPI } from '../services/api';

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

  // Load user and verify session
  useEffect(() => {
    const loadUser = async () => {
      try {
        // Try to fetch user data - if cookie is valid, this will succeed
        const response = await userAPI.getMe();
        const updatedUser = response.data;
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
      } catch (error) {
        // Session invalid or no cookie
        localStorage.removeItem('user');
        localStorage.removeItem('currentRole');
        setUser(null);
        setCurrentRole(null);
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  useEffect(() => {
    if (!user) {
      setCurrentRole(null);
      setAllowedRoles([]);
      localStorage.removeItem('currentRole');
      return;
    }
    // Calculate allowed roles based on user's actual role
    const newAllowedRoles = roles.slice(0, roleHierarchy[user.role] + 1);
    setAllowedRoles(newAllowedRoles);
    
    // Check localStorage for saved role and validate it
    setCurrentRole(prevRole => {
      // If currentRole is already set and valid, keep it
      if (prevRole && newAllowedRoles.includes(prevRole)) {
        return prevRole;
      }
      
      // Otherwise, try to restore from localStorage
      const savedRole = localStorage.getItem('currentRole');
      if (savedRole && newAllowedRoles.includes(savedRole)) {
        return savedRole;
      }
      
      // Fall back to user's actual role
      return user.role;
    });
  }, [user?.role]) // Only depend on user.role, not the entire user object

  // Save currentRole to localStorage whenever it changes
  useEffect(() => {
    if (user && currentRole) {
      // Validate that the role is still allowed before saving
      const allowedRolesForUser = roles.slice(0, roleHierarchy[user.role] + 1);
      if (allowedRolesForUser.includes(currentRole)) {
        localStorage.setItem('currentRole', currentRole);
      } else {
        // Invalid role, clear from localStorage and reset to user's actual role
        localStorage.removeItem('currentRole');
        if (currentRole !== user.role) {
          setCurrentRole(user.role);
        }
      }
    }
  }, [currentRole, user]);

  const login = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    // Role will be restored by the useEffect that watches user.role
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout failed', error);
    }
    localStorage.removeItem('user');
    localStorage.removeItem('currentRole');
    setUser(null);
    setCurrentRole(null);
    setAllowedRoles([]);
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

