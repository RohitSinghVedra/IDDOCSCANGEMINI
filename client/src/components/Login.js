import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { signInGoogle } from '../services/googleAuth';
import './Login.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', { email, password });
      onLogin(response.data.token, response.data.user);
      toast.success('Login successful!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const googleUser = await signInGoogle();
      // Assuming you have a backend endpoint to handle Google login
      // For now, we'll just simulate a successful login or handle it as needed
      // You might need to send the googleUser token to your backend
      toast.info('Google Login functionality to be integrated with backend');
    } catch (error) {
      console.error("Google login error", error);
      toast.error('Google login failed');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>Welcome back</h2>
          <p>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="username@gmail.com"
              className="glass-input"
            />
          </div>

          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="glass-input"
            />
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
            {!loading && <span className="arrow-icon">→</span>}
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="social-login">
          <button className="social-btn google-btn" onClick={handleGoogleLogin}>
            <span className="icon">G</span> Continue with Google
          </button>
          {/* Placeholder for X/Twitter if needed */}
          {/* <button className="social-btn x-btn">
            <span className="icon">X</span> Continue with X
          </button> */}
        </div>

        <div className="login-footer">
          Don't have an account? <Link to="/register" className="link">Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
