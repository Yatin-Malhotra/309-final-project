import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AnalyticsCard from '../AnalyticsCard';

// Mock the hook to return the value immediately
vi.mock('../../hooks/useAnimatedNumber', () => ({
  default: vi.fn((val) => val),
}));

describe('AnalyticsCard', () => {
  it('should render title and value', () => {
    render(<AnalyticsCard title="Test Title" value="100" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should render subtitle and description', () => {
    render(<AnalyticsCard title="T" value="0" subtitle="Sub" description="Desc" />);
    expect(screen.getByText('Sub')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  it('should render children', () => {
    render(
      <AnalyticsCard title="T" value="0">
        <div data-testid="child">Child Content</div>
      </AnalyticsCard>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should handle non-numeric values correctly', () => {
     render(<AnalyticsCard title="Status" value="Active" />);
     expect(screen.getByText('Active')).toBeInTheDocument();
  });
});

