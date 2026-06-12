import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { getMonthName } from '../utils/storage';

/**
 * MonthSelector — lets user navigate between months directly on any page.
 * Props:
 *   value      – current YYYY-MM string
 *   onChange   – callback(newYearMonth)
 */
export default function MonthSelector({ value, onChange }) {
  const inputRef = useRef(null);

  if (!value) return null;

  const handleOpenPicker = () => {
    if (inputRef.current && typeof inputRef.current.showPicker === 'function') {
      inputRef.current.showPicker();
    }
  };

  const shift = (delta) => {
    const [y, m] = value.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newVal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    onChange(newVal);
  };

  return (
    <div className="month-selector">
      <button
        className="month-selector-btn"
        onClick={() => shift(-1)}
        title="เดือนก่อนหน้า"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="month-selector-label" onClick={handleOpenPicker} style={{ cursor: 'pointer' }}>
        <input
          ref={inputRef}
          type="month"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="month-selector-input-hidden"
        />
        <div className="month-selector-display-btn">
          <Calendar size={16} />
          <span>{getMonthName(value)}</span>
        </div>
      </div>

      <button
        className="month-selector-btn"
        onClick={() => shift(1)}
        title="เดือนถัดไป"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
