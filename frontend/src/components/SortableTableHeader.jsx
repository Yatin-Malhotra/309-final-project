// Sortable table header component
import '../styles/components/SortableTableHeader.css';

const SortableTableHeader = ({ children, sortKey, currentSortKey, sortDirection, onSort }) => {
  const isActive = currentSortKey === sortKey;
  const className = `sortable-header ${isActive ? 'active' : ''} ${isActive ? sortDirection : ''}`;

  return (
    <th 
      className={className}
      onClick={() => onSort(sortKey)}
    >
      {children}
      <span className="sortable-header-icon"></span>
    </th>
  );
};

export default SortableTableHeader;

