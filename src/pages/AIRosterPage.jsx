import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Play, RotateCcw, ArrowRight, CheckCircle, Zap } from 'lucide-react';
import {
  loadConfig, loadShiftTypes, loadStaffList,
  loadMonthlyRoster, saveMonthlyRoster, saveAIRoster,
  getDaysInMonth, getDayOfWeek, isWeekend, getMonthName,
} from '../utils/storage';
import { buildShiftTypesMap, calcMonthlyHours } from '../utils/scheduling';
import { generateAIRoster } from '../utils/aiRoster';
import StatCard from '../components/StatCard';

export default function AIRosterPage() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({});
  const [shiftTypes, setShiftTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const loadedConfig = loadConfig();
    setConfig(loadedConfig);
    setShiftTypes(loadShiftTypes());
    setStaffList(loadStaffList());
  }, []);

  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList]);
  const activeShifts = useMemo(() => shiftTypes.filter(s => s.active), [shiftTypes]);
  const shiftTypesMap = useMemo(() => buildShiftTypesMap(shiftTypes), [shiftTypes]);
  const daysInMonth = useMemo(() => getDaysInMonth(config.month), [config.month]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const handleGenerate = () => {
    setGenerating(true);
    setApplied(false);
    // Use setTimeout to show loading state
    setTimeout(() => {
      const res = generateAIRoster(staffList, shiftTypes, config);
      setResult(res);
      saveAIRoster(res);
      setGenerating(false);
    }, 800);
  };

  const handleApply = () => {
    if (!result) return;
    saveMonthlyRoster(result.roster, config.month);
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

  if (activeStaff.length === 0) {
    return (
      <div className="animate-fade-in">
        <div className="page-header">
          <div className="page-header-left">
            <h1>🤖 AI จัดเวรอัตโนมัติ</h1>
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
          <h1>🤖 AI จัดเวรอัตโนมัติ</h1>
          <p>{getMonthName(config.month)} — {config.unit_name || config.hospital_name}</p>
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
        </div>
      </div>

      {/* Config Summary */}
      <div className="card mb-lg" style={{ padding: 'var(--space-md)' }}>
        <div className="flex gap-lg items-center" style={{ flexWrap: 'wrap', fontSize: '0.82rem' }}>
          <span><strong>Mode:</strong> {config.shift_mode}</span>
          <span><strong>บุคลากร:</strong> {activeStaff.length} คน</span>
          <span><strong>Coverage ขั้นต่ำ:</strong> M={config.required_M_coverage}, E={config.required_E_coverage}, N8={config.required_N8_coverage}</span>
          <span><strong>พักขั้นต่ำ:</strong> {config.min_rest_hours} ชม.</span>
          <span><strong>ทำงานสูงสุด/วัน:</strong> {config.max_daily_hours} ชม.</span>
        </div>
      </div>

      {!result && !generating && (
        <div className="card">
          <div className="empty-state" style={{ padding: 60 }}>
            <Sparkles size={64} style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
            <h3 style={{ marginTop: 16 }}>พร้อมสร้างตารางเวรอัตโนมัติ</h3>
            <p style={{ maxWidth: 400 }}>
              AI จะพิจารณาชั่วโมงทำงาน, ชั่วโมงพัก, Coverage ขั้นต่ำ
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
            <h3 style={{ marginTop: 16 }}>🤖 AI กำลังจัดตารางเวร...</h3>
            <p>พิจารณาเงื่อนไขทั้งหมดเพื่อสร้างตารางเวรที่ดีที่สุด</p>
          </div>
        </div>
      )}

      {result && !generating && (
        <>
          {/* AI Score */}
          <div className="card mb-lg">
            <div className="ai-score-container">
              <div className={`ai-score-circle ${getScoreClass(result.score)}`}>
                {result.score}
              </div>
              <div className="ai-score-label">
                AI Score — {getScoreLabel(result.score)}
              </div>
            </div>
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
                <Sparkles size={18} /> ตารางเวรที่ AI สร้าง
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
                          background: isWeekend(config.month, d) ? 'rgba(245,158,11,0.08)' : undefined,
                          minWidth: 44,
                        }}
                      >
                        <div>{d}</div>
                        <div style={{ fontSize: '0.6rem', color: isWeekend(config.month, d) ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
                          {getDayOfWeek(config.month, d)}
                        </div>
                      </th>
                    ))}
                    <th className="total-cell">ชม.</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStaff.map(staff => {
                    const staffRoster = result.roster[staff.id] || {};
                    const totalHours = calcMonthlyHours(staffRoster, shiftTypesMap);
                    return (
                      <tr key={staff.id}>
                        <td className="staff-name-cell">
                          <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{staff.nickname || staff.firstName}</div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)' }}>{staff.position}</div>
                        </td>
                        {days.map(d => (
                          <td key={d} style={{
                            background: isWeekend(config.month, d) ? 'rgba(245,158,11,0.04)' : undefined,
                            padding: 2,
                          }}>
                            <div className={`roster-cell-select ${getShiftClass(staffRoster[d])}`}
                              style={{ padding: '4px 2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, borderRadius: 4, minHeight: 28 }}
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
