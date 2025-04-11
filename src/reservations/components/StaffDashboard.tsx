// src/reservations/components/StaffDashboard.tsx
import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

/**
 * StaffDashboard
 * A simple container with brand-colored NavTabs for sub-routes.
 */
export default function StaffDashboard() {
  const location = useLocation();

  return (
    <div className="bg-white min-h-screen">
      {/* Nav Tabs */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div
          className="
            bg-hafaloha-gold/5
            rounded-md
            shadow
            p-3
            flex
            items-center
            space-x-2
            overflow-x-auto
          "
        >
          <NavTab to="reservations" label="Reservations" currentPath={location.pathname} />
          <NavTab to="waitlist"     label="Waitlist"     currentPath={location.pathname} />
          <NavTab to="seating"      label="Seating"      currentPath={location.pathname} />
          <NavTab to="layout"       label="Layout"       currentPath={location.pathname} />
          <NavTab to="settings"     label="Settings"     currentPath={location.pathname} />
        </div>
      </div>

      {/* Child routes */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}

/**
 * NavTab
 * Highlights the active tab in Hafaloha brand style.
 */
function NavTab({
  to,
  label,
  currentPath,
}: {
  to: string;
  label: string;
  currentPath: string;
}) {
  // Because our parent route is "/reservations/dashboard",
  // the final path is "/reservations/dashboard/<to>"
  // We'll consider the tab "active" if our path ends with that <to>.
  // Or you can do a more robust check with useMatch().
  const isActive = currentPath.includes(`/dashboard/${to}`);

  // Active => gold background, white text
  // Inactive => lightly tinted background, gold text hover
  return (
    <Link
      to={to}
      className={`
        px-4 py-2
        rounded-md
        text-sm font-medium
        transition-colors
        ${
          isActive
            ? 'bg-hafaloha-gold text-white shadow'
            : 'bg-hafaloha-gold/10 text-hafaloha-gold hover:bg-hafaloha-gold/20'
        }
      `}
    >
      {label}
    </Link>
  );
}
