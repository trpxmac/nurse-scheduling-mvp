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
};
// ---- Default Data ----

export const DEFAULT_CONFIG = {
  // Unit Info
  unit_name: 'Ward6B+IMCU',
  hospital_name: 'BPK',
  month: new Date().toISOString().slice(0, 7), // YYYY-MM
  shift_mode: '12HR', // 8HR | 12HR | MIXED

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
  { id: 'OFF', code: 'OFF', name: 'วันหยุด (Day Off)',         start: '',      end: '',      hours: 0,  category: 'OFF',   active: true,  hex: '#F5F5F5' },

  // ── LEAVE (no work hours, leave tracking)
  { id: 'AL',  code: 'AL',  name: 'ลาพักร้อน (Annual Leave)', start: '',      end: '',      hours: 0,  category: 'LEAVE', active: true,  hex: '#FFD700' },
  { id: 'SL',  code: 'SL',  name: 'ลาป่วย (Sick Leave)',      start: '',      end: '',      hours: 0,  category: 'LEAVE', active: true,  hex: '#FFA07A' },

  // ── OTHER
  { id: 'TRN', code: 'TRN', name: 'อบรม (Training)',          start: '',      end: '',      hours: 0,  category: 'OTHER', active: true,  hex: '#ADD8E6' },
  { id: 'MTG', code: 'MTG', name: 'ประชุม (Meeting)',          start: '',      end: '',      hours: 0,  category: 'OTHER', active: false, hex: '#D3D3D3' },
];

export const MOCK_STAFF = [
  { id: 'S1', employeeId: '670137', firstName: 'ปนัดดา', lastName: 'จิตต์เจริญ', nickname: 'ปนัดดา', position: 'RN', level: 'RN4', active: true },
  { id: 'S2', employeeId: '609484', firstName: 'เขมจิรา', lastName: 'ศิริสุวรรณ', nickname: 'เขมจิรา', position: 'RN', level: 'RN2', active: true },
  { id: 'S3', employeeId: '670319', firstName: 'กันยิกา', lastName: 'เรืองขจร', nickname: 'กันยิกา', position: 'Admin', level: '-', active: true },
];

export const MOCK_ROSTER = {
  'S1': {
    1: { shift: 'M', ot: 0 }, 2: { shift: 'M', ot: 0 }, 3: { shift: 'E', ot: 0 }, 4: { shift: 'OFF', ot: 0 }, 5: { shift: 'M', ot: 4 },
    6: { shift: 'M', ot: 0 }, 7: { shift: 'N8', ot: 0 }, 8: { shift: 'N8', ot: 0 }, 9: { shift: 'OFF', ot: 0 }, 10: { shift: 'OFF', ot: 0 },
  },
  'S2': {
    1: { shift: 'E', ot: 0 }, 2: { shift: 'E', ot: 0 }, 3: { shift: 'OFF', ot: 0 }, 4: { shift: 'M', ot: 0 }, 5: { shift: 'M', ot: 4 },
    6: { shift: 'OFF', ot: 0 }, 7: { shift: 'M', ot: 0 }, 8: { shift: 'M', ot: 0 }, 9: { shift: 'E', ot: 0 }, 10: { shift: 'N8', ot: 0 },
  },
  'S3': {
    1: { shift: 'M', ot: 0 }, 2: { shift: 'M', ot: 0 }, 3: { shift: 'M', ot: 0 }, 4: { shift: 'M', ot: 0 }, 5: { shift: 'M', ot: 0 },
    6: { shift: 'OFF', ot: 0 }, 7: { shift: 'OFF', ot: 0 }, 8: { shift: 'M', ot: 0 }, 9: { shift: 'M', ot: 0 }, 10: { shift: 'M', ot: 8 },
  }
};

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

// ---- Shift Types ----

export function loadShiftTypes() {
  return loadData(getScopedKey(SCOPED_KEYS.SHIFT_TYPES), DEFAULT_SHIFT_TYPES);
}

export function saveShiftTypes(shiftTypes) {
  return saveData(getScopedKey(SCOPED_KEYS.SHIFT_TYPES), shiftTypes);
}

// ---- Staff List ----

export function loadStaffList() {
  return loadData(getScopedKey(SCOPED_KEYS.STAFF_LIST), MOCK_STAFF);
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
