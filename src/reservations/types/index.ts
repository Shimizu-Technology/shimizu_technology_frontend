//
// 1) StaffMember — used in StaffBanner
//
export interface StaffMember {
  name: string;
  role: string;
  image: string;
}

//
// 2) Reservation — front-end type, used in StaffDashboard and modals
//
export interface Reservation {
  id: number;

  // For date/time, your code references either:
  //   - start_time (like "2025-01-14T18:00:00Z")
  //   - date, time
  // so we make them optional and let your UI handle whichever is present.
  start_time?: string;  // actual UTC or local datetime
  date?: string;        // e.g. "2025-01-14"
  time?: string;        // e.g. "18:00"

  // Party size, name, contact, status, etc.
  partySize?: number;   // sometimes 'party_size' on the backend
  name?: string;        // or 'contact_name'
  phone?: string;       // or 'contact_phone'
  email?: string;       // or 'contact_email'
  status?: string;      // "booked", "reserved", "seated", "finished", "canceled", "no_show", etc.

  // If you need restaurant_id, special_requests, etc., add them:
  restaurant_id?: number;
  special_requests?: string;

  // NEW: Duration in minutes (e.g. 60, 120, etc.)
  duration_minutes?: number;

  // NEW: If your frontend or backend is storing seat preferences or seat labels
  seat_preferences?: string[][];    // an array of arrays, e.g. [["A1","A2"], ["B1","B2"], ...]
  seat_labels?: string[];           // current seat assignment labels
}

//
// 3) WaitlistEntry — used in StaffDashboard (Waitlist tab)
//
export interface WaitlistEntry {
  id: number;
  name?: string;    // or 'contact_name'
  phone?: string;   // or 'contact_phone'
  partySize?: number;
  check_in_time?: string; // e.g. "2025-01-15T10:00:00Z"
  joinedAt?: string;      // If you store an alternate time field
  status?: string;        // "waiting", "seated", "removed", etc.
}

//
// 4) SeatSection — includes offset coords & seats
//
export interface SeatSection {
  id: string;
  name: string;
  type: 'counter' | 'table';
  orientation: 'vertical' | 'horizontal';
  offsetX: number;
  offsetY: number;
  seats: {
    id: string;
    number: number;
    position: {
      x: number;
      y: number;
    };
    isOccupied: boolean;
  }[];
}
