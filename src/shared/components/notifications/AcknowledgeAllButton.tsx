import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { triggerHapticFeedback } from '../../utils/deviceUtils';
import './AcknowledgeAllButton.css';

interface AcknowledgeAllButtonProps {
  count: number;
  isLoading: boolean;
  onClick: () => void;
  type?: 'order' | 'stock' | 'all';
  className?: string;
  showSuccess?: boolean;
}

const AcknowledgeAllButton: React.FC<AcknowledgeAllButtonProps> = ({
  count,
  isLoading,
  onClick,
  type = 'all',
  className = '',
  showSuccess = false
}) => {
  // Don't render if there's nothing to acknowledge
  if (count === 0) return null;
  
  const getLabel = () => {
    if (isLoading) return 'Acknowledging...';
    if (count === 1) return 'Acknowledge Notification';
    return `Acknowledge All (${count})`;
  };
  
  const handleClick = () => {
    triggerHapticFeedback();
    onClick();
  };
  
  const buttonClasses = [
    'fixed-acknowledge-button',
    showSuccess ? 'success' : '',
    className
  ].filter(Boolean).join(' ');
  
  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={buttonClasses}
      aria-label={getLabel()}
    >
      {isLoading ? (
        <Loader2 className="icon animate-spin" />
      ) : (
        <CheckCircle className="icon" />
      )}
      <span>{getLabel()}</span>
    </button>
  );
};

export default AcknowledgeAllButton;
