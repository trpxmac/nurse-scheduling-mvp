/* =============================================
   AI Roster Generator
   Generates schedule based on Config constraints
   ============================================= */

import { getShiftHours, detectQuickReturns, buildShiftTypesMap, calcWeeklyHours } from './scheduling';

export function isSenior(staff) {
  const lvl = staff.level || staff.position;
  return ['HOD', 'RN2', 'RN3', 'RN4', 'RN5'].includes(lvl);
}

export function meetsRequiredLevel(staff, reqLevel) {
  if (!reqLevel) return true;
  const LEVEL_RANK = {
    'HOD': 6,
    'RN5': 5,
    'RN4': 4,
    'RN3': 3,
    'RN2': 2,
    'RN1': 1,
    'PN': 0,
    'PA': 0,
    'NA': 0,
    '-': 0
  };
  const staffLvl = staff.level || '-';
  const staffRank = LEVEL_RANK[staffLvl] || 0;
  const reqRank = LEVEL_RANK[reqLevel] || 0;
  return staffRank >= reqRank;
}

/**
 * Check if the current constraints are mathematically feasible
 * Returns an array of warning objects
 */
export function checkFeasibility(staffList, shiftTypes, config, lockedSlots = {}) {
  const warnings = [];
  const activeStaff = staffList.filter(s => s.active);
  const activeShifts = shiftTypes.filter(s => s.active && s.code !== '-');
  
  if (activeStaff.length === 0 || activeShifts.length === 0) return warnings;

  const [year, month] = (config.month || '2026-01').split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 1. Calculate required staff per day based on coverage
  let minStaffPerDay = 0;
  for (const shift of activeShifts) {
    minStaffPerDay += Number(config[`required_${shift.code}_coverage`]) || 0;
  }

  // 2. Calculate average shift hours
  let workShifts = activeShifts.filter(s => s.hours > 0);
  if (config.shift_mode === '8HR') workShifts = workShifts.filter(s => s.hours === 8);
  else if (config.shift_mode === '12HR') workShifts = workShifts.filter(s => s.hours === 12);
  if (workShifts.length === 0) workShifts = activeShifts.filter(s => s.hours > 0);

  const avgShiftHours = workShifts.length > 0 
    ? workShifts.reduce((sum, s) => sum + s.hours, 0) / workShifts.length 
    : 12;

  // 3. Calculate max working days per staff based on consecutive workday constraints
  const maxConsecutive = Number(config.max_consecutive_workdays) || 3;
  // If you work maxConsecutive days, you must take at least 1 day off.
  // Over daysInMonth, max days worked = (maxConsecutive / (maxConsecutive + 1)) * daysInMonth
  const maxWorkDaysPerStaff = Math.floor((maxConsecutive / (maxConsecutive + 1)) * daysInMonth);
  
  // Total possible working days across all staff
  let totalAvailableStaffDays = activeStaff.length * maxWorkDaysPerStaff;

  // Subtract locked leaves (very rough estimate)
  let totalLeaveDays = 0;
  for (const staffId in lockedSlots) {
    for (const day in lockedSlots[staffId]) {
      const shiftCode = lockedSlots[staffId][day];
      const st = activeShifts.find(s => s.code === shiftCode);
      if (st && st.category === 'LEAVE') {
        totalLeaveDays++;
      }
    }
  }
  
  totalAvailableStaffDays -= totalLeaveDays;
  const requiredStaffDays = minStaffPerDay * daysInMonth;

  if (totalAvailableStaffDays < requiredStaffDays) {
    const neededStaff = Math.ceil(requiredStaffDays / maxWorkDaysPerStaff);
    warnings.push({
      type: 'coverage',
      message: `บุคลากร ${activeStaff.length} คน อาจไม่พอสำหรับ Coverage ขั้นต่ำ ${minStaffPerDay} คน/วัน`,
      details: `ข้อจำกัด "ทำงานสูงสุด ${maxConsecutive} วันติด" ทำให้ต้องการบุคลากรประมาณ ${neededStaff} คน เพื่อไม่ให้ผิดกฎ`
    });
  }

  // 4. Calculate hours feasibility
  const targetWorkHours = Number(config.roster_hours) || 160;
  const maxPossibleHours = maxWorkDaysPerStaff * avgShiftHours;

  if (targetWorkHours > maxPossibleHours) {
    const requiredWorkDays = Math.ceil(targetWorkHours / avgShiftHours);
    warnings.push({
      type: 'hours',
      message: `เป้าหมายชั่วโมงเวร ${targetWorkHours} ชม. อาจทำไม่ได้จริงตามกฎ`,
      details: `เป้า ${targetWorkHours} ชม. ต้องทำประมาณ ${requiredWorkDays} เวร แต่กฎ "ทำงานสูงสุด ${maxConsecutive} วันติด" ยอมให้ทำได้สูงสุดแค่ ~${Math.floor(maxPossibleHours)} ชม. ต่อคน`
    });
  }

  return warnings;
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

  // Sort workShifts by hours descending, then by coverage requirement descending.
  // This ensures that the staff with the lowest current hours are evaluated for 12-hour shifts FIRST,
  // allowing them to catch up. Otherwise, they get assigned 8-hour shifts first and stay permanently behind.
  workShifts.sort((a, b) => {
    if (b.hours !== a.hours) return b.hours - a.hours;
    const reqA = config[`required_${a.code}_coverage`] || 0;
    const reqB = config[`required_${b.code}_coverage`] || 0;
    return reqB - reqA;
  });

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

    // Pre-fill fixed days off (0 = Sun, 1 = Mon, etc.)
    if (staff.fixed_days_off && staff.fixed_days_off.length > 0) {
      for (let day = 1; day <= daysInMonth; day++) {
        // Date object months are 0-indexed
        const date = new Date(year, month - 1, day);
        if (staff.fixed_days_off.includes(date.getDay()) && !roster[staff.id][day]) {
           roster[staff.id][day] = '-';
        }
      }
    }

  }

  // Pre-fill Holiday (H) shifts if holiday_hours are defined
  // (TEMPORARILY DISABLED AS PER USER REQUEST)
  /*
  const hasHolidayShift = shiftTypesMap['H'] && shiftTypesMap['H'].active;
  const holidayHours = Number(config.holiday_hours) || 0;
  const numHolidayShifts = Math.floor(holidayHours / (shiftTypesMap['H']?.hours || 8));

  if (hasHolidayShift && numHolidayShifts > 0) {
    for (const staff of activeStaff) {
      let hCount = Object.values(roster[staff.id]).filter(v => v === 'H').length;
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
  */

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
    // IMPORTANT: Phase 1 already assigns ~11 staff per day for coverage.
    // Phase 2 should ONLY add extra shifts for staff who are significantly behind.
    // Being too aggressive here causes consecutive-workday violations → fewer staff
    // available for Phase 1 on future days → coverage shortages.
    staffPool.sort((a, b) => {
      return calcCurrentHours(roster[a.id], shiftTypesMap) - calcCurrentHours(roster[b.id], shiftTypesMap);
    });

    const targetWorkHours = Number(config.roster_hours) || 160;
    const remainingDays = daysInMonth - day + 1;

    // Calculate average hours across all staff for comparison
    let totalHoursAll = 0;
    for (const s of activeStaff) {
      totalHoursAll += calcCurrentHours(roster[s.id], shiftTypesMap);
    }
    const avgHoursAll = activeStaff.length > 0 ? totalHoursAll / activeStaff.length : 0;

    const workingShifts = workShifts.filter(s => s.code !== '-');
    let avgShiftHours = workingShifts.length > 0 
      ? workingShifts.reduce((acc, s) => acc + (s.hours || 0), 0) / workingShifts.length 
      : 12;
    if (avgShiftHours === 0) avgShiftHours = 12;

    // Dynamic Extra Assignment Limit
    // Calculate how many shifts we need per day ON AVERAGE to reach targetWorkHours
    const totalRemainingHours = Math.max(0, (targetWorkHours * activeStaff.length) - totalHoursAll);
    const shiftsNeededPerDay = remainingDays > 0 ? (totalRemainingHours / avgShiftHours) / remainingDays : 0;
    const minStaffPerDay = workShifts.reduce((acc, s) => acc + (Number(config[`required_${s.code}_coverage`]) || 0), 0);
    
    let maxExtraPerDay = 2; // Default conservative limit
    if (shiftsNeededPerDay > minStaffPerDay) {
      // We need more shifts than Phase 1 assigns, so increase the extra allowance
      maxExtraPerDay = Math.max(2, Math.ceil(shiftsNeededPerDay - minStaffPerDay + 1));
      // Cap at 60% of staff to avoid blowing through all staff and causing consecutive-workday shortages tomorrow
      maxExtraPerDay = Math.min(maxExtraPerDay, Math.floor(activeStaff.length * 0.6));
    }

    let extraAssigned = 0;

    for (const staff of staffPool) {
      const currentHours = calcCurrentHours(roster[staff.id], shiftTypesMap);

      // Already at or above target — rest
      if (currentHours >= targetWorkHours) {
        roster[staff.id][day] = '-';
        continue;
      }

      // Only assign extra shifts if staff needs at least ~half a shift to reach target
      const hoursNeeded = targetWorkHours - currentHours;
      const shouldWork = hoursNeeded >= (avgShiftHours * 0.4) && extraAssigned < maxExtraPerDay;

      if (!shouldWork) {
        roster[staff.id][day] = '-';
        continue;
      }

      // Find a suitable shift — prefer shifts with lowest coverage ratio
      const availableShifts = workShifts.filter(s => s.code !== '-' && Number(config[`required_${s.code}_coverage`]) > 0);
      if (availableShifts.length > 0) {
        availableShifts.sort((a, b) => {
          const reqA = Number(config[`required_${a.code}_coverage`]) || 1;
          const reqB = Number(config[`required_${b.code}_coverage`]) || 1;
          const ratioA = (dayCoverage[a.code] || 0) / reqA;
          const ratioB = (dayCoverage[b.code] || 0) / reqB;
          if (ratioA !== ratioB) return ratioA - ratioB;
          const aStaffCount = Object.values(roster[staff.id]).filter(v => v === a.code).length;
          const bStaffCount = Object.values(roster[staff.id]).filter(v => v === b.code).length;
          return aStaffCount - bStaffCount;
        });
        
        let assigned = false;
        for (const chosen of availableShifts) {
          const assignedStaffThisShift = activeStaff.filter(s => dayAssignments[s.id] === chosen.code);
          if (isAssignmentValid(roster, staff, day, chosen.code, shiftTypesMap, config, assignedStaffThisShift)) {
            roster[staff.id][day] = chosen.code;
            dayAssignments[staff.id] = chosen.code;
            dayCoverage[chosen.code] = (dayCoverage[chosen.code] || 0) + 1;
            assigned = true;
            extraAssigned++;
            break;
          }
        }
        
        if (!assigned) {
          roster[staff.id][day] = '-';
        }
      } else {
        roster[staff.id][day] = '-';
      }
    }
  }



  // Calculate score (returns { total, legal, safety, quality, breakdown })
  const scoreResult = calculateAIScore(roster, activeStaff, shiftTypesMap, config, daysInMonth, workShifts);
  const summary = generateSummary(roster, activeStaff, shiftTypesMap, config, daysInMonth, workShifts);

  return { roster, score: scoreResult.total, scoreBreakdown: scoreResult, summary };
}

/**
 * Find the best staff member for a given shift on a day
 */
function findBestStaff(pool, roster, shiftCode, day, shiftTypesMap, config, daysInMonth, assignedStaffThisShift = []) {
  let bestIdx = -1;
  let bestScore = -Infinity;
  const hasSenior = assignedStaffThisShift.some(isSenior);
  const reqLevel = config.required_level_every_shift;
  const hasRequiredLevel = reqLevel ? assignedStaffThisShift.some(s => meetsRequiredLevel(s, reqLevel)) : true;

  // Calculate average hours across ALL staff for catch-up bonus
  const allStaffIds = Object.keys(roster);
  const allHours = allStaffIds.map(id => calcCurrentHours(roster[id], shiftTypesMap));
  const avgHours = allHours.length > 0 ? allHours.reduce((a, b) => a + b, 0) / allHours.length : 0;

  for (let i = 0; i < pool.length; i++) {
    const staff = pool[i];

    // Check if assignment is valid
    // Pass the required level down to check validation constraints if necessary
    if (!isAssignmentValid(roster, staff, day, shiftCode, shiftTypesMap, config, assignedStaffThisShift)) {
      continue;
    }

    // Score: prefer staff with fewer hours heavily to balance OT
    const currentHours = calcCurrentHours(roster[staff.id], shiftTypesMap);
    let score = 10000 - (currentHours * 10);

    // Catch-up bonus: strongly boost staff who are significantly behind the average
    // This ensures staff limited in shift types (e.g. can't do nights) still get enough shifts
    const deficit = avgHours - currentHours;
    if (deficit > 0) {
      score += deficit * 50;
    }

    // Boost score if staff has had several consecutive days off
    let consecutiveOff = 0;
    for (let d = day - 1; d >= 1; d--) {
      const prev = roster[staff.id][d];
      if (!prev || prev === '-' || prev === 'x' || prev === 'AL' || prev === 'SL' || prev === 'H') {
        consecutiveOff++;
      } else {
        break;
      }
    }
    // Boost heavily for 2+ days off, but mildly for 1 day off
    score += consecutiveOff * 2500;

    // Boost if shift has a min limit and staff hasn't reached it
    if (staff.shift_limits && staff.shift_limits[shiftCode]) {
      const limit = staff.shift_limits[shiftCode];
      if (limit.min !== undefined && limit.min !== '') {
        const minShifts = Number(limit.min);
        const currentShifts = Object.values(roster[staff.id]).filter(v => v === shiftCode).length;
        if (currentShifts < minShifts) {
          score += 15000;
        }
      }
    }

    // Penalize if the staff already has this specific shift (diversify shift types)
    // Cap at 3000 so staff limited to few shift types don't get permanently blocked
    const currentShiftCount = Object.values(roster[staff.id]).filter(v => v === shiftCode).length;
    score -= Math.min(currentShiftCount * 500, 3000);

    // Rule: Prioritize required level if the shift doesn't have one yet
    if (reqLevel && !hasRequiredLevel && meetsRequiredLevel(staff, reqLevel)) {
      score += 8000;
    }

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
    if (prevShift && prevShift !== '-' && prevShift.toLowerCase() !== 'x') {
      const prevType = shiftTypesMap[prevShift];
      const currType = shiftTypesMap[shiftCode];
      if (prevType && currType) {
        if (prevType.start && prevType.end && currType.start && currType.end) {
          const restHours = calcRestHours(prevType, currType);
          if (restHours < config.min_rest_hours) return false;
        }
      }
    }
  }

  // Check if next day assignment would be violated
  const nextShift = staffRoster[day + 1];
  if (nextShift && nextShift !== '-' && nextShift.toLowerCase() !== 'x') {
    const currType = shiftTypesMap[shiftCode];
    const nextType = shiftTypesMap[nextShift];
    if (currType && nextType) {
      if (currType.start && currType.end && nextType.start && nextType.end) {
        const restHours = calcRestHours(currType, nextType);
        if (restHours < config.min_rest_hours) return false;
      }
    }
  }

  // Check consecutive workdays
  if (config.max_consecutive_workdays) {
    let streak = 0;
    for (let d = day - 1; d >= 1; d--) {
      const prev = staffRoster[d];
      if (prev && prev !== '-' && prev.toLowerCase() !== 'x') {
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

  // Check consecutive nights & max night shifts
  const st = shiftTypesMap[shiftCode];
  if (st && st.category === 'NIGHT') {
    if (config.max_consecutive_nights) {
      let streak = 0;
      for (let d = day - 1; d >= 1; d--) {
        const prev = staffRoster[d];
        if (prev && prev !== '-' && prev.toLowerCase() !== 'x') {
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

  // Check max shifts per month for this specific shift type
  if (staff.shift_limits && staff.shift_limits[shiftCode]) {
    const limit = staff.shift_limits[shiftCode];
    if (limit.max !== undefined && limit.max !== '') {
      const maxShifts = Number(limit.max);
      const currentShifts = Object.values(staffRoster).filter(v => v === shiftCode).length;
      if (currentShifts >= maxShifts) return false;
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

  // Check required level every shift constraint
  if (config.required_level_every_shift) {
    const reqLevel = config.required_level_every_shift;
    const requiredCount = config[`required_${shiftCode}_coverage`] || 0;
    
    if (requiredCount > 0) {
      const hasQualified = assignedStaffThisShift.some(s => meetsRequiredLevel(s, reqLevel));
      const currentMeets = meetsRequiredLevel(staff, reqLevel);
      
      if (!hasQualified && !currentMeets) {
        if (assignedStaffThisShift.length + 1 >= requiredCount) {
          return false;
        }
      }
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
  return rest / 60;
}

function calcCurrentHours(staffRoster, shiftTypesMap) {
  let total = 0;
  for (const day of Object.keys(staffRoster)) {
    total += getShiftHours(staffRoster[day], shiftTypesMap);
  }
  return total;
}


/**
 * Calculate AI Quality Score (0-100) with 3-tier breakdown
 * 🔴 Legal (40%): Quick Returns, Weekly Hours, Daily Hours violations
 * 🟠 Safety (35%): Coverage, Consecutive Nights, Consecutive Workdays
 * 🟢 Quality (25%): Hour distribution evenness, shift diversity
 *
 * Returns { total, legal, safety, quality, breakdown }
 */
function calculateAIScore(roster, staff, shiftTypesMap, config, daysInMonth, workShifts) {
  const yearMonth = config.month;

  // ═══════ 🔴 TIER 1: Legal (40 points max) ═══════
  let legalScore = 100;
  let legalDetails = [];

  // Quick Returns
  let totalQR = 0;
  for (const s of staff) {
    const qr = detectQuickReturns(roster[s.id] || {}, shiftTypesMap, config.min_rest_hours, yearMonth);
    totalQR += qr.length;
  }
  if (totalQR > 0) {
    const qrPenalty = Math.min(50, totalQR * 10);
    legalScore -= qrPenalty;
    legalDetails.push({ rule: 'Quick Return (พักไม่ถึงขั้นต่ำ)', count: totalQR, penalty: qrPenalty });
  }

  // Weekly hours violations
  let weeklyViolations = 0;
  for (const s of staff) {
    const weeks = calcWeeklyHours(roster[s.id] || {}, shiftTypesMap, yearMonth);
    weeklyViolations += weeks.filter(w => w.hours > (config.max_weekly_hours || 52)).length;
  }
  if (weeklyViolations > 0) {
    const weekPenalty = Math.min(40, weeklyViolations * 8);
    legalScore -= weekPenalty;
    legalDetails.push({ rule: 'ชั่วโมง/สัปดาห์เกิน', count: weeklyViolations, penalty: weekPenalty });
  }

  // Daily hours violations
  let dailyViolations = 0;
  for (const s of staff) {
    const sr = roster[s.id] || {};
    for (const day of Object.keys(sr)) {
      const hours = getShiftHours(sr[day], shiftTypesMap);
      if (hours > (config.max_daily_hours || 12)) dailyViolations++;
    }
  }
  if (dailyViolations > 0) {
    const dailyPenalty = Math.min(30, dailyViolations * 10);
    legalScore -= dailyPenalty;
    legalDetails.push({ rule: 'ชั่วโมง/วันเกิน', count: dailyViolations, penalty: dailyPenalty });
  }

  legalScore = Math.max(0, legalScore);

  // ═══════ 🟠 TIER 2: Safety (35 points max) ═══════
  let safetyScore = 100;
  let safetyDetails = [];

  // Coverage shortages (percentage-based)
  let coverageShortages = 0;
  let totalCoverageSlots = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dayCoverage = {};
    for (const s of staff) {
      const shift = roster[s.id]?.[day];
      const isHod = s.level === 'HOD' || s.position === 'HOD';
      if (shift && shift !== '-' && shift.toLowerCase() !== 'x' && !isHod) {
        dayCoverage[shift] = (dayCoverage[shift] || 0) + 1;
      }
    }
    for (const shift of workShifts) {
      const required = config[`required_${shift.code}_coverage`] || 0;
      if (required > 0) {
        totalCoverageSlots++;
        if ((dayCoverage[shift.code] || 0) < required) coverageShortages++;
      }
    }
  }
  if (totalCoverageSlots > 0 && coverageShortages > 0) {
    const coverageRate = 1 - (coverageShortages / totalCoverageSlots);
    const coveragePenalty = Math.round((1 - coverageRate) * 60);
    safetyScore -= coveragePenalty;
    safetyDetails.push({
      rule: 'Coverage ไม่ครบ',
      count: coverageShortages,
      total: totalCoverageSlots,
      rate: Math.round(coverageRate * 100),
      penalty: coveragePenalty
    });
  }

  // Consecutive nights violations
  let nightViolations = 0;
  const maxNights = config.max_consecutive_nights || 3;
  for (const s of staff) {
    const sr = roster[s.id] || {};
    let streak = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const code = sr[d];
      const st = code ? shiftTypesMap[code] : null;
      if (st && st.category === 'NIGHT' && code !== '-' && code.toLowerCase() !== 'x') {
        streak++;
      } else {
        if (streak > maxNights) nightViolations++;
        streak = 0;
      }
    }
    if (streak > maxNights) nightViolations++;
  }
  if (nightViolations > 0) {
    const nightPenalty = Math.min(30, nightViolations * 10);
    safetyScore -= nightPenalty;
    safetyDetails.push({ rule: 'เวรดึกติดเกิน', count: nightViolations, penalty: nightPenalty });
  }

  // Consecutive workdays violations
  let workdayViolations = 0;
  const maxWorkdays = config.max_consecutive_workdays || 3;
  for (const s of staff) {
    const sr = roster[s.id] || {};
    let streak = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const code = sr[d];
      const st = code ? shiftTypesMap[code] : null;
      if (st && st.category !== 'OFF' && st.category !== 'LEAVE' && code !== '-' && code !== '' && code.toLowerCase() !== 'x') {
        streak++;
      } else {
        if (streak > maxWorkdays) workdayViolations++;
        streak = 0;
      }
    }
    if (streak > maxWorkdays) workdayViolations++;
  }
  if (workdayViolations > 0) {
    const workPenalty = Math.min(30, workdayViolations * 5);
    safetyScore -= workPenalty;
    safetyDetails.push({ rule: 'ทำงานติดเกิน', count: workdayViolations, penalty: workPenalty });
  }

  safetyScore = Math.max(0, safetyScore);

  // ═══════ 🟢 TIER 3: Quality (25 points max) ═══════
  let qualityScore = 100;
  let qualityDetails = [];

  // Hour distribution evenness
  const hoursList = staff.map(s => calcCurrentHours(roster[s.id] || {}, shiftTypesMap));
  if (hoursList.length > 1) {
    const avg = hoursList.reduce((a, b) => a + b, 0) / hoursList.length;
    const variance = hoursList.reduce((sum, h) => sum + Math.pow(h - avg, 2), 0) / hoursList.length;
    const stdDev = Math.sqrt(variance);
    const distPenalty = Math.min(40, Math.round(stdDev * 2));
    if (distPenalty > 0) {
      qualityScore -= distPenalty;
      qualityDetails.push({
        rule: 'ชั่วโมงไม่สมดุล',
        stdDev: Math.round(stdDev * 10) / 10,
        penalty: distPenalty
      });
    }
  }

  qualityScore = Math.max(0, qualityScore);

  // ═══════ Weighted Total ═══════
  const LEGAL_WEIGHT = 0.40;
  const SAFETY_WEIGHT = 0.35;
  const QUALITY_WEIGHT = 0.25;

  const total = Math.round(
    legalScore * LEGAL_WEIGHT +
    safetyScore * SAFETY_WEIGHT +
    qualityScore * QUALITY_WEIGHT
  );

  return {
    total: Math.max(0, Math.min(100, total)),
    legal: Math.round(legalScore),
    safety: Math.round(safetyScore),
    quality: Math.round(qualityScore),
    breakdown: {
      legal: { score: Math.round(legalScore), weight: LEGAL_WEIGHT, details: legalDetails },
      safety: { score: Math.round(safetyScore), weight: SAFETY_WEIGHT, details: safetyDetails },
      quality: { score: Math.round(qualityScore), weight: QUALITY_WEIGHT, details: qualityDetails },
    }
  };
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
      const isHod = s.level === 'HOD' || s.position === 'HOD';
      if (shift && shift !== '-' && !isHod) {
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
