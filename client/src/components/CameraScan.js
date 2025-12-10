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
  const [documentType, setDocumentType] = useState('other');
  const [method, setMethod] = useState('camera'); // camera, upload, manual
  const [ocrProgress, setOcrProgress] = useState(0);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);

  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Camera Capabilities
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomRange, setZoomRange] = useState({ min: 1, max: 1, step: 0.1 });
  const [currentZoom, setCurrentZoom] = useState(1);

  // New Fullscreen State
  const [isCameraActive, setIsCameraActive] = useState(false);

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
    // For regular users, check if Google is connected
    if (user?.userType !== 'club' && !isSignedIn()) {
      toast.warning('Please connect your Google account first to save documents');
      navigate('/dashboard');
    }
  }, [navigate, user]);

  const handleQuickReconnect = async () => {
    try {
      setLoading(true);
      const { signInGoogle, setClubAccessToken } = await import('../services/googleAuth');

      // Enforce club email
      const expectedEmail = user?.userType === 'club' ? (user.gmail || user.email) : null;

      const response = await signInGoogle(expectedEmail);

      if (response && response.accessToken) {
        // Update Firestore with new token
        if (user?.userType === 'club') {
          const { setDoc, doc } = await import('firebase/firestore');
          const { db } = await import('../firebase-config');
          await setDoc(doc(db, 'clubs', user.id), {
            gmailAccessToken: response.accessToken,
            updatedAt: new Date()
          }, { merge: true });

          // Set token in memory
          await setClubAccessToken(response.accessToken);
        }

        toast.success('Reconnected successfully! You can now save.');
        setShowReconnectModal(false);
      }
    } catch (error) {
      console.error('Reconnect error:', error);
      toast.error(error.message || 'Failed to reconnect');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      // Simplified Maximum Quality Constraints
      // We rely on 'environment' facing mode and ask for max resolution (4Kish)
      // proper object-fit: cover in CSS will handle the aspect ratio
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 4096 },
          advanced: [
            { focusMode: "continuous" },
            { exposureMode: "continuous" },
            { whiteBalanceMode: "continuous" }
          ]
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsCameraActive(true); // Activate Fullscreen on Mobile

      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();

      // Check Torch
      if (capabilities.torch) {
        setTorchSupported(true);
      }

      // Check Zoom
      if (capabilities.zoom) {
        setZoomSupported(true);
        setZoomRange({
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step
        });

        const settings = track.getSettings();
        if (settings.zoom) {
          setCurrentZoom(settings.zoom);
        }
      }

    } catch (error) {
      toast.error('Camera access denied or not available');
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn }]
      });
      setTorchOn(!torchOn);
    } catch (error) {
      console.error('Torch error:', error);
    }
  };

  const handleZoom = async (e) => {
    const zoomValue = parseFloat(e.target.value);
    setCurrentZoom(zoomValue);

    if (!stream) return;
    const track = stream.getVideoTracks()[0];

    try {
      await track.applyConstraints({
        advanced: [{ zoom: zoomValue }]
      });
    } catch (error) {
      console.error('Zoom error:', error);
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
      ctx.drawImage(video, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Simple contrast preprocessing
      const contrast = 50;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < data.length; i += 4) {
        data[i] = factor * (data[i] - 128) + 128;
        data[i + 1] = factor * (data[i + 1] - 128) + 128;
        data[i + 2] = factor * (data[i + 2] - 128) + 128;
      }
      ctx.putImageData(imageData, 0, 0);

      const imageBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      const imageUrl = URL.createObjectURL(imageBlob);

      setCapturedImage(imageUrl);
      setShowPreview(true);
      stopCamera();

      processCapturedImage(imageUrl);

    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Failed to capture photo');
    }
  };

  const processCapturedImage = async (imageUrl) => {
    setIsProcessing(true);
    setOcrProgress(10);

    try {
      const extractedData = await processDocument(imageUrl, documentType);
      setOcrProgress(100);

      const formattedDOB = extractedData.dateOfBirth
        ? extractedData.dateOfBirth.split('/').reverse().join('-')
        : '';

      setManualData(prev => ({
        ...prev,
        ...extractedData,
        dob: formattedDOB
      }));

      toast.success('Document details extracted!');
    } catch (error) {
      console.error('Processing error:', error);
      toast.warning('Could not extract details automatically. Please enter manually.');
    } finally {
      setIsProcessing(false);
      setOcrProgress(0);
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
        const clubDocRef = doc(db, 'clubs', user.id);
        const clubDoc = await getDoc(clubDocRef);
        const clubData = clubDoc.data();

        if (!clubData?.spreadsheetId) {
          toast.error('Nightclub spreadsheet not configured.');
          return;
        }

        spreadsheetId = clubData.spreadsheetId;
        spreadsheetUrl = clubData.spreadsheetUrl;

        // Ensure token update (handled in googleAuth service if configured)
      } else {
        const userDocRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists() || !userDoc.data().spreadsheetId) {
          toast.error('Spreadsheet not found.');
          return;
        }
        spreadsheetId = userDoc.data().spreadsheetId;
        spreadsheetUrl = userDoc.data().spreadsheetUrl;
      }

      // Format DOB back to DD/MM/YYYY for Sheet
      const dobForSheet = manualData.dob
        ? manualData.dob.split('-').reverse().join('/')
        : '';

      const dataToSave = {
        documentType: documentType,
        extractedData: {
          name: manualData.name,
          idNumber: manualData.idNumber,
          dob: dobForSheet,
          gender: manualData.gender,
          nationality: manualData.nationality || 'Indian'
        }
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
      const errorCode = error.result?.error?.code || error.status;

      if (errorCode === 403 || errorCode === 401) {
        setShowReconnectModal(true);
        toast.warning('Session expired. Please reconnect to save.');
      } else {
        toast.error(error.message || 'Failed to save document');
      }
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setCapturedImage(null);
    setShowPreview(false);
    setManualData({
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
    // Restart camera if method is camera
    if (method === 'camera') {
      startCamera();
    }
  };

  // Video stream handling
  useEffect(() => {
    const videoElement = videoRef.current;
    if (stream && videoElement) {
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch(console.error);
      };
    }
    return () => {
      // Cleanup handled in main unmount effect
    };
  }, [stream]);

  // Clean up on unmount
  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`container ${isCameraActive ? 'camera-active-mode' : ''}`}>
      <div className="card">

        {/* Header - Hidden in Fullscreen Mode on Mobile */}
        <div className={`header ${isCameraActive ? 'hidden-mobile' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="back-btn" onClick={() => navigate('/dashboard')}>
              ←
            </button>
            <h2>Scan Document</h2>
          </div>
        </div>

        {/* Method Selector - Hidden in Fullscreen Mode on Mobile */}
        {!showPreview && !isCameraActive && (
          <div className="method-selector">
            <button
              className={`method-btn ${method === 'camera' ? 'active' : ''}`}
              onClick={() => { setMethod('camera'); startCamera(); }}
            >
              Camera
            </button>
            <button
              className={`method-btn ${method === 'upload' ? 'active' : ''}`}
              onClick={() => { setMethod('upload'); stopCamera(); }}
            >
              Upload
            </button>
            <button
              className={`method-btn ${method === 'manual' ? 'active' : ''}`}
              onClick={() => { setMethod('manual'); stopCamera(); }}
            >
              Manual
            </button>
          </div>
        )}

        {/* Camera View */}
        {method === 'camera' && !showPreview && (
          <div className={`camera-container ${isCameraActive ? 'fullscreen' : ''}`}>

            {/* Conditionally render Start Button only if NOT active */}
            {!isCameraActive ? (
              <div className="camera-placeholder" onClick={startCamera}>
                <span style={{ fontSize: '3rem' }}>📷</span>
                <p>Tap to Start Camera</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  Start Camera
                </button>
              </div>
            ) : (
              <>
                <video ref={videoRef} className="camera-feed" autoPlay playsInline muted />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                {/* Overlays */}
                <div className="camera-overlay">
                  <div className="focus-overlay">
                    <div className="scan-instruction">Align ID Card Here</div>
                  </div>
                </div>

                {/* Fullscreen Controls Overlay */}
                <div className="fullscreen-controls">
                  {/* Top Bar: Back/Close */}
                  <div className="control-top-bar">
                    <button className="control-btn close-cam" onClick={stopCamera}>
                      ✕
                    </button>
                    {torchSupported && (
                      <button
                        className={`control-btn torch-cam ${torchOn ? 'active' : ''}`}
                        onClick={toggleTorch}
                      >
                        ⚡
                      </button>
                    )}
                  </div>

                  {/* Bottom Bar: Zoom & Capture */}
                  <div className="control-bottom-bar">
                    {zoomSupported && (
                      <div className="zoom-control-container">
                        <span className="zoom-label">1x</span>
                        <input
                          type="range"
                          min={zoomRange.min}
                          max={zoomRange.max}
                          step={zoomRange.step}
                          value={currentZoom}
                          onChange={handleZoom}
                          className="zoom-slider"
                        />
                        <div className="zoom-label">{zoomRange.max}x</div>
                      </div>
                    )}

                    <div className="capture-action">
                      <button className="capture-btn" onClick={capturePhoto}>
                        <div className="capture-inner"></div>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Upload View */}
        {method === 'upload' && !showPreview && (
          <div className="upload-container" onClick={() => fileInputRef.current?.click()}>
            <input
              type="file"
              ref={fileInputRef}
              hidden
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  const url = URL.createObjectURL(e.target.files[0]);
                  setCapturedImage(url);
                  setShowPreview(true);
                  processCapturedImage(url);
                }
              }}
            />
            <span style={{ fontSize: '3rem' }}>📂</span>
            <p>Click to Upload Image</p>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="processing-indicator">
            <p className="processing-text">Extracting Data... {ocrProgress}%</p>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${ocrProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Preview & Edit Form */}
        {(showPreview || method === 'manual') && (
          <div className="preview-container">
            {showPreview && capturedImage && (
              <div className="image-preview">
                <img src={capturedImage} alt="Captured" />
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              <div className="form-group">
                <label>Document Type</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                >
                  <option value="id_card">ID Card</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving License</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={manualData.name}
                  onChange={(e) => setManualData({ ...manualData, name: e.target.value })}
                  placeholder="Detected Name"
                />
              </div>

              <div className="form-group">
                <label>ID Number</label>
                <input
                  type="text"
                  value={manualData.idNumber}
                  onChange={(e) => setManualData({ ...manualData, idNumber: e.target.value })}
                  placeholder="Detected ID No."
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={manualData.dob}
                    onChange={(e) => setManualData({ ...manualData, dob: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    value={manualData.gender}
                    onChange={(e) => setManualData({ ...manualData, gender: e.target.value })}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Nationality</label>
                <input
                  type="text"
                  value={manualData.nationality || ''}
                  onChange={(e) => setManualData({ ...manualData, nationality: e.target.value })}
                  placeholder="Nationality"
                />
              </div>

              <div className="preview-controls">
                <button type="button" className="btn btn-secondary" onClick={resetScan}>
                  {method === 'manual' ? 'Reset' : 'Retake'}
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={loading}>
                  {loading ? 'Saving...' : 'Save & Continue'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Reconnect Modal */}
        {showReconnectModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Session Expired</h3>
              <p>Please reconnect your Google account to save this document.</p>
              <button className="btn btn-primary" onClick={handleQuickReconnect} disabled={loading}>
                {loading ? 'Connecting...' : 'Reconnect Google'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowReconnectModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CameraScan;
