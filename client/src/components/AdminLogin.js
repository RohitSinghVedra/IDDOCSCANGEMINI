import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import './Login.css';

const AdminLogin = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simple hardcoded Super Admin check for now
      if (username === 'admin' && password === 'admin123') {
        const adminUser = {
          username: 'admin',
          userType: 'admin',
          name: 'Super Admin'
        };

        onLogin('admin-token', adminUser);
        toast.success('Welcome Super Admin!');
        navigate('/admin');
      } else {
        toast.error('Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Super Admin</h2>
          <p>Enter credentials to manage clubs</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Verifying...' : 'Access Admin Panel'}
          </button>
        </form>

        <div className="login-footer">
          <p>Not an admin? <span onClick={() => navigate('/club-login')} className="link">Club Login</span></p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
