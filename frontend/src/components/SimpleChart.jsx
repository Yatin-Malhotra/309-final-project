// Simple chart component using recharts
import { useState } from 'react';
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
import '../styles/components/SimpleChart.css';

const SimpleChart = ({ type, data, dataKey, xKey = 'date', height = 300, className = '' }) => {
  const { isDark } = useTheme();
  
  // Theme-aware colors with good distinction - using varied hues across teal/blue/green spectrum
  const COLORS = isDark 
    ? [
        '#6B9FA3', // Medium teal-blue
        '#7AB5BA', // Lighter teal-blue  
        '#5A9BA0', // Medium blue-teal
        '#8BC4C9', // Light teal-cyan
        '#4F7C82', // Medium teal
        '#6FA8B0', // Medium-light teal
        '#93B1B5', // Light blue-gray
        '#4A8A94'  // Medium-dark teal-green
      ]
    : [
        '#3D6B72', // Darker teal (distinct dark)
        '#4F7C82', // Medium teal (distinct medium-dark)
        '#4A8A94', // Medium-dark teal-green (distinct green-teal)
        '#5A9BA0', // Medium blue-teal (distinct blue-teal)
        '#6B9FA3', // Medium teal-blue (distinct medium)
        '#6FA8B0', // Medium-light teal (distinct lighter)
        '#7AB5BA', // Lighter teal-blue (distinct light)
        '#93B1B5'  // Light blue-gray (distinct lightest)
      ];
  const textColor = isDark ? '#B8E3E9' : '#0B2E33';
  const gridColor = isDark ? 'rgba(184, 227, 233, 0.1)' : 'rgba(11, 46, 51, 0.1)';
  const [activeIndex, setActiveIndex] = useState(null);

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
                backgroundColor: isDark ? '#1a2d31' : '#ffffff',
                border: `1px solid ${isDark ? '#4F7C82' : '#93B1B5'}`,
                borderRadius: '8px',
                color: textColor,
                boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 2px 8px rgba(11, 46, 51, 0.15)'
              }}
              itemStyle={{
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
          <BarChart {...commonProps} barCategoryGap="20%">
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
              cursor={{ fill: 'transparent' }}
            />
            <Legend wrapperStyle={{ color: textColor }} />
            {Array.isArray(dataKey) ? (
              dataKey.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[index % COLORS.length]}
                  activeBar={{ fill: COLORS[index % COLORS.length], opacity: 0.8 }}
                />
              ))
            ) : (
              <Bar 
                dataKey={dataKey} 
                fill={COLORS[0]}
                activeBar={{ fill: COLORS[0], opacity: 0.8 }}
              />
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
              label={false}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              activeIndex={activeIndex}
              activeShape={{ outerRadius: 90 }}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1a2d31' : '#ffffff',
                border: `1px solid ${isDark ? '#4F7C82' : '#93B1B5'}`,
                borderRadius: '8px',
                color: textColor,
                boxShadow: isDark ? '0 4px 12px rgba(0, 0, 0, 0.5)' : '0 2px 8px rgba(11, 46, 51, 0.15)'
              }}
              itemStyle={{
                color: textColor
              }}
            />
            <Legend 
              wrapperStyle={{ color: textColor }} 
              iconType="circle"
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
};

export default SimpleChart;

