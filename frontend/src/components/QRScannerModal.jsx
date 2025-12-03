// QR Scanner Modal Component - Functional QR code scanner
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import '../styles/components/QRScannerModal.css';

const QRScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      // Clean up when modal closes
      stopScanning();
      return;
    }

    // Start scanning when modal opens
    startScanning();

    // Cleanup on unmount
    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async () => {
    try {
      setError(null);
      setScanResult(null);
      
      const scanner = new Html5Qrcode('qr-scanner-container');
      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: 'environment', // Use back camera if available
        },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText, decodedResult) => {
          // Successfully scanned QR code
          setScanResult(decodedText);
          setIsScanning(true);
          
          // Stop scanning after successful scan
          stopScanning();
          
          // Call callback if provided
          if (onScanSuccess) {
            onScanSuccess(decodedText);
          }
        },
        (errorMessage) => {
          // Ignore scanning errors (they're frequent while searching)
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Unable to access camera. Please check permissions.');
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        // Ignore errors when stopping
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    setScanResult(null);
    onClose();
  };

  const handleRetry = () => {
    setError(null);
    setScanResult(null);
    startScanning();
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
          <p className="qr-scanner-subtitle">
            {scanResult ? 'QR Code scanned successfully!' : 'Position QR code within the frame'}
          </p>
        </div>
        
        <div className="qr-scanner-video-container">
          {error ? (
            <div className="qr-scanner-error">
              <div className="qr-scanner-error-icon">⚠️</div>
              <p>{error}</p>
              <button 
                className="btn btn-primary" 
                onClick={handleRetry}
                style={{ marginTop: '16px' }}
              >
                Retry
              </button>
            </div>
          ) : scanResult ? (
            <div className="qr-scanner-success">
              <div className="qr-scanner-success-icon">✓</div>
              <p>Scanned: {scanResult}</p>
              <button 
                className="btn btn-primary" 
                onClick={handleClose}
                style={{ marginTop: '16px' }}
              >
                Continue
              </button>
            </div>
          ) : (
            <div id="qr-scanner-container" style={{ width: '100%', minHeight: '300px' }}></div>
          )}
        </div>

        {!error && !scanResult && (
          <div className="qr-scanner-footer">
            <p className="qr-scanner-note">Place the QR code within the frame to scan it</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRScannerModal;

