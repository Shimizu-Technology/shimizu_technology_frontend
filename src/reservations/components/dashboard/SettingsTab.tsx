// src/components/dashboard/SettingsTab.tsx

import React from 'react';
import AdminSettings from '../AdminSettings';

export default function SettingsTab() {
  return (
    <div className="bg-white shadow rounded-md">
      {/* Subtle gold top bar with heading */}
      <div className="border-b border-gray-200 bg-hafaloha-gold/5 rounded-t-md px-4 py-3">
      </div>

      {/* Main content */}
      <div className="p-4">
        <AdminSettings />
      </div>
    </div>
  );
}
