export default function ShiftBadge({ code, color, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'text-xs' : '';
  const customStyle = color ? {
    backgroundColor: `${color}35`,
    color: '#1e293b',
    borderColor: `${color}60`
  } : {};
  return (
    <span className={`badge badge-${code || 'OFF'} ${sizeClass}`} style={customStyle}>
      {code || '-'}
    </span>
  );
}
