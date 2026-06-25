import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Save, CheckCircle, Info, X, ExternalLink, Copy, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  loadStaffList, loadShiftTypes, loadLeaveSchedules, saveLeaveSchedules,
  getDaysInMonth, getMonthName, getDayOfWeek, isWeekend,
  loadActiveMonth, saveActiveMonth,
} from '../utils/storage';
import MonthSelector from '../components/MonthSelector';
import CustomDialog from '../components/CustomDialog';

function generateId() {
  return 'L' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase();
}

export default function LeaveSchedulePage() {
  const [staffList, setStaffList] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [viewMonth, setViewMonthState] = useState(loadActiveMonth());
  // cellMap: { [staffId]: { [day]: shiftCode | '' } }
  const [cellMap, setCellMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', danger: false, action: null });
  const [showSuccess, setShowSuccess] = useState('');
  // Popup state
  const [popup, setPopup] = useState(null); // { staffId, day, x, y }

  const setViewMonth = (m) => {
    setViewMonthState(m);
    saveActiveMonth(m);
  };

  useEffect(() => {
    async function init() {
      setStaffList(await loadStaffList());
      setShiftTypes(await loadShiftTypes());
      const schedules = await loadLeaveSchedules(viewMonth);
      const map = {};
      for (const sch of schedules) {
        if (!map[sch.staffId]) map[sch.staffId] = {};
        for (let d = sch.startDay; d <= sch.endDay; d++) {
          map[sch.staffId][d] = sch.shiftCode;
        }
      }
      setCellMap(map);
      setLoading(false);
    }
    init();
  }, [viewMonth]);


  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList]);
  const leaveShifts = useMemo(
    () => shiftTypes.filter(s => s.active && s.code !== '-'),
    [shiftTypes]
  );
  const daysInMonth = useMemo(() => getDaysInMonth(viewMonth), [viewMonth]);
  const dayRange = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const showToast = (msg) => {
    setShowSuccess(msg);
    setTimeout(() => setShowSuccess(''), 3000);
  };

  const handleCellClick = (e, staffId, day) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const current = cellMap[staffId]?.[day] || '';
    // Find existing span end for this code
    let existingEndDay = day;
    if (current) {
      let d = day + 1;
      while (d <= daysInMonth && cellMap[staffId]?.[d] === current) {
        existingEndDay = d;
        d++;
      }
    }
    setPopup({
      staffId, day, current, endDay: existingEndDay,
      x: rect.left, y: rect.bottom + 4
    });
  };

  const handleSelectShift = (shiftCode, endDay) => {
    if (!popup) return;
    const { staffId, day } = popup;
    const until = endDay !== undefined ? endDay : popup.endDay;
    setCellMap(prev => {
      const staffDays = { ...(prev[staffId] || {}) };
      if (shiftCode === '') {
        // Clear entire existing span starting at day
        const code = staffDays[day];
        for (let d = day; d <= daysInMonth; d++) {
          if (staffDays[d] === code) delete staffDays[d];
          else break;
        }
      } else {
        // Fill range from day to until
        for (let d = day; d <= until; d++) {
          staffDays[d] = shiftCode;
        }
      }
      
      let nextMap;
      if (Object.keys(staffDays).length === 0) {
        nextMap = { ...prev };
        delete nextMap[staffId];
      } else {
        nextMap = { ...prev, [staffId]: staffDays };
      }
      
      // Auto-save logic
      const schedules = [];
      for (const [sId, daysObj] of Object.entries(nextMap)) {
        const dayNums = Object.keys(daysObj).map(Number).sort((a, b) => a - b);
        let i = 0;
        while (i < dayNums.length) {
          const code = daysObj[dayNums[i]];
          if (!code) { i++; continue; }
          let j = i;
          while (
            j + 1 < dayNums.length &&
            dayNums[j + 1] === dayNums[j] + 1 &&
            daysObj[dayNums[j + 1]] === code
          ) j++;
          schedules.push({
            id: 'L' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 4).toUpperCase(),
            staffId: sId,
            shiftCode: code,
            startDay: dayNums[i],
            endDay: dayNums[j],
            note: '',
          });
          i = j + 1;
        }
      }
      saveLeaveSchedules(viewMonth, schedules);
      
      return nextMap;
    });
    showToast('อัปเดตข้อมูลเรียบร้อยแล้ว');
    setPopup(null);
  };

  const getShiftColor = (code) => {
    const s = shiftTypes.find(x => x.code === code);
    return s?.hex || '#e5e7eb';
  };

  const totalLeaveDays = useMemo(() => {
    let count = 0;
    for (const days of Object.values(cellMap)) {
      count += Object.values(days).filter(v => v).length;
    }
    return count;
  }, [cellMap]);

  const handleClearAll = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการล้างข้อมูล',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการ "ล้างข้อมูลทั้งหมด" ในเดือนนี้?\n(การกระทำนี้ไม่สามารถย้อนกลับได้)',
      danger: true,
      action: () => {
        saveLeaveSchedules(viewMonth, []);
        setCellMap({});
        showToast('ล้างข้อมูลเดือนนี้ทั้งหมดเรียบร้อยแล้ว');
      }
    });
  };

  if (loading) return <div className="page-container"><div className="card" style={{padding:'40px',textAlign:'center'}}>กำลังโหลดข้อมูล...</div></div>;

  return (
    <div className="animate-fade-in" onClick={() => setPopup(null)}>
      <div className="page-header">
        <div className="page-header-left">
          <h1>📅 กำหนดช่วงลา/อบรม/ล็อคเวร</h1>
          <p>{getMonthName(viewMonth)} — คลิกที่ช่องวันที่เพื่อกำหนดประเภทลาหรือล็อคเวรล่วงหน้า</p>
        </div>
        <div className="page-header-actions">
          <MonthSelector value={viewMonth} onChange={(m) => { setViewMonth(m); }} />
          <button className="btn btn-ghost" onClick={handleClearAll} style={{ color: 'var(--color-danger)', padding: '0 8px' }} title="ล้างข้อมูลเดือนนี้ทั้งหมด">
            <Trash2 size={16} /> <span className="hide-mobile">ล้างข้อมูล</span>
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
          <strong>วิธีใช้:</strong> คลิกที่ช่องวันที่ของพนักงานเพื่อเลือกเวร/ประเภทลา คลิกอีกครั้งเพื่อเปลี่ยน หรือเลือก "ล้าง" เพื่อยกเลิก — <strong>ข้อมูลจะถูกบันทึกอัตโนมัติ</strong>
          {totalLeaveDays > 0 && <span style={{ marginLeft: 8, color: 'var(--color-accent)', fontWeight: 700 }}>
            ✅ {totalLeaveDays} วันที่กำหนดไว้แล้ว
          </span>}
          <span style={{ display: 'block', marginTop: 4 }}>
            💡 ข้อมูลที่กำหนดในหน้านี้จะถูก "ล็อค" ไว้เมื่อระบบ AI จัดเวรอัตโนมัติ สามารถใช้เพื่อล็อคเวรทำงาน (M, E, D, N) หรือกำหนดวันลา/วันหยุดประจำได้
          </span>
        </div>
      </div>

      {/* Interactive Grid */}
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: 'max-content', width: '100%' }}>
            <thead>
              <tr>
                <th style={{
                  position: 'sticky', left: 0, zIndex: 2,
                  background: 'var(--color-bg-secondary)',
                  padding: '8px 12px', textAlign: 'left',
                  borderBottom: '2px solid var(--border-color)',
                  fontSize: '0.78rem', fontWeight: 700, minWidth: 180,
                  whiteSpace: 'nowrap',
                }}>
                  ชื่อ-นามสกุล
                </th>
                <th style={{
                  position: 'sticky', left: 180, zIndex: 2,
                  background: 'var(--color-bg-secondary)',
                  padding: '8px 8px', textAlign: 'center',
                  borderBottom: '2px solid var(--border-color)',
                  fontSize: '0.72rem', fontWeight: 600,
                  minWidth: 60, whiteSpace: 'nowrap',
                  color: 'var(--color-text-muted)',
                }}>
                  ตำแหน่ง
                </th>
                {dayRange.map(d => (
                  <th key={d} style={{
                    padding: '4px 2px',
                    textAlign: 'center',
                    borderBottom: '2px solid var(--border-color)',
                    minWidth: 32,
                    background: isWeekend(viewMonth, d)
                      ? 'rgba(245,158,11,0.08)'
                      : 'var(--color-bg-secondary)',
                    fontSize: '0.7rem',
                  }}>
                    <div style={{ fontWeight: 700, color: isWeekend(viewMonth, d) ? 'var(--color-accent)' : undefined }}>
                      {d}
                    </div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)', fontWeight: 400 }}>
                      {getDayOfWeek(viewMonth, d)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeStaff.map((staff, idx) => (
                <tr key={staff.id} style={{ background: idx % 2 === 0 ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)' }}>
                  {/* Name cell */}
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 1,
                    background: idx % 2 === 0 ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)',
                    padding: '6px 12px',
                    borderBottom: '1px solid var(--border-color-light)',
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      {staff.firstName} {staff.lastName}
                    </div>
                  </td>
                  {/* Position cell */}
                  <td style={{
                    position: 'sticky', left: 180, zIndex: 1,
                    background: idx % 2 === 0 ? 'var(--color-bg-primary)' : 'var(--color-bg-secondary)',
                    padding: '6px 8px', textAlign: 'center',
                    borderBottom: '1px solid var(--border-color-light)',
                    whiteSpace: 'nowrap',
                  }}>
                    <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                      {staff.level && staff.level !== '-' ? staff.level : staff.position}
                    </span>
                  </td>
                  {(() => {
                    const cells = [];
                    let d = 1;
                    const staffDays = cellMap[staff.id] || {};
                    
                    const actualDays = {};
                    const [year, month] = viewMonth.split('-').map(Number);
                    for (let i = 1; i <= daysInMonth; i++) {
                      if (staffDays[i]) {
                        actualDays[i] = staffDays[i];
                      } else if (staff.fixed_days_off && staff.fixed_days_off.length > 0) {
                        const date = new Date(year, month - 1, i);
                        if (staff.fixed_days_off.includes(date.getDay())) {
                          actualDays[i] = 'FIXED_OFF';
                        }
                      }
                    }

                    while (d <= daysInMonth) {
                      const shiftCode = actualDays[d] || '';
                      if (shiftCode === 'FIXED_OFF') {
                        let span = 1;
                        while (d + span <= daysInMonth && actualDays[d + span] === 'FIXED_OFF') span++;
                        
                        const startDay = d;
                        const spanLen = span;
                        cells.push(
                          <td
                            key={startDay}
                            colSpan={spanLen}
                            onClick={(e) => handleCellClick(e, staff.id, startDay)}
                            title={`${staff.firstName} — หยุดประจำสัปดาห์ วันที่ ${startDay}${spanLen > 1 ? `–${startDay + spanLen - 1}` : ''}`}
                            style={{
                              padding: '3px 0',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-color-light)',
                            }}
                          >
                            <div style={{
                              background: 'var(--color-bg-secondary)',
                              border: '1px dashed var(--border-color)',
                              margin: '0 1px',
                              height: 26,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: spanLen === 1 ? '0.6rem' : '0.65rem',
                              fontWeight: 600,
                              color: 'var(--color-text-muted)',
                              borderRadius: 6,
                            }}>
                              หยุดประจำ
                            </div>
                          </td>
                        );
                        d += span;
                      } else if (shiftCode) {
                        // Find how many consecutive days share the same code
                        let span = 1;
                        while (
                          d + span <= daysInMonth &&
                          actualDays[d + span] === shiftCode
                        ) span++;
                        const color = getShiftColor(shiftCode);
                        const shiftObj = leaveShifts.find(s => s.code === shiftCode);
                        const label = shiftObj ? shiftObj.name.split(' (')[0] : shiftCode;
                        // ⚠️ Capture d and span NOW before d changes (fixes JS closure-in-loop bug)
                        const startDay = d;
                        const spanLen = span;
                        cells.push(
                          <td
                            key={startDay}
                            colSpan={spanLen}
                            onClick={(e) => handleCellClick(e, staff.id, startDay)}
                            title={`${staff.firstName} — ${label} วันที่ ${startDay}${spanLen > 1 ? `–${startDay + spanLen - 1}` : ''}`}
                            style={{
                              padding: '3px 0',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-color-light)',
                            }}
                          >
                            <div style={{
                              background: color,
                              margin: '0 1px',
                              height: 26,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 4,
                              fontSize: spanLen === 1 ? '0.62rem' : '0.72rem',
                              fontWeight: 700,
                              color: '#333',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              borderTopLeftRadius: 6,
                              borderBottomLeftRadius: 6,
                              borderTopRightRadius: 6,
                              borderBottomRightRadius: 6,
                              boxShadow: spanLen > 1 ? `0 1px 4px ${color}88` : undefined,
                              position: 'relative',
                            }}>
                              {spanLen > 1 && (
                                <span style={{
                                  position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)',
                                  fontSize: '0.55rem', fontWeight: 900, color: '#33333399',
                                }}>|</span>
                              )}
                              <span>{shiftCode}</span>
                              {spanLen > 2 && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 400, opacity: 0.8 }}>
                                  {label}
                                </span>
                              )}
                              {spanLen > 1 && (
                                <span style={{
                                  position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                                  fontSize: '0.55rem', fontWeight: 900, color: '#33333399',
                                }}>|</span>
                              )}
                            </div>
                          </td>
                        );
                        d += span;
                      } else {
                        // ⚠️ Capture d NOW before d++ (fixes JS closure-in-loop bug)
                        const emptyDay = d;
                        cells.push(
                          <td
                            key={emptyDay}
                            onClick={(e) => handleCellClick(e, staff.id, emptyDay)}
                            title={`คลิกเพื่อล็อคเวร/ลา วันที่ ${emptyDay}`}
                            style={{
                              padding: '2px 1px',
                              textAlign: 'center',
                              borderBottom: '1px solid var(--border-color-light)',
                              background: isWeekend(viewMonth, emptyDay) ? 'rgba(245,158,11,0.04)' : undefined,
                              cursor: 'pointer',
                              minWidth: 32,
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}
                            onMouseLeave={e => e.currentTarget.style.background = isWeekend(viewMonth, emptyDay) ? 'rgba(245,158,11,0.04)' : ''}
                          >
                            <div style={{ minWidth: 28, height: 26, margin: '0 auto' }} />
                          </td>
                        );
                        d++;
                      }
                    }
                    return cells;
                  })()}
                </tr>

              ))}
              {activeStaff.length === 0 && (
                <tr>
                  <td colSpan={daysInMonth + 2} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                    ยังไม่มีบุคลากร Active
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Popup for selecting shift type */}
      {popup && (
        <>
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
            onClick={() => setPopup(null)}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: Math.min(popup.y, window.innerHeight - 480),
              left: Math.min(popup.x, window.innerWidth - 260),
              zIndex: 999,
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              padding: 12,
              minWidth: 240,
            }}
          >
            {/* Header */}
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border-color-light)' }}>
              📅 วันที่ {popup.day} — กำหนดเวร/ช่วงลา
            </div>

            {/* End day range */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 4 }}>ช่วงวันที่</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>วันที่ {popup.day}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>ถึง</span>
                <select
                  className="form-select"
                  value={popup.endDay}
                  onChange={e => setPopup(prev => ({ ...prev, endDay: Number(e.target.value) }))}
                  style={{ flex: 1, fontSize: '0.82rem', padding: '4px 8px', height: 32 }}
                >
                  {Array.from({ length: daysInMonth - popup.day + 1 }, (_, i) => popup.day + i).map(d => (
                    <option key={d} value={d}>วันที่ {d}{d === popup.day ? ' (วันเดียว)' : ''}</option>
                  ))}
                </select>
              </div>
              {popup.endDay > popup.day && (
                <div style={{ fontSize: '0.72rem', color: 'var(--color-accent)', marginTop: 4 }}>
                  รวม {popup.endDay - popup.day + 1} วัน
                </div>
              )}
            </div>

            {/* Leave type buttons */}
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>เลือกประเภท แล้วกดเพื่อยืนยัน</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
              {leaveShifts.map(s => (
                <button
                  key={s.code}
                  onClick={() => handleSelectShift(s.code, popup.endDay)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: popup.current === s.code ? '2px solid var(--color-primary)' : '1px solid var(--border-color-light)',
                    background: popup.current === s.code ? 'rgba(59,130,246,0.1)' : 'var(--color-bg-secondary)',
                    cursor: 'pointer', textAlign: 'left',
                    fontWeight: popup.current === s.code ? 700 : 400,
                    fontSize: '0.82rem',
                    color: 'var(--color-text-primary)',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    background: s.hex,
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    color: '#333',
                    minWidth: 36,
                    textAlign: 'center',
                  }}>{s.code}</span>
                  <span>{s.name.split(' (')[0]}</span>
                  {popup.current === s.code && <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--color-primary)' }}>✓ ปัจจุบัน</span>}
                </button>
              ))}
              {popup.current && (
                <button
                  onClick={() => handleSelectShift('')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--color-danger)',
                    background: 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                    fontSize: '0.82rem',
                    color: 'var(--color-danger)',
                    marginTop: 4,
                  }}
                >
                  <X size={14} /> ล้างช่วงวันลานี้ทั้งหมด
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {/* Success Toast */}
      {showSuccess && (
        <div className="animate-slide-up" style={{
          position: 'fixed', bottom: 32, right: 32, zIndex: 9999,
          background: 'var(--color-bg-card)', border: '1px solid var(--color-success)',
          boxShadow: 'var(--shadow-lg)', padding: '14px 24px', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <CheckCircle size={24} style={{ color: 'var(--color-success)' }} />
          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{showSuccess}</span>
        </div>
      )}

      <CustomDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        type="CONFIRM"
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={confirmDialog.danger}
        onConfirm={() => {
          if (confirmDialog.action) confirmDialog.action();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
      />
    </div>
  );
}
