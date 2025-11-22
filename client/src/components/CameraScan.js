import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { processDocument } from '../services/ocrService';
import { appendToSpreadsheet, isSignedIn } from '../services/googleAuth';
import { db } from '../firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import './CameraScan.css';

const CameraScan = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState('camera'); // camera, upload, manual
  const [ocrProgress, setOcrProgress] = useState(0);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [documentType, setDocumentType] = useState('other');
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Manual Entry / Edit State
  const [manualData, setManualData] = useState({
    name: '',
    idNumber: '',
    dob: '',
    gender: '',
    address: '',
    fatherName: '',
    pincode: '',
    otherInfo1: '',
    otherInfo2: ''
  });

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // For club users, Google Sheets is automatically configured via Dashboard
    // For regular users, check if Google is connected
    if (user?.userType !== 'club' && !isSignedIn()) {
      toast.warning('Please connect your Google account first to save documents');
      navigate('/dashboard');
    }
  }, [navigate, user]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Update video when stream changes
  useEffect(() => {
    const videoElement = videoRef.current;

    if (stream && videoElement) {
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch(err => console.error('Video play error:', err));
      };
    }

    return () => {
      if (videoElement && !stream) {
        videoElement.srcObject = null;
      }
    };
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      setStream(mediaStream);
    } catch (error) {
      toast.error('Camera access denied or not available');
      console.error('Camera error:', error);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !stream) {
      toast.error('Camera not ready');
      return;
    }

    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'document-photo.jpg', { type: 'image/jpeg' });
        const imageUrl = URL.createObjectURL(blob);

        setCapturedImage({ file, url: imageUrl });
        stopCamera();
        toast.success('Photo captured! Processing...');
        await processCapturedImage(file);
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Failed to capture photo');
    }
  };

  const processCapturedImage = async (file) => {
    setIsProcessing(true);
    setOcrProgress(0);
    let progressInterval = null;

    try {
      progressInterval = setInterval(() => {
        setOcrProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const ocrResult = await processDocument(file, (progress) => {
        setOcrProgress(Math.round(progress * 100));
      });

      if (progressInterval) clearInterval(progressInterval);
      setOcrProgress(100);

      setExtractedData(ocrResult);
      setDocumentType(ocrResult.documentType);

      // Populate manual data with extracted data
      setManualData({
        name: ocrResult.extractedData.name || '',
        idNumber: ocrResult.extractedData.aadhaarNumber || ocrResult.extractedData.panNumber || ocrResult.extractedData.passportNumber || ocrResult.extractedData.idNumber || '',
        dob: ocrResult.extractedData.dateOfBirth || '',
        gender: ocrResult.extractedData.gender || '',
        address: ocrResult.extractedData.address || '',
        fatherName: ocrResult.extractedData.fatherName || '',
        pincode: ocrResult.extractedData.pincode || '',
        otherInfo1: ocrResult.extractedData.otherInfo1 || '',
        otherInfo2: ocrResult.extractedData.otherInfo2 || ''
      });

      toast.success('Document processed successfully!');
      setShowPreview(true);
    } catch (error) {
      console.error('OCR error:', error);
      toast.error(`Failed to process document: ${error.message}`);
      setCapturedImage(null);
      setExtractedData(null);
      setShowPreview(false);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setIsProcessing(false);
      setOcrProgress(0);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setCapturedImage({ file, url: imageUrl });

    toast.info('Processing uploaded image...');
    await processCapturedImage(file);
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setExtractedData(null);
    setDocumentType('other');
    setManualData({
      name: '', idNumber: '', dob: '', gender: '', address: '', fatherName: '', pincode: '', otherInfo1: '', otherInfo2: ''
    });
    setShowPreview(false);
    if (method === 'camera') {
      startCamera();
    }
  };

  const handleSave = async () => {
    if (user?.userType !== 'club' && !isSignedIn()) {
      toast.error('Please connect Google account first');
      navigate('/dashboard');
      return;
    }

    if (!manualData.name && !manualData.idNumber) {
      toast.warning('Please enter at least a Name or ID Number');
      return;
    }

    setLoading(true);

    try {
      let spreadsheetId;
      let spreadsheetUrl;

      if (user?.userType === 'club') {
        // Fetch latest club data to get fresh token and spreadsheet info
        const clubDocRef = doc(db, 'clubs', user.id);
        const clubDoc = await getDoc(clubDocRef);

        if (!clubDoc.exists()) {
          toast.error('Club account not found.');
          return;
        }

        const clubData = clubDoc.data();

        if (!clubData.spreadsheetId) {
          toast.error('Nightclub spreadsheet not configured. Please connect Google Sheets in Dashboard.');
          return;
        }

        spreadsheetId = clubData.spreadsheetId;
        spreadsheetUrl = clubData.spreadsheetUrl;

        // Ensure we have the latest token set
        if (clubData.gmailAccessToken) {
          const { setClubAccessToken } = await import('../services/googleAuth');
          await setClubAccessToken(clubData.gmailAccessToken);
        } else {
          // If no token, try anyway (might be in memory), but warn if fails
          console.warn('No Gmail token found in club record');
        }

      } else {
        const userDocRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists() || !userDoc.data().spreadsheetId) {
          toast.error('Spreadsheet not found. Please connect Google account again.');
          navigate('/dashboard');
          return;
        }
        spreadsheetId = userDoc.data().spreadsheetId;
        spreadsheetUrl = userDoc.data().spreadsheetUrl;
      }

      // Prepare data for saving
      const dataToSave = {
        documentType: documentType,
        rawText: extractedData?.rawText || 'Manual Entry',
        extractedData: manualData
      };

      await appendToSpreadsheet(spreadsheetId, dataToSave);

      toast.success('Saved to Google Sheets!', {
        onClick: () => spreadsheetUrl && window.open(spreadsheetUrl, '_blank'),
        autoClose: 3000
      });

      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (error) {
      console.error('Save error:', error);
      if (error.result && error.result.error && error.result.error.code === 403) {
        toast.error('Permission denied. Please reconnect Google Sheets in Dashboard.');
      } else {
        toast.error(error.message || 'Failed to save document');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    setMethod('manual');
    stopCamera();
    setCapturedImage(null);
    setExtractedData(null);
    setShowPreview(true); // Show preview immediately for manual entry
  };

  return (
    <div className="camera-scan-page">
      <div className="header">
        <div className="header-content">
          <h2>📷 Scan Document</h2>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ padding: '8px 16px', fontSize: '14px' }}>
            Back
          </button>
        </div>
      </div>

      <div className="container">
        <div className="card">
          {/* Method Selection */}
          {!showPreview && (
            <div className="method-selector">
              <button
                className={`btn ${method === 'camera' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setMethod('camera'); startCamera(); }}
                disabled={isProcessing}
              >
                📷 Camera
              </button>
              <button
                className={`btn ${method === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setMethod('upload'); stopCamera(); }}
                disabled={isProcessing}
              >
                📁 Upload
              </button>
              <button
                className={`btn ${method === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={handleManualEntry}
                disabled={isProcessing}
              >
                📝 Manual
              </button>
            </div>
          )}

          {/* Camera View */}
          {!showPreview && method === 'camera' && (
            <div className="camera-container">
              {stream ? (
                <div className="video-wrapper">
                  <video ref={videoRef} autoPlay playsInline muted />
                  <div className="focus-overlay" />
                  <div className="camera-instruction">Position document within frame</div>
                </div>
              ) : (
                <div className="camera-placeholder">
                  <p>Ready to capture document</p>
                  <button className="btn btn-primary" onClick={startCamera} disabled={loading}>
                    Start Camera
                  </button>
                </div>
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {stream && (
                <div className="camera-controls">
                  <button className="capture-btn" onClick={capturePhoto} disabled={isProcessing}>
                    <div className="capture-inner" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Upload View */}
          {!showPreview && method === 'upload' && (
            <div className="upload-container">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <div className="upload-placeholder" onClick={() => fileInputRef.current?.click()}>
                <span style={{ fontSize: '48px' }}>📁</span>
                <p>Click to upload document image</p>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="processing-indicator">
              <div className="processing-text">Processing document... {ocrProgress}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${ocrProgress}%` }}></div>
              </div>
            </div>
          )}

          {/* Preview & Edit Section */}
          {showPreview && (
            <div className="preview-container">
              <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>
                {method === 'manual' ? '📝 Manual Entry' : '📄 Review & Edit'}
              </h3>

              {capturedImage && (
                <div className="image-preview">
                  <img src={capturedImage.url} alt="Captured Document" />
                </div>
              )}

              <div className="edit-form">
                <div className="form-group">
                  <label>Document Type</label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="form-control"
                  >
                    <option value="aadhaar">Aadhaar Card</option>
                    <option value="pan">PAN Card</option>
                    <option value="passport">Passport</option>
                    <option value="driving_license">Driving License</option>
                    <option value="voter_id">Voter ID</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={manualData.name}
                      onChange={(e) => setManualData({ ...manualData, name: e.target.value })}
                      placeholder="Full Name"
                    />
                  </div>
                  <div className="form-group">
                    <label>ID Number</label>
                    <input
                      type="text"
                      value={manualData.idNumber}
                      onChange={(e) => setManualData({ ...manualData, idNumber: e.target.value })}
                      placeholder="Document Number"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="text"
                      value={manualData.dob}
                      onChange={(e) => setManualData({ ...manualData, dob: e.target.value })}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select
                      value={manualData.gender}
                      onChange={(e) => setManualData({ ...manualData, gender: e.target.value })}
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <textarea
                    value={manualData.address}
                    onChange={(e) => setManualData({ ...manualData, address: e.target.value })}
                    placeholder="Address"
                    rows="3"
                  />
                </div>

                <div className="preview-controls">
                  <button
                    className="btn btn-secondary"
                    onClick={retakePhoto}
                    disabled={loading}
                  >
                    {method === 'manual' ? 'Cancel' : 'Retake'}
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : '✓ Save to Sheet'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraScan;
