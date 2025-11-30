import useAnimatedNumber from '../hooks/useAnimatedNumber';

const AnimatedNumber = ({ value, className = '' }) => {
  const animatedValue = useAnimatedNumber(value, 2000);
  return <span className={className}>{animatedValue}</span>;
};

export default AnimatedNumber;

