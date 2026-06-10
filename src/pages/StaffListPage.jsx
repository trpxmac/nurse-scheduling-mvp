import { useState, useEffect } from 'react';
import { Users, Plus, Save, CheckCircle, Trash2, Search, UserPlus } from 'lucide-react';
import { loadStaffList, saveStaffList, generateStaffId } from '../utils/storage';
import Modal from '../components/Modal';

const POSITIONS = ['RN4', 'RN3', 'RN2', 'RN1', 'NA'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time'];

export default function StaffListPage() {
  const [staffList, setStaffList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState(-1);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPos, setFilterPos] = useState('');
  const [form, setForm] = useState({
    id: '', firstName: '', lastName: '', nickname: '',
    position: 'RN2', employmentType: 'Full-time',
    preferred_shifts: '', restrictions: '', active: true,
  });

  useEffect(() => {
    setStaffList(loadStaffList());
  }, []);

  const handleSave = () => {
    saveStaffList(staffList);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const openAddModal = () => {
    setForm({
      id: generateStaffId(), firstName: '', lastName: '', nickname: '',
      position: 'RN2', employmentType: 'Full-time',
      preferred_shifts: '', restrictions: '', active: true,
    });
    setEditIndex(-1);
    setShowModal(true);
  };

  const openEditModal = (index) => {
    const s = staffList[index];
    setForm({ ...s });
    setEditIndex(index);
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitForm = () => {
    if (!form.firstName || !form.lastName) return;
    if (editIndex >= 0) {
      const updated = [...staffList];
      updated[editIndex] = { ...form };
      setStaffList(updated);
    } else {
      setStaffList(prev => [...prev, { ...form }]);
    }
    setShowModal(false);
  };

  const handleDelete = (index) => {
    setStaffList(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleActive = (index) => {
    const updated = [...staffList];
    updated[index] = { ...updated[index], active: !updated[index].active };
    setStaffList(updated);
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
                <th>ชื่อเล่น</th>
                <th>ตำแหน่ง</th>
                <th>ประเภท</th>
                <th>เวรที่ชอบ</th>
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
                    <td>{staff.nickname || '-'}</td>
                    <td>
                      <span className="badge badge-info">{staff.position}</span>
                    </td>
                    <td>
                      <span className={`badge ${staff.employmentType === 'Full-time' ? 'badge-success' : 'badge-warning'}`}>
                        {staff.employmentType}
                      </span>
                    </td>
                    <td className="text-sm text-muted">{staff.preferred_shifts || '-'}</td>
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
                  <td colSpan={8} className="text-center text-muted" style={{ padding: 40 }}>
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
        <div className="form-group">
          <label className="form-label">ชื่อเล่น</label>
          <input
            className="form-input"
            type="text"
            value={form.nickname}
            onChange={(e) => handleFormChange('nickname', e.target.value)}
            placeholder="ชื่อเล่น"
          />
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
        <div className="form-group">
          <label className="form-label">เวรที่ชอบ (Preferred Shifts)</label>
          <input
            className="form-input"
            type="text"
            value={form.preferred_shifts}
            onChange={(e) => handleFormChange('preferred_shifts', e.target.value)}
            placeholder="เช่น M, E (คั่นด้วย comma)"
          />
        </div>
        <div className="form-group">
          <label className="form-label">ข้อจำกัด (Restrictions)</label>
          <textarea
            className="form-textarea"
            value={form.restrictions}
            onChange={(e) => handleFormChange('restrictions', e.target.value)}
            placeholder="เช่น ไม่สามารถอยู่เวรดึกได้"
          />
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
