// Custom hook for table sorting
import { useState, useMemo } from 'react';

const useTableSort = (data, config = {}, options = { manualSort: false }) => {
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: 'asc', // 'asc' or 'desc'
  });

  const handleSort = (key, sortFn) => {
    setSortConfig((prevConfig) => {
      // If clicking the same column, toggle direction
      if (prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      // If clicking a different column, start with ascending
      return {
        key,
        direction: 'asc',
      };
    });
  };

  const sortedData = useMemo(() => {
    if (options.manualSort) {
      return data;
    }

    if (!sortConfig.key || !data || data.length === 0) {
      return data;
    }

    const sorted = [...data].sort((a, b) => {
      // Get custom sort function from config if provided
      const customSortFn = config[sortConfig.key]?.sortFn;
      
      if (customSortFn) {
        const result = customSortFn(a, b);
        return sortConfig.direction === 'asc' ? result : -result;
      }

      // Default sorting logic
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      // Handle nested properties (e.g., user.name)
      if (config[sortConfig.key]?.accessor) {
        aValue = config[sortConfig.key].accessor(a);
        bValue = config[sortConfig.key].accessor(b);
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Handle dates
      if (aValue instanceof Date || (typeof aValue === 'string' && !isNaN(Date.parse(aValue)))) {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle strings
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [data, sortConfig, config, options.manualSort]);

  return {
    sortedData,
    sortConfig,
    handleSort,
  };
};

export default useTableSort;

