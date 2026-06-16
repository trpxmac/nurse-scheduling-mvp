import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Plus, Trash2, Save, CheckCircle, Info } from 'lucide-react';
import {
  loadStaffList, loadShiftTypes, loadLeaveSchedules, saveLeaveSchedules,
  getDaysInMonth, getMonthName, loadActiveMonth, saveActiveMonth,
} from '../utils/storage';
import MonthSelector from '../components/MonthSelector';

function generateId() {
  return 'L' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase();
}

export default function LeaveSchedulePage() {
  const [staffList, setStaffList] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [viewMonth, setViewMonthState] = useState(loadActiveMonth());
  const [schedules, setSchedules] = useState([]);
  const [saved, setSaved] = useState(false);

  // Form state
  const [form, setForm] = useState({
    staffId: '',
    shiftCode: '',
    startDay: 1,
    endDay: 1,
    note: '',
  });

  const setViewMonth = (m) => {
    setViewMonthState(m);
    saveActiveMonth(m);
  };

  useEffect(() => {
    setStaffList(loadStaffList());
    setShiftTypes(loadShiftTypes());
  }, []);

  useEffect(() => {
    setSchedules(loadLeaveSchedules(viewMonth));
  }, [viewMonth]);

  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList]);
  const leaveShifts = useMemo(
    () => shiftTypes.filter(s => s.active && (s.category === 'LEAVE' || s.category === 'OTHER')),
    [shiftTypes]
  );
  const daysInMonth = useMemo(() => getDaysInMonth(viewMonth), [viewMonth]);

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-clamp endDay if startDay is greater
      if (field === 'startDay' && Number(value) > Number(updated.endDay)) {
        updated.endDay = value;
      }
      return updated;
    });
  };

  const handleAdd = () => {
    if (!form.staffId || !form.shiftCode || !form.startDay || !form.endDay) return;
    const startDay = Number(form.startDay);
    const endDay = Number(form.endDay);
    if (startDay > endDay) return;

    const newEntry = {
      id: generateId(),
      staffId: form.staffId,
      shiftCode: form.shiftCode,
      startDay,
      endDay,
      note: form.note,
    };
    const updated = [...schedules, newEntry];
    setSchedules(updated);
    setForm(prev => ({ ...prev, note: '' }));
  };

  const handleDelete = (id) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const handleSave = () => {
    saveLeaveSchedules(viewMonth, schedules);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const getStaffName = (staffId) => {
    const s = staffList.find(x => x.id === staffId);
    return s ? `${s.firstName} (${s.nickname || s.position})` : staffId;
  };

  const getShiftName = (code) => {
    const s = shiftTypes.find(x => x.code === code);
    return s ? s.name.split(' (')[0] : code;
  };

  const getShiftColor = (code) => {
    const s = shiftTypes.find(x => x.code === code);
    return s?.hex || '#e5e7eb';
  };

  // Group schedules by staffId for display
  const grouped = useMemo(() => {
    const map = {};
    for (const sch of schedules) {
      if (!map[sch.staffId]) map[sch.staffId] = [];
      map[sch.staffId].push(sch);
    }
    return map;
  }, [schedules]);

  const dayRange = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>📅 กำหนดช่วงลา/อบรม</h1>
          <p>{getMonthName(viewMonth)} — ล็อกวันล่วงหน้าก่อน AI จัดตาราง</p>
        </div>
        <div className="page-header-actions">
          <MonthSelector value={viewMonth} onChange={(m) => { setViewMonth(m); }} />
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'บันทึกแล้ว!' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="card mb-lg" style={{
        padding: 'var(--space-md)',
        background: 'rgba(59,130,246,0.06)',
        border: '1px solid rgba(59,130,246,0.2)',
        display: 'flex', alignItems: 'flex-start', gap: 12
      }}>
        <Info size={18} style={{ color: 'var(--color-primary)', marginTop: 2, flexShrink: 0 }} />
        <div style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
          <strong>วิธีใช้งาน:</strong> กำหนดช่วงวันที่พนักงานจะ <strong>ลา / อบรม / ลาคลอด</strong> ล่วงหน้า ก่อนกด Generate
          ระบบ AI จะล็อกวันเหล่านี้ไว้อัตโนมัติ และจัดเวรทำงานในวันที่เหลือให้ครับ
        </div>
      </div>

      {/* Add Form */}
      <div className="card mb-lg">
        <div className="card-header">
          <div className="card-title"><Plus size={16} /> เพิ่มรายการลา/อบรม</div>
        </div>
        <div style={{ padding: 'var(--space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
            {/* Staff */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">บุคลากร</label>
              <select
                className="form-select"
                value={form.staffId}
                onChange={e => handleFormChange('staffId', e.target.value)}
              >
                <option value="">— เลือกชื่อ —</option>
                {activeStaff.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.nickname || s.position})
                  </option>
                ))}
              </select>
            </div>

            {/* Leave type */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ประเภท</label>
              <select
                className="form-select"
                value={form.shiftCode}
                onChange={e => handleFormChange('shiftCode', e.target.value)}
              >
                <option value="">— เลือกประเภท —</option>
                {leaveShifts.map(s => (
                  <option key={s.code} value={s.code}>{s.code} — {s.name.split(' (')[0]}</option>
                ))}
              </select>
            </div>

            {/* Start day */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">วันที่เริ่ม</label>
              <select
                className="form-select"
                value={form.startDay}
                onChange={e => handleFormChange('startDay', e.target.value)}
              >
                {dayRange.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* End day */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">วันที่สิ้นสุด</label>
              <select
                className="form-select"
                value={form.endDay}
                onChange={e => handleFormChange('endDay', e.target.value)}
              >
                {dayRange.filter(d => d >= Number(form.startDay)).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Note */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">หมายเหตุ (ไม่บังคับ)</label>
              <input
                className="form-input"
                type="text"
                placeholder="เช่น อบรม CPR ที่ รพ.กลาง"
                value={form.note}
                onChange={e => handleFormChange('note', e.target.value)}
              />
            </div>

            {/* Add button */}
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
              <button
                className="btn btn-primary"
                onClick={handleAdd}
                disabled={!form.staffId || !form.shiftCode}
                style={{ width: '100%' }}
              >
                <Plus size={16} /> เพิ่ม
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule List */}
      {schedules.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 48 }}>
            <CalendarDays size={48} style={{ opacity: 0.3 }} />
            <p style={{ marginTop: 12 }}>ยังไม่มีรายการลา/อบรมสำหรับเดือนนี้</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div className="card-title"><CalendarDays size={16} /> รายการที่กำหนดไว้ ({schedules.length} รายการ)</div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>บุคลากร</th>
                  <th>ประเภท</th>
                  <th style={{ textAlign: 'center' }}>วันที่เริ่ม</th>
                  <th style={{ textAlign: 'center' }}>วันที่สิ้นสุด</th>
                  <th style={{ textAlign: 'center' }}>จำนวนวัน</th>
                  <th>หมายเหตุ</th>
                  <th>ลบ</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map(sch => (
                  <tr key={sch.id}>
                    <td style={{ fontWeight: 600 }}>{getStaffName(sch.staffId)}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: getShiftColor(sch.shiftCode) + '40',
                          color: 'var(--color-text-primary)',
                          border: `1px solid ${getShiftColor(sch.shiftCode)}`,
                          fontWeight: 700,
                        }}
                      >
                        {sch.shiftCode} — {getShiftName(sch.shiftCode)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>วันที่ {sch.startDay}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>วันที่ {sch.endDay}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-info">{sch.endDay - sch.startDay + 1} วัน</span>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>{sch.note || '—'}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-danger)' }}
                        onClick={() => handleDelete(sch.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Visual calendar-like overview */}
          <div style={{ padding: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
              ภาพรวมช่วงลาในเดือนนี้
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', fontSize: '0.7rem' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '4px 8px', textAlign: 'left', fontWeight: 600, minWidth: 120, whiteSpace: 'nowrap' }}>ชื่อ</th>
                    {dayRange.map(d => (
                      <th key={d} style={{ padding: '2px 0', textAlign: 'center', minWidth: 24, fontWeight: 400, color: 'var(--color-text-muted)' }}>
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(grouped).map(staffId => (
                    <tr key={staffId}>
                      <td style={{ padding: '4px 8px', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color-light)' }}>
                        {getStaffName(staffId)}
                      </td>
                      {dayRange.map(d => {
                        const match = grouped[staffId].find(s => d >= s.startDay && d <= s.endDay);
                        return (
                          <td key={d} style={{ padding: '2px 1px', textAlign: 'center', borderBottom: '1px solid var(--border-color-light)' }}>
                            {match ? (
                              <div style={{
                                background: getShiftColor(match.shiftCode),
                                borderRadius: 2,
                                minWidth: 20,
                                height: 20,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                color: '#333',
                              }}>
                                {match.shiftCode}
                              </div>
                            ) : (
                              <div style={{ minWidth: 20, height: 20 }} />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
