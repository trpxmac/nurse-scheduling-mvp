export default function ShiftBadge({ code, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'text-xs' : '';
  return (
    <span className={`badge badge-${code || 'OFF'} ${sizeClass}`}>
      {code || '-'}
    </span>
  );
}
