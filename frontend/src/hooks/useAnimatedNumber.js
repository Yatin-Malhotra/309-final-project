import { useState, useEffect } from 'react';

const useAnimatedNumber = (targetValue, duration = 2000) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    // Parse the target value - handle strings with units
    let numericValue = targetValue;
    let prefix = '';
    let suffix = '';
    
    if (typeof targetValue === 'string') {
      // Extract number and unit (e.g., "100 pts", "$50.00", "75%")
      const match = targetValue.match(/^(\D*)([\d.,]+)(\D*)$/);
      if (match) {
        prefix = match[1] || '';
        numericValue = parseFloat(match[2].replace(/,/g, ''));
        suffix = match[3] || '';
      } else {
        // If it's not a number, return as is
        setDisplayValue(targetValue);
        return;
      }
    }

    if (isNaN(numericValue)) {
      setDisplayValue(targetValue);
      return;
    }

    // Start animation from 0
    setDisplayValue(prefix + '0' + suffix);
    
    const startTime = Date.now();
    const startValue = 0;
    const endValue = numericValue;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      const currentValue = startValue + (endValue - startValue) * easeOutQuart;
      
      // Format the number based on original format
      let formattedValue;
      if (typeof targetValue === 'string' && targetValue.includes('.')) {
        // Preserve decimal places
        const decimals = targetValue.split('.')[1]?.match(/\d/)?.[0] ? targetValue.split('.')[1].length : 0;
        formattedValue = currentValue.toFixed(decimals);
      } else {
        formattedValue = Math.floor(currentValue);
      }
      
      setDisplayValue(prefix + formattedValue + suffix);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final value matches exactly
        setDisplayValue(targetValue);
      }
    };

    const animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, [targetValue, duration]);

  return displayValue;
};

export default useAnimatedNumber;

