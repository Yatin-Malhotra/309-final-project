// Navigation bar component
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
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

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="navbar-brand">
          CSSU Rewards
        </Link>
        {user ? (
          <div className="navbar-links">
            <Link to="/dashboard">Dashboard</Link>
            {<Link to="/transactions">Transactions</Link>}
            {hasRole('manager') && <Link to="/users">Users</Link>}
            {<Link to="/events">Events</Link>}
            {<Link to="/promotions">Promotions</Link>}
            <Link to="/profile">Profile</Link>
            <div className="navbar-user">
              <div className="user-info">
                <div className="user-avatar">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name} />
                  ) : (
                    getInitials(user.name)
                  )}
                </div>
                <span>{user.name}</span>
                <span className="user-role">({user.role})</span>
              </div>
              <button onClick={handleLogout} className="btn btn-secondary">
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="navbar-links">
            <Link to="/login">Login</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;

