import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Settings, Clock, Users, CalendarDays,
  BarChart3, Sparkles, Building2, PlusCircle, Trash2, Plane
} from 'lucide-react';
import { loadDepartments, loadActiveDepartment, saveActiveDepartment, saveDepartments, pullFromDatabase, loadActiveMonth } from '../utils/storage';
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
      { to: '/leave-schedule', label: 'กำหนดช่วงลา/อบรม', icon: Plane, step: 4 },
      { to: '/roster', label: 'จัดตารางเวร', icon: CalendarDays, step: 5 },
    ]
  },
  {
    section: 'ผลลัพธ์',
    items: [
      { to: '/results', label: 'ตรวจสอบผลลัพธ์', icon: BarChart3, step: 6 },
      { to: '/ai-roster', label: 'จัดเวรอัตโนมัติ', icon: Sparkles, step: 7 },
    ]
  }
];

export default function Sidebar() {
  const [departments, setDepartments] = useState([]);
  const [activeDept, setActiveDept] = useState(null);
  const [activeMonth, setActiveMonth] = useState(loadActiveMonth());
  const [dialog, setDialog] = useState({ isOpen: false, type: 'ALERT', title: '', message: '', value: '', onConfirm: null, danger: false });
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  useEffect(() => {
    const fetchDepts = async () => {
      const depts = await loadDepartments();
      setDepartments(depts);
      setActiveDept(loadActiveDepartment());
    };
    fetchDepts();
    
    const handleMonthUpdate = (e) => setActiveMonth(e.detail);

    window.addEventListener('nss_department_updated', fetchDepts);
    window.addEventListener('nss_month_updated', handleMonthUpdate);
    return () => {
      window.removeEventListener('nss_department_updated', fetchDepts);
      window.removeEventListener('nss_month_updated', handleMonthUpdate);
    };
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
        onConfirm: async (name) => {
          if (name && name.trim()) {
            const id = 'dept_' + Date.now();
            const newDept = { id, name: name.trim() };
            const updated = [...departments, newDept];
            await saveDepartments(updated);
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
      onConfirm: async () => {
        const updated = departments.filter(d => d.id !== activeDept.id);
        await saveDepartments(updated);
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

          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Building2 size={18} style={{ color: '#60a5fa' }} />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>แผนกปัจจุบัน</span>
            </div>
            {activeDept && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  value={activeDept.id} 
                  onChange={handleDeptChange}
                  style={{ 
                    flex: 1, padding: '10px 12px', borderRadius: '8px', 
                    background: '#1e293b', color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.15)', fontSize: '15px', fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                  <option disabled>──────────</option>
                  <option value="__ADD_NEW__" style={{ color: '#60a5fa' }}>+ เพิ่มแผนกใหม่...</option>
                </select>
                {departments.length > 1 && (
                  <button 
                    onClick={handleDeleteDept}
                    title="ลบแผนกนี้"
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#ef4444',
                      cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '6px', transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={18} style={{ color: '#f472b6' }} />
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>เดือนที่กำลังจัดตาราง</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginTop: '2px' }}>
                  {activeMonth ? new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(new Date(activeMonth + '-01')) : 'ยังไม่ได้เลือก'}
                </div>
              </div>
            </div>
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



          <div className="sidebar-footer" style={{ padding: '12px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
            <p>Bangkok Hospital Siriroj</p>
            <p className="version" style={{ fontWeight: 600, color: '#cbd5e1' }}>v1.0.0</p>
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
