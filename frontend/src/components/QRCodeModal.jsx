// QR Code Modal Component - Placeholder for scanning
import './QRCodeModal.css';
import qrCodeImage from '../assets/qr-code.png';

const QRCodeModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="qr-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="qr-modal-header">
          <h2>Scan QR Code</h2>
          <p className="qr-modal-subtitle">Present this code for scanning</p>
        </div>
        <div className="qr-code-container">
          <img 
            src={qrCodeImage} 
            alt="QR Code" 
            className="qr-code-image"
          />
        </div>
        <div className="qr-modal-footer">
          <p className="qr-modal-note">Your Unique QR Code</p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;

