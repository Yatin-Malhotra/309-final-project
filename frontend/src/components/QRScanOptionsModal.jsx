// QR Scan Options Modal - Shows options after scanning a QR code
import React from 'react';
import '../styles/components/QRScanOptionsModal.css';

const QRScanOptionsModal = ({ isOpen, onClose, utorid, onCreateTransaction, onCheckRedemption }) => {
  if (!isOpen) return null;

  return (
    <div className="qr-scan-options-overlay" onClick={onClose}>
      <div className="qr-scan-options-content" onClick={(e) => e.stopPropagation()}>
        <div className="qr-scan-options-header">
          <h2>QR Code Scanned</h2>
          <button className="qr-scan-options-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="qr-scan-options-body">
          <p className="qr-scan-options-utorid">UTORid: <strong>{utorid}</strong></p>
          <p className="qr-scan-options-message">What would you like to do?</p>
        </div>
        <div className="qr-scan-options-actions">
          <button 
            className="btn btn-primary qr-scan-options-btn" 
            onClick={() => {
              onCreateTransaction();
              onClose();
            }}
          >
            <span className="qr-scan-options-icon">➕</span>
            <span>Create New Transaction</span>
          </button>
          <button 
            className="btn btn-secondary qr-scan-options-btn" 
            onClick={() => {
              onCheckRedemption();
              onClose();
            }}
          >
            <span className="qr-scan-options-icon">🔍</span>
            <span>Check Pending Redemption</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRScanOptionsModal;

