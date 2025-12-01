import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AnimatedNumber from '../AnimatedNumber';

// Mock the hook
vi.mock('../../hooks/useAnimatedNumber', () => ({
  default: vi.fn((val) => val),
}));

describe('AnimatedNumber', () => {
  it('should render the value returned by the hook', () => {
    render(<AnimatedNumber value={100} />);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should apply className', () => {
    const { container } = render(<AnimatedNumber value={100} className="test-class" />);
    expect(container.firstChild).toHaveClass('test-class');
  });
});

