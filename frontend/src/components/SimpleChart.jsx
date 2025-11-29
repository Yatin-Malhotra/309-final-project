// Simple chart component using recharts
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import './SimpleChart.css';

const COLORS = ['#4F7C82', '#93B1B5', '#B8E3E9', '#0B2E33', '#6B9FA3'];

const SimpleChart = ({ type, data, dataKey, xKey = 'date', height = 300, className = '' }) => {
  const { isDark } = useTheme();
  const textColor = isDark ? '#B8E3E9' : '#0B2E33';
  const gridColor = isDark ? 'rgba(184, 227, 233, 0.1)' : 'rgba(11, 46, 51, 0.1)';

  if (!data || data.length === 0) {
    return (
      <div className={`simple-chart-empty ${className}`}>
        <p>No data available</p>
      </div>
    );
  }

  const commonProps = {
    data,
    margin: { top: 5, right: 30, left: 20, bottom: 5 }
  };

  if (type === 'line') {
    return (
      <div className={`simple-chart ${className}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey={xKey}
              stroke={textColor}
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke={textColor} style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#0B2E33' : '#B8E3E9',
                border: `1px solid ${isDark ? '#4F7C82' : '#93B1B5'}`,
                borderRadius: '8px',
                color: textColor
              }}
            />
            <Legend wrapperStyle={{ color: textColor }} />
            {Array.isArray(dataKey) ? (
              dataKey.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              ))
            ) : (
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={COLORS[0]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'bar') {
    return (
      <div className={`simple-chart ${className}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey={xKey}
              stroke={textColor}
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke={textColor} style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#0B2E33' : '#B8E3E9',
                border: `1px solid ${isDark ? '#4F7C82' : '#93B1B5'}`,
                borderRadius: '8px',
                color: textColor
              }}
            />
            <Legend wrapperStyle={{ color: textColor }} />
            {Array.isArray(dataKey) ? (
              dataKey.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[index % COLORS.length]}
                />
              ))
            ) : (
              <Bar dataKey={dataKey} fill={COLORS[0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'pie') {
    // Handle pie chart data - data should be array of {name, value} objects
    let pieData;
    if (Array.isArray(dataKey)) {
      // If dataKey is array, aggregate values from data
      pieData = dataKey.map((key) => ({
        name: key,
        value: data.reduce((sum, item) => sum + (item[key] || 0), 0)
      }));
    } else if (dataKey && data.length > 0 && data[0][dataKey] !== undefined) {
      // If dataKey is a single key, use it directly
      pieData = data.map((item) => ({
        name: item[xKey] || 'Unknown',
        value: item[dataKey] || 0
      }));
    } else if (data.length > 0 && data[0].name && data[0].value !== undefined) {
      // Data is already formatted as {name, value} objects
      pieData = data;
    } else {
      // Fallback: extract from first object
      pieData = Object.entries(data[0] || {})
        .filter(([key]) => key !== xKey)
        .map(([name, value]) => ({ name, value }));
    }

    // Filter out entries with 0 values
    pieData = pieData.filter((entry) => entry.value > 0);

    // If no data after filtering, show empty state
    if (pieData.length === 0) {
      return (
        <div className={`simple-chart-empty ${className}`}>
          <p>No data available</p>
        </div>
      );
    }

    return (
      <div className={`simple-chart ${className}`} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#0B2E33' : '#B8E3E9',
                border: `1px solid ${isDark ? '#4F7C82' : '#93B1B5'}`,
                borderRadius: '8px',
                color: textColor
              }}
            />
            <Legend wrapperStyle={{ color: textColor }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
};

export default SimpleChart;

