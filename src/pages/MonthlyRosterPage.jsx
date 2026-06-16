import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Save, CheckCircle, Sparkles, RotateCcw, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  loadConfig, loadShiftTypes, loadStaffList,
  loadMonthlyRoster, saveMonthlyRoster,
  getDaysInMonth, getDayOfWeek, isWeekend, getMonthName,
  loadActiveMonth, saveActiveMonth
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
  const [viewMonth, setViewMonthState] = useState(loadActiveMonth());
  const [dialog, setDialog] = useState({ isOpen: false, type: 'CONFIRM', title: '', message: '', onConfirm: null, danger: false });

  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const setViewMonth = (m) => {
    setViewMonthState(m);
    saveActiveMonth(m);
  };

  useEffect(() => {
    const loadedConfig = loadConfig();
    setConfig(loadedConfig);
    setShiftTypes(loadShiftTypes());
    setStaffList(loadStaffList());
    const month = loadActiveMonth();
    setViewMonth(month);
    setRoster(loadMonthlyRoster(month));
  }, []);

  // Reload roster when viewMonth changes
  useEffect(() => {
    if (viewMonth) {
      setRoster(loadMonthlyRoster(viewMonth));
      setSaved(false);
    }
  }, [viewMonth]);

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

  const handleShiftChange = (staffId, day, { shift, ot, otType = '' }) => {
    setRoster(prev => {
      const staffRoster = prev[staffId] || {};
      const val = `${shift}\n${ot}\n${otType}`;
      return {
        ...prev,
        [staffId]: { ...staffRoster, [day]: val }
      };
    });
    setSaved(false);
  };

  const handleSave = () => {
    saveMonthlyRoster(roster, viewMonth);
    setSaved(true);
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
        closeDialog();
      }
    });
  };

  const getShiftClass = (code) => {
    if (!code || code === '') return 'shift-none';
    return `shift-${code}`;
  };

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
      <div className="page-header">
        <div className="page-header-left">
          <h1>📅 จัดตารางเวร</h1>
          <p>{config.unit_name ? `${config.unit_name} — ` : ''}{config.hospital_name} | บุคลากร {activeStaff.length} คน | {daysInMonth} วัน</p>
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
      <div className="card mb-lg" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
        <div className="flex gap-md items-center" style={{ flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted font-bold">ประเภทเวร:</span>
          {activeShifts.map(st => (
            <span key={st.code} className={`badge badge-${st.code}`}>
              {st.code} ({st.hours > 0 ? `${st.start}-${st.end}` : st.name.split(' (')[0]})
            </span>
          ))}
          <span style={{ marginLeft: 'auto', borderLeft: '1px solid var(--border-color)', paddingLeft: 16 }}>
            <span className="text-muted font-bold" style={{ fontSize: '0.75rem' }}>หมายเหตุ:</span>
            <span className="text-muted" style={{ marginLeft: 4, fontSize: '0.75rem' }}>ช่อง OT สามารถพิมพ์ตัวอักษรต่อท้ายได้ เช่น <strong>8R</strong>=RLV, <strong>8A</strong>=ADM</span>
          </span>
        </div>
      </div>

      {/* Roster Grid */}
      <div className="card" style={{ padding: 'var(--space-sm)' }}>
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
                      minWidth: 54,
                    }}
                  >
                    <div>{d}</div>
                    <div style={{ fontSize: '0.6rem', color: isWeekend(viewMonth, d) ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                      {getDayOfWeek(viewMonth, d)}
                    </div>
                  </th>
                ))}
                <th className="total-cell" style={{ minWidth: 46, borderLeft: '1px solid var(--border-color)' }}>ชม.เวร</th>
                <th className="total-cell" style={{ minWidth: 46, color: '#9ca3af' }}>OT</th>
              </tr>
            </thead>
            <tbody>
              {activeStaff.map(staff => {
                const staffRoster = roster[staff.id] || {};
                let shiftHours = 0;
                let otHours = 0;
                for (const d of Object.keys(staffRoster)) {
                  const { shift, ot } = parseShift(staffRoster[d]);
                  shiftHours += getShiftHours(shift, shiftTypesMap);
                  otHours += ot;
                }
                const totalHours = shiftHours + otHours;
                const staffViolations = violations[staff.id] || new Set();

                return (
                  <tr key={staff.id}>
                    <td className="staff-name-cell" title={`${staff.firstName} ${staff.lastName}`}>
                          <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{staff.firstName} {staff.nickname ? `(${staff.nickname})` : ''}</div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>{staff.level && staff.level !== '-' ? staff.level : staff.position}</div>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <select
                                className={`roster-cell-select ${getShiftClass(shift)}`}
                                value={shift}
                                onChange={(e) => handleShiftChange(staff.id, d, { shift: e.target.value, ot, otType })}
                              >
                                <option value="">-</option>
                                {activeShifts.map(st => (
                                  <option key={st.code} value={st.code}>{st.code}</option>
                                ))}
                              </select>
                              <input 
                                type="text" 
                                className="ot-input"
                                value={ot > 0 ? `${ot}${otType || ''}` : ''}
                                placeholder="ชม."
                                onChange={(e) => {
                                  const val = e.target.value.toUpperCase();
                                  const match = val.match(/^(\d*)([A-Z]*)$/);
                                  let newOt = 0;
                                  let newOtType = '';
                                  if (match) {
                                    newOt = Number(match[1]) || 0;
                                    newOtType = match[2];
                                  } else {
                                    newOt = parseInt(val, 10) || 0;
                                    newOtType = val.replace(/[0-9]/g, '');
                                  }
                                  handleShiftChange(staff.id, d, { shift, ot: newOt, otType: newOtType });
                                }}
                                title="จำนวน ชม. OT/RLV/ADM (เช่น 8, 8R, 8A)"
                              />
                            </div>
                          );
                        })()}
                      </td>
                    ))}
                    <td className="total-cell" style={{ borderLeft: '1px solid var(--border-color)', color: totalHours > config.max_weekly_hours * 5 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                      {shiftHours}
                    </td>
                    <td className="total-cell" style={{ color: '#9ca3af' }}>
                      {otHours}
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
                      <span className={`badge badge-${shiftCode}`} style={{ marginRight: 4 }}>{shiftCode}</span>
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
                <tr key={`role-count-${role}`} className="coverage-row" style={{ opacity: 0.85, height: '32px' }}>
                  <td className="staff-name-cell" style={{ background: 'var(--color-bg-tertiary)', textAlign: 'right', paddingRight: '12px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>รวม {role}</span>
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
              <tr className="coverage-row" style={{ background: 'rgba(59,130,246,0.05)', height: '36px' }}>
                <td className="staff-name-cell" style={{ textAlign: 'right', paddingRight: '12px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-primary-dark)' }}>รวมผู้ปฏิบัติงานทั้งหมด</span>
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
    </div>
  );
}
