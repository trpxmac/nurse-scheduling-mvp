/* =============================================
   AI Roster Generator
   Generates schedule based on Config constraints
   ============================================= */

import { getShiftHours, detectQuickReturns, buildShiftTypesMap } from './scheduling';

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
export function generateAIRoster(staffList, shiftTypes, config) {
  const activeStaff = staffList.filter(s => s.active);
  const activeShifts = shiftTypes.filter(s => s.active && s.code !== 'OFF');
  const shiftTypesMap = buildShiftTypesMap(shiftTypes);

  if (activeStaff.length === 0 || activeShifts.length === 0) {
    return { roster: {}, score: 0, summary: { error: 'ไม่มีบุคลากรหรือประเภทเวรที่ active' } };
  }

  const [year, month] = (config.month || '2026-01').split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Determine which shifts to use based on shift_mode
  let workShifts;
  if (config.shift_mode === '8HR') {
    workShifts = activeShifts.filter(s => s.hours === 8);
  } else if (config.shift_mode === '12HR') {
    workShifts = activeShifts.filter(s => s.hours === 12);
  } else {
    workShifts = activeShifts;
  }

  if (workShifts.length === 0) workShifts = activeShifts;

  // Coverage requirements
  const coverageReqs = {
    M: config.required_M_coverage || 0,
    E: config.required_E_coverage || 0,
    N8: config.required_N8_coverage || 0,
  };

  const roster = {};
  for (const staff of activeStaff) {
    roster[staff.id] = {};
  }

  // For each day, assign shifts to meet coverage
  for (let day = 1; day <= daysInMonth; day++) {
    const staffPool = [...activeStaff];
    shuffleArray(staffPool);

    // Track assignments for this day
    const dayAssignments = {};
    const dayCoverage = {};
    for (const s of workShifts) {
      dayCoverage[s.code] = 0;
    }

    // Phase 1: Fill coverage requirements
    for (const shiftCode of Object.keys(coverageReqs)) {
      const required = coverageReqs[shiftCode];
      if (!shiftTypesMap[shiftCode] || !shiftTypesMap[shiftCode].active) continue;

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
    for (const staff of staffPool) {
      // Check if staff should get OFF (aim for ~5-6 days off per month)
      const totalAssigned = Object.values(roster[staff.id]).filter(v => v && v !== 'OFF').length;
      const targetWorkDays = Math.round(daysInMonth * 5 / 7); // ~22 days

      if (totalAssigned >= targetWorkDays) {
        roster[staff.id][day] = 'OFF';
        continue;
      }

      // Determine probability of OFF (increase as we approach target)
      const ratio = totalAssigned / targetWorkDays;
      if (Math.random() < ratio * 0.3) {
        roster[staff.id][day] = 'OFF';
        continue;
      }

      // Find a suitable shift
      const availableShifts = workShifts.filter(s => s.code !== 'OFF');
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
          roster[staff.id][day] = 'OFF';
        }
      } else {
        roster[staff.id][day] = 'OFF';
      }
    }
  }

  // Phase 3: Ensure everyone has some rest — at least 1 OFF per 7 consecutive days
  for (const staff of activeStaff) {
    ensureRestDays(roster[staff.id], daysInMonth);
  }

  // Calculate score
  const score = calculateAIScore(roster, activeStaff, shiftTypesMap, config, daysInMonth);
  const summary = generateSummary(roster, activeStaff, shiftTypesMap, config, daysInMonth);

  return { roster, score, summary };
}

/**
 * Find the best staff member for a given shift on a day
 */
function findBestStaff(pool, roster, shiftCode, day, shiftTypesMap, config, daysInMonth, assignedStaffThisShift = []) {
  let bestIdx = -1;
  let bestScore = -1;
  const hasSenior = assignedStaffThisShift.some(isSenior);

  for (let i = 0; i < pool.length; i++) {
    const staff = pool[i];

    // Check if assignment is valid
    if (!isAssignmentValid(roster, staff, day, shiftCode, shiftTypesMap, config, assignedStaffThisShift)) {
      continue;
    }

    // Score: prefer staff with fewer hours
    const currentHours = calcCurrentHours(roster[staff.id], shiftTypesMap);
    let score = 1000 - currentHours;

    // Penalize if the staff already has a lot of THIS specific shift to ensure equal distribution
    const currentShiftCount = Object.values(roster[staff.id]).filter(v => v === shiftCode).length;
    score -= (currentShiftCount * 50);

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

  // Check daily hours limit
  const shiftHours = getShiftHours(shiftCode, shiftTypesMap);
  if (shiftHours > config.max_daily_hours) return false;

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
      if (staffRoster[d + i] && staffRoster[d + i] !== 'OFF') {
        consecutive++;
      }
    }
    if (consecutive >= 7) {
      // Force one day off in the middle
      const midDay = d + 3;
      staffRoster[midDay] = 'OFF';
    }
  }
}

/**
 * Calculate AI Quality Score (0-100)
 */
function calculateAIScore(roster, staff, shiftTypesMap, config, daysInMonth) {
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
      if (shift && shift !== 'OFF') {
        dayCoverage[shift] = (dayCoverage[shift] || 0) + 1;
      }
    }
    if ((dayCoverage['M'] || 0) < config.required_M_coverage) score -= 1;
    if ((dayCoverage['E'] || 0) < config.required_E_coverage) score -= 1;
    if ((dayCoverage['N8'] || 0) < config.required_N8_coverage) score -= 1;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateSummary(roster, staff, shiftTypesMap, config, daysInMonth) {
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
      if (shift && shift !== 'OFF') {
        dayCoverage[shift] = (dayCoverage[shift] || 0) + 1;
      }
    }
    if ((dayCoverage['M'] || 0) < config.required_M_coverage) coverageShortages++;
    if ((dayCoverage['E'] || 0) < config.required_E_coverage) coverageShortages++;
    if ((dayCoverage['N8'] || 0) < config.required_N8_coverage) coverageShortages++;
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
