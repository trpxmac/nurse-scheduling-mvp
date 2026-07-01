import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Play, RotateCcw, ArrowRight, CheckCircle, Zap } from 'lucide-react';
import {
  loadConfig, loadShiftTypes, loadStaffList,
  loadMonthlyRoster, saveMonthlyRoster, saveAIRoster,
  getDaysInMonth, getDayOfWeek, isWeekend, getMonthName,
  loadActiveMonth, saveActiveMonth, loadLeaveSchedules, loadMonthlySettings
} from '../utils/storage';
import MonthSelector from '../components/MonthSelector';
import { buildShiftTypesMap, calcMonthlyHours } from '../utils/scheduling';
import { generateAIRoster, checkFeasibility } from '../utils/aiRoster';
import StatCard from '../components/StatCard';

export default function AIRosterPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({});
  const [shiftTypes, setShiftTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonthState] = useState(loadActiveMonth());
  const [warnings, setWarnings] = useState([]);
  const [monthlySettings, setMonthlySettings] = useState({});

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
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    async function check() {
      if (staffList.length === 0 || shiftTypes.length === 0) return;
      const mSettings = await loadMonthlySettings(viewMonth);
      setMonthlySettings(mSettings);
      const aiConfig = { 
        ...config, 
        month: viewMonth,
        roster_hours: mSettings.roster_hours || config.roster_hours,
        holiday_hours: mSettings.holiday_hours || config.holiday_hours
      };
      const leaveSchedules = await loadLeaveSchedules(viewMonth);
      const lockedSlots = {};
      for (const sch of leaveSchedules) {
        if (!lockedSlots[sch.staffId]) lockedSlots[sch.staffId] = {};
        for (let d = sch.startDay; d <= sch.endDay; d++) {
          lockedSlots[sch.staffId][d] = sch.shiftCode;
        }
      }
      const w = checkFeasibility(staffList, shiftTypes, aiConfig, lockedSlots);
      setWarnings(w);
    }
    check();
  }, [viewMonth, staffList, shiftTypes, config]);

  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList]);
  const activeShifts = useMemo(() => shiftTypes.filter(s => s.active), [shiftTypes]);
  const shiftTypesMap = useMemo(() => buildShiftTypesMap(shiftTypes), [shiftTypes]);
  const daysInMonth = useMemo(() => getDaysInMonth(viewMonth), [viewMonth]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const handleGenerate = async () => {
    setGenerating(true);
    setApplied(false);
    
    const monthlySettings = await loadMonthlySettings(viewMonth);
    const aiConfig = { 
      ...config, 
      month: viewMonth,
      roster_hours: monthlySettings.roster_hours || config.roster_hours,
      holiday_hours: monthlySettings.holiday_hours || config.holiday_hours
    };
    // Load pre-set leave schedules and build locked slots map
    const leaveSchedules = await loadLeaveSchedules(viewMonth);
    const lockedSlots = {}; // { [staffId]: { [day]: shiftCode } }
    for (const sch of leaveSchedules) {
      if (!lockedSlots[sch.staffId]) lockedSlots[sch.staffId] = {};
      for (let d = sch.startDay; d <= sch.endDay; d++) {
        lockedSlots[sch.staffId][d] = sch.shiftCode;
      }
    }
    
    // Use setTimeout to allow UI to update to generating state before blocking thread
    setTimeout(() => {
      const res = generateAIRoster(staffList, shiftTypes, aiConfig, lockedSlots);
      setResult(res);
      saveAIRoster(res);
      setGenerating(false);
    }, 100);
  };

  const handleApply = () => {
    if (!result) return;
    saveMonthlyRoster(result.roster, viewMonth);
    setApplied(true);
    setTimeout(() => {
      setApplied(false);
      navigate('/roster');
    }, 1000);
  };

  const getScoreClass = (score) => {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  };

  const getScoreLabel = (score) => {
    if (score >= 85) return 'ดีเยี่ยม';
    if (score >= 70) return 'ดี';
    if (score >= 50) return 'พอใช้';
    return 'ต้องปรับปรุง';
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
            <h1>⚡ จัดเวรอัตโนมัติ</h1>
          </div>
        </div>
        <div className="card">
          <div className="empty-state">
            <Sparkles size={48} />
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
          <h1>⚡ จัดเวรอัตโนมัติ</h1>
          <p>{getMonthName(viewMonth)} — {config.unit_name || config.hospital_name}</p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-accent btn-lg"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <><Zap size={18} className="animate-pulse" /> กำลังสร้าง...</>
            ) : (
              <><Sparkles size={18} /> {result ? 'Generate ใหม่' : 'Generate'}</>
            )}
          </button>
          {result && (
            <button
              className="btn btn-success btn-lg"
              onClick={handleApply}
            >
              {applied ? <CheckCircle size={18} /> : <ArrowRight size={18} />}
              {applied ? 'นำไปใช้แล้ว!' : 'นำไปใช้ใน Monthly Roster'}
            </button>
          )}
          <MonthSelector value={viewMonth} onChange={(m) => { setViewMonth(m); setResult(null); }} />
        </div>
      </div>

      {/* Monthly Settings Check */}
      {(!(monthlySettings.roster_hours || config.roster_hours) && !(warnings.find(w => w.type === 'monthly_set'))) && (
        <div className="card mb-lg" style={{ background: '#fffbeb', borderColor: '#fbbf24', border: '1px solid' }}>
          <div style={{ padding: 'var(--space-md)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>ยังไม่ได้กำหนด Roster Hours สำหรับ {getMonthName(viewMonth)}</div>
              <div style={{ fontSize: '0.83rem', color: '#78350f' }}>
                AI จะใช้โหมด <strong>"เกลี่ยเวรสมดุล"</strong> แต่ไม่สามารถคำนวณ OT ได้ถูกต้อง
                กรุณาไปที่ <strong>ตั้งค่าหน่วยงาน → ชั่วโมงการทำงานรวม (Roster Hours)</strong> แล้วบันทึกก่อน Generate
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Feasibility Warnings */}
      {warnings.length > 0 && (
        <div className="card mb-lg" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
          <div style={{ padding: 'var(--space-md)' }}>
            <h4 style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span> คำเตือนก่อนจัดเวร: อาจเป็นไปไม่ได้ตามเป้าหมาย (Feasibility Warning)
            </h4>
            <ul style={{ color: '#7f1d1d', margin: 0, paddingLeft: '24px', fontSize: '0.85rem' }}>
              {warnings.map((w, i) => (
                <li key={i} style={{ marginBottom: '8px' }}>
                  <strong>{w.message}</strong>
                  <div style={{ opacity: 0.85, marginTop: '2px' }}>{w.details}</div>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '12px', padding: '8px', background: 'rgba(153, 27, 27, 0.05)', borderRadius: '4px', fontSize: '0.8rem', color: '#991b1b', fontWeight: 600 }}>
              💡 คำแนะนำ: ปรับเพิ่มบุคลากร, ลด Coverage, หรือเพิ่ม max_consecutive_workdays ในตั้งค่าหน่วยงาน
            </div>
          </div>
        </div>
      )}

      {/* Config Summary Bar */}
      <div className="card mb-lg" style={{ padding: 'var(--space-md)' }}>
        <div className="flex gap-lg items-center" style={{ flexWrap: 'wrap', fontSize: '0.82rem' }}>
          <span><strong>Mode:</strong> {config.shift_mode}</span>
          <span><strong>บุคลากร:</strong> {activeStaff.length} คน</span>
          <span><strong>Roster Hours:</strong> {(monthlySettings.roster_hours || config.roster_hours) ? `${(monthlySettings.roster_hours || config.roster_hours)} ชม.` : <span style={{ color: 'var(--color-warning, #f59e0b)' }}>ยังไม่ได้ตั้งค่า ⚠️</span>}</span>
          <span><strong>พักขั้นต่ำ:</strong> {config.min_rest_hours} ชม.</span>
          <span style={{ marginLeft: 'auto' }}>
            <strong>โหมด AI:</strong>{' '}
            <span style={{ background: (config.shift_fairness_mode || 'balanced') === 'maximize' ? 'var(--color-accent, #6366f1)' : 'var(--color-success, #10b981)', color: 'white', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>
              {(config.shift_fairness_mode || 'balanced') === 'maximize' ? '🚀 Maximize' : '⚖️ Balanced'}
            </span>
          </span>
        </div>
      </div>

      {!result && !generating && (
        <div className="card">
          <div className="empty-state" style={{ padding: 60 }}>
            <Sparkles size={64} style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
            <h3 style={{ marginTop: 16 }}>พร้อมสร้างตารางเวรอัตโนมัติ</h3>
            <p style={{ maxWidth: 400 }}>
              ระบบจะพิจารณาชั่วโมงทำงาน, ชั่วโมงพัก, Coverage ขั้นต่ำ
              และกระจายเวรอย่างเท่าเทียม
            </p>
            <button className="btn btn-accent btn-lg mt-lg" onClick={handleGenerate}>
              <Sparkles size={18} /> เริ่ม Generate
            </button>
          </div>
        </div>
      )}

      {generating && (
        <div className="card">
          <div className="empty-state" style={{ padding: 60 }}>
            <div style={{
              width: 64, height: 64, border: '4px solid var(--border-color)',
              borderTop: '4px solid var(--color-accent)', borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <h3 style={{ marginTop: 16 }}>⚡ กำลังคำนวณและจัดตารางเวร...</h3>
            <p>พิจารณาเงื่อนไขทั้งหมดเพื่อสร้างตารางเวรที่ดีที่สุด</p>
          </div>
        </div>
      )}

      {result && !generating && (
        <>
          {/* Coverage Stats Summary */}
          {result.summary?.coverageStats && (
            <div className="card mb-lg" style={{ padding: 'var(--space-md)' }}>
              <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                📊 สรุป Coverage ต่อเวร
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(result.summary.coverageStats).map(([code, stat]) => (
                  <div key={code} style={{ background: stat.rate >= 95 ? '#f0fdf4' : stat.rate >= 70 ? '#fffbeb' : '#fef2f2', border: `1px solid ${stat.rate >= 95 ? '#86efac' : stat.rate >= 70 ? '#fcd34d' : '#fca5a5'}`, borderRadius: 10, padding: '10px 18px', textAlign: 'center', minWidth: 110 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.4rem', color: stat.rate >= 95 ? '#16a34a' : stat.rate >= 70 ? '#d97706' : '#dc2626' }}>{stat.rate}%</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>เวร {code}</div>
                    <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>{stat.metDays}/{stat.totalDays} วันครบ</div>
                  </div>
                ))}
                {result.summary?.nightFairness && (
                  <div style={{ background: '#f0f9ff', border: '1px solid #7dd3fc', borderRadius: 10, padding: '10px 18px', textAlign: 'center', minWidth: 130 }}>
                    <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0284c7' }}>±{result.summary.nightFairness.stdDev}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>🌙 ความสม่ำเสมอเวรดึก</div>
                    <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>เฉลี่ย {result.summary.nightFairness.avgNights} ครั้ง/คน</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Score with Tiered Breakdown */}
          <div className="card mb-lg">
            <div className="ai-score-container">
              <div className={`ai-score-circle ${getScoreClass(result.score)}`}>
                {result.score}
              </div>
              <div className="ai-score-label">
                ความสมบูรณ์ของตาราง — {getScoreLabel(result.score)}
              </div>
            </div>

            {/* Tier Breakdown */}
            {result.scoreBreakdown && (
              <div style={{ padding: '0 var(--space-xl) var(--space-xl)', display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap', justifyContent: 'center' }}>
                {/* Legal Tier */}
                <div className="score-tier-card" style={{ '--tier-color': '#ef4444' }}>
                  <div className="score-tier-header">
                    <span className="score-tier-icon">⚖️</span>
                    <span className="score-tier-title">กฎหมายแรงงาน</span>
                    <span className="score-tier-badge" style={{ background: result.scoreBreakdown.legal >= 80 ? '#dcfce7' : result.scoreBreakdown.legal >= 50 ? '#fef9c3' : '#fee2e2', color: result.scoreBreakdown.legal >= 80 ? '#166534' : result.scoreBreakdown.legal >= 50 ? '#854d0e' : '#991b1b' }}>
                      {result.scoreBreakdown.legal}%
                    </span>
                  </div>
                  <div className="score-tier-bar-bg">
                    <div className="score-tier-bar" style={{ width: `${result.scoreBreakdown.legal}%`, background: result.scoreBreakdown.legal >= 80 ? '#22c55e' : result.scoreBreakdown.legal >= 50 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <div className="score-tier-weight">น้ำหนัก 40%</div>
                  {result.scoreBreakdown.breakdown.legal.details.length > 0 ? (
                    <div className="score-tier-details">
                      {result.scoreBreakdown.breakdown.legal.details.map((d, i) => (
                        <div key={i} className="score-tier-detail-row">
                          <span>❌ {d.rule}</span>
                          <span className="score-tier-count">{d.count} ครั้ง (−{d.penalty})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="score-tier-details">
                      <div className="score-tier-detail-row" style={{ color: '#16a34a' }}>
                        <span>✅ ไม่มีการละเมิดกฎหมาย</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Safety Tier */}
                <div className="score-tier-card" style={{ '--tier-color': '#f97316' }}>
                  <div className="score-tier-header">
                    <span className="score-tier-icon">🛡️</span>
                    <span className="score-tier-title">ความปลอดภัยบุคลากร</span>
                    <span className="score-tier-badge" style={{ background: result.scoreBreakdown.safety >= 80 ? '#dcfce7' : result.scoreBreakdown.safety >= 50 ? '#fef9c3' : '#fee2e2', color: result.scoreBreakdown.safety >= 80 ? '#166534' : result.scoreBreakdown.safety >= 50 ? '#854d0e' : '#991b1b' }}>
                      {result.scoreBreakdown.safety}%
                    </span>
                  </div>
                  <div className="score-tier-bar-bg">
                    <div className="score-tier-bar" style={{ width: `${result.scoreBreakdown.safety}%`, background: result.scoreBreakdown.safety >= 80 ? '#22c55e' : result.scoreBreakdown.safety >= 50 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <div className="score-tier-weight">น้ำหนัก 35%</div>
                  {result.scoreBreakdown.breakdown.safety.details.length > 0 ? (
                    <div className="score-tier-details">
                      {result.scoreBreakdown.breakdown.safety.details.map((d, i) => (
                        <div key={i} className="score-tier-detail-row">
                          <span>⚠️ {d.rule}</span>
                          <span className="score-tier-count">
                            {d.rate !== undefined ? `${d.rate}% ครบ (${d.count}/${d.total} ขาด)` : `${d.count} ครั้ง`}
                            {' '}(−{d.penalty})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="score-tier-details">
                      <div className="score-tier-detail-row" style={{ color: '#16a34a' }}>
                        <span>✅ Coverage ครบ & ไม่มีเวรติดเกิน</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quality Tier */}
                <div className="score-tier-card" style={{ '--tier-color': '#22c55e' }}>
                  <div className="score-tier-header">
                    <span className="score-tier-icon">✨</span>
                    <span className="score-tier-title">คุณภาพตาราง</span>
                    <span className="score-tier-badge" style={{ background: result.scoreBreakdown.quality >= 80 ? '#dcfce7' : result.scoreBreakdown.quality >= 50 ? '#fef9c3' : '#fee2e2', color: result.scoreBreakdown.quality >= 80 ? '#166534' : result.scoreBreakdown.quality >= 50 ? '#854d0e' : '#991b1b' }}>
                      {result.scoreBreakdown.quality}%
                    </span>
                  </div>
                  <div className="score-tier-bar-bg">
                    <div className="score-tier-bar" style={{ width: `${result.scoreBreakdown.quality}%`, background: result.scoreBreakdown.quality >= 80 ? '#22c55e' : result.scoreBreakdown.quality >= 50 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <div className="score-tier-weight">น้ำหนัก 25%</div>
                  {result.scoreBreakdown.breakdown.quality.details.length > 0 ? (
                    <div className="score-tier-details">
                      {result.scoreBreakdown.breakdown.quality.details.map((d, i) => (
                        <div key={i} className="score-tier-detail-row">
                          <span>📊 {d.rule} (SD={d.stdDev})</span>
                          <span className="score-tier-count">(−{d.penalty})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="score-tier-details">
                      <div className="score-tier-detail-row" style={{ color: '#16a34a' }}>
                        <span>✅ ชั่วโมงกระจายสมดุล</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Summary Stats */}
          <div className="stats-grid mb-lg">
            <StatCard icon={Sparkles} label="บุคลากรที่จัด" value={result.summary.totalStaff} color="blue" suffix="คน" />
            <StatCard icon={Sparkles} label="ชั่วโมงเฉลี่ย" value={result.summary.avgHours} color="amber" suffix="ชม." />
            <StatCard icon={Sparkles} label="Quick Returns" value={result.summary.totalQuickReturns} color={result.summary.totalQuickReturns > 0 ? 'red' : 'green'} />
            <StatCard icon={Sparkles} label="Coverage Shortages" value={result.summary.coverageShortages} color={result.summary.coverageShortages > 0 ? 'red' : 'green'} />
          </div>

          {/* AI Generated Roster Table */}
          <div className="card" style={{ padding: 'var(--space-sm)' }}>
            <div className="card-header" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
              <div className="card-title">
                <Sparkles size={18} /> ตารางเวรที่ระบบสร้าง
              </div>
              <div className="flex gap-sm">
                <button className="btn btn-ghost btn-sm" onClick={handleGenerate}>
                  <RotateCcw size={14} /> สร้างใหม่
                </button>
                <button className="btn btn-success btn-sm" onClick={handleApply}>
                  {applied ? '✅ นำไปใช้แล้ว' : '📋 นำไปใช้'}
                </button>
              </div>
            </div>
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
                          minWidth: 24,
                          padding: '0 2px',
                        }}
                      >
                        <div>{d}</div>
                        <div style={{ fontSize: '0.6rem', color: isWeekend(viewMonth, d) ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {getDayOfWeek(viewMonth, d)}
                        </div>
                      </th>
                    ))}
                    <th className="total-cell" style={{ minWidth: 40 }}>ชม.</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStaff.map(staff => {
                    const staffRoster = result.roster[staff.id] || {};
                    const totalHours = calcMonthlyHours(staffRoster, shiftTypesMap);
                    return (
                      <tr key={staff.id}>
                        <td className="staff-name-cell" title={`${staff.firstName} ${staff.lastName}`}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{staff.firstName} {staff.nickname ? `(${staff.nickname})` : ''}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>{staff.level && staff.level !== '-' ? staff.level : staff.position}</span>
                          </div>
                        </td>
                        {days.map(d => (
                          <td key={d} style={{
                            background: isWeekend(viewMonth, d) ? 'rgba(245,158,11,0.04)' : undefined,
                            padding: 0,
                          }}>
                            <div className={`roster-cell-select ${getShiftClass(staffRoster[d])}`}
                              style={{ padding: '2px 1px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, borderRadius: 4, minHeight: 20 }}
                            >
                              {staffRoster[d] || '-'}
                            </div>
                          </td>
                        ))}
                        <td className="total-cell">{totalHours}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
