// src/shared/components/ui/SettingsHeader.tsx

import React, { ReactNode } from 'react';

interface SettingsHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export function SettingsHeader({ title, description, icon }: SettingsHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
        {icon && <span className="mr-2 text-[#c1902f]">{icon}</span>}
        {title}
      </h2>
      {description && (
        <p className="text-sm text-gray-600 ml-0">{description}</p>
      )}
    </div>
  );
}
