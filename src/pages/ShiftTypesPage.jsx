import { useState, useEffect } from 'react';
import { Clock, Plus, Save, CheckCircle, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { loadShiftTypes, saveShiftTypes, DEFAULT_SHIFT_TYPES } from '../utils/storage';
import Modal from '../components/Modal';
import ShiftBadge from '../components/ShiftBadge';

const CATEGORIES = ['DAY', 'NIGHT', 'OFF', 'LEAVE', 'OTHER'];

const CATEGORY_LABELS = {
  DAY:   { label: 'DAY',   desc: 'เวรกลางวัน — นับรวม Day Coverage',   color: '#98FB98' },
  NIGHT: { label: 'NIGHT', desc: 'เวรกลางคืน — นับรวม Night Coverage',  color: '#DDA0DD' },
  OFF:   { label: 'OFF',   desc: 'วันหยุดประจำ — ไม่นับชั่วโมงทำงาน', color: '#e2e8f0' },
  LEAVE: { label: 'LEAVE', desc: 'ลางาน — ไม่นับชั่วโมงทำงาน',        color: '#FFD700' },
  OTHER: { label: 'OTHER', desc: 'อื่นๆ — กำหนดเอง',                   color: '#ADD8E6' },
};

const EMPTY_FORM = {
  code: '', name: '', start: '07:00', end: '15:00',
  hours: 8, active: true, category: 'DAY', hex: '#90EE90',
};

export default function ShiftTypesPage() {
  const [shiftTypes, setShiftTypes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editIndex, setEditIndex] = useState(-1);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadShiftTypes().then(types => {
      setShiftTypes(types);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="page-container"><div className="card" style={{padding:'40px',textAlign:'center'}}>กำลังโหลดข้อมูล...</div></div>;

  const handleSave = () => {
    saveShiftTypes(shiftTypes);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleToggle = (index) => {
    const updated = [...shiftTypes];
    updated[index] = { ...updated[index], active: !updated[index].active };
    setShiftTypes(updated);
    saveShiftTypes(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDelete = (index) => {
    const updated = shiftTypes.filter((_, i) => i !== index);
    setShiftTypes(updated);
    saveShiftTypes(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const openAddModal = () => {
    setForm(EMPTY_FORM);
    setEditIndex(-1);
    setShowModal(true);
  };

  const openEditModal = (index) => {
    const st = shiftTypes[index];
    setForm({
      code: st.code,
      name: st.name,
      start: st.start || '07:00',
      end: st.end || '15:00',
      hours: st.hours,
      active: st.active,
      category: st.category || 'DAY',
      hex: st.hex || '#90EE90',
    });
    setEditIndex(index);
    setShowModal(true);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const calcHours = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin <= startMin) endMin += 24 * 60;
    return (endMin - startMin) / 60;
  };

  const isNoTimeShift = ['OFF', 'LEAVE'].includes(form.category);

  const handleSubmitForm = () => {
    if (!form.code || !form.name) return;
    const hours = isNoTimeShift ? (Number(form.hours) || 0) : calcHours(form.start, form.end);
    const newShift = {
      id: form.code,
      code: form.code,
      name: form.name,
      start: isNoTimeShift ? '' : form.start,
      end: isNoTimeShift ? '' : form.end,
      hours,
      active: form.active,
      category: form.category,
      hex: form.hex,
    };

    let updated;
    if (editIndex >= 0) {
      updated = [...shiftTypes];
      updated[editIndex] = newShift;
    } else {
      updated = [...shiftTypes, newShift];
    }
    setShiftTypes(updated);
    saveShiftTypes(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setShowModal(false);
  };

  const handleReset = () => {
    setShiftTypes(DEFAULT_SHIFT_TYPES);
    saveShiftTypes(DEFAULT_SHIFT_TYPES);
  };

  // Group for legend
  const grouped = CATEGORIES.map(cat => ({
    cat,
    ...CATEGORY_LABELS[cat],
    shifts: shiftTypes.filter(st => (st.category || 'DAY') === cat),
  }));

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>⏰ ประเภทเวร (Shift Types)</h1>
          <p>กำหนดประเภทเวรที่ใช้งาน ตั้งเวลาเริ่ม-สิ้นสุด และ Category</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={handleReset}>รีเซ็ตค่าเริ่มต้น</button>
          <button className="btn btn-ghost" onClick={openAddModal}>
            <Plus size={16} /> เพิ่มเวรใหม่
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'บันทึกแล้ว!' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="card mb-lg">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shift Code</th>
                <th>ชื่อเวร</th>
                <th>เวลาเริ่ม</th>
                <th>เวลาสิ้นสุด</th>
                <th>ชั่วโมง</th>
                <th>Category</th>
                <th>Color</th>
                <th>สถานะ</th>
                <th style={{ width: 100 }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {shiftTypes.map((st, idx) => (
                <tr key={st.code + idx} style={{ opacity: st.active ? 1 : 0.5 }}>
                  <td>
                    <ShiftBadge code={st.code} color={st.hex} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{st.name}</td>
                  <td>{st.start || '-'}</td>
                  <td>{st.end || '-'}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: st.hours > 0 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {st.hours} ชม.
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 4,
                      background: CATEGORY_LABELS[st.category]?.color || '#e2e8f0',
                      color: '#1a1a2e',
                    }}>
                      {st.category || '-'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 4,
                        background: st.hex || '#ccc',
                        border: '1px solid rgba(255,255,255,0.2)',
                        display: 'inline-block',
                        flexShrink: 0,
                      }} />
                      <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>{st.hex || '-'}</code>
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggle(idx)}
                      style={{ color: st.active ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                    >
                      {st.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      {st.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-xs">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditModal(idx)}>แก้ไข</button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(idx)}
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {shiftTypes.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted" style={{ padding: 40 }}>
                    ยังไม่มีประเภทเวร — กดปุ่ม "เพิ่มเวรใหม่" หรือ "รีเซ็ตค่าเริ่มต้น"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Legend */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">📋 คำอธิบาย Category</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '0 var(--space-lg) var(--space-lg)' }}>
          {grouped.map(({ cat, label, desc, color, shifts }) => (
            <div key={cat} style={{
              flex: '1 1 200px',
              background: 'var(--surface-2)',
              borderRadius: 8,
              padding: '10px 14px',
              borderLeft: `4px solid ${color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '2px 8px',
                  borderRadius: 4, background: color, color: '#1a1a2e',
                }}>{label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{shifts.length} เวร</span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editIndex >= 0 ? 'แก้ไขประเภทเวร' : 'เพิ่มประเภทเวรใหม่'}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={handleSubmitForm}>
              {editIndex >= 0 ? 'อัปเดต' : 'เพิ่ม'}
            </button>
          </>
        }
      >
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">รหัสเวร (Shift Code)</label>
            <input
              className="form-input"
              type="text"
              value={form.code}
              onChange={(e) => handleFormChange('code', e.target.value.toUpperCase())}
              placeholder="เช่น M, AL, TRN"
              disabled={editIndex >= 0}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={form.category}
              onChange={(e) => handleFormChange('category', e.target.value)}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c} — {CATEGORY_LABELS[c].desc}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">ชื่อเวร</label>
          <input
            className="form-input"
            type="text"
            value={form.name}
            onChange={(e) => handleFormChange('name', e.target.value)}
            placeholder="เช่น เช้า (Morning), ลาพักร้อน (Annual Leave)"
          />
        </div>

        {!isNoTimeShift ? (
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">เวลาเริ่ม</label>
              <input
                className="form-input"
                type="time"
                value={form.start}
                onChange={(e) => handleFormChange('start', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">เวลาสิ้นสุด</label>
              <input
                className="form-input"
                type="time"
                value={form.end}
                onChange={(e) => handleFormChange('end', e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">นับเป็นชั่วโมงทำงาน (ชม.)</label>
            <input
              className="form-input"
              type="number"
              min="0"
              max="24"
              value={form.hours === undefined ? 0 : form.hours}
              onChange={(e) => handleFormChange('hours', Number(e.target.value))}
            />
            <span className="form-hint" style={{ marginTop: 4, display: 'block' }}>เวรที่ไม่กำหนดเวลาเริ่ม-สิ้นสุด สามารถกำหนดจำนวนชั่วโมงที่นับเข้า Roster ได้เอง</span>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Color Code (Hex)</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="color"
                value={form.hex}
                onChange={(e) => handleFormChange('hex', e.target.value)}
                style={{ width: 44, height: 36, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', padding: 2, background: 'transparent' }}
              />
              <input
                className="form-input"
                type="text"
                value={form.hex}
                onChange={(e) => handleFormChange('hex', e.target.value)}
                placeholder="#90EE90"
                style={{ flex: 1 }}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">สถานะ</label>
            <div className="toggle-wrapper" style={{ marginTop: 8 }}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => handleFormChange('active', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <span className="toggle-label">{form.active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
