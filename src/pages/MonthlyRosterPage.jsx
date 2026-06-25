import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Save, CheckCircle, Sparkles, RotateCcw, Printer, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  loadConfig, loadShiftTypes, loadStaffList,
  loadMonthlyRoster, saveMonthlyRoster,
  getDaysInMonth, getDayOfWeek, isWeekend, getMonthName,
  loadActiveMonth, saveActiveMonth, loadMonthlySettings
} from '../utils/storage';
import MonthSelector from '../components/MonthSelector';
import CustomDialog from '../components/CustomDialog';
import {
  buildShiftTypesMap, calcMonthlyHours, detectQuickReturns,
  calcDailyCoverage, checkCoverageRequirements, parseShift,
  getShiftHours, filterActiveShifts
} from '../utils/scheduling';

export default function MonthlyRosterPage() {
  const [config, setConfig] = useState({});
  const [shiftTypes, setShiftTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [roster, setRoster] = useState({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonthState] = useState(loadActiveMonth());
  const [monthlySettings, setMonthlySettings] = useState({});
  const [dialog, setDialog] = useState({ isOpen: false, type: 'CONFIRM', title: '', message: '', onConfirm: null, danger: false });
  const [selectedStaffForModal, setSelectedStaffForModal] = useState(null);
  const [showSuccess, setShowSuccess] = useState('');

  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const setViewMonth = (m) => {
    setViewMonthState(m);
    saveActiveMonth(m);
  };

  useEffect(() => {
    async function init() {
      const loadedConfig = await loadConfig();
      setConfig(loadedConfig);
      setShiftTypes(await loadShiftTypes());
      setStaffList(await loadStaffList());
      const month = loadActiveMonth();
      setViewMonth(month);
      setRoster(await loadMonthlyRoster(month));
      setMonthlySettings(await loadMonthlySettings(month) || {});
      setLoading(false);
    }
    init();
  }, []);

  // Reload roster when viewMonth changes
  useEffect(() => {
    if (viewMonth && !loading) {
      async function reload() {
        setRoster(await loadMonthlyRoster(viewMonth));
        setMonthlySettings(await loadMonthlySettings(viewMonth) || {});
        setSaved(false);
      }
      reload();
    }
  }, [viewMonth, loading]);


  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList]);
  const activeShifts = useMemo(() => filterActiveShifts(shiftTypes, config.shift_mode), [shiftTypes, config.shift_mode]);
  const shiftTypesMap = useMemo(() => buildShiftTypesMap(shiftTypes), [shiftTypes]);
  const daysInMonth = useMemo(() => getDaysInMonth(viewMonth), [viewMonth]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // Calculate violations for each staff
  const violations = useMemo(() => {
    const v = {};
    for (const staff of activeStaff) {
      const qr = detectQuickReturns(roster[staff.id] || {}, shiftTypesMap, config.min_rest_hours, viewMonth);
      v[staff.id] = new Set(qr.map(viol => viol.day));
    }
    return v;
  }, [roster, activeStaff, shiftTypesMap, config]);

  // Daily coverage
  const coverage = useMemo(() => {
    const activeIds = activeStaff.map(s => s.id);
    return calcDailyCoverage(roster, activeIds, shiftTypesMap);
  }, [roster, activeStaff, shiftTypesMap]);

  const coverageCheck = useMemo(() => {
    return checkCoverageRequirements(coverage, config);
  }, [coverage, config]);

  const activeRoles = useMemo(() => {
    const roles = new Set();
    for (const staff of activeStaff) {
      roles.add(staff.level && staff.level !== '-' ? staff.level : staff.position);
    }
    // Sort roles so RN4 comes before RN3, etc. Reverse alphabetical works well for RN4...RN1, PN, PA.
    return Array.from(roles).sort().reverse();
  }, [activeStaff]);

  const dailyStaffCounts = useMemo(() => {
    const counts = {};
    days.forEach(d => {
      counts[d] = { total: 0, roles: {} };
    });
    
    for (const staff of activeStaff) {
      const role = staff.level && staff.level !== '-' ? staff.level : staff.position;
      const sr = roster[staff.id] || {};
      for (const d of days) {
        const { shift } = parseShift(sr[d]);
        if (shift && shift !== '') {
          const st = shiftTypesMap[shift];
          if (st && st.hours > 0) {
            counts[d].total++;
            counts[d].roles[role] = (counts[d].roles[role] || 0) + 1;
          }
        }
      }
    }
    return counts;
  }, [roster, activeStaff, shiftTypesMap, days]);

  const showToast = (msg) => {
    setShowSuccess(msg);
    setTimeout(() => setShowSuccess(''), 3000);
  };

  const handleShiftChange = (staffId, day, { shift, ot, otType = '' }) => {
    setRoster(prev => {
      const staffRoster = prev[staffId] || {};
      const val = `${shift}\n${ot}\n${otType}`;
      const nextRoster = {
        ...prev,
        [staffId]: { ...staffRoster, [day]: val }
      };
      // Removed auto-save here because user prefers manual save for the roster grid
      return nextRoster;
    });
  };

  const handleSave = () => {
    saveMonthlyRoster(roster, viewMonth);
    setSaved(true);
    showToast('บันทึกตารางเวรเรียบร้อยแล้ว');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClear = () => {
    setDialog({
      isOpen: true,
      type: 'CONFIRM',
      title: 'ยืนยันการล้างตาราง',
      message: 'คุณแน่ใจหรือไม่ว่าต้องการล้างตารางเวรทั้งหมดของเดือนนี้?\nการกระทำนี้ไม่สามารถย้อนกลับได้',
      danger: true,
      confirmText: 'ล้างข้อมูล',
      onConfirm: () => {
        setRoster({});
        saveMonthlyRoster({}, viewMonth);
        showToast('ล้างตารางเวรเรียบร้อยแล้ว');
        closeDialog();
      }
    });
  };

  const getShiftClass = (code) => {
    if (!code || code === '') return 'shift-none';
    return `shift-${code}`;
  };

  if (loading) return <div className="page-container"><div className="card" style={{padding:'40px',textAlign:'center'}}>กำลังโหลดข้อมูล...</div></div>;

  if (activeStaff.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div className="page-header-left">
            <h1>📅 จัดตารางเวร (Monthly Roster)</h1>
          </div>
        </div>
        <div className="card">
          <div className="empty-state">
            <CalendarDays size={48} />
            <h3>ยังไม่มีบุคลากร</h3>
            <p>กรุณาเพิ่มบุคลากรในหน้า "รายชื่อบุคลากร" ก่อน แล้วตั้งค่า Active</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ marginBottom: '8px' }}>
        <div className="page-header-left" style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h1 style={{ fontSize: '1.2rem', margin: 0 }}>📅 จัดตารางเวร</h1>
          <p style={{ margin: 0, fontSize: '0.8rem' }}>{config.unit_name ? `${config.unit_name} — ` : ''}{config.hospital_name} | บุคลากร {activeStaff.length} คน | {daysInMonth} วัน</p>
        </div>
        <div className="page-header-actions">
          <MonthSelector value={viewMonth} onChange={setViewMonth} />
          <Link to="/print" target="_blank" className="btn btn-ghost" style={{ border: '1px solid var(--border-color)' }}>
            <Printer size={16} /> สั่งพิมพ์ (Print)
          </Link>
          <button className="btn btn-ghost" onClick={handleClear}>
            <RotateCcw size={16} /> ล้าง
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'บันทึกแล้ว!' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* Shift Legend */}
      <div className="card" style={{ padding: '6px 12px', marginBottom: '8px' }}>
        <div className="flex gap-md items-center" style={{ flexWrap: 'wrap', fontSize: '0.75rem' }}>
          <span className="text-muted font-bold">ประเภทเวร:</span>
          {activeShifts.map(st => (
            <span key={st.code} className={`badge badge-${st.code}`} style={st.hex ? { backgroundColor: `${st.hex}35`, color: '#1e293b', borderColor: `${st.hex}60` } : {}}>
              {st.code} ({st.hours > 0 ? `${st.start}-${st.end}` : st.name.split(' (')[0]})
            </span>
          ))}
          <span style={{ marginLeft: 'auto', borderLeft: '1px solid var(--border-color)', paddingLeft: 16 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>หมายเหตุ:</span>
            <span style={{ marginLeft: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>ยอด OT จะถูกคำนวณอัตโนมัติเมื่อชั่วโมงเวรรวมเกินเป้าหมาย (Roster Hours)</span>
          </span>
        </div>
      </div>

      {/* Roster Grid */}
      <div className="card" style={{ padding: '4px' }}>
        <div className="roster-grid">
          <table className="roster-table">
            <thead>
              <tr>
                <th className="staff-name-cell">ชื่อ</th>
                {days.map(d => (
                  <th
                    key={d}
                    style={{
                      background: isWeekend(viewMonth, d) ? '#fef3c7' : undefined,
                      minWidth: 36,
                    }}
                  >
                    <div>{d}</div>
                    <div style={{ fontSize: '0.6rem', color: isWeekend(viewMonth, d) ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                      {getDayOfWeek(viewMonth, d)}
                    </div>
                  </th>
                ))}
                <th className="total-cell" style={{ minWidth: 40, borderLeft: '1px solid var(--border-color)' }}>ชม.เวร</th>
                <th className="total-cell" style={{ minWidth: 40, color: '#9ca3af' }}>OT</th>
              </tr>
            </thead>
            <tbody>
              {activeStaff.map(staff => {
                const staffRoster = roster[staff.id] || {};
                let shiftHours = 0;
                let manualOt = 0;
                for (const d of Object.keys(staffRoster)) {
                  const { shift, ot } = parseShift(staffRoster[d]);
                  shiftHours += getShiftHours(shift, shiftTypesMap);
                  manualOt += ot;
                }
                const targetHrs = Number(monthlySettings.roster_hours) || 0;
                const finalOt = targetHrs > 0 ? Math.max(0, (shiftHours + manualOt) - targetHrs) : manualOt;
                const totalHours = shiftHours + manualOt;
                const staffViolations = violations[staff.id] || new Set();

                return (
                  <tr key={staff.id}>
                    <td className="staff-name-cell hover-bg-light" title={`คลิกเพื่อดูตารางเวรของ ${staff.firstName} ${staff.lastName}`} onClick={() => setSelectedStaffForModal(staff)} style={{ cursor: 'pointer', transition: 'background 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Search size={12} style={{ color: 'var(--color-primary)', opacity: 0.7 }} />
                          {staff.firstName} {staff.lastName}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, flexShrink: 0 }}>{staff.level && staff.level !== '-' ? staff.level : staff.position}</span>
                      </div>
                    </td>
                    {days.map(d => (
                      <td
                        key={d}
                        className={staffViolations.has(d) ? 'violation-cell' : ''}
                        style={{
                          background: isWeekend(viewMonth, d) ? 'rgba(245,158,11,0.04)' : undefined,
                        }}
                      >
                        {(() => {
                          const { shift, ot, otType } = parseShift(staffRoster[d]);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', height: '100%', justifyContent: 'center' }}>
                              <select
                                className={`roster-cell-select ${getShiftClass(shift)}`}
                                value={shift}
                                onChange={(e) => handleShiftChange(staff.id, d, { shift: e.target.value, ot: 0, otType: '' })}
                                style={{
                                  width: '100%', height: '100%', border: 'none',
                                  background: shift && shift !== '-' && shiftTypesMap[shift]?.hex ? `${shiftTypesMap[shift].hex}35` : 'transparent',
                                  color: shift && shift !== '-' ? '#1e293b' : 'inherit',
                                  fontWeight: shift && shift !== '-' ? '700' : 'normal'
                                }}
                              >
                                <option value="">-</option>
                                {activeShifts.map(st => (
                                  <option key={st.code} value={st.code}>{st.code}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}
                      </td>
                    ))}
                    <td className="total-cell" style={{ fontWeight: 600, color: 'var(--color-primary-dark)', background: 'rgba(59,130,246,0.05)', borderLeft: '1px solid var(--border-color)' }}>
                      {totalHours}
                    </td>
                    <td className="total-cell" style={{ fontWeight: 700, color: finalOt > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {finalOt > 0 ? `+${finalOt}` : '0'}
                    </td>
                  </tr>
                );
              })}

              {/* Coverage Rows */}
              {(() => {
                const mode = config.shift_mode || '8HR';
                let coverageShifts = [];
                if (mode === '8HR' || mode === 'MIXED') coverageShifts.push('M', 'E', 'N8');
                if (mode === '12HR' || mode === 'MIXED') coverageShifts.push('D', 'N12');
                return coverageShifts;
              })().map(shiftCode => {
                if (!shiftTypesMap[shiftCode]?.active) return null;
                const required = config[`required_${shiftCode}_coverage`] || 0;
                return (
                  <tr key={`cov-${shiftCode}`} className="coverage-row">
                    <td className="staff-name-cell" style={{ background: 'var(--color-bg-tertiary)' }}>
                      <span className={`badge badge-${shiftCode}`} style={{ ...(shiftTypesMap[shiftCode]?.hex ? { backgroundColor: `${shiftTypesMap[shiftCode].hex}35`, color: '#1e293b', borderColor: `${shiftTypesMap[shiftCode].hex}60` } : {}), marginRight: 4 }}>{shiftCode}</span>
                      <span style={{ fontSize: '0.68rem' }}>ขั้นต่ำ {required}</span>
                    </td>
                    {days.map(d => {
                      const actual = coverage[d]?.[shiftCode] || 0;
                      const met = actual >= required;
                      return (
                        <td key={d} className={met ? 'coverage-ok' : 'coverage-warn'}>
                          {actual}
                        </td>
                      );
                    })}
                    <td className="total-cell" style={{ borderLeft: '1px solid var(--border-color)' }}>-</td>
                    <td className="total-cell">-</td>
                  </tr>
                );
              })}

              {/* Staff Count by Role Rows */}
              {activeRoles.map(role => (
                <tr key={`role-count-${role}`} className="coverage-row" style={{ opacity: 0.85, height: '24px' }}>
                  <td className="staff-name-cell" style={{ background: 'var(--color-bg-tertiary)', textAlign: 'right', paddingRight: '12px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{role}</span>
                  </td>
                  {days.map(d => (
                    <td key={`rc-${d}`} style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {dailyStaffCounts[d]?.roles[role] || 0}
                    </td>
                  ))}
                  <td className="total-cell" style={{ borderLeft: '1px solid var(--border-color)' }}>-</td>
                  <td className="total-cell">-</td>
                </tr>
              ))}
              
              {/* Total Staff Row */}
              <tr className="coverage-row" style={{ background: 'rgba(59,130,246,0.05)', height: '28px' }}>
                <td className="staff-name-cell" style={{ textAlign: 'right', paddingRight: '12px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>Total</span>
                </td>
                {days.map(d => (
                  <td key={`tc-${d}`} style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                    {dailyStaffCounts[d]?.total || 0}
                  </td>
                ))}
                <td className="total-cell" style={{ borderLeft: '1px solid var(--border-color)' }}>-</td>
                <td className="total-cell">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Staff Roster Modal */}
      {selectedStaffForModal && (
        <div className="modal-overlay" onClick={() => setSelectedStaffForModal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content animate-scale card" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px', width: '90%', padding: 'var(--space-lg)' }}>
            <div className="flex justify-between items-center mb-md pb-sm" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={20} /> ตารางเวร: {selectedStaffForModal.firstName} {selectedStaffForModal.lastName}
              </h3>
              <div className="flex gap-sm">
                 <button className="btn btn-ghost btn-sm" onClick={() => {
                   const idx = activeStaff.findIndex(s => s.id === selectedStaffForModal.id);
                   const prev = activeStaff[idx > 0 ? idx - 1 : activeStaff.length - 1];
                   setSelectedStaffForModal(prev);
                 }}><ChevronLeft size={16} /> ก่อนหน้า</button>
                 <button className="btn btn-ghost btn-sm" onClick={() => {
                   const idx = activeStaff.findIndex(s => s.id === selectedStaffForModal.id);
                   const next = activeStaff[idx < activeStaff.length - 1 ? idx + 1 : 0];
                   setSelectedStaffForModal(next);
                 }}>ถัดไป <ChevronRight size={16} /></button>
                 <button className="btn btn-ghost btn-icon" onClick={() => setSelectedStaffForModal(null)}><X size={20} /></button>
              </div>
            </div>
            
            <div className="flex items-center gap-md mb-md">
              <div className="badge badge-neutral text-sm">ตำแหน่ง: {selectedStaffForModal.position}</div>
              {selectedStaffForModal.level && selectedStaffForModal.level !== '-' && selectedStaffForModal.level !== selectedStaffForModal.position && (
                <div className="badge badge-primary text-sm">{selectedStaffForModal.level}</div>
              )}
              {(() => {
                const staffRoster = roster[selectedStaffForModal.id] || {};
                let shiftHours = 0;
                let manualOt = 0;
                for (const d of Object.keys(staffRoster)) {
                  const { shift, ot } = parseShift(staffRoster[d]);
                  shiftHours += getShiftHours(shift, shiftTypesMap);
                  manualOt += ot;
                }
                const targetHrs = Number(monthlySettings.roster_hours) || 0;
                const finalOt = targetHrs > 0 ? Math.max(0, (shiftHours + manualOt) - targetHrs) : manualOt;
                return (
                  <>
                    <div className="badge badge-success text-sm" style={{ marginLeft: 'auto' }}>รวม: {shiftHours + manualOt} ชม.</div>
                    {finalOt > 0 && <div className="badge badge-danger text-sm">OT: +{finalOt} ชม.</div>}
                  </>
                );
              })()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', marginBottom: 'var(--space-lg)' }}>
              {['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสฯ', 'ศุกร์', 'เสาร์'].map((day, idx) => (
                <div key={day} style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 'bold', color: idx === 0 || idx === 6 ? 'var(--color-accent)' : 'var(--color-text-muted)', paddingBottom: '4px', borderBottom: '2px solid var(--border-color)' }}>{day}</div>
              ))}
              
              {/* Empty days before 1st of month */}
              {Array.from({ length: new Date(viewMonth.split('-')[0], viewMonth.split('-')[1] - 1, 1).getDay() }).map((_, i) => <div key={`empty-${i}`} />)}
              
              {/* Calendar Days */}
              {days.map(d => {
                 const cell = roster[selectedStaffForModal.id]?.[d];
                 const { shift, ot } = parseShift(cell);
                 const st = shiftTypesMap[shift];
                 const isWknd = isWeekend(viewMonth, d);
                 const hasViol = violations[selectedStaffForModal.id]?.has(d);
                 
                 return (
                   <div key={d} style={{ 
                     border: `1px solid ${hasViol ? 'var(--color-danger)' : 'var(--border-color)'}`, 
                     borderRadius: '6px', 
                     padding: '6px', 
                     textAlign: 'center', 
                     background: hasViol ? 'rgba(239, 68, 68, 0.05)' : (isWknd ? 'rgba(245, 158, 11, 0.05)' : 'white'), 
                     minHeight: '75px', 
                     display: 'flex', 
                     flexDirection: 'column',
                     boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                   }}>
                     <div style={{ fontSize: '0.75rem', color: isWknd ? 'var(--color-accent)' : 'var(--color-text-muted)', marginBottom: '6px', fontWeight: 600 }}>{d}</div>
                     {shift && shift !== '-' ? (
                       <div className={`badge badge-${shift}`} style={{ ...(st?.hex ? { backgroundColor: `${st.hex}35`, color: '#1e293b', borderColor: `${st.hex}60` } : {}), margin: 'auto', width: '100%', display: 'flex', flexDirection: 'column', padding: '6px 2px', lineHeight: 1.2 }}>
                         <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{shift}</span>
                         {st && st.hours > 0 && <span style={{ fontSize: '0.6rem', opacity: 0.9, marginTop: '2px' }}>{st.start}-{st.end}</span>}
                         {ot > 0 && <span style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.2)', padding: '1px 4px', borderRadius: '4px', marginTop: '2px' }}>OT +{ot}</span>}
                       </div>
                     ) : (
                       <div style={{ margin: 'auto', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>-</div>
                     )}
                   </div>
                 )
              })}
            </div>
            
            <div className="flex gap-sm justify-end">
               <button className="btn btn-secondary" onClick={() => setSelectedStaffForModal(null)}>ปิดหน้าต่าง</button>
            </div>
          </div>
        </div>
      )}

      <CustomDialog
        isOpen={dialog.isOpen}
        onClose={closeDialog}
        type={dialog.type}
        title={dialog.title}
        message={dialog.message}
        onConfirm={dialog.onConfirm}
        danger={dialog.danger}
        confirmText={dialog.confirmText}
      />

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
    </div>
  );
}
