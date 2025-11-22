import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { signInGoogle, getCurrentUser } from '../services/googleAuth';
import { isAdminEmail } from '../config/adminConfig';
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

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const response = await signInGoogle();
      if (response && response.accessToken) {
        const userInfo = await getCurrentUser();

        if (userInfo && isAdminEmail(userInfo.email)) {
          const adminUser = {
            username: userInfo.email,
            userType: 'admin',
            name: userInfo.name,
            email: userInfo.email
          };

          onLogin('admin-token', adminUser);
          toast.success(`Welcome back, ${userInfo.name}!`);
          navigate('/admin');
        } else {
          toast.error('Access Denied: This email is not authorized as an Admin.');
        }
      }
    } catch (error) {
      console.error('Google Admin Login error:', error);
      toast.error('Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Super Admin</h2>
          <p>Enter credentials or sign in with Google</p>
        </div>

        <div className="google-login-section" style={{ marginBottom: '20px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', background: '#fff', color: '#333' }}
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px', height: '18px' }} />
            Sign in with Google
          </button>
        </div>

        <div className="divider" style={{ textAlign: 'center', margin: '20px 0', color: '#aaa', fontSize: '0.9rem' }}>
          <span>OR</span>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Verifying...' : 'Login with Password'}
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
