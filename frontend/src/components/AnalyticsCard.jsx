// Reusable analytics card component for displaying metrics
import { useMemo } from 'react';
import useAnimatedNumber from '../hooks/useAnimatedNumber';
import '../styles/components/AnalyticsCard.css';

const AnalyticsCard = ({ title, value, subtitle, description, children, className = '' }) => {
  // Check if value is numeric (number or string containing a number)
  const isNumeric = useMemo(() => {
    if (value === undefined || value === null) return false;
    if (typeof value === 'number') return true;
    if (typeof value === 'string') {
      // Check if string contains a number (handles cases like "100 pts", "$50.00", "75%")
      return /[\d.,]+/.test(value);
    }
    return false;
  }, [value]);

  const animatedValue = useAnimatedNumber(isNumeric ? value : 0, 2000);
  const displayValue = isNumeric ? animatedValue : value;

  return (
    <div className={`analytics-card dashboard-quick-access-card ${className}`}>
      {value !== undefined && (
        <div className="dashboard-quick-access-value">{displayValue}</div>
      )}
      <div className="dashboard-quick-access-content">
        {title && (
          <div className="dashboard-quick-access-title">{title}</div>
        )}
        {subtitle && (
          <div className="dashboard-quick-access-description">{subtitle}</div>
        )}
        {description && (
          <div className="dashboard-quick-access-description">{description}</div>
        )}
      </div>
      {children && (
        <div className="analytics-card-content">{children}</div>
      )}
    </div>
  );
};

export default AnalyticsCard;

