import { useState, useEffect, useMemo, Fragment } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import {
  loadConfig, loadShiftTypes, loadStaffList, loadMonthlyRoster,
  getDaysInMonth, getMonthName, getDayOfWeek, isWeekend, loadMonthlySettings, loadActiveMonth
} from '../utils/storage';
import { buildShiftTypesMap, calcMonthlyHours, parseShift, filterActiveShifts } from '../utils/scheduling';
import './PrintPage.css';

export default function PrintPage() {
  const [config, setConfig] = useState({});
  const [shiftTypes, setShiftTypes] = useState([]);
  const activeShiftTypes = useMemo(() => filterActiveShifts(shiftTypes, config.shift_mode), [shiftTypes, config.shift_mode]);
  const [staffList, setStaffList] = useState([]);
  const [roster, setRoster] = useState({});
  const [monthlySettings, setMonthlySettings] = useState({});

  useEffect(() => {
    document.body.style.backgroundColor = '#f3f4f6';
    return () => { document.body.style.backgroundColor = ''; }
  }, []);

  // Auto-scale to fit one A4 landscape page
  useEffect(() => {
    const handleBeforePrint = () => {
      const el = document.querySelector('.print-page-container');
      if (!el) return;
      // Reset first to measure natural size
      el.style.transform = '';
      el.style.zoom = '';
      el.style.transformOrigin = 'top left';
      // A4 landscape printable area: 277mm × 190mm (with 10mm margins)
      const pageW = 277 * 3.78;  // ~1047px
      const pageH = 190 * 3.78;  // ~718px
      const scale = Math.min(pageW / el.scrollWidth, pageH / el.scrollHeight, 1);
      if (scale < 1) {
        el.style.zoom = scale; // Using zoom shrinks the layout space, preventing extra blank pages in Chrome/Edge
      }
    };
    const handleAfterPrint = () => {
      const el = document.querySelector('.print-page-container');
      if (el) {
        el.style.transform = '';
        el.style.zoom = '';
      }
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  useEffect(() => {
    const loadAllData = async () => {
      const activeMonth = loadActiveMonth();
      const currentConfig = await loadConfig();
      setConfig({ ...currentConfig, month: activeMonth });
      setMonthlySettings(await loadMonthlySettings(activeMonth));
      setShiftTypes(await loadShiftTypes());
      const allStaff = await loadStaffList();
      setStaffList(allStaff);
      setRoster(await loadMonthlyRoster(activeMonth));
    };

    loadAllData();

    // Auto-reload when returning to this tab
    window.addEventListener('focus', loadAllData);
    return () => window.removeEventListener('focus', loadAllData);
  }, []);

  const activeStaff = useMemo(() => staffList.filter(s => s.active), [staffList]);
  
  const headNurseName = useMemo(() => {
    if (config.head_nurse_name) return config.head_nurse_name;
    const hod = staffList.find(s => (s.position === 'HOD' || s.level === 'HOD') && s.active);
    return hod ? `${hod.firstName} ${hod.lastName}` : '';
  }, [config.head_nurse_name, staffList]);

  const shiftTypesMap = useMemo(() => buildShiftTypesMap(shiftTypes), [shiftTypes]);
  const daysInMonth = useMemo(() => getDaysInMonth(config.month), [config.month]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  if (activeStaff.length === 0) return <div>กำลังโหลดข้อมูล...</div>;

  return (
    <>
      <div className="print-header-bar no-print">
        <div className="print-header-title">
          <button className="btn btn-ghost btn-sm" onClick={() => window.close()} style={{ marginRight: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowLeft size={16} /> ปิดหน้านี้
          </button>
          <span>โหมดตัวอย่างก่อนพิมพ์ (Print Preview)</span>
        </div>
        <div className="print-header-actions">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            * แนะนำ: <strong>Landscape (แนวนอน)</strong> · <strong>A4</strong> · Scale: <strong>Fit to page</strong>
          </p>
          <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> สั่งพิมพ์ (Print)
          </button>
        </div>
      </div>

      <div className="print-preview-wrapper">
        <div className="print-page-container">
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
                    เดือน ........ {getMonthName(config.month)} ........ Roster ..... {monthlySettings.roster_hours || '...............'} ..... ชม. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (Holiday ..... {monthlySettings.holiday_hours || '...............'} ..... ชม.)
                  </div>
                </div>
              </div>
            </td>
          </tr>
          <tr>
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
        <>
          {activeStaff.map((staff, i) => {
            const staffRoster = roster[staff.id] || {};
            let totalHours = 0;
            let totalOT = 0;
            let totalRLV = 0;
            let totalADM = 0;

            const reqHrs = Number(monthlySettings.roster_hours) || 0;
            const targetHrs = reqHrs;

            for (let d = 1; d <= daysInMonth; d++) {
              const { shift, ot, otType } = parseShift(staffRoster[d]);
              const st = shiftTypesMap[shift];
              if (st) totalHours += st.hours;
              
              if (otType === 'R') totalRLV += ot;
              else if (otType === 'A') totalADM += ot;
              else totalOT += ot;
            }
            
            const finalOt = targetHrs > 0 ? Math.max(0, (totalHours + totalOT) - targetHrs) : totalOT;
            const displayTotalHours = totalHours + totalOT;

            return (
              <tbody key={staff.id} style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                {/* Row 1: Shifts */}
                <tr className="staff-row-shift">
                  <td rowSpan={2} className="staff-name-cell" style={{ whiteSpace: 'nowrap' }}>
                    {staff.firstName} {staff.lastName}
                  </td>
                  <td rowSpan={2} className="text-center">
                    {(staff.level && staff.level !== '-') ? staff.level : staff.position}
                  </td>
                  <td className="text-center row-label">กะ</td>
                  {days.map(d => {
                    const { shift } = parseShift(staffRoster[d]);
                    return <td key={d} className="text-center cell-shift">{shift}</td>;
                  })}
                  <td rowSpan={2} className="text-center summary-val">{displayTotalHours > 0 ? displayTotalHours : ''}</td>
                  <td rowSpan={2} className="text-center summary-val" style={{ fontSize: '9px', lineHeight: '1.2' }}>
                    {finalOt > 0 && <div>OT={finalOt}</div>}
                    {totalRLV > 0 && <div>RLV={totalRLV}</div>}
                    {totalADM > 0 && <div>ADM={totalADM}</div>}
                  </td>
                  <td rowSpan={2} className="remark-cell" style={{ textAlign: 'left', paddingLeft: '6px', verticalAlign: 'middle' }}>
                    {i < activeShiftTypes.length ? (
                      <span style={{ fontSize: '8.5px' }}>
                        <strong>{activeShiftTypes[i].code}</strong> = {
                          (activeShiftTypes[i].start && activeShiftTypes[i].end)
                            ? `${activeShiftTypes[i].start}-${activeShiftTypes[i].end}`
                            : activeShiftTypes[i].name.split(' (')[0]
                        }
                      </span>
                    ) : ''}
                  </td>
                </tr>
                {/* Row 2: OT */}
                <tr className="staff-row-ot">
                  <td className="text-center row-label" style={{ fontSize: '8.5px', padding: 2 }}>OT/RLV/ADM</td>
                  {days.map(d => {
                    const { ot, otType } = parseShift(staffRoster[d]);
                    return <td key={`ot-${d}`} className="text-center cell-ot">{ot > 0 ? `${ot}${otType || ''}` : ''}</td>;
                  })}
                </tr>
              </tbody>
            );
          })}
        </>
      </table>

      {/* Footer / Signatures */}
      <div className="print-footer">
        <div className="signature-section" style={{ width: '100%', justifyContent: 'flex-end', gap: '80px', paddingRight: '40px' }}>
          <div className="sig-box">
            <div className="sig-line"></div>
            <div className="sig-name">({headNurseName ? ` ${headNurseName} ` : '................................................'})</div>
            <div className="sig-title">หัวหน้าแผนก</div>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <div className="sig-name">({config.manager_name ? ` ${config.manager_name} ` : '................................................'})</div>
            <div className="sig-title">ผู้จัดการฝ่าย</div>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <div className="sig-name">({config.director_name ? ` ${config.director_name} ` : '................................................'})</div>
            <div className="sig-title">ผู้อำนวยการฝ่ายการพยาบาล</div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </>
  );
}
