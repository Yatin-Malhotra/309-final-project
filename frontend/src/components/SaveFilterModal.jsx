import { useState } from 'react';
import '../styles/components/SavedFilters.css';

const SaveFilterModal = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name);
      setName('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="saved-filters-modal-overlay" onClick={onClose}>
      <div className="saved-filters-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="saved-filters-modal-close" onClick={onClose}>×</button>
        <div className="saved-filters-modal-header">
          <h2>Save Current Filters</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="filterName">Filter Name</label>
            <input
              type="text"
              id="filterName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Large Redemptions"
              required
              autoFocus
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveFilterModal;

