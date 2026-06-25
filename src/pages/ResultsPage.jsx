import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Users, Clock, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  loadConfig, loadShiftTypes, loadStaffList,
  loadMonthlyRoster, getDaysInMonth, getMonthName,
  loadActiveMonth, saveActiveMonth, loadMonthlySettings
} from '../utils/storage';
import MonthSelector from '../components/MonthSelector';
import {
  buildShiftTypesMap, calcMonthlyHours, calcWeeklyHours,
  detectQuickReturns, calcDailyCoverage, checkCoverageRequirements,
  countViolations, buildStaffValidation, parseShift, getShiftHours, filterActiveShifts
} from '../utils/scheduling';
import StatCard from '../components/StatCard';
import ShiftBadge from '../components/ShiftBadge';

const CHART_COLORS = ['#f59e0b', '#f97316', '#6366f1', '#10b981', '#a855f7', '#64748b'];

export default function ResultsPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState({});
  const [shiftTypes, setShiftTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [roster, setRoster] = useState({});
  const [selectedValidationStaff, setSelectedValidationStaff] = useState(null);
  const [viewMonth, setViewMonthState] = useState(loadActiveMonth());
  const [monthlySettings, setMonthlySettings] = useState({ roster_hours: 0, holiday_hours: 0 });
  const [loading, setLoading] = useState(true);

  const setViewMonth = (m) => {
    setViewMonthState(m);
    saveActiveMonth(m);
  };

  useEffect(() => {
    async function init() {
      setConfig(await loadConfig());
      setShiftTypes(await loadShiftTypes());
      setStaffList(await loadStaffList());
      const month = loadActiveMonth();
      setViewMonth(month);
      setRoster(await loadMonthlyRoster(month));
      setMonthlySettings(await loadMonthlySettings(month));
      setLoading(false);
    }
    init();
  }, []);

  // Reload roster when viewMonth changes
  useEffect(() => {
    if (viewMonth && !loading) {
      async function reload() {
        setRoster(await loadMonthlyRoster(viewMonth));
        setMonthlySettings(await loadMonthlySettings(viewMonth));
      }
      reload();
    }
  }, [viewMonth, loading]);

  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList]);
  const activeShifts = useMemo(() => filterActiveShifts(shiftTypes, config.shift_mode), [shiftTypes, config.shift_mode]);
  const shiftTypesMap = useMemo(() => buildShiftTypesMap(shiftTypes), [shiftTypes]);
  const daysInMonth = useMemo(() => getDaysInMonth(viewMonth), [viewMonth]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  // Stats
  const stats = useMemo(() => {
    let totalShiftHours = 0;
    let totalOTHours = 0;
    const reqHrs = Number(monthlySettings.roster_hours) || 0;
    const targetHrs = reqHrs;

    const hours = activeStaff.map(s => {
      let sh = 0; let manualOt = 0;
      const sr = roster[s.id] || {};
      for (const d of Object.keys(sr)) {
         const { shift, ot } = parseShift(sr[d]);
         sh += getShiftHours(shift, shiftTypesMap);
         manualOt += ot;
      }
      const finalOt = targetHrs > 0 ? Math.max(0, (sh + manualOt) - targetHrs) : manualOt;
      totalShiftHours += sh;
      totalOTHours += finalOt;
      return sh + manualOt;
    });
    const totalHours = totalShiftHours + totalOTHours;
    const avgHours = hours.length > 0 ? Math.round(totalHours / hours.length) : 0;
    const violations = countViolations(roster, staffList, shiftTypesMap, config, viewMonth);

    const coverage = calcDailyCoverage(roster, activeStaff.map(s => s.id), shiftTypesMap);
    const coverageCheck = checkCoverageRequirements(coverage, config);
    const coverageMet = Object.values(coverageCheck).filter(c => c.met).length;
    const coverageTotal = Object.keys(coverageCheck).length;
    const coverageRate = coverageTotal > 0 ? Math.round((coverageMet / coverageTotal) * 100) : 0;

    return { totalHours, totalShiftHours, totalOTHours, avgHours, violations, coverageRate, coverageMet, coverageTotal, hours };
  }, [roster, activeStaff, shiftTypesMap, config, staffList, monthlySettings]);

  // Chart Data
  const hoursChartData = useMemo(() => {
    const reqHrs = Number(monthlySettings.roster_hours) || 0;
    const targetHrs = reqHrs;

    return activeStaff.map(s => {
      let shiftHours = 0;
      let manualOt = 0;
      const sr = roster[s.id] || {};
      for (const d of Object.keys(sr)) {
         const { shift, ot } = parseShift(sr[d]);
         shiftHours += getShiftHours(shift, shiftTypesMap);
         manualOt += ot;
      }
      const finalOt = targetHrs > 0 ? Math.max(0, (shiftHours + manualOt) - targetHrs) : manualOt;
      return {
        name: s.nickname || s.firstName,
        shiftHours,
        otHours: finalOt,
        total: shiftHours + manualOt
      };
    });
  }, [activeStaff, roster, shiftTypesMap, monthlySettings]);

  const coverageChartData = useMemo(() => {
    const coverage = calcDailyCoverage(roster, activeStaff.map(s => s.id), shiftTypesMap);
    return days.map(d => ({
      day: `${d}`,
      M: coverage[d]?.M || 0,
      E: coverage[d]?.E || 0,
      N8: coverage[d]?.N8 || 0,
      D: coverage[d]?.D || 0,
      N12: coverage[d]?.N12 || 0,
      reqM: config.required_M_coverage || 0,
      reqE: config.required_E_coverage || 0,
      reqN8: config.required_N8_coverage || 0,
      reqD: config.required_D_coverage || 0,
      reqN12: config.required_N12_coverage || 0,
    }));
  }, [roster, activeStaff, shiftTypesMap, days, config]);

  const shiftDistribution = useMemo(() => {
    const counts = {};
    for (const staff of activeStaff) {
      const sr = roster[staff.id] || {};
      for (const day of Object.keys(sr)) {
        const { shift: code } = parseShift(sr[day]);
        if (code && code !== '') {
          // Exclude OFF and Leave days from the pie chart
          if (['OFF', 'AL', 'SL', 'TRN', 'MTG'].includes(code)) continue;
          counts[code] = (counts[code] || 0) + 1;
        }
      }
    }
    return Object.entries(counts).map(([code, count], i) => ({
      name: code,
      value: count,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [roster, activeStaff]);

  // Weekly Summary Data
  const weeklySummary = useMemo(() => {
    return activeStaff.map(s => {
      const weeks = calcWeeklyHours(roster[s.id] || {}, shiftTypesMap, viewMonth);
      const qr = detectQuickReturns(roster[s.id] || {}, shiftTypesMap, config.min_rest_hours, viewMonth);
      return {
        staff: s,
        weeks,
        quickReturns: qr,
        totalHours: calcMonthlyHours(roster[s.id] || {}, shiftTypesMap),
      };
    });
  }, [roster, activeStaff, shiftTypesMap, config]);

  // Validation Check data
  const validationData = useMemo(() => {
    return buildStaffValidation(roster, staffList, shiftTypesMap, config, viewMonth);
  }, [roster, staffList, shiftTypesMap, config]);

  const selectedRow = validationData.find(r => r.staff.id === selectedValidationStaff) || validationData[0] || null;

  // Daily Coverage Data
  const dailyCoverageData = useMemo(() => {
    const coverage = calcDailyCoverage(roster, activeStaff.map(s => s.id), shiftTypesMap);
    const coverageCheck = checkCoverageRequirements(coverage, config);
    return days.map(d => ({
      day: d,
      coverage: coverage[d] || {},
      check: coverageCheck[d] || { met: true, details: {} },
    }));
  }, [roster, activeStaff, shiftTypesMap, config, days]);

  // Staff Shift Summary Data
  const staffShiftSummary = useMemo(() => {
    const reqHrs = Number(monthlySettings.roster_hours) || 0;
    const targetHrs = reqHrs;

    return activeStaff.map(s => {
      const counts = {};
      let totalShiftHours = 0;
      let manualOt = 0;
      let totalWorkingShifts = 0;
      
      activeShifts.forEach(st => counts[st.code] = 0);
      
      const sr = roster[s.id] || {};
      for (const day of Object.keys(sr)) {
        const { shift, ot } = parseShift(sr[day]);
        if (!shift) continue;
        
        if (counts[shift] !== undefined) {
          counts[shift]++;
        } else {
          counts[shift] = 1;
        }
        
        const stHours = getShiftHours(shift, shiftTypesMap);
        totalShiftHours += stHours;
        manualOt += ot;
        if (stHours > 0) totalWorkingShifts++;
      }
      
      const finalOt = targetHrs > 0 ? Math.max(0, (totalShiftHours + manualOt) - targetHrs) : manualOt;
      const totalHours = totalShiftHours + manualOt;
      
      return { staff: s, counts, totalHours, totalShiftHours, totalOTHours: finalOt, totalWorkingShifts, targetHrs };
    });
  }, [roster, activeStaff, shiftTypesMap, activeShifts, monthlySettings]);

  const tabs = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'staff-summary', label: '👥 สรุปเวรรายบุคคล' },
    { id: 'validation', label: '🚨 Validation Check' },
    { id: 'weekly', label: '📋 Weekly Summary' },
    { id: 'coverage', label: '🏥 Daily Coverage' },
  ];

  if (loading) return <div className="page-container"><div className="card" style={{padding:'40px',textAlign:'center'}}>กำลังโหลดข้อมูล...</div></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>📊 ตรวจสอบผลลัพธ์</h1>
          <p>{getMonthName(viewMonth)} — {config.unit_name || config.hospital_name}</p>
          <div style={{ marginTop: '8px', display: 'flex', gap: '16px', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            <span><strong>เป้าหมาย (Roster Hours):</strong> {monthlySettings.roster_hours || '-'} ชม.</span>
            <span><strong>วันหยุด (Holiday Hours):</strong> {monthlySettings.holiday_hours || '-'} ชม.</span>
          </div>
        </div>
        <div className="page-header-actions">
          <MonthSelector value={viewMonth} onChange={setViewMonth} />
        </div>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="animate-fade-in">
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <StatCard icon={Users} label="บุคลากร Active" value={activeStaff.length} color="blue" suffix="คน" />
            <StatCard icon={Clock} label="ชม. ขึ้นเวรจริง" value={stats.totalShiftHours} color="amber" suffix="ชม." />
            <StatCard icon={Clock} label="ชม. OT/RLV/ADM" value={stats.totalOTHours} color="purple" suffix="ชม." />
            <StatCard icon={AlertTriangle} label="Violations" value={stats.violations.total} color={stats.violations.total > 0 ? 'red' : 'green'} />
            <StatCard icon={CheckCircle2} label="Coverage Rate" value={stats.coverageRate} color={stats.coverageRate >= 90 ? 'green' : 'amber'} suffix="%" />
          </div>

          <div className="charts-grid">
            {/* Hours Per Staff */}
            <div className="card">
              <div className="card-header">
                <div className="card-title"><TrendingUp size={18} /> ชั่วโมงทำงานแต่ละคน</div>
              </div>
              {hoursChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hoursChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.1)" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#111d35', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#e8ecf4' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="shiftHours" name="ชม.เวรปกติ" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="otHours" name="ชม. OT" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p>ยังไม่มีข้อมูล</p></div>
              )}
            </div>

            {/* Shift Distribution */}
            <div className="card">
              <div className="card-header">
                <div className="card-title"><BarChart3 size={18} /> สัดส่วนเวร</div>
              </div>
              {shiftDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={shiftDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {shiftDistribution.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#111d35', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#e8ecf4' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p>ยังไม่มีข้อมูล</p></div>
              )}
            </div>

            {/* Coverage Chart */}
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <div className="card-title"><BarChart3 size={18} /> Daily Coverage</div>
              </div>
              {coverageChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={coverageChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(59,130,246,0.1)" />
                    <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#111d35', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, color: '#e8ecf4' }}
                    />
                    <Legend />
                    {(() => {
                      const mode = config.shift_mode || '8HR';
                      const lines = [];
                      if (mode === '8HR' || mode === 'MIXED') {
                        lines.push(
                          <Line key="l-M" type="monotone" dataKey="M" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />,
                          <Line key="l-E" type="monotone" dataKey="E" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />,
                          <Line key="l-N8" type="monotone" dataKey="N8" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />,
                          <Line key="l-rM" type="monotone" dataKey="reqM" stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={1} dot={false} />,
                          <Line key="l-rE" type="monotone" dataKey="reqE" stroke="#f97316" strokeDasharray="5 5" strokeWidth={1} dot={false} />,
                          <Line key="l-rN8" type="monotone" dataKey="reqN8" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                        );
                      }
                      if (mode === '12HR' || mode === 'MIXED') {
                        lines.push(
                          <Line key="l-D" type="monotone" dataKey="D" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />,
                          <Line key="l-N12" type="monotone" dataKey="N12" stroke="#a855f7" strokeWidth={2} dot={{ r: 2 }} />,
                          <Line key="l-rD" type="monotone" dataKey="reqD" stroke="#10b981" strokeDasharray="5 5" strokeWidth={1} dot={false} />,
                          <Line key="l-rN12" type="monotone" dataKey="reqN12" stroke="#a855f7" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                        );
                      }
                      return lines;
                    })()}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><p>ยังไม่มีข้อมูล</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff Summary Tab */}
      {activeTab === 'staff-summary' && (
        <div className="card animate-fade-in">
          <div className="card-header">
            <div className="card-title">👥 สรุปจำนวนเวรรายบุคคล</div>
            <span className="text-muted text-sm">ช่วยให้คุณสามารถตรวจสอบและกระจายเวรได้อย่างเป็นธรรม</span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>ตำแหน่ง</th>
                  {activeShifts.map(st => (
                    <th key={st.code} style={{ textAlign: 'center', padding: '8px 4px' }}>
                      <ShiftBadge code={st.code} color={st.hex} />
                    </th>
                  ))}
                  <th style={{ borderLeft: '1px solid var(--border-color)', textAlign: 'center' }}>รวมเวร</th>
                  <th style={{ textAlign: 'center' }}>ชม.ทำจริง</th>
                  <th style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>OT</th>
                </tr>
              </thead>
              <tbody>
                {staffShiftSummary.map(row => (
                  <tr key={row.staff.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.staff.firstName} {row.staff.lastName}</td>
                    <td style={{ whiteSpace: 'nowrap' }}><span className="badge badge-info">{row.staff.position}</span></td>
                    {activeShifts.map(st => (
                      <td 
                        key={st.code} 
                        style={{ 
                          textAlign: 'center', 
                          fontWeight: row.counts[st.code] > 0 ? 700 : 400,
                          color: row.counts[st.code] > 0 ? 'var(--color-text-primary)' : 'var(--border-color-strong)' 
                        }}
                      >
                        {row.counts[st.code] || 0}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontWeight: 600, borderLeft: '1px solid var(--border-color)' }}>
                      {row.totalWorkingShifts}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-primary-dark)', background: 'rgba(59,130,246,0.05)' }}>
                      {row.totalHours}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: row.totalOTHours > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                      {row.totalOTHours > 0 ? `+${row.totalOTHours}` : '0'}
                    </td>
                  </tr>
                ))}
                {staffShiftSummary.length === 0 && (
                  <tr>
                    <td colSpan={activeShifts.length + 6} className="text-center text-muted" style={{ padding: 40 }}>
                      ยังไม่มีข้อมูลบุคลากร
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validation Check Tab */}
      {activeTab === 'validation' && (() => {
        const staffWithFlags = validationData.filter(r => r.redFlags.length > 0).length;
        const staffOk = validationData.length - staffWithFlags;
        const totalQR = validationData.reduce((s, r) => s + r.quickReturns.length, 0);
        const complianceRate = validationData.length > 0
          ? Math.round((staffOk / validationData.length) * 100) : 0;

        const activeRules = [
          { rule: 'max_weekly_hours',       value: config.max_weekly_hours,       desc: 'ชั่วโมงทำงานสูงสุด/สัปดาห์' },
          { rule: 'min_rest_hours',         value: config.min_rest_hours,         desc: 'ชั่วโมงพักขั้นต่ำระหว่างเวร' },
          { rule: 'max_daily_hours',        value: config.max_daily_hours,        desc: 'ชั่วโมงทำงานสูงสุด/วัน' },
          { rule: 'max_consecutive_nights', value: config.max_consecutive_nights, desc: 'เวรกลางคืนติดต่อกันสูงสุด' },
          { rule: 'max_consecutive_workdays', value: config.max_consecutive_workdays, desc: 'วันทำงานติดต่อกันสูงสุด' },
        ];

        return (
          <div className="animate-fade-in">
            {/* ── Section 1: Staff Validation Table ── */}
            <div className="card mb-lg">
              <div className="card-header">
                <div className="card-title">🔍 สรุปการตรวจสอบรายบุคคล</div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {staffWithFlags > 0
                    ? <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>⚠️ {staffWithFlags} คนต้องตรวจสอบ</span>
                    : <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>✅ ทุกคนผ่าน</span>}
                </span>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>No.</th>
                      <th>Staff ID</th>
                      <th>ชื่อ</th>
                      <th>Total Hrs</th>
                      <th>Max Week H</th>
                      <th>Quick Return</th>
                      <th>QR Days</th>
                      <th>Night Run</th>
                      <th>Work Run</th>
                      <th>Max Daily</th>
                      <th>Weekly Violation</th>
                      <th>Overall Status</th>
                      <th>Red Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationData.map((row, idx) => (
                      <tr
                        key={row.staff.id}
                        style={{
                          cursor: 'pointer',
                          background: selectedValidationStaff === row.staff.id
                            ? 'rgba(59,130,246,0.08)'
                            : row.redFlags.length > 0 ? 'rgba(239,68,68,0.04)' : undefined,
                        }}
                        onClick={() => setSelectedValidationStaff(row.staff.id)}
                      >
                        <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                        <td><code style={{ fontSize: 11 }}>{row.staff.id}</code></td>
                        <td style={{ fontWeight: 600 }}>{row.staff.nickname || row.staff.firstName || row.staff.id}</td>
                        <td style={{ fontWeight: 700 }}>{row.totalHours}</td>
                        <td style={{ color: row.maxWeeklyOk ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                          {row.maxWeeklyHours} {row.maxWeeklyOk ? '✓' : '✗'}
                        </td>
                        <td>
                          {row.quickReturns.length > 0
                            ? <span className="badge badge-danger">⚠️ {row.quickReturns.length} ครั้ง</span>
                            : <span className="badge badge-success">OK</span>}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {row.qrDays.length > 0 ? row.qrDays.join(', ') : '-'}
                        </td>
                        <td>
                          {row.nightRunViolations.length > 0
                            ? <span className="badge badge-danger">{row.nightRunViolations.length}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </td>
                        <td>
                          {row.workRunViolations.length > 0
                            ? <span className="badge badge-danger">{row.workRunViolations.length}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </td>
                        <td>
                          {row.dailyViolations.length > 0
                            ? <span className="badge badge-warning">{row.dailyViolations.length}</span>
                            : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </td>
                        <td>
                          {row.weeklyViolations.length > 0
                            ? <span className="badge badge-danger">{row.weeklyViolations.length} สัปดาห์</span>
                            : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </td>
                        <td>
                          {row.overallStatus === 'OK'
                            ? <span className="badge badge-success">✅ OK</span>
                            : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 14 }}>🔴</span>
                                <span className="badge badge-danger">REVIEW</span>
                              </span>}
                        </td>
                        <td style={{ fontSize: 10, maxWidth: 260 }}>
                          {row.redFlags.length === 0
                            ? <span style={{ color: 'var(--color-success)' }}>—</span>
                            : row.redFlags.map((f, fi) => (
                                <span key={fi} style={{
                                  display: 'inline-block', background: 'rgba(239,68,68,0.12)',
                                  color: '#f87171', padding: '1px 6px', borderRadius: 4,
                                  marginRight: 3, marginBottom: 2, fontWeight: 600, fontSize: 10,
                                }}>{f}</span>
                              ))}
                        </td>
                      </tr>
                    ))}
                    {validationData.length === 0 && (
                      <tr>
                        <td colSpan={13} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                          ยังไม่มีข้อมูลตารางเวร
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Section 2: Quick Return Detail for selected staff ── */}
            {selectedRow && selectedRow.quickReturns.length > 0 && (
              <div className="card mb-lg">
                <div className="card-header">
                  <div className="card-title">
                    🔴 Quick Return Details — {selectedRow.staff.nickname || selectedRow.staff.firstName}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    พักน้อยกว่า {config.min_rest_hours} ชม. ระหว่างเวร
                  </span>
                </div>
                <div style={{ padding: '0 var(--space-lg) var(--space-lg)' }}>
                  <p style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 12 }}>
                    ⚠️ Quick Return หมายถึงพักน้อยกว่า {config.min_rest_hours} ชม. แสดง N8 (23:00 0→00) → M (07:00 12:00) = พัก 8 ชม.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedRow.quickReturns.map((qr, qi) => {
                      const prevSt = shiftTypesMap[qr.prevShift];
                      const currSt = shiftTypesMap[qr.currentShift];
                      return (
                        <div key={qi} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: 'rgba(239,68,68,0.07)', borderRadius: 8,
                          padding: '8px 14px', border: '1px solid rgba(239,68,68,0.2)',
                        }}>
                          <span style={{ color: 'var(--color-danger)', fontSize: 16 }}>✗</span>
                          <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 30 }}>วัน{qr.prevDay}→{qr.day}</span>
                          <span className={`badge badge-${qr.prevShift}`}>{qr.prevShift}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            ({prevSt?.start || '?'}:{prevSt?.end || '?'})
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>→</span>
                          <span className={`badge badge-${qr.currentShift}`}>{qr.currentShift}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                            ({currSt?.start || '?'}:{currSt?.end || '?'})
                          </span>
                          <span style={{
                            marginLeft: 'auto', fontSize: 12, fontWeight: 700,
                            color: 'var(--color-danger)',
                          }}>พัก {qr.restHours} ชม.</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Section 3: Active Rules Table + Summary side by side ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
              {/* Rules */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">📋 กฎที่ใช้งาน (Active Rules)</div>
                </div>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rule</th>
                        <th>Value</th>
                        <th>Description</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRules.map(r => (
                        <tr key={r.rule}>
                          <td><code style={{ fontSize: 11 }}>{r.rule}</code></td>
                          <td style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>{r.value}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.desc}</td>
                          <td><span className="badge badge-success">Active</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* สรุปสถิติ */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">📊 สรุปสถิติ</div>
                </div>
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Total Staff</td>
                      <td style={{ fontWeight: 800, color: 'var(--color-primary-light)' }}>{validationData.length}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>คน</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: 'var(--color-danger)' }}>Staff with Red Flags</td>
                      <td style={{ fontWeight: 800, color: 'var(--color-danger)' }}>{staffWithFlags}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>คน</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600, color: 'var(--color-success)' }}>Staff OK</td>
                      <td style={{ fontWeight: 800, color: 'var(--color-success)' }}>{staffOk}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>คน</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Total Quick Returns</td>
                      <td style={{ fontWeight: 800, color: totalQR > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>{totalQR}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>ครั้ง</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>Compliance Rate</td>
                      <td style={{ fontWeight: 800, color: complianceRate >= 80 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {complianceRate}
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Weekly Summary Tab */}
      {activeTab === 'weekly' && (
        <div className="card animate-fade-in">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>ตำแหน่ง</th>
                  {weeklySummary[0]?.weeks.map((_, i) => (
                    <th key={i}>สัปดาห์ {i + 1}</th>
                  ))}
                  <th>รวม</th>
                  <th>Quick Returns</th>
                </tr>
              </thead>
              <tbody>
                {weeklySummary.map(row => (
                  <tr key={row.staff.id}>
                    <td style={{ fontWeight: 600 }}>{row.staff.nickname || row.staff.firstName}</td>
                    <td><span className="badge badge-info">{row.staff.position}</span></td>
                    {row.weeks.map((week, i) => (
                      <td
                        key={i}
                        style={{
                          fontWeight: 700,
                          color: week.hours > config.max_weekly_hours ? 'var(--color-danger)' : 'var(--color-text-primary)',
                          background: week.hours > config.max_weekly_hours ? 'var(--color-danger-bg)' : undefined,
                        }}
                      >
                        {week.hours} ชม.
                      </td>
                    ))}
                    <td style={{ fontWeight: 700 }}>{row.totalHours} ชม.</td>
                    <td>
                      {row.quickReturns.length > 0 ? (
                        <span className="badge badge-danger">
                          ⚠️ {row.quickReturns.length} ครั้ง
                        </span>
                      ) : (
                        <span className="badge badge-success">✅ ปกติ</span>
                      )}
                    </td>
                  </tr>
                ))}
                {weeklySummary.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-muted" style={{ padding: 40 }}>
                      ยังไม่มีข้อมูลตารางเวร
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Daily Coverage Tab */}
      {activeTab === 'coverage' && (
        <div className="card animate-fade-in">
          <div className="table-container" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>วัน</th>
                  {(() => {
                    const mode = config.shift_mode || '8HR';
                    let coverageShifts = [];
                    if (mode === '8HR' || mode === 'MIXED') coverageShifts.push('M', 'E', 'N8');
                    if (mode === '12HR' || mode === 'MIXED') coverageShifts.push('D', 'N12');
                    return coverageShifts;
                  })().map(code => (
                    <th key={code}><ShiftBadge code={code} /> เวร {code}</th>
                  ))}
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {dailyCoverageData.map(row => (
                  <tr key={row.day}>
                    <td style={{ fontWeight: 600 }}>วันที่ {row.day}</td>
                    {(() => {
                      const mode = config.shift_mode || '8HR';
                      let coverageShifts = [];
                      if (mode === '8HR' || mode === 'MIXED') coverageShifts.push('M', 'E', 'N8');
                      if (mode === '12HR' || mode === 'MIXED') coverageShifts.push('D', 'N12');
                      return coverageShifts;
                    })().map(code => (
                      <td key={code}>
                        <span className={row.check.details?.[code]?.met === false ? 'text-danger font-bold' : ''}>
                          {row.coverage[code] || 0} / {config[`required_${code}_coverage`] || 0}
                        </span>
                      </td>
                    ))}
                    <td>
                      {row.check.met ? (
                        <span className="badge badge-success">✅ ครบ</span>
                      ) : (
                        <span className="badge badge-danger">⚠️ ไม่ครบ</span>
                      )}
                    </td>
                  </tr>
                ))}
                {dailyCoverageData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-muted" style={{ padding: 40 }}>
                      ยังไม่มีข้อมูลตารางเวร
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
