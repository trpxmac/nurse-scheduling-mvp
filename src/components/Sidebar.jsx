import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Settings, Clock, Users, CalendarDays,
  BarChart3, Sparkles, Building2, PlusCircle
} from 'lucide-react';
import { loadDepartments, loadActiveDepartment, saveActiveDepartment, saveDepartments } from '../utils/storage';

const navItems = [
  {
    section: 'ตั้งค่า',
    items: [
      { to: '/', label: 'ตั้งค่าหน่วยงาน', icon: Settings, step: 1 },
      { to: '/shift-types', label: 'ประเภทเวร', icon: Clock, step: 2 },
    ]
  },
  {
    section: 'จัดการ',
    items: [
      { to: '/staff', label: 'รายชื่อบุคลากร', icon: Users, step: 3 },
      { to: '/roster', label: 'จัดตารางเวร', icon: CalendarDays, step: 4 },
    ]
  },
  {
    section: 'ผลลัพธ์',
    items: [
      { to: '/results', label: 'ตรวจสอบผลลัพธ์', icon: BarChart3, step: 5 },
      { to: '/ai-roster', label: 'AI จัดเวร', icon: Sparkles, step: 6 },
    ]
  }
];

export default function Sidebar() {
  const [departments, setDepartments] = useState([]);
  const [activeDept, setActiveDept] = useState(null);

  useEffect(() => {
    setDepartments(loadDepartments());
    setActiveDept(loadActiveDepartment());
  }, []);

  const handleDeptChange = (e) => {
    const val = e.target.value;
    if (val === '__ADD_NEW__') {
      const name = window.prompt("ตั้งชื่อแผนกใหม่ (เช่น OPD, Ward 6B, IPU2):");
      if (name && name.trim()) {
        const id = 'dept_' + Date.now();
        const newDept = { id, name: name.trim() };
        const updated = [...departments, newDept];
        saveDepartments(updated);
        saveActiveDepartment(newDept);
        window.location.reload();
      } else {
        // Reset select back to current active dept
        e.target.value = activeDept?.id || '';
      }
    } else {
      const selected = departments.find(d => d.id === val);
      if (selected) {
        saveActiveDepartment(selected);
        window.location.reload();
      }
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/logo.png" alt="Bangkok Hospital Siriroj" style={{ width: '100%', height: 'auto', maxHeight: '50px', objectFit: 'contain' }} />
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Building2 size={14} style={{ color: 'var(--color-primary-light)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>แผนกปัจจุบัน</span>
        </div>
        {activeDept && (
          <select 
            value={activeDept.id} 
            onChange={handleDeptChange}
            style={{ 
              width: '100%', padding: '6px 8px', borderRadius: '6px', 
              background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)',
              border: '1px solid var(--border-color)', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
            <option disabled>──────────</option>
            <option value="__ADD_NEW__">+ เพิ่มแผนกใหม่...</option>
          </select>
        )}
      </div>

      <nav className="sidebar-nav">
        {navItems.map((section) => (
          <div key={section.section}>
            <div className="nav-section-label">{section.section}</div>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
              >
                <span className="nav-step">{item.step}</span>
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>Bangkok Hospital Siriroj</p>
        <p className="version">v1.0.0</p>
      </div>
    </aside>
  );
}
