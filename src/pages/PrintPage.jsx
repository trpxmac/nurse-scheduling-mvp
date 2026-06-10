import { useState, useEffect, useMemo, Fragment } from 'react';
import {
  loadConfig, loadShiftTypes, loadStaffList, loadMonthlyRoster,
  getDaysInMonth, getMonthName, getDayOfWeek, isWeekend
} from '../utils/storage';
import { buildShiftTypesMap, calcMonthlyHours, parseShift } from '../utils/scheduling';
import './PrintPage.css';

export default function PrintPage() {
  const [config, setConfig] = useState({});
  const [shiftTypes, setShiftTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [roster, setRoster] = useState({});

  useEffect(() => {
    const loadedConfig = loadConfig();
    setConfig(loadedConfig);
    setShiftTypes(loadShiftTypes());
    setStaffList(loadStaffList());
    setRoster(loadMonthlyRoster(loadedConfig.month));
  }, []);

  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList]);
  const shiftTypesMap = useMemo(() => buildShiftTypesMap(shiftTypes), [shiftTypes]);
  const daysInMonth = useMemo(() => getDaysInMonth(config.month), [config.month]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  if (activeStaff.length === 0) return <div>กำลังโหลดข้อมูล...</div>;

  return (
    <div className="print-page-container">
      <div className="no-print" style={{ textAlign: 'right', marginBottom: '20px' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨️ สั่งพิมพ์ (Print)</button>
        <p style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
          * ตรวจสอบให้แน่ใจว่าตั้งค่าในหน้าต่าง Print เป็น <strong>Landscape (แนวนอน)</strong> และ <strong>A4</strong>
        </p>
      </div>

      {/* Main Roster Table */}
      <table className="print-table">
        <thead>
          {/* Dummy row to hold the page header so it repeats on every printed page */}
          <tr>
            <td colSpan={daysInMonth + 8} style={{ border: 'none', padding: 0, backgroundColor: 'white' }}>
              <div className="print-header">
                <div className="print-logo-container">
                  <img src="/logo.png" alt="Bangkok Hospital Siriroj" className="print-logo" />
                </div>
                <div className="print-title-container">
                  <h2>ตารางเวรปฏิบัติงานแผนก ........... {config.unit_name} ...........</h2>
                  <div className="print-subtitle">
                    เดือน ........ {getMonthName(config.month)} ........ Roster ..... {activeStaff.length} ..... คน (Hours=...{config.max_daily_hours}.. ชม.)
                  </div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
            <th rowSpan={2} className="col-no">ลำดับ</th>
            <th rowSpan={2} className="col-empid">รหัสพนักงาน</th>
            <th rowSpan={2} className="col-name">ชื่อ-สกุล</th>
            <th rowSpan={2} className="col-position">ตำแหน่ง<br/>/Level</th>
            <th className="col-day-label">วันที่</th>
            {days.map(d => <th key={d} className="col-day-num">{d}</th>)}
            <th rowSpan={2} className="col-summary">จำนวน ชม.<br/>ขึ้นเวรจริง</th>
            <th rowSpan={2} className="col-summary">จำนวน ชม.<br/>OT/RLV/ADM</th>
            <th rowSpan={2} className="col-remark">หมายเหตุ</th>
          </tr>
          <tr>
            <th className="col-day-label">วัน</th>
            {days.map(d => <th key={`dow-${d}`} className="col-dow">{getDayOfWeek(config.month, d)}</th>)}
          </tr>
        </thead>
        <tbody>
          {activeStaff.map((staff, i) => {
            const staffRoster = roster[staff.id] || {};
            let totalHours = 0;
            let totalOT = 0;

            for (let d = 1; d <= daysInMonth; d++) {
              const { shift, ot } = parseShift(staffRoster[d]);
              const st = shiftTypesMap[shift];
              if (st) totalHours += st.hours;
              totalOT += ot;
            }

            return (
              <Fragment key={staff.id}>
                {/* Row 1: Shifts */}
                <tr className="staff-row-shift">
                  <td rowSpan={2} className="text-center">{i + 1}</td>
                  <td rowSpan={2} className="text-center">{staff.employeeId || '-'}</td>
                  <td rowSpan={2} className="staff-name-cell">
                    {staff.firstName} {staff.lastName}
                  </td>
                  <td rowSpan={2} className="text-center">
                    {staff.position}<br/>{staff.level || '-'}
                  </td>
                  <td className="text-center row-label">กะ</td>
                  {days.map(d => {
                    const { shift } = parseShift(staffRoster[d]);
                    return <td key={d} className="text-center cell-shift">{shift}</td>;
                  })}
                  <td rowSpan={2} className="text-center summary-val">{totalHours > 0 ? totalHours : ''}</td>
                  <td rowSpan={2} className="text-center summary-val">{totalOT > 0 ? totalOT : ''}</td>
                  <td rowSpan={2} className="remark-cell"></td>
                </tr>
                {/* Row 2: OT */}
                <tr className="staff-row-ot">
                  <td className="text-center row-label">OT</td>
                  {days.map(d => {
                    const { ot } = parseShift(staffRoster[d]);
                    return <td key={`ot-${d}`} className="text-center cell-ot">{ot > 0 ? ot : ''}</td>;
                  })}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {/* Footer / Legend / Signatures */}
      <div className="print-footer">
        <div className="legend-section">
          <div className="legend-grid">
            {shiftTypes.filter(s => s.active).map(st => (
              <div key={st.code} className="legend-item">
                <strong>{st.code}</strong> = {st.name} ({st.hours} ชม.)
              </div>
            ))}
          </div>
        </div>
        <div className="signature-section">
          <div className="sig-box">
            <div className="sig-line"></div>
            <div className="sig-name">(........................................................)</div>
            <div className="sig-title">ผู้จัดทำตารางเวร</div>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <div className="sig-name">(........................................................)</div>
            <div className="sig-title">หัวหน้าแผนก</div>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <div className="sig-name">(........................................................)</div>
            <div className="sig-title">ผู้อำนวยการฝ่ายการพยาบาล<br/>Senior Nurse Manager</div>
          </div>
        </div>
      </div>
    </div>
  );
}
