import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

const DocumentList = ({ token }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDocuments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get('/api/documents', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (error) {
      toast.error('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const getDocumentIcon = (type) => {
    const icons = {
      aadhaar: '🆔',
      passport: '📕',
      pan: '💳',
      driving_license: '🚗',
      voter_id: '🗳️',
      other: '📄'
    };
    return icons[type] || '📄';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div>
      <div className="header">
        <div className="header-content">
          <h2>📋 My Documents</h2>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{padding: '8px 16px', fontSize: '14px'}}>
            Back
          </button>
        </div>
      </div>

      <div className="container">
        {loading ? (
          <div className="card">
            <p>Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="card">
            <p>No documents yet. <button onClick={() => navigate('/scan')} style={{color: '#667eea', cursor: 'pointer', border: 'none', background: 'transparent', textDecoration: 'underline', padding: 0}}>Scan your first document</button></p>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc._id} className="card">
              <div style={{display: 'flex', alignItems: 'flex-start', marginBottom: '16px'}}>
                <span style={{fontSize: '48px', marginRight: '16px'}}>
                  {getDocumentIcon(doc.documentType)}
                </span>
                <div style={{flex: 1}}>
                  <h3 style={{marginBottom: '8px', textTransform: 'capitalize'}}>
                    {doc.documentType.replace('_', ' ')}
                  </h3>
                  <p style={{color: '#666', fontSize: '14px'}}>
                    {formatDate(doc.timestamp)}
                  </p>
                </div>
              </div>
              
              <div style={{background: '#f8f9fa', padding: '16px', borderRadius: '8px', marginTop: '16px'}}>
                <h4 style={{marginBottom: '12px'}}>Extracted Information:</h4>
                <pre style={{fontSize: '13px', color: '#333', whiteSpace: 'pre-wrap'}}>
                  {JSON.stringify(doc.extractedData, null, 2)}
                </pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DocumentList;
