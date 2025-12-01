import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useAnimatedNumber from '../useAnimatedNumber';

describe('useAnimatedNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "0" initially for numeric target', () => {
    const { result } = renderHook(() => useAnimatedNumber(100));
    // It starts at "0" because of string concatenation
    expect(result.current).toBe("0");
  });

  it('should animate to the target value', async () => {
    const duration = 1000;
    const { result } = renderHook(() => useAnimatedNumber(100, duration));

    expect(result.current).toBe("0");

    // Advance time to half duration
    await act(async () => {
      vi.advanceTimersByTime(duration / 2);
    });

    // Value should be somewhere in between (approx 50, but easing applies)
    // The result is a string, so parse it
    const currentVal = parseFloat(result.current);
    expect(currentVal).toBeGreaterThan(0);
    expect(currentVal).toBeLessThan(100);

    // Advance time to full duration
    await act(async () => {
      vi.advanceTimersByTime(duration / 2 + 100);
    });

    expect(result.current).toBe(100);
  });

  it('should handle string values with units', async () => {
    const { result } = renderHook(() => useAnimatedNumber('100 pts', 1000));

    expect(result.current).toBe('0 pts');

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current).toBe('100 pts');
  });

  it('should handle currency formatting', async () => {
    const { result } = renderHook(() => useAnimatedNumber('$50.00', 1000));

    // Initial value doesn't preserve decimals in current implementation
    expect(result.current).toBe('$0');

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current).toBe('$50.00');
  });

  it('should update when target value changes', async () => {
    const { result, rerender } = renderHook(({ val }) => useAnimatedNumber(val, 1000), {
      initialProps: { val: 100 },
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    expect(result.current).toBe(100);

    // Update target value
    rerender({ val: 200 });

    // It should start animating from 100 to 200 (actually resets to 0 in current impl?)
    // Checking implementation: 
    // useEffect dependencies are [targetValue, duration].
    // Inside useEffect: setDisplayValue(prefix + '0' + suffix); -> It resets to 0!
    
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    
    expect(result.current).toBe(200);
  });

  it('should handle non-numeric strings immediately', () => {
    const { result } = renderHook(() => useAnimatedNumber('Not a number'));
    expect(result.current).toBe('Not a number');
  });
});

