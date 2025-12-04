// Navigation bar component
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { getAvatarUrl } from '../services/api';
import '../styles/components/Navbar.css';

const Navbar = () => {
  const { user, logout, hasRole, allowedRoles, currentRole, setCurrentRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dropdownRef = useRef(null);
  const roleMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const switchRole = (newRole) => {
    setCurrentRole(newRole)
    navigate('/dashboard')
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInsideDropdown = dropdownRef.current?.contains(event.target);
      const clickedInsideRoleMenu = roleMenuRef.current?.querySelector('.navbar-role-menu')?.contains(event.target);
      const clickedInsideMobileMenu = mobileMenuRef.current?.contains(event.target);
      const clickedHamburger = event.target.closest('.navbar-hamburger');
      
      if (!clickedInsideDropdown && !clickedInsideRoleMenu) {
        setDropdownOpen(false);
        setRoleMenuOpen(false);
      }
      
      if (!clickedInsideMobileMenu && !clickedHamburger) {
        setMobileMenuOpen(false);
      }
    };

    if (dropdownOpen || roleMenuOpen || mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen, roleMenuOpen, mobileMenuOpen]);

  // Position the role menu dynamically with responsive handling
  const positionRoleMenu = () => {
    if (roleMenuOpen && roleMenuRef.current) {
      const roleItem = roleMenuRef.current.querySelector('.navbar-dropdown-role');
      const roleMenu = roleMenuRef.current.querySelector('.navbar-role-menu');
      if (roleItem && roleMenu) {
        requestAnimationFrame(() => {
          const rect = roleItem.getBoundingClientRect();
          const menuRect = roleMenu.getBoundingClientRect();
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          
          let left = rect.right + 8;
          let top = rect.top;
          
          // Check if menu would overflow on the right
          if (left + menuRect.width > viewportWidth - 16) {
            left = rect.left - menuRect.width - 8;
          }
          
          // Ensure menu doesn't go off the left edge
          if (left < 16) {
            left = 16;
            isLeftSide = false;
          }
          
          // overflow on the bottom
          if (top + menuRect.height > viewportHeight - 16) {
            top = Math.max(16, viewportHeight - menuRect.height - 16);
          }
          
          // Ensure menu doesn't go off the top edge
          if (top < 16) {
            top = 16;
          }
          
          roleMenu.style.left = `${left}px`;
          roleMenu.style.top = `${top}px`;
        });
      }
    }
  };

  useEffect(() => {
    positionRoleMenu();
    
    // Reposition on window resize
    const handleResize = () => {
      positionRoleMenu();
    };
    
    if (roleMenuOpen) {
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [roleMenuOpen]);

  const handleLogout = () => {
    closeMobileMenu();
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const capitalizeRole = (role) => {
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
    setRoleMenuOpen(false);
  };

  return (
    <>
      {mobileMenuOpen && (
        <div 
          className="navbar-mobile-overlay" 
          onClick={closeMobileMenu}
        />
      )}
      <nav className="navbar">
        <div className="container navbar-content">
          <div className="navbar-header">
            <Link to="/" className="navbar-brand" onClick={closeMobileMenu}>
              CSSU Rewards
            </Link>
            {user && (
              <button
                className={`navbar-hamburger ${mobileMenuOpen ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <span></span>
                <span></span>
                <span></span>
              </button>
            )}
          </div>

          {user ? (
            <div className={`navbar-links ${mobileMenuOpen ? 'mobile-open' : ''}`} ref={mobileMenuRef}>
            <Link to="/dashboard" className={location.pathname === '/dashboard' || location.pathname === '/' ? 'active' : ''} onClick={closeMobileMenu}>Dashboard</Link>
            <Link to="/transactions" className={location.pathname.startsWith('/transactions') ? 'active' : ''} onClick={closeMobileMenu}>Transactions</Link>
            {hasRole('manager') && <Link to="/users" className={location.pathname.startsWith('/users') ? 'active' : ''} onClick={closeMobileMenu}>Users</Link>}
            <Link to="/events" className={location.pathname.startsWith('/events') ? 'active' : ''} onClick={closeMobileMenu}>Events</Link>
            <Link to="/promotions" className={location.pathname.startsWith('/promotions') ? 'active' : ''} onClick={closeMobileMenu}>Promotions</Link>

            <div className="navbar-user" ref={dropdownRef}>
              <div
                className="user-info-clickable"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <div className="user-avatar">
                  {getAvatarUrl(user.avatarUrl) ? (
                    <img 
                      key={user.avatarUrl} 
                      src={getAvatarUrl(user.avatarUrl)} 
                      alt={user.name} 
                    />
                  ) : (
                    getInitials(user.name)
                  )}
                </div>
                <span>{user.name}</span>
              </div>

              {dropdownOpen && (
                <div className="navbar-dropdown">
                  <Link
                    to="/profile"
                    className="navbar-dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      setRoleMenuOpen(false);
                      closeMobileMenu();
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>My Profile</span>
                  </Link>
                  <div className="navbar-dropdown-role-wrapper" ref={roleMenuRef}>
                    <div
                      className={`navbar-dropdown-item navbar-dropdown-role ${roleMenuOpen ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setRoleMenuOpen(!roleMenuOpen);
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>

                      <span>Role: {capitalizeRole(currentRole)}</span>

                      <svg 
                        width="12" 
                        height="12" 
                        viewBox="0 0 24 24" 
                        className={`chevron ${roleMenuOpen ? 'rotated' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                    {roleMenuOpen && (
                      <div 
                        className="navbar-role-menu"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {allowedRoles.map((r) => (
                          <div
                            key={r}
                            className={`navbar-role-menu-item ${currentRole === r ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              switchRole(r);
                              setRoleMenuOpen(false);
                              setDropdownOpen(false);
                              closeMobileMenu();
                            }}
                          >
                            <span className="role-name">{capitalizeRole(r)}</span>
                            {currentRole === r && (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div
                    className="navbar-dropdown-item navbar-dropdown-item-theme"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {theme === 'light' ? (
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                      ) : (
                        <>
                          <circle cx="12" cy="12" r="5"></circle>
                          <line x1="12" y1="1" x2="12" y2="3"></line>
                          <line x1="12" y1="21" x2="12" y2="23"></line>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                          <line x1="1" y1="12" x2="3" y2="12"></line>
                          <line x1="21" y1="12" x2="23" y2="12"></line>
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                        </>
                      )}
                    </svg>
                    <span>Dark Mode</span>
                    <label className="theme-switch" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={theme === 'dark'}
                        onChange={toggleTheme}
                      />
                      <span className="theme-slider"></span>
                    </label>
                  </div>
                  <div
                    className="navbar-dropdown-item navbar-dropdown-item-logout"
                    onClick={handleLogout}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>Logout</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="navbar-links">
            <Link to="/login" onClick={closeMobileMenu}>Login</Link>
          </div>
        )}
      </div>
    </nav>
    </>
  );
};

export default Navbar;
