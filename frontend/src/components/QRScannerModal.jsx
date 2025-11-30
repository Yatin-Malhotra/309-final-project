// QR Scanner Modal Component - Placeholder scanner with camera access
import { useEffect, useRef, useState } from 'react';
import './QRScannerModal.css';

const QRScannerModal = ({ isOpen, onClose }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Clean up when modal closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsScanning(false);
      return;
    }

    // Request camera access
    const startCamera = async () => {
      try {
        setError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Use back camera if available
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setIsScanning(true);
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError('Unable to access camera. Please check permissions.');
        setIsScanning(false);
      }
    };

    startCamera();

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const handleClose = () => {
    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="qr-scanner-overlay" onClick={handleClose}>
      <div className="qr-scanner-content" onClick={(e) => e.stopPropagation()}>
        <button className="qr-scanner-close" onClick={handleClose} aria-label="Close">
          ×
        </button>
        <div className="qr-scanner-header">
          <h2>Scan QR Code</h2>
          <p className="qr-scanner-subtitle">Position QR code within the frame</p>
        </div>
        
        <div className="qr-scanner-video-container">
          {error ? (
            <div className="qr-scanner-error">
              <div className="qr-scanner-error-icon">⚠️</div>
              <p>{error}</p>
              <button 
                className="btn btn-primary" 
                onClick={() => window.location.reload()}
                style={{ marginTop: '16px' }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="qr-scanner-video"
              />
              {isScanning && (
                <div className="qr-scanner-overlay-frame">
                  <div className="qr-scanner-corner qr-scanner-corner-tl"></div>
                  <div className="qr-scanner-corner qr-scanner-corner-tr"></div>
                  <div className="qr-scanner-corner qr-scanner-corner-bl"></div>
                  <div className="qr-scanner-corner qr-scanner-corner-br"></div>
                  <div className="qr-scanner-scan-line"></div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="qr-scanner-footer">
          <p className="qr-scanner-note">Place the QR code within the frame to scan it</p>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;

