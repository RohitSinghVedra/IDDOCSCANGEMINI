import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { initGoogleAPI, signInGoogle, isSignedIn, createSpreadsheet, setClubAccessToken } from '../services/googleAuth';
import { db } from '../firebase-config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getClubById } from '../services/adminService';
import './Dashboard.css';

const Dashboard = ({ user, onLogout }) => {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const isClubUser = user?.userType === 'club';

  useEffect(() => {
    checkGoogleStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkGoogleStatus = async () => {
    try {
      await initGoogleAPI();

      if (isClubUser) {
        // Club Flow: Use pre-configured Gmail token
        const club = await getClubById(user.id);

        if (club && club.gmailAccessToken) {
          try {
            await setClubAccessToken(club.gmailAccessToken);
            setGoogleConnected(true);

            if (club.spreadsheetId && club.spreadsheetUrl) {
              setSpreadsheetUrl(club.spreadsheetUrl);
            } else {
              // Auto-create spreadsheet if missing (and we have token)
              await initializeClubSpreadsheet(club);
            }
          } catch (error) {
            console.error('Error using club token:', error);
            // Token expired or invalid - allow manual connection
            setGoogleConnected(false);
            toast.warning('Google Sheets session expired. Please reconnect.');
          }
        } else {
          // No token configured
          setGoogleConnected(false);
        }
      } else {
        // Legacy/Regular User Flow
        const signedIn = isSignedIn();
        setGoogleConnected(signedIn);

        if (signedIn) {
          const userDocRef = doc(db, 'users', user.id);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists() && userDoc.data().spreadsheetUrl) {
            setSpreadsheetUrl(userDoc.data().spreadsheetUrl);
          }
        }
      }
    } catch (error) {
      console.error('Error checking Google status:', error);
      setGoogleConnected(false);
    }
  };

  const initializeClubSpreadsheet = async (club) => {
    try {
      const result = await createSpreadsheet(`${club.name} - ID Scans`);

      // Update club document
      const { updateClub } = await import('../services/adminService');
      await updateClub(club.id, {
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl
      });

      setSpreadsheetUrl(result.spreadsheetUrl);
      toast.success('Spreadsheet created successfully!');
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      toast.error('Failed to create spreadsheet. Check Gmail permissions.');
    }
  };

  const handleGoogleConnect = async () => {
    setLoading(true);
    try {
      const response = await signInGoogle();
      if (response && response.accessToken) {
        // Determine collection based on user type
        const collectionName = isClubUser ? 'clubs' : 'users';
        const docRef = doc(db, collectionName, user.id);
        const docSnap = await getDoc(docRef);

        let spreadsheetId, spreadsheetUrl;

        if (docSnap.exists() && docSnap.data().spreadsheetId) {
          spreadsheetId = docSnap.data().spreadsheetId;
          spreadsheetUrl = docSnap.data().spreadsheetUrl;
        } else {
          // Create new spreadsheet
          const sheetName = isClubUser ? `${user.name} - ID Scans` : 'ID Document Scans';
          const result = await createSpreadsheet(sheetName);
          spreadsheetId = result.spreadsheetId;
          spreadsheetUrl = result.spreadsheetUrl;

          // Update document with new sheet info
          await setDoc(docRef, {
            googleConnected: true,
            spreadsheetId,
            spreadsheetUrl,
            // For clubs, we might want to save the token too (optional, but it expires)
            ...(isClubUser ? { gmailAccessToken: response.accessToken } : {}),
            updatedAt: new Date()
          }, { merge: true });
        }

        setGoogleConnected(true);
        setSpreadsheetUrl(spreadsheetUrl);
        toast.success('Connected successfully!');
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Failed to connect Google account');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h1>🆔 IDDocScan</h1>
        </div>
        <div className="nav-user">
          <div className="user-info">
            <span className="user-name">{user?.name || 'User'}</span>
            {isClubUser && <span className="user-role">Nightclub Account</span>}
          </div>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <main className="dashboard-content">
        <div className="status-section">
          <div className={`status-card ${googleConnected ? 'connected' : 'disconnected'}`}>
            <div className="status-icon">
              {googleConnected ? '🟢' : '🔴'}
            </div>
            <div className="status-details">
              <h3>Google Sheets Status</h3>
              <p>{googleConnected ? 'Connected & Ready' : 'Not Connected'}</p>
              {isClubUser && googleConnected && (
                <small>Using {user?.gmail}</small>
              )}
            </div>
            {googleConnected && spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="view-sheet-btn"
              >
                View Sheet ↗
              </a>
            )}
            {!googleConnected && (
              <button onClick={handleGoogleConnect} disabled={loading} className="connect-btn">
                {loading ? 'Connecting...' : 'Connect Google'}
              </button>
            )}
          </div>
        </div>

        <div className="actions-grid">
          <div className="action-card primary" onClick={() => navigate('/scan')}>
            <div className="action-icon">📷</div>
            <h3>Scan ID</h3>
            <p>Capture and extract data from ID cards</p>
          </div>

          <div className="action-card secondary" onClick={() => navigate('/scan', { state: { mode: 'manual' } })}>
            <div className="action-icon">📝</div>
            <h3>Manual Entry</h3>
            <p>Type in visitor details manually</p>
          </div>
        </div>

        <div className="recent-activity">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            <div className="activity-item">
              <span className="time">Just now</span>
              <span className="desc">System ready for scanning</span>
            </div>
            {/* Add real activity log here if needed */}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
