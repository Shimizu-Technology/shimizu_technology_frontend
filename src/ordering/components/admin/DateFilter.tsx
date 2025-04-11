import React from 'react';
import { MobileSelect } from '../../../shared/components/ui/MobileSelect';

export type DateFilterOption = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'custom';

interface DateFilterProps {
  selectedOption: DateFilterOption;
  onOptionChange: (option: DateFilterOption) => void;
  startDate?: Date;
  endDate?: Date;
  onDateRangeChange?: (startDate: Date, endDate: Date) => void;
  className?: string;
}

export function DateFilter({ 
  selectedOption, 
  onOptionChange, 
  startDate, 
  endDate, 
  onDateRangeChange,
  className
}: DateFilterProps) {
  const dateOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'thisWeek', label: 'This Week' },
    { value: 'lastWeek', label: 'Last Week' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const handleDateOptionChange = (value: string) => {
    onOptionChange(value as DateFilterOption);
  };

  // Custom date range picker (only shown when 'custom' is selected)
  const renderCustomDatePicker = () => {
    if (selectedOption !== 'custom') return null;

    return (
      <div className="mt-2 flex space-x-2">
        <input
          type="date"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm h-12 shadow-sm"
          value={startDate ? formatDateForInput(startDate) : ''}
          onChange={(e) => {
            // When parsing a date string without time, it's interpreted in local timezone
            // Add the Guam timezone offset to ensure correct interpretation
            const dateStr = e.target.value ? `${e.target.value}T00:00:00+10:00` : new Date().toISOString();
            const newStartDate = new Date(dateStr);
            if (onDateRangeChange && endDate) {
              onDateRangeChange(newStartDate, endDate);
            }
          }}
        />
        <span className="self-center text-gray-500">to</span>
        <input
          type="date"
          className="px-3 py-2 border border-gray-300 rounded-md text-sm h-12 shadow-sm"
          value={endDate ? formatDateForInput(endDate) : ''}
          onChange={(e) => {
            // When parsing a date string without time, it's interpreted in local timezone
            // Add the Guam timezone offset to ensure correct interpretation
            const dateStr = e.target.value ? `${e.target.value}T23:59:59+10:00` : new Date().toISOString();
            const newEndDate = new Date(dateStr);
            if (onDateRangeChange && startDate) {
              onDateRangeChange(startDate, newEndDate);
            }
          }}
        />
      </div>
    );
  };

  // Helper to format date for input element - using Guam timezone (UTC+10)
  const formatDateForInput = (date: Date): string => {
    // First convert the date to Guam timezone
    const dateInGuam = new Date(date.toLocaleString('en-US', { timeZone: 'Pacific/Guam' }));
    
    // Format as YYYY-MM-DD directly
    const year = dateInGuam.getFullYear();
    const month = String(dateInGuam.getMonth() + 1).padStart(2, '0');
    const day = String(dateInGuam.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  };

  return (
    <div>
      <MobileSelect
        options={dateOptions}
        value={selectedOption}
        onChange={handleDateOptionChange}
        placeholder="Select date range"
        className={className}
      />
      {renderCustomDatePicker()}
    </div>
  );
}
