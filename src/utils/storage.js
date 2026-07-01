/* =============================================
   Cloud Storage API Helper — Nurse Scheduling System
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

export const DEFAULT_CONFIG = {
  unit_name: 'Ward 6B+IMCU',
  hospital_name: 'BSI',
  month: new Date().toISOString().slice(0, 7), // YYYY-MM
  shift_mode: '12HR',
  roster_hours: '',
  holiday_hours: '',
  head_nurse_name: '',
  manager_name: '',
  director_name: '',
  max_weekly_hours: 52,
  min_rest_hours: 11,
  max_daily_hours: 12,
  max_consecutive_nights: 3,
  max_consecutive_workdays: 3,
  required_M_coverage: 2,
  max_M_coverage: 0,
  required_E_coverage: 1,
  max_E_coverage: 0,
  required_N8_coverage: 1,
  max_N8_coverage: 0,
  required_D_coverage: 4,
  max_D_coverage: 0,
  required_N12_coverage: 3,
  max_N12_coverage: 0,
  incompatible_levels: [],
  required_level_every_shift: '',
  shift_fairness_mode: 'balanced', // 'balanced' | 'maximize'
  max_night_shifts_per_month: 0,  // 0 = no limit
  hod_office_days: [1, 2, 3, 4, 5], // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
};

export const DEFAULT_SHIFT_TYPES = [
  { id: 'M', code: 'M', name: 'เช้า (Morning)', start: '07:00', end: '15:00', hours: 8, category: 'DAY', active: true, hex: '#90EE90' },
  { id: 'E', code: 'E', name: 'บ่าย (Evening)', start: '15:00', end: '23:00', hours: 8, category: 'DAY', active: true, hex: '#87CEEB' },
  { id: 'D', code: 'D', name: 'กลางวัน 12 ชม. (Day 12hr)', start: '07:00', end: '19:00', hours: 12, category: 'DAY', active: true, hex: '#98FB98' },
  { id: 'N8', code: 'N8', name: 'ดึก 8 ชม. (Night 8hr)', start: '23:00', end: '07:00', hours: 8, category: 'NIGHT', active: true, hex: '#DDA0DD' },
  { id: 'N12', code: 'N12', name: 'กลางคืน 12 ชม. (Night 12hr)', start: '19:00', end: '07:00', hours: 12, category: 'NIGHT', active: true, hex: '#E6E6FA' },
  { id: '-', code: '-', name: 'พัก (Rest)', start: '', end: '', hours: 0, category: 'OFF', active: true, hex: '#F5F5F5' },
  { id: 'x', code: 'x', name: 'ขอล็อคหยุด (Requested Off)', start: '', end: '', hours: 0, category: 'OFF', active: true, hex: '#ffcdd2' },
  { id: 'H', code: 'H', name: 'วันหยุด (Holiday)', start: '', end: '', hours: 8, category: 'LEAVE', active: true, hex: '#DDA0DD' },
  { id: 'AL', code: 'AL', name: 'ลาพักร้อน (Annual Leave)', start: '', end: '', hours: 8, category: 'LEAVE', active: true, hex: '#FFD700' },
  { id: 'SL', code: 'SL', name: 'ลาป่วย (Sick Leave)', start: '', end: '', hours: 8, category: 'LEAVE', active: true, hex: '#FFA07A' },
  { id: 'TRN', code: 'TRN', name: 'อบรม (Training)', start: '', end: '', hours: 8, category: 'OTHER', active: true, hex: '#ADD8E6' },
  { id: 'MTG', code: 'MTG', name: 'ประชุม (Meeting)', start: '', end: '', hours: 0, category: 'OTHER', active: false, hex: '#D3D3D3' },
];

export const MOCK_STAFF = [
  { id: 'S01', employeeId: '1586347', firstName: 'ปนัดดา', lastName: 'จิตต์เจริญ', nickname: 'ดา', position: 'RN', level: 'RN4', active: true },
  { id: 'S02', employeeId: '622063', firstName: 'เขมจิรา', lastName: 'ศิริสุวรรณ', nickname: 'จิรา', position: 'RN', level: 'RN4', active: true },
  { id: 'S03', employeeId: '596823', firstName: 'สุภาวดี', lastName: 'ธนะพัฒน์', nickname: 'ดี', position: 'RN', level: 'RN3', active: true },
  { id: 'S04', employeeId: '553005', firstName: 'ศศิธร', lastName: 'วงศ์สวัสดิ์', nickname: 'ธร', position: 'RN', level: 'RN3', active: true },
  { id: 'S05', employeeId: '611077', firstName: 'พิมพ์ผกา', lastName: 'แก้วมณี', nickname: 'กา', position: 'RN', level: 'RN3', active: true },
  { id: 'S06', employeeId: '630177', firstName: 'จิราภรณ์', lastName: 'สาระคุณ', nickname: 'ภรณ์', position: 'RN', level: 'RN2', active: true },
  { id: 'S07', employeeId: '635143', firstName: 'อาทิตยา', lastName: 'ชนะกุล', nickname: 'ยา', position: 'RN', level: 'RN2', active: true },
  { id: 'S08', employeeId: '501694', firstName: 'กฤษฎิ์ภูมิ', lastName: 'วรรณดี', nickname: 'ภูมิ', position: 'RN', level: 'RN2', active: true },
  { id: 'S09', employeeId: '628475', firstName: 'วรัญญา', lastName: 'รุ่งเรือง', nickname: 'รัญ', position: 'RN', level: 'RN2', active: true },
  { id: 'S10', employeeId: '741258', firstName: 'ณิชาภัทร', lastName: 'ตั้งเจริญ', nickname: 'ณิชา', position: 'RN', level: 'RN1', active: true },
  { id: 'S11', employeeId: '752369', firstName: 'พรนภา', lastName: 'สุขสันต์', nickname: 'พร', position: 'RN', level: 'RN1', active: true },
  { id: 'S12', employeeId: '763480', firstName: 'กิตติศักดิ์', lastName: 'ใจตรง', nickname: 'กิต', position: 'RN', level: 'RN1', active: true },
  { id: 'S13', employeeId: '710634', firstName: 'กันยิกา', lastName: 'เรืองขจร', nickname: 'กัน', position: 'PN', level: '-', active: true },
  { id: 'S14', employeeId: '603484', firstName: 'จุฑามาศ', lastName: 'ทองใบ', nickname: 'มาศ', position: 'PN', level: '-', active: true },
  { id: 'S15', employeeId: '600133', firstName: 'วรรณภา', lastName: 'สุขสมบูรณ์', nickname: 'แอน', position: 'PN', level: '-', active: true },
  { id: 'S16', employeeId: '548201', firstName: 'นภาพร', lastName: 'พงษ์ประเสริฐ', nickname: 'นภา', position: 'PA', level: '-', active: true },
  { id: 'S17', employeeId: '615892', firstName: 'คำศรี', lastName: 'บุญมาก', nickname: 'ศรี', position: 'PA', level: '-', active: true },
  { id: 'S99', employeeId: '999999', firstName: 'น้องใหม่', lastName: 'พยาบาลใหม่', nickname: 'ใหม่', position: 'Orientation Nurse', level: 'Orientation Nurse', active: true },
];

export const MOCK_ROSTER = {};

// ---- Status Listeners (For UI) ----
let connectionStatus = 'connected';
const listeners = new Set();
export function subscribeToSyncStatus(listener) {
  listeners.add(listener);
  listener(connectionStatus);
  return () => listeners.delete(listener);
}
function updateStatus(status) {
  connectionStatus = status;
  listeners.forEach(listener => listener(status));
}
export function getSyncStatus() {
  return connectionStatus;
}

// ---- Legacy Compatibility (Return empty functions for App.jsx sync logic so it doesn't crash before we update it) ----
export async function pullFromDatabase() { return false; }

// ---- Cloud API Helpers ----

async function fetchFromCloud(key, defaultValue, retries = 5, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`/api/data/${key}`);
      if (!res.ok) {
        if (res.status >= 500 && i < retries - 1) {
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
        return defaultValue;
      }
      const json = await res.json();
      updateStatus('connected');
      return json.success && json.value ? json.value : defaultValue;
    } catch (err) {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        console.error(`Failed to fetch ${key} from cloud:`, err);
        updateStatus('error');
        return defaultValue;
      }
    }
  }
  return defaultValue;
}

async function saveToCloud(key, value) {
  updateStatus('syncing');
  try {
    const res = await fetch(`/api/data/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    });
    if (res.ok) {
      updateStatus('connected');
      return true;
    }
    throw new Error('Push failed');
  } catch (err) {
    console.error(`Failed to push ${key} to cloud:`, err);
    updateStatus('error');
    return false;
  }
}

// ---- LocalStorage (Only for UI State) ----
function loadLocal(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}
function saveLocal(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ---- Departments (Cloud + Local Active State) ----

export function loadActiveDepartment() {
  return loadLocal(KEYS.ACTIVE_DEPARTMENT, { id: 'default', name: 'Ward 6B+IMCU' });
}

export function saveActiveDepartment(dept) {
  return saveLocal(KEYS.ACTIVE_DEPARTMENT, dept);
}

export async function loadDepartments() {
  return fetchFromCloud(KEYS.DEPARTMENTS, [{ id: 'default', name: 'Ward 6B+IMCU' }]);
}

export async function saveDepartments(depts) {
  return saveToCloud(KEYS.DEPARTMENTS, depts);
}

// ---- Active Month (Local State) ----



export function loadActiveMonth() {
  return loadLocal('nss_active_view_month', new Date().toISOString().slice(0, 7));
}

export function saveActiveMonth(month) {
  const result = saveLocal('nss_active_view_month', month);
  window.dispatchEvent(new CustomEvent('nss_month_updated', { detail: month }));
  return result;
}

function getScopedKey(baseKey) {
  const activeDept = loadActiveDepartment();
  return `${baseKey}_${activeDept.id}`;
}

// ---- Config (Cloud) ----

export async function loadConfig() {
  const activeDept = loadActiveDepartment();
  const defaultConfigForDept = {
    ...DEFAULT_CONFIG,
    unit_name: activeDept.name !== 'Ward 6B+IMCU' ? activeDept.name : DEFAULT_CONFIG.unit_name
  };
  return fetchFromCloud(getScopedKey(SCOPED_KEYS.CONFIG), defaultConfigForDept);
}

export async function saveConfig(config) {
  return saveToCloud(getScopedKey(SCOPED_KEYS.CONFIG), config);
}

// ---- Monthly Settings (Cloud) ----

export async function loadMonthlySettings(month) {
  const allSettings = await fetchFromCloud(getScopedKey(SCOPED_KEYS.MONTHLY_SETTINGS), {});
  return allSettings[month] || { roster_hours: '', holiday_hours: '' };
}

export async function saveMonthlySettings(month, settings) {
  const allSettings = await fetchFromCloud(getScopedKey(SCOPED_KEYS.MONTHLY_SETTINGS), {});
  allSettings[month] = settings;
  return saveToCloud(getScopedKey(SCOPED_KEYS.MONTHLY_SETTINGS), allSettings);
}

// ---- Shift Types (Cloud) ----

export async function loadShiftTypes() {
  const activeDept = loadActiveDepartment();
  let loaded = await fetchFromCloud(getScopedKey(SCOPED_KEYS.SHIFT_TYPES), DEFAULT_SHIFT_TYPES);
  if (!loaded.find(s => s.code === 'O')) {
    loaded.push({ id: 'O', code: 'O', name: 'เวร Office (HOD)', start: '08:00', end: '16:00', hours: 8, category: 'OFFICE', active: true, hex: '#F0E68C' });
    saveToCloud(getScopedKey(SCOPED_KEYS.SHIFT_TYPES), loaded);
  }
  return loaded;
}

export async function saveShiftTypes(shiftTypes) {
  return saveToCloud(getScopedKey(SCOPED_KEYS.SHIFT_TYPES), shiftTypes);
}

// ---- Staff List (Cloud) ----

export async function loadStaffList() {
  const activeDept = loadActiveDepartment();
  const defaultStaff = activeDept.id === 'default' ? MOCK_STAFF : [];
  let list = await fetchFromCloud(getScopedKey(SCOPED_KEYS.STAFF_LIST), defaultStaff);

  return list;
}

export async function saveStaffList(staffList) {
  return saveToCloud(getScopedKey(SCOPED_KEYS.STAFF_LIST), staffList);
}

// ---- Monthly Roster (Cloud) ----

export async function loadMonthlyRoster(yearMonth) {
  const scopedKey = getScopedKey(SCOPED_KEYS.MONTHLY_ROSTER);
  const monthKey = yearMonth ? `${scopedKey}_${yearMonth}` : scopedKey;
  return fetchFromCloud(monthKey, MOCK_ROSTER);
}

export async function saveMonthlyRoster(roster, yearMonth) {
  const scopedKey = getScopedKey(SCOPED_KEYS.MONTHLY_ROSTER);
  const monthKey = yearMonth ? `${scopedKey}_${yearMonth}` : scopedKey;
  return saveToCloud(monthKey, roster);
}

// ---- AI Roster (Cloud) ----

export async function loadAIRoster() {
  return fetchFromCloud(getScopedKey(SCOPED_KEYS.AI_ROSTER), null);
}

export async function saveAIRoster(roster) {
  return saveToCloud(getScopedKey(SCOPED_KEYS.AI_ROSTER), roster);
}

// ---- Leave Schedules (Cloud) ----

export async function loadLeaveSchedules(yearMonth) {
  const key = `${getScopedKey(SCOPED_KEYS.LEAVE_SCHEDULES)}_${yearMonth}`;
  return fetchFromCloud(key, []);
}

export async function saveLeaveSchedules(yearMonth, schedules) {
  const key = `${getScopedKey(SCOPED_KEYS.LEAVE_SCHEDULES)}_${yearMonth}`;
  return saveToCloud(key, schedules);
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
