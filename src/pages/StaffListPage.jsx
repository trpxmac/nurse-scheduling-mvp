import { useState, useEffect } from 'react';
import { Users, Plus, Save, CheckCircle, Trash2, Search, UserPlus, X } from 'lucide-react';
import { loadStaffList, saveStaffList, generateStaffId, loadShiftTypes } from '../utils/storage';
import Modal from '../components/Modal';

const POSITIONS = ['HOD', 'RN4', 'RN3', 'RN2', 'RN1', 'PN', 'PA', 'NA'];
const LEVELS = ['HOD', 'RN4', 'RN3', 'RN2', 'RN1'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time'];

const DAYS_OF_WEEK = [
  { value: 0, label: 'อาทิตย์ (Sun)' },
  { value: 1, label: 'จันทร์ (Mon)' },
  { value: 2, label: 'อังคาร (Tue)' },
  { value: 3, label: 'พุธ (Wed)' },
  { value: 4, label: 'พฤหัสฯ (Thu)' },
  { value: 5, label: 'ศุกร์ (Fri)' },
  { value: 6, label: 'เสาร์ (Sat)' },
];

export default function StaffListPage() {
  const [staffList, setStaffList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState(-1);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPos, setFilterPos] = useState('');
  const [shiftTypes, setShiftTypes] = useState([]);
  const [avoidStaffSearch, setAvoidStaffSearch] = useState('');
  const [showAvoidStaffDropdown, setShowAvoidStaffDropdown] = useState(false);
  const [form, setForm] = useState({
    id: '', firstName: '', lastName: '', nickname: '',
    position: 'RN2', employmentType: 'Full-time',
    avoid_staff: [], avoid_shifts: [], avoid_levels: [], fixed_days_off: [], active: true,
    shift_limits: {}
  });

  useEffect(() => {
    async function init() {
      const st = await loadStaffList();
      const shifts = await loadShiftTypes();
      setStaffList(st);
      setShiftTypes(shifts.filter(s => s.active && s.category !== 'OFF' && s.category !== 'LEAVE' && s.category !== 'OTHER'));
      setLoading(false);
    }
    init();
  }, []);

  if (loading) return <div className="page-container"><div className="card" style={{padding:'40px',textAlign:'center'}}>กำลังโหลดข้อมูล...</div></div>;

  const handleSave = () => {
    saveStaffList(staffList);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const openAddModal = () => {
    setForm({
      id: generateStaffId(), firstName: '', lastName: '', nickname: '',
      position: 'RN2', employmentType: 'Full-time',
      avoid_staff: [], avoid_shifts: [], avoid_levels: [], fixed_days_off: [], active: true,
      shift_limits: {}
    });
    setAvoidStaffSearch('');
    setShowAvoidStaffDropdown(false);
    setEditIndex(-1);
    setShowModal(true);
  };

  const openEditModal = (index) => {
    const s = staffList[index];
    setForm({ 
      ...s, 
      employmentType: s.employmentType || 'Full-time',
      avoid_staff: s.avoid_staff || [], 
      avoid_shifts: s.avoid_shifts || [],
      avoid_levels: s.avoid_levels || [],
      fixed_days_off: s.fixed_days_off || [],
      shift_limits: s.shift_limits || {}
    });
    setAvoidStaffSearch('');
    setShowAvoidStaffDropdown(false);
    setEditIndex(index);
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckboxArrayChange = (field, itemValue, isChecked) => {
    setForm(prev => {
      const currentList = prev[field] || [];
      if (isChecked) {
        return { ...prev, [field]: [...currentList, itemValue] };
      } else {
        return { ...prev, [field]: currentList.filter(v => v !== itemValue) };
      }
    });
  };

  const handleShiftLimitChange = (shiftCode, field, value) => {
    setForm(prev => {
      const currentLimits = prev.shift_limits || {};
      const shiftLimit = currentLimits[shiftCode] || { min: '', max: '' };
      return {
        ...prev,
        shift_limits: {
          ...currentLimits,
          [shiftCode]: { ...shiftLimit, [field]: value }
        }
      };
    });
  };

  const handleSubmitForm = () => {
    if (!form.firstName || !form.lastName) return;
    let newList;
    if (editIndex >= 0) {
      newList = [...staffList];
      newList[editIndex] = { ...form };
    } else {
      newList = [...staffList, { ...form }];
    }
    setStaffList(newList);
    saveStaffList(newList);
    setShowModal(false);
  };

  const handleDelete = (index) => {
    const updated = staffList.filter((_, i) => i !== index);
    setStaffList(updated);
    saveStaffList(updated);
  };

  const handleToggleActive = (index) => {
    const updated = [...staffList];
    updated[index] = { ...updated[index], active: !updated[index].active };
    setStaffList(updated);
    saveStaffList(updated);
  };

  // Filtered list
  const filtered = staffList.filter(s => {
    const matchSearch = search === '' ||
      s.firstName.includes(search) ||
      s.lastName.includes(search) ||
      s.nickname.includes(search) ||
      s.id.toLowerCase().includes(search.toLowerCase());
    const matchPos = filterPos === '' || s.position === filterPos;
    return matchSearch && matchPos;
  });

  const activeCount = staffList.filter(s => s.active).length;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>👥 รายชื่อบุคลากร (Staff List)</h1>
          <p>ทั้งหมด {staffList.length} คน — Active {activeCount} คน</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={openAddModal}>
            <UserPlus size={16} /> เพิ่มบุคลากร
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'บันทึกแล้ว!' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-lg" style={{ padding: 'var(--space-md)' }}>
        <div className="flex gap-md items-center" style={{ flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input
              className="form-input"
              type="text"
              placeholder="ค้นหาชื่อ, ชื่อเล่น, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>
          <select
            className="form-select"
            value={filterPos}
            onChange={(e) => setFilterPos(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="">ทุกตำแหน่ง</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>ชื่อ-นามสกุล</th>
                <th>ระดับ/ตำแหน่ง</th>
                <th>ประเภท</th>
                <th>เงื่อนไข (HOD/จำกัดเวร)</th>
                <th>ข้อจำกัด (Avoid)</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((staff, idx) => {
                const realIdx = staffList.indexOf(staff);
                return (
                  <tr key={staff.id} style={{ opacity: staff.active ? 1 : 0.5 }}>
                    <td className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>{staff.id}</td>
                    <td style={{ fontWeight: 600 }}>
                      {staff.firstName} {staff.lastName}
                    </td>
                    <td>
                      <span className="badge badge-info">{staff.level && staff.level !== '-' ? staff.level : staff.position}</span>
                    </td>
                    <td>
                      <span className={`badge ${(!staff.employmentType || staff.employmentType === 'Full-time') ? 'badge-success' : 'badge-warning'}`}>
                        {staff.employmentType || 'Full-time'}
                      </span>
                    </td>
                    <td className="text-sm">
                      <div className="flex flex-col gap-xs">
                        {(staff.position === 'HOD' || staff.level === 'HOD') && (
                          <span className="badge badge-info" style={{ fontSize: '0.75rem', alignSelf: 'flex-start' }}>
                            👔 HOD (Office)
                          </span>
                        )}
                        {staff.shift_limits && Object.keys(staff.shift_limits).map(code => {
                          const limit = staff.shift_limits[code];
                          if (!limit.min && !limit.max) return null;
                          return (
                            <span key={code} className="text-muted" style={{ fontSize: '0.75rem' }}>
                              ⏱️ เวร {code}: {limit.min ? `≥${limit.min}` : ''} {limit.min && limit.max ? '|' : ''} {limit.max ? `≤${limit.max}` : ''}
                            </span>
                          );
                        })}
                        {(staff.position !== 'HOD' && staff.level !== 'HOD') && (!staff.shift_limits || Object.keys(staff.shift_limits).every(k => !staff.shift_limits[k].min && !staff.shift_limits[k].max)) && '-'}
                      </div>
                    </td>
                    <td className="text-sm">
                      {((staff.avoid_shifts || []).length > 0 || (staff.avoid_staff || []).length > 0 || (staff.fixed_days_off || []).length > 0) ? (
                        <div className="flex flex-col gap-xs">
                          {(staff.avoid_shifts || []).length > 0 && (
                            <span className="text-danger" style={{ fontSize: '0.75rem' }}>
                              ❌ {staff.avoid_shifts.join(', ')}
                            </span>
                          )}
                          {(staff.avoid_staff || []).length > 0 && (
                            <span className="text-warning" style={{ fontSize: '0.75rem' }}>
                              ⚠️ ไม่อยู่กับ {staff.avoid_staff.length} คน
                            </span>
                          )}
                          {(staff.fixed_days_off || []).length > 0 && (
                            <span className="text-info" style={{ fontSize: '0.75rem' }}>
                              🗓️ หยุด: {staff.fixed_days_off.map(d => DAYS_OF_WEEK.find(x => x.value === d)?.label.split(' ')[0]).join(', ')}
                            </span>
                          )}
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleToggleActive(realIdx)}
                        style={{ color: staff.active ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                      >
                        {staff.active ? '✅ Active' : '❌ Inactive'}
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-xs">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(realIdx)}>แก้ไข</button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDelete(realIdx)}
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted" style={{ padding: 40 }}>
                    {staffList.length === 0
                      ? '🏥 ยังไม่มีบุคลากร — กดปุ่ม "เพิ่มบุคลากร" เพื่อเริ่มต้น'
                      : '🔍 ไม่พบผลลัพธ์'
                    }
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editIndex >= 0 ? '✏️ แก้ไขข้อมูลบุคลากร' : '🆕 เพิ่มบุคลากรใหม่'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleSubmitForm}>
              {editIndex >= 0 ? 'อัปเดต' : 'เพิ่ม'}
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Staff ID</label>
          <input
            className="form-input"
            type="text"
            value={form.id}
            disabled
            style={{ opacity: 0.6 }}
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ชื่อ *</label>
            <input
              className="form-input"
              type="text"
              value={form.firstName}
              onChange={(e) => handleFormChange('firstName', e.target.value)}
              placeholder="ชื่อจริง"
            />
          </div>
          <div className="form-group">
            <label className="form-label">นามสกุล *</label>
            <input
              className="form-input"
              type="text"
              value={form.lastName}
              onChange={(e) => handleFormChange('lastName', e.target.value)}
              placeholder="นามสกุล"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ตำแหน่ง (Position)</label>
            <select
              className="form-select"
              value={form.position}
              onChange={(e) => handleFormChange('position', e.target.value)}
            >
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ประเภทจ้างงาน</label>
            <select
              className="form-select"
              value={form.employmentType}
              onChange={(e) => handleFormChange('employmentType', e.target.value)}
            >
              {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row">
        </div>
        <div className="form-group">
          <label className="form-label text-primary">จำกัดจำนวนเวร (Min/Max Shifts)</label>
          <div className="flex flex-col gap-sm" style={{ marginTop: 4, background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: 8 }}>
            {shiftTypes.map(shift => (
              <div key={shift.code} className="flex gap-md items-center">
                <div style={{ width: 120, fontWeight: 500, fontSize: '0.85rem' }}>เวร {shift.code} ({shift.name})</div>
                <input
                  className="form-input"
                  type="number"
                  placeholder="ขั้นต่ำ"
                  value={form.shift_limits?.[shift.code]?.min || ''}
                  onChange={(e) => handleShiftLimitChange(shift.code, 'min', e.target.value)}
                  style={{ width: 80, height: 32, fontSize: '0.85rem' }}
                  min="0"
                />
                <span className="text-muted text-xs">ถึง</span>
                <input
                  className="form-input"
                  type="number"
                  placeholder="สูงสุด"
                  value={form.shift_limits?.[shift.code]?.max || ''}
                  onChange={(e) => handleShiftLimitChange(shift.code, 'max', e.target.value)}
                  style={{ width: 80, height: 32, fontSize: '0.85rem' }}
                  min="0"
                />
              </div>
            ))}
            <span className="text-muted text-xs mt-xs">เว้นว่างไว้หากไม่ต้องการจำกัด</span>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label text-danger">ไม่ขออยู่เวรนี้ (Avoid Shifts)</label>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginTop: 4 }}>
            {shiftTypes.map(shift => (
              <label key={shift.code} className="flex items-center gap-xs" style={{ cursor: 'pointer', padding: '4px 8px', background: 'var(--color-bg-secondary)', borderRadius: 4 }}>
                <input
                  type="checkbox"
                  checked={(form.avoid_shifts || []).includes(shift.code)}
                  onChange={(e) => handleCheckboxArrayChange('avoid_shifts', shift.code, e.target.checked)}
                />
                <span className="text-sm">{shift.code} ({shift.name})</span>
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label text-info">หยุดประจำสัปดาห์ (Fixed Days Off)</label>
          <div className="flex gap-sm" style={{ flexWrap: 'wrap', marginTop: 4 }}>
            {DAYS_OF_WEEK.map(day => (
              <label key={day.value} className="flex items-center gap-xs" style={{ cursor: 'pointer', padding: '4px 8px', background: 'var(--color-bg-secondary)', borderRadius: 4 }}>
                <input
                  type="checkbox"
                  checked={(form.fixed_days_off || []).includes(day.value)}
                  onChange={(e) => handleCheckboxArrayChange('fixed_days_off', day.value, e.target.checked)}
                />
                <span className="text-sm">{day.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label text-warning">ไม่ขออยู่กับบุคคลนี้ (Avoid Staff)</label>
          <div className="multi-select-container" style={{ position: 'relative' }}>
            
            {/* Selected Tags */}
            {(form.avoid_staff || []).length > 0 && (
              <div className="flex gap-xs" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
                {(form.avoid_staff || []).map(staffId => {
                  const s = staffList.find(x => x.id === staffId);
                  const name = s ? `${s.firstName} ${s.lastName} (${s.position})` : staffId;
                  return (
                    <div key={staffId} className="badge badge-warning flex items-center gap-xs" style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                      {name}
                      <button 
                        type="button" 
                        onClick={() => handleCheckboxArrayChange('avoid_staff', staffId, false)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit', opacity: 0.6 }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search Input */}
            <div className="form-input flex items-center gap-xs" style={{ padding: '0 8px', borderColor: showAvoidStaffDropdown ? 'var(--color-primary-light)' : 'var(--border-color)' }}>
              <Search size={16} className="text-muted" />
              <input
                type="text"
                placeholder="ค้นหาชื่อพยาบาลเพื่อเพิ่ม..."
                value={avoidStaffSearch}
                onChange={(e) => {
                  setAvoidStaffSearch(e.target.value);
                  setShowAvoidStaffDropdown(true);
                }}
                onFocus={() => setShowAvoidStaffDropdown(true)}
                style={{ border: 'none', background: 'transparent', width: '100%', height: '36px', outline: 'none', fontSize: '0.85rem' }}
              />
            </div>

            {/* Dropdown */}
            {showAvoidStaffDropdown && (
              <>
                <div 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} 
                  onClick={() => setShowAvoidStaffDropdown(false)} 
                />
                <div 
                  className="dropdown-menu" 
                  style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, 
                    background: 'var(--color-bg-primary)', border: '1px solid var(--border-color)', 
                    borderRadius: 6, marginTop: 4, maxHeight: 200, overflowY: 'auto', zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                >
                  {staffList
                    .filter(s => s.id !== form.id && s.active)
                    .filter(s => !(form.avoid_staff || []).includes(s.id))
                    .filter(s => 
                      s.firstName.toLowerCase().includes(avoidStaffSearch.toLowerCase()) || 
                      s.lastName.toLowerCase().includes(avoidStaffSearch.toLowerCase()) || 
                      (s.nickname || '').toLowerCase().includes(avoidStaffSearch.toLowerCase())
                    )
                    .map(s => (
                      <div 
                        key={s.id}
                        style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-color-light)', fontSize: '0.85rem' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        onClick={() => {
                          handleCheckboxArrayChange('avoid_staff', s.id, true);
                          setAvoidStaffSearch('');
                          setShowAvoidStaffDropdown(false);
                        }}
                      >
                        {s.firstName} {s.lastName} <span className="text-muted">({s.position})</span>
                      </div>
                    ))}
                  {staffList.filter(s => s.id !== form.id && s.active && !(form.avoid_staff || []).includes(s.id) && (s.firstName.toLowerCase().includes(avoidStaffSearch.toLowerCase()) || s.lastName.toLowerCase().includes(avoidStaffSearch.toLowerCase()))).length === 0 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>ไม่พบรายชื่อที่ค้นหา</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="form-group">
          <div className="toggle-wrapper">
            <label className="toggle">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => handleFormChange('active', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">Active — บุคลากรที่ทำงานอยู่</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
