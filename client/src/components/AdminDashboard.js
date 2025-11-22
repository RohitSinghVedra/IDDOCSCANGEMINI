import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { getAllClubs, createClub, updateClub, deleteClub } from '../services/adminService';
import { signInGoogle } from '../services/googleAuth';
import './AdminDashboard.css';

const AdminDashboard = ({ user, onLogout }) => {
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClub, setEditingClub] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    gmail: '',
    gmailPassword: '',
    gmailAccessToken: '',
    gmailRefreshToken: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadClubs();
  }, []);

  const loadClubs = async () => {
    setLoading(true);
    try {
      const allClubs = await getAllClubs();
      setClubs(allClubs);
    } catch (error) {
      console.error('Error loading clubs:', error);
      toast.error('Failed to load clubs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClub = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.name || !formData.username || !formData.password || !formData.gmail) {
        toast.error('Please fill all required fields');
        return;
      }

      await createClub({
        ...formData,
        createdBy: user?.id || 'admin'
      });

      toast.success('Nightclub added successfully!');
      setShowCreateModal(false);
      resetForm();
      loadClubs();
    } catch (error) {
      console.error('Error creating club:', error);
      toast.error(error.message || 'Failed to create club');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClub = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await updateClub(editingClub.id, formData);
      toast.success('Nightclub updated successfully!');
      setEditingClub(null);
      resetForm();
      loadClubs();
    } catch (error) {
      console.error('Error updating club:', error);
      toast.error(error.message || 'Failed to update club');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClub = async (clubId) => {
    if (!window.confirm('Are you sure you want to delete this nightclub?')) {
      return;
    }

    setLoading(true);
    try {
      await deleteClub(clubId);
      toast.success('Nightclub deleted successfully!');
      loadClubs();
    } catch (error) {
      console.error('Error deleting club:', error);
      toast.error('Failed to delete club');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (club) => {
    setEditingClub(club);
    setFormData({
      name: club.name || '',
      username: club.username || '',
      password: '', // Don't show existing password
      gmail: club.gmail || '',
      gmailPassword: '', // Don't show existing Gmail password
      gmailAccessToken: club.gmailAccessToken || '',
      gmailRefreshToken: club.gmailRefreshToken || ''
    });
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      username: '',
      password: '',
      gmail: '',
      gmailPassword: '',
      gmailAccessToken: '',
      gmailRefreshToken: ''
    });
    setEditingClub(null);
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const handleGenerateTokens = async (club) => {
    if (!club.gmail) {
      toast.error('Gmail account not set for this nightclub');
      return;
    }

    try {
      toast.info('Please sign in with the nightclub Gmail account to generate tokens...', { autoClose: 5000 });

      // Open a popup window for OAuth flow
      // Note: This requires the admin to sign in with the nightclub's Gmail account
      const response = await signInGoogle();

      if (response && response.accessToken) {
        // Store the access token (refresh token is not available in this flow)
        // For refresh token, admin would need to use OAuth Playground
        await updateClub(club.id, {
          gmailAccessToken: response.accessToken
        });

        toast.success('OAuth tokens generated successfully! The nightclub can now access Google Sheets.');
        loadClubs();
      }
    } catch (error) {
      console.error('Error generating tokens:', error);
      toast.error('Failed to generate tokens. Please try using OAuth Playground method in Edit form.');
    }
  };

  return (
    <div className="admin-dashboard">
      <nav className="admin-nav">
        <div className="nav-brand">
          <h1>Admin Panel</h1>
        </div>
        <div className="nav-user">
          <span>Welcome, {user?.name || 'Admin'}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <main className="admin-content">
        <div className="content-header">
          <h2>Manage Nightclubs</h2>
          <button className="add-btn" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            + Add New Club
          </button>
        </div>

        {loading && !showCreateModal ? (
          <div className="loading">Loading clubs...</div>
        ) : (
          <div className="clubs-grid">
            {clubs.length === 0 ? (
              <div className="no-data">No clubs found. Add one to get started.</div>
            ) : (
              clubs.map(club => (
                <div key={club.id} className="club-card">
                  <div className="club-info">
                    <h3>{club.name}</h3>
                    <p><strong>Username:</strong> {club.username}</p>
                    <p><strong>Gmail:</strong> {club.gmail || 'Not set'}</p>
                    <p className="status">
                      <span className={`status-dot ${club.isActive ? 'active' : 'inactive'}`}></span>
                      {club.isActive ? 'Active' : 'Inactive'}
                    </p>
                    <div className="token-status">
                      {club.gmailAccessToken ? (
                        <span className="badge success">✓ Sheets Connected</span>
                      ) : (
                        <span className="badge warning">⚠ Sheets Not Connected</span>
                      )}
                    </div>
                  </div>
                  <div className="club-actions">
                    <button
                      className="edit-btn"
                      onClick={() => handleEdit(club)}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteClub(club.id)}
                    >
                      Delete
                    </button>
                    {!club.gmailAccessToken && (
                      <button
                        className="connect-btn"
                        onClick={() => handleGenerateTokens(club)}
                      >
                        Connect Sheets
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => { setShowCreateModal(false); resetForm(); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingClub ? 'Edit Nightclub' : 'Add New Nightclub'}</h3>
              <button className="close-btn" onClick={() => { setShowCreateModal(false); resetForm(); }}>×</button>
            </div>
            <form onSubmit={editingClub ? handleUpdateClub : handleCreateClub}>
              <div className="form-group">
                <label>Club Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Club Prism"
                  required
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. prism_admin"
                  required
                  disabled={!!editingClub}
                />
              </div>
              <div className="form-group">
                <label>Password {editingClub && '(Leave blank to keep current)'}</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Set a password"
                  required={!editingClub}
                />
              </div>
              <div className="form-group">
                <label>Gmail Account</label>
                <input
                  type="email"
                  value={formData.gmail}
                  onChange={e => setFormData({ ...formData, gmail: e.target.value })}
                  placeholder="club.official@gmail.com"
                  required
                />
                <small>Used for Google Sheets integration</small>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => { setShowCreateModal(false); resetForm(); }}>Cancel</button>
                <button type="submit" className="submit-btn">{editingClub ? 'Update' : 'Create Club'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
