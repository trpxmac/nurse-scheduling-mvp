import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Save, CheckCircle, Sparkles, RotateCcw, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  loadConfig, loadShiftTypes, loadStaffList,
  loadMonthlyRoster, saveMonthlyRoster,
  getDaysInMonth, getDayOfWeek, isWeekend, getMonthName,
} from '../utils/storage';
import {
  buildShiftTypesMap, calcMonthlyHours, detectQuickReturns,
  calcDailyCoverage, checkCoverageRequirements, parseShift,
  getShiftHours
} from '../utils/scheduling';

export default function MonthlyRosterPage() {
  const [config, setConfig] = useState({});
  const [shiftTypes, setShiftTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [roster, setRoster] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadedConfig = loadConfig();
    setConfig(loadedConfig);
    setShiftTypes(loadShiftTypes());
    setStaffList(loadStaffList());
    setRoster(loadMonthlyRoster(loadedConfig.month));
  }, []);

  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList]);
  const activeShifts = useMemo(() => shiftTypes.filter(s => s.active), [shiftTypes]);
  const shiftTypesMap = useMemo(() => buildShiftTypesMap(shiftTypes), [shiftTypes]);
  const daysInMonth = useMemo(() => getDaysInMonth(config.month), [config.month]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // Calculate violations for each staff
  const violations = useMemo(() => {
    const v = {};
    for (const staff of activeStaff) {
      const qr = detectQuickReturns(roster[staff.id] || {}, shiftTypesMap, config.min_rest_hours, config.month);
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

  const handleShiftChange = (staffId, day, value) => {
    setRoster(prev => ({
      ...prev,
      [staffId]: {
        ...(prev[staffId] || {}),
        [day]: value,
      }
    }));
    setSaved(false);
  };

  const handleSave = () => {
    saveMonthlyRoster(roster, config.month);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClear = () => {
    if (window.confirm('ล้างตารางเวรทั้งหมด?')) {
      setRoster({});
      saveMonthlyRoster({}, config.month);
    }
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
          <h1>📅 จัดตารางเวร — {getMonthName(config.month)}</h1>
          <p>{config.unit_name ? `${config.unit_name} — ` : ''}{config.hospital_name} | บุคลากร {activeStaff.length} คน | {daysInMonth} วัน</p>
        </div>
        <div className="page-header-actions">
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
              {st.code} ({st.hours > 0 ? `${st.start}-${st.end}` : 'หยุด'})
            </span>
          ))}
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
                      background: isWeekend(config.month, d) ? 'rgba(245,158,11,0.08)' : undefined,
                      minWidth: 54,
                    }}
                  >
                    <div>{d}</div>
                    <div style={{ fontSize: '0.6rem', color: isWeekend(config.month, d) ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                      {getDayOfWeek(config.month, d)}
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
                      <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{staff.nickname || staff.firstName}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{staff.position}</div>
                    </td>
                    {days.map(d => (
                      <td
                        key={d}
                        className={staffViolations.has(d) ? 'violation-cell' : ''}
                        style={{
                          background: isWeekend(config.month, d) ? 'rgba(245,158,11,0.04)' : undefined,
                          padding: 2,
                        }}
                      >
                        {(() => {
                          const { shift, ot } = parseShift(staffRoster[d]);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <select
                                className={`roster-cell-select ${getShiftClass(shift)}`}
                                value={shift}
                                onChange={(e) => handleShiftChange(staff.id, d, { shift: e.target.value, ot })}
                                style={{ height: '24px', padding: '0 2px' }}
                              >
                                <option value="">-</option>
                                {activeShifts.map(st => (
                                  <option key={st.code} value={st.code}>{st.code}</option>
                                ))}
                              </select>
                              <input 
                                type="number" 
                                min="0" max="24"
                                value={ot || ''}
                                placeholder="OT"
                                onChange={(e) => handleShiftChange(staff.id, d, { shift, ot: Number(e.target.value) || 0 })}
                                style={{ 
                                  width: '100%', height: '18px', fontSize: '0.65rem', 
                                  textAlign: 'center', background: 'transparent', border: '1px dashed var(--border-color)',
                                  color: 'var(--color-text-secondary)', borderRadius: '3px'
                                }}
                                title="ชั่วโมง OT"
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
              {['M', 'E', 'N8'].map(shiftCode => {
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
