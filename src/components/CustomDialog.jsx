import Modal from './Modal';
import { AlertCircle, HelpCircle, CheckCircle, Info } from 'lucide-react';

export default function CustomDialog({ 
  isOpen, 
  onClose, 
  type = 'CONFIRM', // 'CONFIRM', 'ALERT', 'PROMPT'
  title, 
  message, 
  value = '', 
  onChange = () => {},
  onConfirm,
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
  danger = false
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (type === 'PROMPT') {
      onConfirm(value);
    } else {
      onConfirm();
    }
  };

  const getIcon = () => {
    if (type === 'ALERT') return <AlertCircle size={24} style={{ color: 'var(--color-warning)' }} />;
    if (danger) return <AlertCircle size={24} style={{ color: 'var(--color-danger)' }} />;
    if (type === 'PROMPT') return <Info size={24} style={{ color: 'var(--color-primary)' }} />;
    return <HelpCircle size={24} style={{ color: 'var(--color-primary)' }} />;
  };

  const footer = (
    <div className="flex justify-end gap-sm w-full">
      {type !== 'ALERT' && (
        <button className="btn btn-ghost" onClick={onClose}>{cancelText}</button>
      )}
      <button 
        className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} 
        onClick={handleConfirm}
      >
        {confirmText}
      </button>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={<div className="flex items-center gap-sm">{getIcon()} {title}</div>} footer={footer}>
      <div style={{ padding: '8px 0' }}>
        {message && <p className="text-muted" style={{ marginBottom: type === 'PROMPT' ? '16px' : '0', whiteSpace: 'pre-line' }}>{message}</p>}
        {type === 'PROMPT' && (
          <input
            className="form-input"
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            autoFocus
            style={{ marginTop: 8 }}
          />
        )}
      </div>
    </Modal>
  );
}
