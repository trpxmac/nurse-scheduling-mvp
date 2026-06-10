export default function StatCard({ icon: Icon, label, value, color = 'blue', suffix = '' }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className={`stat-icon ${color}`}>
        {Icon && <Icon size={20} />}
      </div>
      <div className="stat-value">
        {value}{suffix && <span style={{ fontSize: '0.9rem', fontWeight: 500, marginLeft: 4 }}>{suffix}</span>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
