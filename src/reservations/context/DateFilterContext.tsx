// src/context/DateFilterContext.tsx
import React, { createContext, useContext, useState } from 'react';

/** The shape of our context’s data. */
interface DateFilterContextValue {
  date: string;
  setDate: (newDate: string) => void;
}

/**
 * Create the actual context object.
 */
const DateFilterContext = createContext<DateFilterContextValue | undefined>(undefined);

/**
 * Provide the “date” to any components beneath this provider.
 */
export function DateFilterProvider({ children }: { children: React.ReactNode }) {
  // Single source of truth for the date. Initialize to “today in Guam.”
  const [date, setDate] = useState<string>(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Guam' })
  );

  return (
    <DateFilterContext.Provider value={{ date, setDate }}>
      {children}
    </DateFilterContext.Provider>
  );
}

/**
 * Hook to read/update the shared date anywhere in the app.
 * Must be called from a child of <DateFilterProvider>.
 */
export function useDateFilter() {
  const ctx = useContext(DateFilterContext);
  if (!ctx) {
    throw new Error('useDateFilter must be used within a <DateFilterProvider>.');
  }
  return ctx;
}
