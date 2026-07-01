/* =============================================
   Scheduling Logic — Violations, Coverage, Hours
   ============================================= */

/**
 * Parse a roster cell which could be a string or an object with OT
 * Returns { shift: string, ot: number }
 */
export function parseShift(cell) {
  if (!cell) return { shift: '', ot: 0, otType: '' };
  if (typeof cell === 'string') {
    const parts = cell.split('\n');
    return {
      shift: parts[0] || '',
      ot: parts.length > 1 ? Number(parts[1]) || 0 : 0,
      otType: parts.length > 2 ? parts[2] : ''
    };
  }
  return { shift: cell.shift || '', ot: Number(cell.ot) || 0, otType: cell.otType || '' };
}

/**
 * Get shift hours from shift code using shift types map
 */
export function getShiftHours(shiftCode, shiftTypesMap) {
  if (!shiftCode || shiftCode === '-' || shiftCode === '' || shiftCode.toLowerCase() === 'x') return 0;
  const st = shiftTypesMap[shiftCode];
  return st ? st.hours : 0;
}

/**
 * Calculate total hours for a staff member in a month
 */
export function calcMonthlyHours(staffRoster, shiftTypesMap) {
  let total = 0;
  for (const day of Object.keys(staffRoster)) {
    const { shift, ot } = parseShift(staffRoster[day]);
    total += getShiftHours(shift, shiftTypesMap) + ot;
  }
  return total;
}

/**
 * Calculate weekly hours breakdown
 * Returns array of { weekNum, hours, days }
 */
export function calcWeeklyHours(staffRoster, shiftTypesMap, yearMonth) {
  if (!yearMonth) return [];
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks = [];
  let currentWeek = { weekNum: 1, hours: 0, workHours: 0, days: [] };

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dow = date.getDay();
    const { shift: shiftCode, ot } = parseShift(staffRoster[d]);
    const hours = getShiftHours(shiftCode, shiftTypesMap) + ot;
    
    // Check if shift is actual work (not leave/off)
    const st = shiftTypesMap[shiftCode];
    const isWork = st && !['OFF', 'LEAVE'].includes(st.category);
    
    currentWeek.hours += hours;
    if (isWork) currentWeek.workHours += hours;
    
    currentWeek.days.push({ day: d, shift: shiftCode, ot, hours, isWork });

    // Week ends on Saturday (6) or last day of month
    if (dow === 6 || d === daysInMonth) {
      weeks.push({ ...currentWeek });
      currentWeek = { weekNum: currentWeek.weekNum + 1, hours: 0, workHours: 0, days: [] };
    }
  }
  return weeks;
}

/**
 * Detect Quick Return violations (rest < min_rest_hours between shifts)
 * Returns array of { day, prevShift, currentShift }
 */
export function detectQuickReturns(staffRoster, shiftTypesMap, minRestHours, yearMonth) {
  if (!yearMonth) return [];
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const violations = [];

  // Parse time string "HH:MM" to minutes from midnight
  function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  for (let d = 2; d <= daysInMonth; d++) {
    const { shift: prevShiftCode } = parseShift(staffRoster[d - 1]);
    const { shift: currShiftCode } = parseShift(staffRoster[d]);
    if (!prevShiftCode || prevShiftCode === '-' || prevShiftCode === '' || prevShiftCode.toLowerCase() === 'x') continue;
    if (!currShiftCode || currShiftCode === '-' || currShiftCode === '' || currShiftCode.toLowerCase() === 'x') continue;

    const prevShift = shiftTypesMap[prevShiftCode];
    const currShift = shiftTypesMap[currShiftCode];
    if (!prevShift || !currShift) continue;

    // Skip shifts that have no start or end time (e.g. OFF, LEAVE, OTHER)
    if (!prevShift.start || !prevShift.end || !currShift.start || !currShift.end) {
      continue;
    }

    const prevEnd = timeToMinutes(prevShift.end);
    const currStart = timeToMinutes(currShift.start);

    // Calculate rest time
    let restMinutes;
    if (prevEnd <= currStart) {
      // Same day (e.g., E ends 23:00, next day M starts 07:00)
      restMinutes = (24 * 60 - prevEnd) + currStart;
    } else {
      // Overnight shift (e.g., N8 ends 07:00, next shift starts after)
      restMinutes = currStart + (24 * 60 - prevEnd);
    }

    // For overnight shifts that end next morning
    if (prevShift.end < prevShift.start) {
      // Previous shift crosses midnight, actually ends on day d
      restMinutes = currStart - timeToMinutes(prevShift.end);
      if (restMinutes < 0) restMinutes += 24 * 60;
    }

    const restHours = restMinutes / 60;
    if (restHours < minRestHours) {
      violations.push({
        day: d,
        prevDay: d - 1,
        prevShift: prevShiftCode,
        currentShift: currShiftCode,
        restHours: Math.round(restHours * 10) / 10,
      });
    }
  }
  return violations;
}

/**
 * Calculate daily coverage for each shift type
 * Returns { [day]: { M: count, E: count, N8: count, ... } }
 */
export function calcDailyCoverage(roster, activeStaffIds, shiftTypesMap) {
  const coverage = {};

  // Find all days from the first staff's roster
  const allDays = new Set();
  for (const staffId of activeStaffIds) {
    if (roster[staffId]) {
      Object.keys(roster[staffId]).forEach(d => allDays.add(Number(d)));
    }
  }

  for (const day of allDays) {
    coverage[day] = {};
    // Initialize all shift codes to 0
    for (const code of Object.keys(shiftTypesMap)) {
      if (code !== '-' && code.toLowerCase() !== 'x') coverage[day][code] = 0;
    }

    for (const staffId of activeStaffIds) {
      const { shift } = parseShift(roster[staffId]?.[day]);
      if (shift && shift !== '-' && shift.toLowerCase() !== 'x' && coverage[day][shift] !== undefined) {
        coverage[day][shift]++;
      }
    }
  }
  return coverage;
}

/**
 * Check if daily coverage meets requirements
 * Returns { [day]: { met: boolean, details: { shiftCode: { actual, required, met } } } }
 */
export function checkCoverageRequirements(coverage, config) {
  // Build requirements based on shift_mode
  const mode = config.shift_mode || '8HR';
  const requirements = {};
  if (mode === '8HR' || mode === 'MIXED') {
    requirements.M = config.required_M_coverage || 0;
    requirements.E = config.required_E_coverage || 0;
    requirements.N8 = config.required_N8_coverage || 0;
  }
  if (mode === '12HR' || mode === 'MIXED') {
    requirements.D = config.required_D_coverage || 0;
    requirements.N12 = config.required_N12_coverage || 0;
  }

  const results = {};
  for (const [day, shifts] of Object.entries(coverage)) {
    const details = {};
    let allMet = true;
    for (const shiftCode of Object.keys(requirements)) {
      const required = requirements[shiftCode];
      const max = config[`max_${shiftCode}_coverage`] || 0;
      const actual = shifts[shiftCode] || 0;
      const met = actual >= required && (max === 0 || actual <= max);
      if (!met) allMet = false;
      details[shiftCode] = { actual, required, max, met };
    }
    results[day] = { met: allMet, details };
  }
  return results;
}

/**
 * Build a shift types map from array: { code: { ...shiftType } }
 */
export function buildShiftTypesMap(shiftTypes) {
  const map = {};
  for (const st of shiftTypes) {
    map[st.code] = st;
  }
  return map;
}

/**
 * Filter active shifts based on shift_mode
 */
export function filterActiveShifts(shiftTypes, shiftMode) {
  let filtered = shiftTypes.filter(s => s.active);
  if (shiftMode === '8HR') {
    filtered = filtered.filter(s => s.hours === 8 || s.hours === 0);
  } else if (shiftMode === '12HR') {
    filtered = filtered.filter(s => s.hours === 12 || s.hours === 0);
  }
  return filtered;
}

/**
 * Count all violations for summary
 */
export function countViolations(roster, staffList, shiftTypesMap, config, yearMonth) {
  let totalQuickReturns = 0;
  let totalOverweekly = 0;

  const activeStaff = staffList.filter(s => s.active);

  for (const staff of activeStaff) {
    const staffRoster = roster[staff.id] || {};

    // Quick returns
    const qr = detectQuickReturns(staffRoster, shiftTypesMap, config.min_rest_hours, yearMonth);
    totalQuickReturns += qr.length;

    // Weekly hours
    const weeks = calcWeeklyHours(staffRoster, shiftTypesMap, yearMonth);
    for (const week of weeks) {
      if (week.workHours > Number(config.max_weekly_hours || 52)) {
        totalOverweekly++;
      }
    }
  }

  return { totalQuickReturns, totalOverweekly, total: totalQuickReturns + totalOverweekly };
}

/**
 * Detect consecutive night shifts exceeding max_consecutive_nights
 * Returns array of { startDay, endDay, count, shifts }
 */
export function detectConsecutiveNights(staffRoster, shiftTypesMap, maxConsecutiveNights, yearMonth) {
  if (!yearMonth) return [];
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const NIGHT_CATEGORIES = ['NIGHT'];

  const isNight = (code) => {
    if (!code || code === 'OFF' || code === '') return false;
    const st = shiftTypesMap[code];
    return st && NIGHT_CATEGORIES.includes(st.category);
  };

  const violations = [];
  let streak = 0;
  let streakStart = 0;
  let streakShifts = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const { shift: code } = parseShift(staffRoster[d]);
    if (isNight(code)) {
      if (streak === 0) streakStart = d;
      streak++;
      streakShifts.push({ day: d, shift: code });
    } else {
      if (streak > maxConsecutiveNights) {
        violations.push({ startDay: streakStart, endDay: d - 1, count: streak, shifts: streakShifts });
      }
      streak = 0;
      streakShifts = [];
    }
  }
  if (streak > maxConsecutiveNights) {
    violations.push({ startDay: streakStart, endDay: daysInMonth, count: streak, shifts: streakShifts });
  }
  return violations;
}

/**
 * Detect consecutive workdays exceeding max_consecutive_workdays
 * Returns array of { startDay, endDay, count }
 */
export function detectConsecutiveWorkdays(staffRoster, shiftTypesMap, maxConsecutive, yearMonth) {
  if (!yearMonth) return [];
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const isWork = (code) => {
    if (!code || code === '') return false;
    const st = shiftTypesMap[code];
    if (!st) return false;
    return st.category === 'DAY' || st.category === 'NIGHT';
  };

  const violations = [];
  let streak = 0;
  let streakStart = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const { shift: code } = parseShift(staffRoster[d]);
    if (isWork(code)) {
      if (streak === 0) streakStart = d;
      streak++;
    } else {
      if (streak > maxConsecutive) {
        violations.push({ startDay: streakStart, endDay: d - 1, count: streak });
      }
      streak = 0;
    }
  }
  if (streak > maxConsecutive) {
    violations.push({ startDay: streakStart, endDay: daysInMonth, count: streak });
  }
  return violations;
}

/**
 * Detect daily hours violations (shift hours > max_daily_hours)
 * Returns array of { day, shift, hours }
 */
export function detectMaxDailyHours(staffRoster, shiftTypesMap, maxDailyHours) {
  const violations = [];
  for (const [day, cell] of Object.entries(staffRoster)) {
    const { shift: code, ot } = parseShift(cell);
    if (!code || code === '') continue;
    const st = shiftTypesMap[code];
    if (!st) continue;
    const totalHours = st.hours + ot;
    if (totalHours > maxDailyHours) {
      violations.push({ day: Number(day), shift: code, ot, hours: totalHours });
    }
  }
  return violations;
}

/**
 * Build comprehensive per-staff validation results
 * Returns array of { staff, totalHours, maxWeeklyOk, quickReturns, qrDays,
 *   nightRunViolations, workRunViolations, dailyViolations, weeklyViolations,
 *   redFlags, overallStatus }
 */
export function buildStaffValidation(roster, staffList, shiftTypesMap, config, yearMonth) {
  const activeStaff = staffList.filter(s => s.active);
  const results = [];

  for (const staff of activeStaff) {
    const sr = roster[staff.id] || {};

    const totalHours = calcMonthlyHours(sr, shiftTypesMap);
    const weeks = calcWeeklyHours(sr, shiftTypesMap, yearMonth);
    const weeklyViolations = weeks.filter(w => w.workHours > Number(config.max_weekly_hours || 52));
    const maxWeeklyHours = weeks.reduce((max, w) => Math.max(max, w.workHours), 0);
    const maxWeeklyOk = weeklyViolations.length === 0;

    const quickReturns = detectQuickReturns(sr, shiftTypesMap, config.min_rest_hours || 11, yearMonth);
    const qrDays = quickReturns.map(qr => qr.day);

    const nightRunViolations = detectConsecutiveNights(sr, shiftTypesMap, config.max_consecutive_nights || 3, yearMonth);
    const workRunViolations = detectConsecutiveWorkdays(sr, shiftTypesMap, config.max_consecutive_workdays || 3, yearMonth);
    const dailyViolations = detectMaxDailyHours(sr, shiftTypesMap, config.max_daily_hours || 12);

    // Build Red Flag text list
    const redFlags = [];
    if (weeklyViolations.length > 0) redFlags.push(`MaxWeekHrs:${maxWeeklyHours}>${config.max_weekly_hours}`);
    if (quickReturns.length > 0) redFlags.push(`QuickReturn:<${config.min_rest_hours}h`);
    if (nightRunViolations.length > 0) redFlags.push(`NightRun:>${config.max_consecutive_nights}`);
    if (workRunViolations.length > 0) redFlags.push(`WorkDays:>${config.max_consecutive_workdays}`);
    if (dailyViolations.length > 0) redFlags.push(`MaxDaily:>${config.max_daily_hours}`);
    // Always mark as WeekViolation for demo visibility (matching screenshot)
    if (weeklyViolations.length > 0) {
      const weekNums = weeklyViolations.map(w => `W${w.weekNum}`).join(',');
      redFlags.push(`WeekViolation:${weekNums}`);
    }

    const hasViolation = redFlags.length > 0;
    const overallStatus = hasViolation ? 'REVIEW' : 'OK';

    results.push({
      staff,
      totalHours,
      maxWeeklyHours,
      maxWeeklyOk,
      quickReturns,
      qrDays,
      nightRunViolations,
      workRunViolations,
      weeklyViolations,
      dailyViolations,
      redFlags,
      overallStatus,
    });
  }
  return results;
}

