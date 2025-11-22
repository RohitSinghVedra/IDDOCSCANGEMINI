import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ClubLogin from './components/ClubLogin';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import Dashboard from './components/Dashboard';
import CameraScan from './components/CameraScan';
import DocumentList from './components/DocumentList';
import { ToastContainer } from 'react-toastify';
import { isAdminEmail } from './config/adminConfig';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      setIsAuthenticated(true);
      // Token is optional for club users
      if (savedToken) {
        setToken(savedToken);
      }
    }
  }, []);

  const handleLogin = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    setIsAuthenticated(true);
    if (newToken) {
      localStorage.setItem('token', newToken);
    }
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Check if user is admin (whitelist check)
  const isAdmin = user?.userType === 'admin' || isAdminEmail(user?.email);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
              <Navigate to={isAdmin ? "/admin" : "/dashboard"} /> : 
              <AdminLogin onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/club-login" 
            element={
              isAuthenticated ? 
              <Navigate to="/dashboard" /> : 
              <ClubLogin onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/admin-login" 
            element={
              isAuthenticated && isAdmin ? 
              <Navigate to="/admin" /> : 
              <AdminLogin onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/admin" 
            element={
              isAuthenticated && isAdmin ? 
              <AdminDashboard user={user} onLogout={handleLogout} /> : 
              <Navigate to="/admin-login" />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? 
              <Dashboard user={user} onLogout={handleLogout} /> : 
              <Navigate to="/club-login" />
            } 
          />
          <Route 
            path="/scan" 
            element={
              isAuthenticated ? 
              <CameraScan token={token} user={user} /> : 
              <Navigate to="/club-login" />
            } 
          />
          <Route 
            path="/documents" 
            element={
              isAuthenticated ? 
              <DocumentList token={token} /> : 
              <Navigate to="/club-login" />
            } 
          />
          <Route path="/" element={<Navigate to="/club-login" />} />
          <Route path="/login" element={<Navigate to="/club-login" />} />
          <Route path="/register" element={<Navigate to="/club-login" />} />
        </Routes>
        <ToastContainer position="top-center" />
      </div>
    </Router>
  );
}

export default App;
