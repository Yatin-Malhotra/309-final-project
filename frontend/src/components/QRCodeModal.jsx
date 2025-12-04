// QR Code Modal Component - Generates unique QR code per user
import { useAuth } from '../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import '../styles/components/QRCodeModal.css';

const QRCodeModal = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  
  if (!isOpen) return null;

  // Generate QR code with user's UTORid
  const qrValue = user?.utorid || '';

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="qr-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="qr-modal-header">
          <h2>Your QR Code</h2>
          <p className="qr-modal-subtitle">Present this code for scanning</p>
        </div>
        <div className="qr-code-container">
          {qrValue ? (
            <QRCodeSVG
              value={qrValue}
              size={256}
              level="H"
              includeMargin={true}
              className="qr-code-image"
            />
          ) : (
            <div className="qr-code-error">Unable to generate QR code</div>
          )}
        </div>
        <div className="qr-modal-footer">
          <p className="qr-modal-note">Your Unique QR Code</p>
          {user?.utorid && (
            <p className="qr-modal-utorid">UTORid: {user.utorid}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;

