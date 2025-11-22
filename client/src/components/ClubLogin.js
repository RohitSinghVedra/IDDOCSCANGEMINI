import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authenticateClub } from '../services/adminService';
import './Login.css';

const ClubLogin = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const club = await authenticateClub(username, password);

      // Store club session
      const clubSession = {
        id: club.id,
        name: club.name,
        username: club.username,
        gmail: club.gmail,
        spreadsheetId: club.spreadsheetId,
        spreadsheetUrl: club.spreadsheetUrl,
        userType: 'club'
      };

      onLogin(null, clubSession); // No Firebase token for club users
      toast.success(`Welcome, ${club.name}!`);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Club Access</h2>
          <p>Sign in to start scanning</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter club username"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>

        <div className="login-footer">
          <p>Admin Access? <span onClick={() => navigate('/admin-login')} className="link">Admin Login</span></p>
        </div>
      </div>
    </div>
  );
};

export default ClubLogin;
