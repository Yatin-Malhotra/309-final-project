// Reusable sortable table component
import useTableSort from '../hooks/useTableSort';
import SortableTableHeader from './SortableTableHeader';

const SortableTable = ({ data, columns, config = {}, className = '', renderRow }) => {
  const { sortedData, sortConfig: currentSort, handleSort } = useTableSort(data, config);

  return (
    <table className={className}>
      <thead>
        <tr>
          {columns.map((col) => (
            col.sortable !== false ? (
              <SortableTableHeader
                key={col.key}
                sortKey={col.key}
                currentSortKey={currentSort.key}
                sortDirection={currentSort.direction}
                onSort={handleSort}
              >
                {col.label}
              </SortableTableHeader>
            ) : (
              <th key={col.key}>{col.label}</th>
            )
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedData.map((row) => renderRow(row))}
      </tbody>
    </table>
  );
};

export default SortableTable;

