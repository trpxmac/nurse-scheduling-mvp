import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Settings, Clock, Users, CalendarDays,
  BarChart3, Sparkles, Building2, PlusCircle, Trash2
} from 'lucide-react';
import { loadDepartments, loadActiveDepartment, saveActiveDepartment, saveDepartments } from '../utils/storage';
import CustomDialog from './CustomDialog';

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
      { to: '/ai-roster', label: 'จัดเวรอัตโนมัติ', icon: Sparkles, step: 6 },
    ]
  }
];

export default function Sidebar() {
  const [departments, setDepartments] = useState([]);
  const [activeDept, setActiveDept] = useState(null);
  const [dialog, setDialog] = useState({ isOpen: false, type: 'ALERT', title: '', message: '', value: '', onConfirm: null, danger: false });

  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const fetchDepts = () => {
      setDepartments(loadDepartments());
      setActiveDept(loadActiveDepartment());
    };
    fetchDepts();
    
    window.addEventListener('nss_department_updated', fetchDepts);
    return () => window.removeEventListener('nss_department_updated', fetchDepts);
  }, []);

  const handleDeptChange = (e) => {
    const val = e.target.value;
    if (val === '__ADD_NEW__') {
      setDialog({
        isOpen: true,
        type: 'PROMPT',
        title: 'ตั้งชื่อแผนกใหม่',
        message: 'กรุณาระบุชื่อแผนกใหม่ (เช่น OPD, Ward 6B, IPU2):',
        value: '',
        onConfirm: (name) => {
          if (name && name.trim()) {
            const id = 'dept_' + Date.now();
            const newDept = { id, name: name.trim() };
            const updated = [...departments, newDept];
            saveDepartments(updated);
            saveActiveDepartment(newDept);
            window.location.reload();
          } else {
            // Re-render select
            setActiveDept({...activeDept});
          }
        }
      });
      // Temporarily revert select value
      e.target.value = activeDept?.id || '';
    } else {
      const selected = departments.find(d => d.id === val);
      if (selected) {
        saveActiveDepartment(selected);
        window.location.reload();
      }
    }
  };

  const handleDeleteDept = () => {
    if (departments.length <= 1) {
      setDialog({
        isOpen: true,
        type: 'ALERT',
        title: 'ไม่สามารถลบได้',
        message: 'ไม่สามารถลบแผนกสุดท้ายได้ ต้องมีอย่างน้อย 1 แผนกในระบบ',
        onConfirm: closeDialog
      });
      return;
    }
    setDialog({
      isOpen: true,
      type: 'CONFIRM',
      title: 'ยืนยันการลบแผนก',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบแผนก "${activeDept.name}" ?\nข้อมูลที่เกี่ยวข้องกับแผนกนี้อาจไม่สามารถกู้คืนได้`,
      danger: true,
      confirmText: 'ลบแผนก',
      onConfirm: () => {
        const updated = departments.filter(d => d.id !== activeDept.id);
        saveDepartments(updated);
        saveActiveDepartment(updated[0]); // สลับไปแผนกแรกอัตโนมัติ
        window.location.reload();
      }
    });
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
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <select 
              value={activeDept.id} 
              onChange={handleDeptChange}
              style={{ 
                flex: 1, padding: '6px 8px', borderRadius: '6px', 
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
            {departments.length > 1 && (
              <button 
                onClick={handleDeleteDept}
                title="ลบแผนกนี้"
                style={{
                  background: 'transparent', border: 'none', color: 'var(--color-danger)',
                  cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '4px'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,0,0,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
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

      <CustomDialog
        isOpen={dialog.isOpen}
        onClose={closeDialog}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        value={dialog.value}
        onChange={(val) => setDialog(prev => ({ ...prev, value: val }))}
        onConfirm={dialog.onConfirm}
        danger={dialog.danger}
        confirmText={dialog.confirmText}
      />
    </aside>
  );
}
