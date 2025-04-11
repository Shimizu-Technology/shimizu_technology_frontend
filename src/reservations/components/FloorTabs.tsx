// src/components/FloorTabs.tsx

import React, { useState } from 'react';
import SeatLayoutCanvas, { SeatSectionData, DBSeat } from './SeatLayoutCanvas';

interface FloorTabsProps {
  allSections: SeatSectionData[];
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  showGrid?: boolean;
  onSeatClick?: (seat: DBSeat, section: SeatSectionData) => void;
  onSectionDrag?: (sectionId: number | string, dx: number, dy: number) => void;
  getFloorNumber: (section: SeatSectionData) => number;
}

export default function FloorTabs({
  allSections,
  canvasWidth,
  canvasHeight,
  zoom,
  showGrid = true,
  onSeatClick,
  onSectionDrag,
  getFloorNumber,
}: FloorTabsProps) {
  // gather unique floors
  const floorNumbers = Array.from(
    new Set(allSections.map(sec => getFloorNumber(sec)))
  ).sort((a, b) => a - b);

  const [activeFloor, setActiveFloor] = useState(floorNumbers[0] || 1);

  const sectionsForActiveFloor = allSections.filter(
    sec => getFloorNumber(sec) === activeFloor
  );

  return (
    <div>
      {/* Tab Buttons */}
      <div className="flex space-x-2 mb-4">
        {floorNumbers.map(floorNum => {
          const isActive = floorNum === activeFloor;
          return (
            <button
              key={floorNum}
              onClick={() => setActiveFloor(floorNum)}
              className={`
                px-4 py-2 rounded transition-colors
                ${isActive
                  ? 'bg-hafaloha-gold/10 text-hafaloha-gold border border-hafaloha-gold/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-hafaloha-gold/5'
                }
              `}
            >
              Floor {floorNum}
            </button>
          );
        })}
      </div>

      {/* Render seat layout for the active floor */}
      <SeatLayoutCanvas
        width={canvasWidth}
        height={canvasHeight}
        zoom={zoom}
        showGrid={showGrid}
        sections={sectionsForActiveFloor}
        onSeatClick={onSeatClick}
        onSectionDrag={onSectionDrag}
      />
    </div>
  );
}
