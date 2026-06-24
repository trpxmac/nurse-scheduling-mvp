import { generateAIRoster } from './utils/aiRoster.js';
import { MOCK_STAFF, DEFAULT_SHIFT_TYPES, DEFAULT_CONFIG } from './utils/storage.js';

const config = { ...DEFAULT_CONFIG, shift_mode: 'MIXED', roster_hours: 200 };
config.required_M_coverage = 1;
config.required_E_coverage = 0;
config.required_N8_coverage = 0;
config.required_D_coverage = 5;
config.required_N12_coverage = 5;

const res = generateAIRoster(MOCK_STAFF, DEFAULT_SHIFT_TYPES, config, {});
console.log("Roster for S01:", JSON.stringify(res.roster['S01']));
console.log("Summary:", res.summary);
