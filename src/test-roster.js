import { generateAIRoster } from './utils/aiRoster.js';
import { MOCK_STAFF, DEFAULT_SHIFT_TYPES, DEFAULT_CONFIG } from './utils/storage.js';

const config = { ...DEFAULT_CONFIG, shift_mode: '12HR', roster_hours: 160 };
const res = generateAIRoster(MOCK_STAFF, DEFAULT_SHIFT_TYPES, config, {});
console.log(JSON.stringify(res.roster['S01']));
