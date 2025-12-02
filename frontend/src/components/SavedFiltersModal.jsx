import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { savedFilterAPI } from '../services/api';
import ConfirmationModal from './ConfirmationModal';
import './SavedFilters.css';

const SavedFiltersModal = ({ isOpen, onClose, onSelect, page }) => {
  const [filters, setFilters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    filterId: null
  });

  useEffect(() => {
    if (isOpen) {
      loadFilters();
    }
  }, [isOpen, page]);

  const loadFilters = async () => {
    try {
      setLoading(true);
      const response = await savedFilterAPI.getSavedFilters(page);
      setFilters(response.data);
    } catch (error) {
      toast.error('Failed to load saved filters');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (e, id) => {
    e.stopPropagation();
    setDeleteModal({
      isOpen: true,
      filterId: id
    });
  };

  const handleConfirmDelete = async () => {
    const { filterId } = deleteModal;
    try {
      await savedFilterAPI.deleteSavedFilter(filterId);
      setFilters(filters.filter(f => f.id !== filterId));
      toast.success('Filter deleted');
    } catch (error) {
      toast.error('Failed to delete filter');
    } finally {
      setDeleteModal({ isOpen: false, filterId: null });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="saved-filters-modal-overlay" onClick={onClose}>
      <div className="saved-filters-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="saved-filters-modal-close" onClick={onClose}>×</button>
        <div className="saved-filters-modal-header">
          <h2>Saved Filters</h2>
        </div>
        
        {loading ? (
          <div className="saved-filters-loading">Loading...</div>
        ) : filters.length === 0 ? (
          <div className="saved-filters-empty">No saved filters found.</div>
        ) : (
          <div className="saved-filters-list">
            {filters.map(filter => (
              <div 
                key={filter.id} 
                className="saved-filter-item"
                onClick={() => {
                    let parsed;
                    try {
                        parsed = typeof filter.filters === 'string' ? JSON.parse(filter.filters) : filter.filters;
                    } catch(e) {
                        parsed = {};
                    }
                    onSelect(parsed);
                    onClose();
                }}
              >
                <div className="saved-filter-info">
                    <span className="saved-filter-name">{filter.name}</span>
                    <span className="saved-filter-date">{new Date(filter.createdAt).toLocaleDateString()}</span>
                </div>
                <button 
                    className="saved-filter-delete-btn"
                    onClick={(e) => handleDeleteClick(e, filter.id)}
                    title="Delete filter"
                >
                    Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleConfirmDelete}
        title="Delete Filter"
        message="Are you sure you want to delete this filter?"
        confirmLabel="Delete"
        isDangerous={true}
      />
    </div>
  );
};

export default SavedFiltersModal;

