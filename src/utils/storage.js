/* =============================================
   LocalStorage Helper — Nurse Scheduling System
   ============================================= */

const STORAGE_PREFIX = 'nss_';

const KEYS = {
  ACTIVE_DEPARTMENT: `${STORAGE_PREFIX}active_department`,
  DEPARTMENTS: `${STORAGE_PREFIX}departments`,
};

const SCOPED_KEYS = {
  CONFIG: `${STORAGE_PREFIX}config`,
  SHIFT_TYPES: `${STORAGE_PREFIX}shift_types`,
  STAFF_LIST: `${STORAGE_PREFIX}staff_list`,
  MONTHLY_ROSTER: `${STORAGE_PREFIX}monthly_roster`,
  AI_ROSTER: `${STORAGE_PREFIX}ai_roster`,
  LEAVE_SCHEDULES: `${STORAGE_PREFIX}leave_schedules`,
  MONTHLY_SETTINGS: `${STORAGE_PREFIX}monthly_settings`,
};
// ---- Default Data ----

export const DEFAULT_CONFIG = {
  // Unit Info
  unit_name: 'Ward 6B+IMCU',
  hospital_name: 'BSI',
  month: new Date().toISOString().slice(0, 7), // YYYY-MM
  shift_mode: '12HR', // 8HR | 12HR | MIXED
  roster_hours: '',
  holiday_hours: '',

  // Signatures
  head_nurse_name: '',
  manager_name: '',
  director_name: '',

  // Working Rules
  max_weekly_hours: 52,
  min_rest_hours: 11,
  max_daily_hours: 12,
  max_consecutive_nights: 3,
  max_consecutive_workdays: 3,

  // Coverage Requirements — 8HR shifts (M, E, N8)
  required_M_coverage: 2,
  required_E_coverage: 1,
  required_N8_coverage: 1,

  // Coverage Requirements — 12HR shifts (D, N12)
  required_D_coverage: 4,
  required_N12_coverage: 3,

  // Pairing Rules
  incompatible_levels: [], // e.g. ['RN1-RN1']
};

export const DEFAULT_SHIFT_TYPES = [
  // ── DAY shifts (count toward Day Coverage)
  { id: 'M',   code: 'M',   name: 'เช้า (Morning)',           start: '07:00', end: '15:00', hours: 8,  category: 'DAY',   active: true,  hex: '#90EE90' },
  { id: 'E',   code: 'E',   name: 'บ่าย (Evening)',           start: '15:00', end: '23:00', hours: 8,  category: 'DAY',   active: true,  hex: '#87CEEB' },
  { id: 'D',   code: 'D',   name: 'กลางวัน 12 ชม. (Day 12hr)', start: '07:00', end: '19:00', hours: 12, category: 'DAY',   active: true,  hex: '#98FB98' },

  // ── NIGHT shifts (count toward Night Coverage)
  { id: 'N8',  code: 'N8',  name: 'ดึก 8 ชม. (Night 8hr)',    start: '23:00', end: '07:00', hours: 8,  category: 'NIGHT', active: true,  hex: '#DDA0DD' },
  { id: 'N12', code: 'N12', name: 'กลางคืน 12 ชม. (Night 12hr)', start: '19:00', end: '07:00', hours: 12, category: 'NIGHT', active: true,  hex: '#E6E6FA' },

  // ── OFF (no hours counted)
  { id: '-', code: '-', name: 'วันหยุด/พัก (Rest)',         start: '',      end: '',      hours: 0,  category: 'OFF',   active: true,  hex: '#F5F5F5' },

  // ── HOLIDAY
  { id: 'H', code: 'H', name: 'วันหยุดนักขัตฤกษ์ (Holiday)', start: '',      end: '',      hours: 8,  category: 'OFF', active: true,  hex: '#DDA0DD' },

  // ── LEAVE (no work hours, leave tracking)
  { id: 'AL',  code: 'AL',  name: 'ลาพักร้อน (Annual Leave)', start: '',      end: '',      hours: 0,  category: 'LEAVE', active: true,  hex: '#FFD700' },
  { id: 'SL',  code: 'SL',  name: 'ลาป่วย (Sick Leave)',      start: '',      end: '',      hours: 0,  category: 'LEAVE', active: true,  hex: '#FFA07A' },

  // ── OTHER
  { id: 'TRN', code: 'TRN', name: 'อบรม (Training)',          start: '',      end: '',      hours: 0,  category: 'OTHER', active: true,  hex: '#ADD8E6' },
  { id: 'MTG', code: 'MTG', name: 'ประชุม (Meeting)',          start: '',      end: '',      hours: 0,  category: 'OTHER', active: false, hex: '#D3D3D3' },
];

export const MOCK_STAFF = [
  // ── Senior RN (RN4, RN3, RN2) (9 คน) ──
  { id: 'S01', employeeId: '1586347', firstName: 'ปนัดดา',   lastName: 'จิตต์เจริญ',     nickname: 'ดา',   position: 'RN', level: 'RN4', active: true },
  { id: 'S02', employeeId: '622063',  firstName: 'เขมจิรา',   lastName: 'ศิริสุวรรณ',     nickname: 'จิรา', position: 'RN', level: 'RN4', active: true },
  { id: 'S03', employeeId: '596823',  firstName: 'สุภาวดี',   lastName: 'ธนะพัฒน์',       nickname: 'ดี',   position: 'RN', level: 'RN3', active: true },
  { id: 'S04', employeeId: '553005',  firstName: 'ศศิธร',     lastName: 'วงศ์สวัสดิ์',     nickname: 'ธร',   position: 'RN', level: 'RN3', active: true },
  { id: 'S05', employeeId: '611077',  firstName: 'พิมพ์ผกา',  lastName: 'แก้วมณี',        nickname: 'กา',   position: 'RN', level: 'RN3', active: true },
  { id: 'S06', employeeId: '630177',  firstName: 'จิราภรณ์',  lastName: 'สาระคุณ',        nickname: 'ภรณ์', position: 'RN', level: 'RN2', active: true },
  { id: 'S07', employeeId: '635143',  firstName: 'อาทิตยา',   lastName: 'ชนะกุล',         nickname: 'ยา',   position: 'RN', level: 'RN2', active: true },
  { id: 'S08', employeeId: '501694',  firstName: 'กฤษฎิ์ภูมิ', lastName: 'วรรณดี',         nickname: 'ภูมิ', position: 'RN', level: 'RN2', active: true },
  { id: 'S09', employeeId: '628475',  firstName: 'วรัญญา',    lastName: 'รุ่งเรือง',       nickname: 'รัญ',  position: 'RN', level: 'RN2', active: true },

  // ── Junior RN (RN1) (3 คน) ──
  { id: 'S10', employeeId: '741258',  firstName: 'ณิชาภัทร',  lastName: 'ตั้งเจริญ',      nickname: 'ณิชา', position: 'RN', level: 'RN1', active: true },
  { id: 'S11', employeeId: '752369',  firstName: 'พรนภา',    lastName: 'สุขสันต์',       nickname: 'พร',   position: 'RN', level: 'RN1', active: true },
  { id: 'S12', employeeId: '763480',  firstName: 'กิตติศักดิ์', lastName: 'ใจตรง',         nickname: 'กิต',  position: 'RN', level: 'RN1', active: true },

  // ── PN — Practical Nurses (3 คน) ──
  { id: 'S13', employeeId: '710634',  firstName: 'กันยิกา',   lastName: 'เรืองขจร',       nickname: 'กัน',  position: 'PN', level: '-', active: true },
  { id: 'S14', employeeId: '603484',  firstName: 'จุฑามาศ',   lastName: 'ทองใบ',          nickname: 'มาศ',  position: 'PN', level: '-', active: true },
  { id: 'S15', employeeId: '600133',  firstName: 'วรรณภา',    lastName: 'สุขสมบูรณ์',     nickname: 'แอน',  position: 'PN', level: '-', active: true },

  // ── PA — Patient Assistants (2 คน) ──
  { id: 'S16', employeeId: '548201',  firstName: 'นภาพร',     lastName: 'พงษ์ประเสริฐ',   nickname: 'นภา',  position: 'PA', level: '-', active: true },
  { id: 'S17', employeeId: '615892',  firstName: 'คำศรี',     lastName: 'บุญมาก',         nickname: 'ศรี',  position: 'PA', level: '-', active: true },
];

export const MOCK_ROSTER = {};

// ---- Generic CRUD ----

function loadData(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    console.error(`Failed to save data for key: ${key}`);
    return false;
  }
}

// ---- Departments ----

export function loadActiveDepartment() {
  return loadData(KEYS.ACTIVE_DEPARTMENT, { id: 'default', name: 'Ward 6B+IMCU' });
}

export function saveActiveDepartment(dept) {
  return saveData(KEYS.ACTIVE_DEPARTMENT, dept);
}

export function loadDepartments() {
  return loadData(KEYS.DEPARTMENTS, [{ id: 'default', name: 'Ward 6B+IMCU' }]);
}

export function saveDepartments(depts) {
  return saveData(KEYS.DEPARTMENTS, depts);
}

// ---- Active Month ----

export function loadActiveMonth() {
  const config = loadConfig(); // Get current config to use as fallback
  return loadData('nss_active_view_month', config.month || new Date().toISOString().slice(0, 7));
}

export function saveActiveMonth(month) {
  return saveData('nss_active_view_month', month);
}

function getScopedKey(baseKey) {
  const activeDept = loadActiveDepartment();
  return `${baseKey}_${activeDept.id}`;
}

// ---- Config ----

export function loadConfig() {
  const activeDept = loadActiveDepartment();
  const defaultConfigForDept = {
    ...DEFAULT_CONFIG,
    unit_name: activeDept.name !== 'Ward 6B+IMCU' ? activeDept.name : DEFAULT_CONFIG.unit_name
  };
  return loadData(getScopedKey(SCOPED_KEYS.CONFIG), defaultConfigForDept);
}

export function saveConfig(config) {
  return saveData(getScopedKey(SCOPED_KEYS.CONFIG), config);
}

// ---- Monthly Settings (Roster/Holiday Hours) ----

export function loadMonthlySettings(month) {
  const allSettings = loadData(getScopedKey(SCOPED_KEYS.MONTHLY_SETTINGS), {});
  // Defaults to config if not set for month
  const config = loadConfig();
  return allSettings[month] || {
    roster_hours: config.roster_hours || 0,
    holiday_hours: config.holiday_hours || 0
  };
}

export function saveMonthlySettings(month, settings) {
  const allSettings = loadData(getScopedKey(SCOPED_KEYS.MONTHLY_SETTINGS), {});
  allSettings[month] = settings;
  return saveData(getScopedKey(SCOPED_KEYS.MONTHLY_SETTINGS), allSettings);
}

// ---- Shift Types ----

export function loadShiftTypes() {
  return loadData(getScopedKey(SCOPED_KEYS.SHIFT_TYPES), DEFAULT_SHIFT_TYPES);
}

export function saveShiftTypes(shiftTypes) {
  return saveData(getScopedKey(SCOPED_KEYS.SHIFT_TYPES), shiftTypes);
}

// ---- Staff List ----

export function loadStaffList() {
  const activeDept = loadActiveDepartment();
  // Only use MOCK_STAFF as a fallback for the built-in default department
  const defaultStaff = activeDept.id === 'default' ? MOCK_STAFF : [];
  return loadData(getScopedKey(SCOPED_KEYS.STAFF_LIST), defaultStaff);
}

export function saveStaffList(staffList) {
  return saveData(getScopedKey(SCOPED_KEYS.STAFF_LIST), staffList);
}

// ---- Monthly Roster ----
// roster = { [staffId]: { [day]: shiftCode } }

export function loadMonthlyRoster(yearMonth) {
  const scopedKey = getScopedKey(SCOPED_KEYS.MONTHLY_ROSTER);
  const monthKey = yearMonth ? `${scopedKey}_${yearMonth}` : scopedKey;
  
  // Try loading month-scoped data
  const data = loadData(monthKey, null);
  if (data !== null) return data;
  
  // Migration: If no month-scoped data exists, load old unscoped data as a fallback
  return loadData(scopedKey, MOCK_ROSTER);
}

export function saveMonthlyRoster(roster, yearMonth) {
  const scopedKey = getScopedKey(SCOPED_KEYS.MONTHLY_ROSTER);
  const monthKey = yearMonth ? `${scopedKey}_${yearMonth}` : scopedKey;
  return saveData(monthKey, roster);
}

// ---- AI Roster ----

export function loadAIRoster() {
  return loadData(getScopedKey(SCOPED_KEYS.AI_ROSTER), null);
}

export function saveAIRoster(roster) {
  return saveData(getScopedKey(SCOPED_KEYS.AI_ROSTER), roster);
}

// ---- Leave Schedules (Pre-set leaves per staff per month) ----
// Structure: { [yearMonth]: [ { id, staffId, shiftCode, startDay, endDay, note } ] }

export function loadLeaveSchedules(yearMonth) {
  const key = `${getScopedKey(SCOPED_KEYS.LEAVE_SCHEDULES)}_${yearMonth}`;
  return loadData(key, []);
}

export function saveLeaveSchedules(yearMonth, schedules) {
  const key = `${getScopedKey(SCOPED_KEYS.LEAVE_SCHEDULES)}_${yearMonth}`;
  return saveData(key, schedules);
}

// ---- Utilities ----

export function getDaysInMonth(yearMonth) {
  if (!yearMonth) return 30;
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export function getMonthName(yearMonth) {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-').map(Number);
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return `${thaiMonths[month - 1]} ${year + 543}`;
}

export function getDayOfWeek(yearMonth, day) {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const thaiDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  return thaiDays[date.getDay()];
}

export function isWeekend(yearMonth, day) {
  if (!yearMonth) return false;
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}



export function generateStaffId() {
  return 'S' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
}
