import React from 'react';

interface StatusTimerProps {
  createdAt: string;
  statusUpdatedAt?: string;
  status: string;
  className?: string;
}

export function StatusTimer({ createdAt, statusUpdatedAt, status, className = '' }: StatusTimerProps) {
  // Calculate time elapsed since status change or creation
  const getElapsedTime = (): { value: number; unit: string } => {
    const now = new Date();
    const statusDate = statusUpdatedAt 
      ? new Date(statusUpdatedAt) 
      : new Date(createdAt);
    
    const diffMs = now.getTime() - statusDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return { value: diffHours, unit: 'h' };
    } else {
      return { value: diffMins || 1, unit: 'm' }; // Minimum 1 minute
    }
  };
  
  // Get color based on status and elapsed time
  const getTimerColor = (): string => {
    const { value, unit } = getElapsedTime();
    
    // Different thresholds based on status
    if (status === 'pending') {
      if ((unit === 'h' && value >= 1) || (unit === 'm' && value >= 30)) {
        return 'text-red-600'; // Urgent
      } else if (unit === 'm' && value >= 15) {
        return 'text-yellow-600'; // Warning
      }
    } else if (status === 'preparing') {
      if ((unit === 'h' && value >= 1) || (unit === 'm' && value >= 45)) {
        return 'text-red-600'; // Urgent
      } else if (unit === 'm' && value >= 20) {
        return 'text-yellow-600'; // Warning
      }
    }
    
    return 'text-gray-500'; // Default
  };
  
  const { value, unit } = getElapsedTime();
  const color = getTimerColor();
  
  return (
    <div className={`flex items-center ${color} ${className}`}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className="h-4 w-4 mr-1" 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
        />
      </svg>
      <span className="text-xs font-medium">
        {value}{unit} in {status}
      </span>
    </div>
  );
}
