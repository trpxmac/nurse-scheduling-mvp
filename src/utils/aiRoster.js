/* =============================================
   AI Roster Generator
   Generates schedule based on Config constraints
   ============================================= */

import { getShiftHours, detectQuickReturns, buildShiftTypesMap, calcWeeklyHours } from './scheduling';

export function isSenior(staff) {
  const lvl = staff.level || staff.position;
  return ['RN2', 'RN3', 'RN4', 'RN5'].includes(lvl);
}

/**
 * Generate AI roster for all active staff
 * @param {Array} staffList - Active staff members
 * @param {Array} shiftTypes - Available shift types
 * @param {Object} config - Configuration with constraints
 * @returns {{ roster: Object, score: number, summary: Object }}
 */
export function generateAIRoster(staffList, shiftTypes, config, lockedSlots = {}) {
  const activeStaff = staffList.filter(s => s.active);
  const activeShifts = shiftTypes.filter(s => s.active && s.code !== '-');
  const shiftTypesMap = buildShiftTypesMap(shiftTypes);

  if (activeStaff.length === 0 || activeShifts.length === 0) {
    return { roster: {}, score: 0, summary: { error: 'ไม่มีบุคลากรหรือประเภทเวรที่ active' } };
  }

  const [year, month] = (config.month || '2026-01').split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Determine which shifts to use based on shift_mode
  // AI should only automatically generate working shifts (hours > 0)
  let workShifts = activeShifts.filter(s => s.hours > 0);
  if (config.shift_mode === '8HR') {
    workShifts = workShifts.filter(s => s.hours === 8);
  } else if (config.shift_mode === '12HR') {
    workShifts = workShifts.filter(s => s.hours === 12);
  }

  if (workShifts.length === 0) workShifts = activeShifts.filter(s => s.hours > 0);

  // Initialize roster and pre-fill with locked leave days
  const roster = {};
  for (const staff of activeStaff) {
    roster[staff.id] = {};
    // Pre-fill locked slots (AL, SL, TRN, ML etc)
    if (lockedSlots[staff.id]) {
      for (const [day, shiftCode] of Object.entries(lockedSlots[staff.id])) {
        roster[staff.id][Number(day)] = shiftCode;
      }
    }
  }

  // Pre-fill Holiday (H) shifts if holiday_hours are defined
  const hasHolidayShift = shiftTypesMap['H'] && shiftTypesMap['H'].active;
  const holidayHours = Number(config.holiday_hours) || 0;
  const numHolidayShifts = Math.floor(holidayHours / (shiftTypesMap['H']?.hours || 8));

  if (hasHolidayShift && numHolidayShifts > 0) {
    for (const staff of activeStaff) {
      let hCount = 0;
      // Pre-fill randomly to empty slots
      const emptyDays = Array.from({length: daysInMonth}, (_, i) => i + 1)
                             .filter(d => roster[staff.id][d] === undefined);
      shuffleArray(emptyDays);
      for (let i = 0; i < emptyDays.length && hCount < numHolidayShifts; i++) {
        roster[staff.id][emptyDays[i]] = 'H';
        hCount++;
      }
    }
  }

  // For each day, assign shifts to meet coverage
  for (let day = 1; day <= daysInMonth; day++) {
    // Only include staff that don't have a locked slot for this day
    const staffPool = activeStaff.filter(s => roster[s.id][day] === undefined);
    shuffleArray(staffPool);

    // Track assignments for this day
    const dayAssignments = {};
    const dayCoverage = {};
    for (const s of workShifts) {
      dayCoverage[s.code] = 0;
    }

    // Phase 1: Fill coverage requirements
    for (const shift of workShifts) {
      const shiftCode = shift.code;
      const required = config[`required_${shiftCode}_coverage`] || 0;
      if (required === 0) continue;

      for (let i = 0; i < required && staffPool.length > 0; i++) {
        const assignedStaffThisShift = activeStaff.filter(s => dayAssignments[s.id] === shiftCode);
        const staffIdx = findBestStaff(staffPool, roster, shiftCode, day, shiftTypesMap, config, daysInMonth, assignedStaffThisShift);
        if (staffIdx >= 0) {
          const staff = staffPool[staffIdx];
          roster[staff.id][day] = shiftCode;
          dayAssignments[staff.id] = shiftCode;
          dayCoverage[shiftCode] = (dayCoverage[shiftCode] || 0) + 1;
          staffPool.splice(staffIdx, 1);
        }
      }
    }

    // Phase 2: Assign remaining staff (some work, some OFF)
    // To balance hours, sort remaining staff by current total hours (ascending)
    staffPool.sort((a, b) => {
      return calcCurrentHours(roster[a.id], shiftTypesMap) - calcCurrentHours(roster[b.id], shiftTypesMap);
    });

    for (const staff of staffPool) {
      // Target work hours is ideally roster_hours or max allowed
      const currentHours = calcCurrentHours(roster[staff.id], shiftTypesMap);
      const targetWorkHours = Number(config.roster_hours) || ((config.max_weekly_hours || 48) * (daysInMonth / 7));

      if (currentHours >= targetWorkHours) {
        roster[staff.id][day] = '-';
        continue;
      }

      // Find a suitable shift
      const availableShifts = workShifts.filter(s => s.code !== '-');
      if (availableShifts.length > 0) {
        // Pick the shift this staff has done the least, then by least coverage
        availableShifts.sort((a, b) => {
          const aStaffCount = Object.values(roster[staff.id]).filter(v => v === a.code).length;
          const bStaffCount = Object.values(roster[staff.id]).filter(v => v === b.code).length;
          if (aStaffCount !== bStaffCount) {
             return aStaffCount - bStaffCount; 
          }
          return (dayCoverage[a.code] || 0) - (dayCoverage[b.code] || 0);
        });
        const chosen = availableShifts[0];

        // Check constraints before assigning
        const assignedStaffThisShift = activeStaff.filter(s => dayAssignments[s.id] === chosen.code);
        if (isAssignmentValid(roster, staff, day, chosen.code, shiftTypesMap, config, assignedStaffThisShift)) {
          roster[staff.id][day] = chosen.code;
          dayAssignments[staff.id] = chosen.code;
          dayCoverage[chosen.code] = (dayCoverage[chosen.code] || 0) + 1;
        } else {
          roster[staff.id][day] = '-';
        }
      } else {
        roster[staff.id][day] = '-';
      }
    }
  }

  // Phase 3: Ensure everyone has some rest — at least 1 OFF per 7 consecutive days
  for (const staff of activeStaff) {
    ensureRestDays(roster[staff.id], daysInMonth);
  }

  // Calculate score
  const score = calculateAIScore(roster, activeStaff, shiftTypesMap, config, daysInMonth, workShifts);
  const summary = generateSummary(roster, activeStaff, shiftTypesMap, config, daysInMonth, workShifts);

  return { roster, score, summary };
}

/**
 * Find the best staff member for a given shift on a day
 */
function findBestStaff(pool, roster, shiftCode, day, shiftTypesMap, config, daysInMonth, assignedStaffThisShift = []) {
  let bestIdx = -1;
  let bestScore = -Infinity;
  const hasSenior = assignedStaffThisShift.some(isSenior);

  for (let i = 0; i < pool.length; i++) {
    const staff = pool[i];

    // Check if assignment is valid
    if (!isAssignmentValid(roster, staff, day, shiftCode, shiftTypesMap, config, assignedStaffThisShift)) {
      continue;
    }

    // Score: prefer staff with fewer hours heavily to balance OT
    const currentHours = calcCurrentHours(roster[staff.id], shiftTypesMap);
    let score = 10000 - (currentHours * 10);

    // Penalize if the staff already has this specific shift (secondary priority)
    const currentShiftCount = Object.values(roster[staff.id]).filter(v => v === shiftCode).length;
    score -= (currentShiftCount * 30);

    // Rule: Prioritize seniors if the shift doesn't have one yet
    if (!hasSenior && isSenior(staff)) {
      score += 5000;
    }

    // Prefer staff whose preferred shift matches
    if (staff.preferred_shifts && staff.preferred_shifts.includes(shiftCode)) {
      if (score + 100 > bestScore) {
        bestScore = score + 100;
        bestIdx = i;
      }
    } else if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

/**
 * Check if assigning a shift is valid (no constraint violations)
 */
function isAssignmentValid(roster, staff, day, shiftCode, shiftTypesMap, config, assignedStaffThisShift = []) {
  const staffId = staff.id;
  const staffRoster = roster[staffId];

  // Check Avoid Shifts constraint
  if (staff.avoid_shifts && staff.avoid_shifts.includes(shiftCode)) {
    return false;
  }

  // Check Avoid Staff constraint
  if (assignedStaffThisShift.length > 0) {
    const conflictsWithAssigned = assignedStaffThisShift.some(
      assignedStaff => 
        (staff.avoid_staff && staff.avoid_staff.includes(assignedStaff.id)) || 
        (assignedStaff.avoid_staff && assignedStaff.avoid_staff.includes(staff.id))
    );
    if (conflictsWithAssigned) return false;
  }

  // Check Avoid Levels constraint (Individual) has been removed because it is superseded by Global Incompatible Levels.

  // Check Global Incompatible Levels constraint
  if (config.incompatible_levels && config.incompatible_levels.length > 0 && assignedStaffThisShift.length > 0) {
    const myLvl = staff.level || staff.position;
    const violatesGlobalRule = assignedStaffThisShift.some(assignedStaff => {
      const theirLvl = assignedStaff.level || assignedStaff.position;
      const pair1 = `${myLvl}-${theirLvl}`;
      const pair2 = `${theirLvl}-${myLvl}`;
      return config.incompatible_levels.includes(pair1) || config.incompatible_levels.includes(pair2);
    });
    if (violatesGlobalRule) return false;
  }


  // Check previous day for Quick Return
  if (day > 1) {
    const prevShift = staffRoster[day - 1];
    if (prevShift && prevShift !== 'OFF') {
      const prevType = shiftTypesMap[prevShift];
      const currType = shiftTypesMap[shiftCode];
      if (prevType && currType) {
        const restHours = calcRestHours(prevType, currType);
        if (restHours < config.min_rest_hours) return false;
      }
    }
  }

  // Check if next day assignment would be violated
  const nextShift = staffRoster[day + 1];
  if (nextShift && nextShift !== 'OFF') {
    const currType = shiftTypesMap[shiftCode];
    const nextType = shiftTypesMap[nextShift];
    if (currType && nextType) {
      const restHours = calcRestHours(currType, nextType);
      if (restHours < config.min_rest_hours) return false;
    }
  }

  // Check consecutive workdays
  if (config.max_consecutive_workdays) {
    let streak = 0;
    for (let d = day - 1; d >= 1; d--) {
      const prev = staffRoster[d];
      if (prev && prev !== 'OFF') {
        const st = shiftTypesMap[prev];
        if (st && st.category !== 'OFF' && st.category !== 'LEAVE') {
          streak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    if (streak >= config.max_consecutive_workdays) return false;
  }

  // Check consecutive nights
  if (config.max_consecutive_nights) {
    const st = shiftTypesMap[shiftCode];
    if (st && st.category === 'NIGHT') {
      let streak = 0;
      for (let d = day - 1; d >= 1; d--) {
        const prev = staffRoster[d];
        if (prev && prev !== 'OFF') {
          const prevSt = shiftTypesMap[prev];
          if (prevSt && prevSt.category === 'NIGHT') {
            streak++;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      if (streak >= config.max_consecutive_nights) return false;
    }
  }

  // Check daily hours limit
  const shiftHours = getShiftHours(shiftCode, shiftTypesMap);
  if (shiftHours > config.max_daily_hours) return false;

  // Check weekly hours limit
  if (config.max_weekly_hours) {
    const testRoster = { ...staffRoster, [day]: shiftCode };
    const weeks = calcWeeklyHours(testRoster, shiftTypesMap, config.month);
    if (weeks.some(w => w.hours > config.max_weekly_hours)) {
      return false;
    }
  }

  // Check RN1 supervision constraint
  if (staff.level === 'RN1') {
    const hasSenior = assignedStaffThisShift.some(isSenior);
    if (!hasSenior) {
      return false; // RN1 cannot be assigned if there is no senior currently on this shift
    }
  }

  return true;
}

/**
 * Calculate rest hours between two consecutive shifts
 */
function calcRestHours(prevShift, nextShift) {
  function toMin(t) {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  let prevEndMin = toMin(prevShift.end);
  let nextStartMin = toMin(nextShift.start);

  // If prev shift crosses midnight (end < start), the shift ends on the next calendar day
  if (prevShift.end < prevShift.start) {
    // Shift ends early morning of day+1, rest = nextStart of day+1 - prevEnd of day+1
    let rest = nextStartMin - prevEndMin;
    if (rest < 0) rest += 24 * 60;
    return rest / 60;
  }

  // Normal: rest = (24:00 - prevEnd) + nextStart
  let rest = (24 * 60 - prevEndMin) + nextStartMin;
  if (rest >= 24 * 60) rest -= 24 * 60;
  return rest / 60;
}

function calcCurrentHours(staffRoster, shiftTypesMap) {
  let total = 0;
  for (const day of Object.keys(staffRoster)) {
    total += getShiftHours(staffRoster[day], shiftTypesMap);
  }
  return total;
}

function ensureRestDays(staffRoster, daysInMonth) {
  for (let d = 1; d <= daysInMonth - 6; d++) {
    let consecutive = 0;
    for (let i = 0; i < 7; i++) {
      if (staffRoster[d + i] && staffRoster[d + i] !== '-') {
        consecutive++;
      }
    }
    if (consecutive >= 7) {
      // Force one day off in the middle
      const midDay = d + 3;
      staffRoster[midDay] = '-';
    }
  }
}

/**
 * Calculate AI Quality Score (0-100)
 */
function calculateAIScore(roster, staff, shiftTypesMap, config, daysInMonth, workShifts) {
  let score = 100;
  const yearMonth = config.month;

  // Penalty for Quick Returns
  for (const s of staff) {
    const qr = detectQuickReturns(roster[s.id] || {}, shiftTypesMap, config.min_rest_hours, yearMonth);
    score -= qr.length * 5;
  }

  // Penalty for uneven distribution
  const hoursList = staff.map(s => calcCurrentHours(roster[s.id] || {}, shiftTypesMap));
  if (hoursList.length > 1) {
    const avg = hoursList.reduce((a, b) => a + b, 0) / hoursList.length;
    const variance = hoursList.reduce((sum, h) => sum + Math.pow(h - avg, 2), 0) / hoursList.length;
    const stdDev = Math.sqrt(variance);
    score -= Math.min(20, stdDev);
  }

  // Penalty for coverage shortages
  for (let day = 1; day <= daysInMonth; day++) {
    const dayCoverage = {};
    for (const s of staff) {
      const shift = roster[s.id]?.[day];
      if (shift && shift !== '-') {
        dayCoverage[shift] = (dayCoverage[shift] || 0) + 1;
      }
    }
    for (const shift of workShifts) {
      const required = config[`required_${shift.code}_coverage`] || 0;
      if ((dayCoverage[shift.code] || 0) < required) score -= 1;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateSummary(roster, staff, shiftTypesMap, config, daysInMonth, workShifts) {
  const yearMonth = config.month;
  let totalQuickReturns = 0;
  let coverageShortages = 0;
  const hoursList = [];

  for (const s of staff) {
    const qr = detectQuickReturns(roster[s.id] || {}, shiftTypesMap, config.min_rest_hours, yearMonth);
    totalQuickReturns += qr.length;
    hoursList.push(calcCurrentHours(roster[s.id] || {}, shiftTypesMap));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayCoverage = {};
    for (const s of staff) {
      const shift = roster[s.id]?.[day];
      if (shift && shift !== '-') {
        dayCoverage[shift] = (dayCoverage[shift] || 0) + 1;
      }
    }
    for (const shift of workShifts) {
      const required = config[`required_${shift.code}_coverage`] || 0;
      if ((dayCoverage[shift.code] || 0) < required) coverageShortages++;
    }
  }

  const avgHours = hoursList.length > 0 ? Math.round(hoursList.reduce((a, b) => a + b, 0) / hoursList.length) : 0;
  const minHours = hoursList.length > 0 ? Math.min(...hoursList) : 0;
  const maxHours = hoursList.length > 0 ? Math.max(...hoursList) : 0;

  return {
    totalStaff: staff.length,
    avgHours,
    minHours,
    maxHours,
    totalQuickReturns,
    coverageShortages,
    daysInMonth,
  };
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
