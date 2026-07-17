import { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Save, CheckCircle, Sparkles, RotateCcw, Printer, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  loadConfig, loadShiftTypes, loadStaffList,
  loadMonthlyRoster, saveMonthlyRoster,
  getDaysInMonth, getDayOfWeek, isWeekend, getMonthName,
  loadActiveMonth, saveActiveMonth, loadMonthlySettings, loadLeaveSchedules
} from '../utils/storage';
import MonthSelector from '../components/MonthSelector';
import CustomDialog from '../components/CustomDialog';
import {
  buildShiftTypesMap, calcMonthlyHours, detectQuickReturns,
  calcDailyCoverage, checkCoverageRequirements, parseShift,
  getShiftHours, filterActiveShifts, calcWeeklyHours,
  detectConsecutiveNights, detectConsecutiveWorkdays, detectMaxDailyHours
} from '../utils/scheduling';

// LEVEL_RANK for required_level_every_shift comparison (outside component to avoid re-creation)
const LEVEL_RANK = { HOD: 6, RN5: 5, RN4: 4, RN3: 3, RN2: 2, RN1: 1, PN: 0, PA: 0, NA: 0, '-': 0 };

export default function MonthlyRosterPage() {
  const [config, setConfig] = useState({});
  const [shiftTypes, setShiftTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [roster, setRoster] = useState({});
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonthState] = useState(loadActiveMonth());
  const [monthlySettings, setMonthlySettings] = useState({});
  const [leaveSchedules, setLeaveSchedules] = useState([]);
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
      setLeaveSchedules(await loadLeaveSchedules(month));
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
        setLeaveSchedules(await loadLeaveSchedules(viewMonth));
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

  const lockedSlots = useMemo(() => {
    const map = {};
    for (const sch of leaveSchedules) {
      if (!map[sch.staffId]) map[sch.staffId] = {};
      for (let d = sch.startDay; d <= sch.endDay; d++) {
        map[sch.staffId][d] = sch.shiftCode;
      }
    }
    return map;
  }, [leaveSchedules]);

  // LEVEL_RANK for required_level_every_shift comparison

  // Pre-compute: for each day, which shift codes are missing the required level
  const missingLevelDays = useMemo(() => {
    const reqLevel = config.required_level_every_shift;
    if (!reqLevel) return {}; // No constraint set
    const reqRank = LEVEL_RANK[reqLevel] || 0;

    // result: { [day]: Set<shiftCode> } — shift codes that are missing required level on that day
    const result = {};
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    for (const day of daysArr) {
      // Collect all (staffId, shiftCode) pairs working on this day
      const shiftGroups = {}; // shiftCode -> array of staff
      for (const staff of activeStaff) {
        const { shift } = parseShift((roster[staff.id] || {})[day]);
        if (!shift || shift === '' || shift === '-') continue;
        const st = shiftTypesMap[shift];
        if (!st || st.category === 'OFF' || st.category === 'LEAVE') continue;
        if (!shiftGroups[shift]) shiftGroups[shift] = [];
        shiftGroups[shift].push(staff);
      }
      // Check each shift group for qualified staff
      const missingShifts = new Set();
      for (const [shiftCode, staffGroup] of Object.entries(shiftGroups)) {
        const hasQualified = staffGroup.some(s => (LEVEL_RANK[s.level || '-'] || 0) >= reqRank);
        if (!hasQualified) missingShifts.add(shiftCode);
      }
      if (missingShifts.size > 0) result[day] = missingShifts;
    }
    return result;
  }, [roster, activeStaff, shiftTypesMap, config, daysInMonth]);

  // Calculate violations for each staff with details for tooltip
  const violations = useMemo(() => {
    const v = {};
    for (const staff of activeStaff) {
      const staffId = staff.id;
      const sr = roster[staffId] || {};
      v[staffId] = {}; // Map of day -> array of error messages

      const addViolation = (day, msg) => {
        if (!v[staffId][day]) v[staffId][day] = [];
        if (!v[staffId][day].includes(msg)) v[staffId][day].push(msg);
      };

      // Quick Returns
      const qr = detectQuickReturns(sr, shiftTypesMap, config.min_rest_hours || 11, viewMonth);
      for (const viol of qr) {
        addViolation(viol.day, `⚠️ พักน้อยกว่า ${config.min_rest_hours || 11} ชม. (ลงเวร ${viol.prevShift} ขึ้นเวร ${viol.currentShift} พักจริง ${viol.restHours} ชม.)`);
      }

      // Consecutive Nights
      const maxNights = config.max_consecutive_nights || 3;
      const nightRun = detectConsecutiveNights(sr, shiftTypesMap, maxNights, viewMonth);
      for (const run of nightRun) {
        for (let d = run.startDay; d <= run.endDay; d++) {
          addViolation(d, `⚠️ เวรดึกติดกันเกิน ${maxNights} วัน (ติดกัน ${run.count} วัน)`);
        }
      }

      // Consecutive Workdays
      const maxWork = config.max_consecutive_workdays || 5;
      const workRun = detectConsecutiveWorkdays(sr, shiftTypesMap, maxWork, viewMonth);
      for (const run of workRun) {
        for (let d = run.startDay; d <= run.endDay; d++) {
          addViolation(d, `⚠️ ทำงานติดกันเกิน ${maxWork} วัน (ติดกัน ${run.count} วัน)`);
        }
      }

      // Max Daily Hours
      const maxDaily = config.max_daily_hours || 12;
      const dailyHours = detectMaxDailyHours(sr, shiftTypesMap, maxDaily);
      for (const viol of dailyHours) {
        addViolation(viol.day, `⚠️ ทำงานเกิน ${maxDaily} ชม. ในหนึ่งวัน (ทำจริง ${viol.hours} ชม.)`);
      }

      // Required Level Every Shift
      if (config.required_level_every_shift) {
        const reqLevel = config.required_level_every_shift;
        for (const day of Object.keys(missingLevelDays).map(Number)) {
          const missingShifts = missingLevelDays[day];
          const { shift } = parseShift(sr[day]);
          if (shift && missingShifts.has(shift)) {
            addViolation(day, `🚨 เวร ${shift} วันที่ ${day} ไม่มีพยาบาลระดับ ${reqLevel} ขึ้นไป`);
          }
        }
      }
    }
    return v;
  }, [roster, activeStaff, shiftTypesMap, config, viewMonth, missingLevelDays]);

  // Per-staff comprehensive validation (real-time)
  const staffValidations = useMemo(() => {
    const result = {};
    for (const staff of activeStaff) {
      const sr = roster[staff.id] || {};
      const issues = [];

      // Quick Returns
      const qr = detectQuickReturns(sr, shiftTypesMap, config.min_rest_hours || 11, viewMonth);
      if (qr.length > 0) issues.push(`พักไม่พอ ${qr.length} ครั้ง`);

      // Weekly hours
      const weeks = calcWeeklyHours(sr, shiftTypesMap, viewMonth);
      const weeklyOver = weeks.filter(w => w.workHours > Number(config.max_weekly_hours || 52));
      if (weeklyOver.length > 0) {
        const maxW = weeks.reduce((m, w) => Math.max(m, w.workHours), 0);
        issues.push(`สัปดาห์เกิน (${maxW} ชม.)`);
      }

      // Consecutive nights
      const nightRun = detectConsecutiveNights(sr, shiftTypesMap, config.max_consecutive_nights || 3, viewMonth);
      if (nightRun.length > 0) issues.push(`ดึกติดเกิน (${nightRun.length} ครั้ง)`);

      // Consecutive workdays
      const workRun = detectConsecutiveWorkdays(sr, shiftTypesMap, config.max_consecutive_workdays || 5, viewMonth);
      if (workRun.length > 0) issues.push(`ทำติดเกิน (${workRun.length} ครั้ง)`);

      // Daily hours
      const maxDaily = config.max_daily_hours || 12;
      const dailyHours = detectMaxDailyHours(sr, shiftTypesMap, maxDaily);
      if (dailyHours.length > 0) issues.push(`วันเกิน (${dailyHours.length} ครั้ง)`);

      // Required Level Every Shift — count days this staff is in a shift missing the required level
      if (config.required_level_every_shift) {
        let levelViolDays = 0;
        for (const day of Object.keys(missingLevelDays).map(Number)) {
          const { shift } = parseShift(sr[day]);
          if (shift && missingLevelDays[day]?.has(shift)) levelViolDays++;
        }
        if (levelViolDays > 0) issues.push(`ขาดระดับ ${config.required_level_every_shift} (${levelViolDays} วัน)`);
      }

      result[staff.id] = issues;
    }
    return result;
  }, [roster, activeStaff, shiftTypesMap, config, viewMonth, missingLevelDays]);

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
    return Array.from(roles).filter(r => r !== 'HOD').sort().reverse();
  }, [activeStaff]);

  const dailyStaffCounts = useMemo(() => {
    const counts = {};
    days.forEach(d => {
      counts[d] = { total: 0, roles: {}, officeTotal: 0, hodTotal: 0 };
    });
    
    for (const staff of activeStaff) {
      const role = staff.level && staff.level !== '-' ? staff.level : staff.position;
      const sr = roster[staff.id] || {};
      for (const d of days) {
        const { shift } = parseShift(sr[d]);
        if (shift && shift !== '') {
          const st = shiftTypesMap[shift];
          if (st && st.hours > 0) {
            if (role === 'HOD') counts[d].hodTotal++;
            
            if (st.category === 'OFFICE') {
              counts[d].officeTotal++;
            } else {
              counts[d].total++;
              counts[d].roles[role] = (counts[d].roles[role] || 0) + 1;
            }
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
        setRoster(lockedSlots);
        saveMonthlyRoster(lockedSlots, viewMonth);
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
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>{config.unit_name ? `${config.unit_name} — ` : ''}{config.hospital_name}</span>
            <span>|</span>
            <span>บุคลากร {activeStaff.length} คน</span>
            <span>|</span>
            <span>{daysInMonth} วัน</span>
            <span>|</span>
            <span style={{ fontWeight: 600 }}>Roster Hours: {monthlySettings.roster_hours || config.roster_hours || 0} ชม.</span>
            {(monthlySettings.holiday_hours > 0 || config.holiday_hours > 0) && (
              <>
                <span>|</span>
                <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>Holiday: {monthlySettings.holiday_hours || config.holiday_hours} ชม.</span>
              </>
            )}
          </p>
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
                {days.map(d => {
                  const hasMissingLevel = config.required_level_every_shift && missingLevelDays[d]?.size > 0;
                  const missingShiftList = hasMissingLevel ? Array.from(missingLevelDays[d]).join(', ') : '';
                  return (
                    <th
                      key={d}
                      style={{
                        background: hasMissingLevel
                          ? 'rgba(239,68,68,0.10)'
                          : isWeekend(viewMonth, d) ? '#fef3c7' : undefined,
                        minWidth: 24,
                        padding: '0 2px',
                        position: 'relative',
                      }}
                      title={hasMissingLevel ? `🚨 เวร ${missingShiftList} ขาดระดับ ${config.required_level_every_shift}` : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                        {d}
                        {hasMissingLevel && (
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-danger)', display: 'inline-block', flexShrink: 0 }} />
                        )}
                      </div>
                      <div style={{ fontSize: '0.6rem', color: hasMissingLevel ? 'var(--color-danger)' : isWeekend(viewMonth, d) ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                        {getDayOfWeek(viewMonth, d)}
                      </div>
                    </th>
                  );
                })}
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
                const staffViolations = violations[staff.id] || {};

                return (
                  <tr key={staff.id}>
                    <td className="staff-name-cell hover-bg-light" title={staffValidations[staff.id]?.length > 0 ? `⚠️ ${staffValidations[staff.id].join(', ')}` : `คลิกเพื่อดูตารางเวรของ ${staff.firstName} ${staff.lastName}`} onClick={() => setSelectedStaffForModal(staff)} style={{ cursor: 'pointer', transition: 'background 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          {staffValidations[staff.id]?.length > 0
                            ? <span style={{ color: 'var(--color-danger)', fontSize: '0.7rem', flexShrink: 0 }}>⚠️</span>
                            : <Search size={12} style={{ color: 'var(--color-primary)', opacity: 0.7 }} />}
                          {staff.nickname || staff.firstName}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 700, flexShrink: 0 }}>{staff.level && staff.level !== '-' ? staff.level : staff.position}</span>
                      </div>
                    </td>
                    {days.map(d => {
                      const dayViolations = staffViolations[d];
                      const isLocked = lockedSlots[staff.id]?.[d];
                      return (
                      <td
                        key={d}
                        className={dayViolations ? 'violation-cell' : ''}
                        style={{
                          background: isWeekend(viewMonth, d) ? 'rgba(245,158,11,0.04)' : undefined,
                          backgroundImage: isLocked ? 'radial-gradient(var(--color-text-muted) 1px, transparent 1px)' : undefined,
                          backgroundSize: isLocked ? '4px 4px' : undefined,
                        }}
                        title={dayViolations ? dayViolations.join('\n') : (isLocked ? 'ดึงจากกำหนดช่วงลา/อบรม' : undefined)}
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
                                title={dayViolations ? dayViolations.join('\n') : undefined}
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
                    )})}
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
                if (shiftTypesMap['O']) coverageShifts.push('O');
                return coverageShifts;
              })().map(shiftCode => {
                if (!shiftTypesMap[shiftCode]?.active) return null;
                const required = config[`required_${shiftCode}_coverage`] || 0;
                const max = config[`max_${shiftCode}_coverage`] || 0;
                const rangeLabel = max > 0 ? `ขั้นต่ำ ${required}, สูงสุด ${max}` : `ขั้นต่ำ ${required}`;
                return (
                  <tr key={`cov-${shiftCode}`} className="coverage-row">
                    <td className="staff-name-cell" style={{ background: 'var(--color-bg-tertiary)' }}>
                      <span className={`badge badge-${shiftCode}`} style={{ ...(shiftTypesMap[shiftCode]?.hex ? { backgroundColor: `${shiftTypesMap[shiftCode].hex}35`, color: '#1e293b', borderColor: `${shiftTypesMap[shiftCode].hex}60` } : {}), marginRight: 4 }}>{shiftCode}</span>
                      {shiftCode !== 'O' && <span style={{ fontSize: '0.68rem' }}>{rangeLabel}</span>}
                    </td>
                    {days.map(d => {
                      const actual = coverage[d]?.[shiftCode] || 0;
                      const met = actual >= required && (max === 0 || actual <= max);
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
                 const dayViolations = violations[selectedStaffForModal.id]?.[d];
                 const hasViol = !!dayViolations;
                 const isLocked = lockedSlots[selectedStaffForModal.id]?.[d];
                 
                 return (
                   <div key={d} style={{ 
                     border: `1px solid ${hasViol ? 'var(--color-danger)' : 'var(--border-color)'}`, 
                     borderRadius: '6px', 
                     padding: '6px', 
                     textAlign: 'center', 
                     background: hasViol ? 'rgba(239, 68, 68, 0.05)' : (isWknd ? 'rgba(245, 158, 11, 0.05)' : 'white'), 
                     backgroundImage: isLocked ? 'radial-gradient(var(--color-text-muted) 1px, transparent 1px)' : undefined,
                     backgroundSize: isLocked ? '4px 4px' : undefined,
                     minHeight: '75px', 
                     display: 'flex', 
                     flexDirection: 'column',
                     boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                   }}
                   title={hasViol ? dayViolations.join('\n') : (isLocked ? 'ดึงจากกำหนดช่วงลา/อบรม' : undefined)}>
                     <div style={{ fontSize: '0.75rem', color: isWknd ? 'var(--color-accent)' : 'var(--color-text-muted)', marginBottom: '6px', fontWeight: 600, background: isLocked ? 'rgba(255,255,255,0.7)' : 'transparent', borderRadius: '4px', display: 'inline-block', padding: '0 4px', alignSelf: 'center' }}>{d}</div>
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
