import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import useTableSort from '../useTableSort';

describe('useTableSort', () => {
  const mockData = [
    { id: 1, name: 'Alice', age: 30, nested: { val: 10 } },
    { id: 2, name: 'Bob', age: 25, nested: { val: 20 } },
    { id: 3, name: 'Charlie', age: 35, nested: { val: 5 } },
  ];

  it('should return original data initially', () => {
    const { result } = renderHook(() => useTableSort(mockData));
    expect(result.current.sortedData).toEqual(mockData);
    expect(result.current.sortConfig).toEqual({ key: null, direction: 'asc' });
  });

  it('should sort ascending by number', () => {
    const { result } = renderHook(() => useTableSort(mockData));

    act(() => {
      result.current.handleSort('age');
    });

    expect(result.current.sortConfig).toEqual({ key: 'age', direction: 'asc' });
    expect(result.current.sortedData).toEqual([
      { id: 2, name: 'Bob', age: 25, nested: { val: 20 } },
      { id: 1, name: 'Alice', age: 30, nested: { val: 10 } },
      { id: 3, name: 'Charlie', age: 35, nested: { val: 5 } },
    ]);
  });

  it('should sort descending when clicking same column', () => {
    const { result } = renderHook(() => useTableSort(mockData));

    act(() => {
      result.current.handleSort('age');
    });
    act(() => {
      result.current.handleSort('age');
    });

    expect(result.current.sortConfig).toEqual({ key: 'age', direction: 'desc' });
    expect(result.current.sortedData).toEqual([
      { id: 3, name: 'Charlie', age: 35, nested: { val: 5 } },
      { id: 1, name: 'Alice', age: 30, nested: { val: 10 } },
      { id: 2, name: 'Bob', age: 25, nested: { val: 20 } },
    ]);
  });

  it('should sort by string', () => {
    const { result } = renderHook(() => useTableSort(mockData));

    act(() => {
      result.current.handleSort('name');
    });

    expect(result.current.sortedData[0].name).toBe('Alice');
    expect(result.current.sortedData[2].name).toBe('Charlie');
  });

  it('should handle custom accessor for nested properties', () => {
    const config = {
      nestedVal: {
        accessor: (item) => item.nested.val,
      },
    };
    const { result } = renderHook(() => useTableSort(mockData, config));

    act(() => {
      result.current.handleSort('nestedVal');
    });

    expect(result.current.sortedData[0].nested.val).toBe(5); // Charlie
    expect(result.current.sortedData[1].nested.val).toBe(10); // Alice
    expect(result.current.sortedData[2].nested.val).toBe(20); // Bob
  });

  it('should handle custom sort function', () => {
    const config = {
      custom: {
        sortFn: (a, b) => a.name.length - b.name.length,
      },
    };
    const { result } = renderHook(() => useTableSort(mockData, config));

    act(() => {
      result.current.handleSort('custom');
    });

    // Bob (3), Alice (5), Charlie (7)
    expect(result.current.sortedData[0].name).toBe('Bob');
    expect(result.current.sortedData[1].name).toBe('Alice');
    expect(result.current.sortedData[2].name).toBe('Charlie');
  });
});

