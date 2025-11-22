import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase-config';
import { toast } from 'react-toastify';

const RegisterFirebase = ({ onLogin }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      
      onLogin(token, {
        id: result.user.uid,
        email: result.user.email
      });
      
      toast.success('Signed in successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="container">
        <div className="card">
          <div className="card-header">
            <h1>📱 IDDocScan</h1>
            <p>Sign in to get started</p>
          </div>
          
          <div style={{textAlign: 'center', padding: '40px 20px'}}>
            <p style={{marginBottom: '30px', color: '#666'}}>
              Sign in with your Google account to start scanning documents
            </p>
            <button 
              onClick={handleGoogleSignIn} 
              className="btn btn-primary" 
              disabled={loading}
              style={{width: '100%', fontSize: '16px', padding: '14px'}}
            >
              {loading ? 'Signing in...' : '📧 Continue with Google'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterFirebase;
