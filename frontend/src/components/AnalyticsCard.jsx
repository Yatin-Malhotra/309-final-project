// Reusable analytics card component for displaying metrics
import './AnalyticsCard.css';

const AnalyticsCard = ({ title, value, subtitle, description, children, className = '' }) => {
  return (
    <div className={`analytics-card ${className}`}>
      <div className="analytics-card-title">{title}</div>
      {value !== undefined && (
        <div className="analytics-card-value">{value}</div>
      )}
      {subtitle && (
        <div className="analytics-card-subtitle">{subtitle}</div>
      )}
      {description && (
        <div className="analytics-card-description">{description}</div>
      )}
      {children && (
        <div className="analytics-card-content">{children}</div>
      )}
    </div>
  );
};

export default AnalyticsCard;

