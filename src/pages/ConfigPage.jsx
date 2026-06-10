import { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, CheckCircle, Clock, Users, Moon } from 'lucide-react';
import { loadConfig, saveConfig, DEFAULT_CONFIG, getMonthName } from '../utils/storage';

export default function ConfigPage() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const handleChange = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleNumberChange = (field, value) => {
    const num = parseInt(value) || 0;
    handleChange(field, num);
  };

  const handleSave = () => {
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    saveConfig(DEFAULT_CONFIG);
  };

  const mode = config.shift_mode;
  const show8HR  = mode === '8HR'  || mode === 'MIXED';
  const show12HR = mode === '12HR' || mode === 'MIXED';

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1>⚙️ ตั้งค่าหน่วยงาน</h1>
          <p>กำหนดข้อมูลหน่วยงาน กฎการทำงาน และความต้องการจำนวนคนต่อเวร</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-ghost" onClick={handleReset}>
            <RotateCcw size={16} /> รีเซ็ต
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? <CheckCircle size={16} /> : <Save size={16} />}
            {saved ? 'บันทึกแล้ว!' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* ── Section 1: Unit Information ── */}
      <div className="card mb-lg">
        <div className="card-header">
          <div className="card-title">
            <Settings size={18} /> ข้อมูลหน่วยงาน (Unit Information)
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ชื่อโรงพยาบาล <code>hospital_name</code></label>
            <input
              className="form-input"
              type="text"
              value={config.hospital_name}
              onChange={(e) => handleChange('hospital_name', e.target.value)}
              placeholder="เช่น BPK"
            />
            <span className="form-hint">ชื่อโรงพยาบาล — ใช้ชื่อย่อของโรงพยาบาล</span>
          </div>
          <div className="form-group">
            <label className="form-label">ชื่อหน่วยงาน <code>unit_name</code></label>
            <input
              className="form-input"
              type="text"
              value={config.unit_name}
              onChange={(e) => handleChange('unit_name', e.target.value)}
              placeholder="เช่น Ward6B+IMCU, CCU, ICU"
            />
            <span className="form-hint">ชื่อหน่วยงาน — ใช้ชื่อหน่วยงานของคุณ</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">เดือน/ปี <code>month</code></label>
            <input
              className="form-input"
              type="month"
              value={config.month}
              onChange={(e) => handleChange('month', e.target.value)}
            />
            {config.month && (
              <span className="form-hint">📅 {getMonthName(config.month)}</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">รูปแบบเวร <code>shift_mode</code></label>
            <select
              className="form-select"
              value={config.shift_mode}
              onChange={(e) => handleChange('shift_mode', e.target.value)}
            >
              <option value="8HR">⚕️ 8 ชั่วโมง (8HR) — เวร M, E, N8</option>
              <option value="12HR">🏥 12 ชั่วโมง (12HR) — เวร D, N12</option>
              <option value="MIXED">🔀 ผสม (MIXED) — M, E, N8, D, N12</option>
            </select>
            <span className="form-hint">
              {mode === '8HR'   && '3 เวร/วัน: เช้า (M) · บ่าย (E) · ดึก (N8) — Ward ทั่วไป'}
              {mode === '12HR'  && '2 เวร/วัน: กลางวัน (D) · กลางคืน (N12) — ICU, CCU, ER'}
              {mode === 'MIXED' && 'ใช้ได้ทั้ง 8 ชม. และ 12 ชม. — หน่วยงานยืดหยุ่น'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 2: Working Rules ── */}
      <div className="card mb-lg">
        <div className="card-header">
          <div className="card-title">
            <Clock size={18} /> กฎการทำงาน (Working Rules)
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">ชั่วโมงสูงสุด/สัปดาห์ <code>max_weekly_hours</code></label>
            <input
              className="form-input"
              type="number"
              value={config.max_weekly_hours}
              onChange={(e) => handleNumberChange('max_weekly_hours', e.target.value)}
              min="36" max="52"
            />
            <span className="form-hint">ตามกฎหมายแรงงาน (36–52 ชม.)</span>
          </div>
          <div className="form-group">
            <label className="form-label">ชั่วโมงพักขั้นต่ำ <code>min_rest_hours</code></label>
            <input
              className="form-input"
              type="number"
              value={config.min_rest_hours}
              onChange={(e) => handleNumberChange('min_rest_hours', e.target.value)}
              min="8" max="16"
            />
            <span className="form-hint">⚠️ ต้องพักอย่างน้อย {config.min_rest_hours} ชม. ระหว่างเวร (Quick Return)</span>
          </div>
          <div className="form-group">
            <label className="form-label">ชั่วโมงสูงสุด/วัน <code>max_daily_hours</code></label>
            <input
              className="form-input"
              type="number"
              value={config.max_daily_hours}
              onChange={(e) => handleNumberChange('max_daily_hours', e.target.value)}
              min="8" max="12"
            />
            <span className="form-hint">⚠️ ไม่เกิน {config.max_daily_hours} ชม./วัน (NEW)</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <Moon size={14} style={{ display: 'inline', marginRight: 4 }} />
              เวรกลางคืนติดต่อกันสูงสุด <code>max_consecutive_nights</code>
            </label>
            <input
              className="form-input"
              type="number"
              value={config.max_consecutive_nights}
              onChange={(e) => handleNumberChange('max_consecutive_nights', e.target.value)}
              min="1" max="7"
            />
            <span className="form-hint">ป้องกันสุขภาพ — ไม่เกิน {config.max_consecutive_nights} คืนติดต่อกัน</span>
          </div>
          <div className="form-group">
            <label className="form-label">วันทำงานติดต่อกันสูงสุด <code>max_consecutive_workdays</code></label>
            <input
              className="form-input"
              type="number"
              value={config.max_consecutive_workdays}
              onChange={(e) => handleNumberChange('max_consecutive_workdays', e.target.value)}
              min="2" max="7"
            />
            <span className="form-hint">ต้องมีวันหยุด — ไม่เกิน {config.max_consecutive_workdays} วันติดต่อกัน</span>
          </div>
        </div>
      </div>

      {/* ── Section 3: Coverage Requirements ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Users size={18} /> จำนวนคนขั้นต่ำต่อเวร (Coverage Requirements)
          </div>
          <span className="form-hint" style={{ marginLeft: 'auto' }}>
            รูปแบบเวรที่เลือก: <strong>{mode}</strong>
          </span>
        </div>

        {/* 8HR Shifts */}
        {show8HR && (
          <>
            <p style={{ padding: '0 var(--space-lg)', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4 }}>
              📋 เวร 8 ชั่วโมง (8HR Mode)
            </p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  <span className="badge badge-M" style={{ marginRight: 8 }}>M</span>
                  เวรเช้า 07:00–15:00 <code>required_M_coverage</code>
                </label>
                <input
                  className="form-input"
                  type="number"
                  value={config.required_M_coverage}
                  onChange={(e) => handleNumberChange('required_M_coverage', e.target.value)}
                  min="0" max="50"
                />
                <span className="form-hint">คนขั้นต่ำ/วัน</span>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <span className="badge badge-E" style={{ marginRight: 8 }}>E</span>
                  เวรบ่าย 15:00–23:00 <code>required_E_coverage</code>
                </label>
                <input
                  className="form-input"
                  type="number"
                  value={config.required_E_coverage}
                  onChange={(e) => handleNumberChange('required_E_coverage', e.target.value)}
                  min="0" max="50"
                />
                <span className="form-hint">คนขั้นต่ำ/วัน</span>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <span className="badge badge-N8" style={{ marginRight: 8 }}>N8</span>
                  เวรดึก 23:00–07:00 <code>required_N8_coverage</code>
                </label>
                <input
                  className="form-input"
                  type="number"
                  value={config.required_N8_coverage}
                  onChange={(e) => handleNumberChange('required_N8_coverage', e.target.value)}
                  min="0" max="50"
                />
                <span className="form-hint">คนขั้นต่ำ/วัน</span>
              </div>
            </div>
          </>
        )}

        {/* 12HR Shifts */}
        {show12HR && (
          <>
            <p style={{ padding: '0 var(--space-lg)', color: 'var(--text-muted)', fontSize: 13, marginBottom: 4, marginTop: show8HR ? 12 : 0 }}>
              📋 เวร 12 ชั่วโมง (12HR Mode)
            </p>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  <span className="badge badge-D" style={{ marginRight: 8 }}>D</span>
                  เวร D (12ชม.กลางวัน) 07:00–19:00 <code>required_D_coverage</code>
                </label>
                <input
                  className="form-input"
                  type="number"
                  value={config.required_D_coverage}
                  onChange={(e) => handleNumberChange('required_D_coverage', e.target.value)}
                  min="0" max="50"
                />
                <span className="form-hint">คนขั้นต่ำ/วัน</span>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <span className="badge badge-N12" style={{ marginRight: 8 }}>N12</span>
                  เวร N12 (12ชม.กลางคืน) 19:00–07:00 <code>required_N12_coverage</code>
                </label>
                <input
                  className="form-input"
                  type="number"
                  value={config.required_N12_coverage}
                  onChange={(e) => handleNumberChange('required_N12_coverage', e.target.value)}
                  min="0" max="50"
                />
                <span className="form-hint">คนขั้นต่ำ/วัน</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
