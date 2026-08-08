import { useCountUp } from '../hooks/useAnimations';

export default function CountUp({ value, decimals = 0, rate = false, className = 'num' }) {
  const ref = useCountUp(value, { decimals, rate });
  return <div ref={ref} className={className}>0</div>;
}
