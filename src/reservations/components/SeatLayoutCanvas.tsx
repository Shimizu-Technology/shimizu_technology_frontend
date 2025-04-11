import React, { useState } from 'react';

export interface DBSeat {
  id: number;
  label: string;
  position_x: number;
  position_y: number;
  capacity?: number;
  occupant_status?: string;  // "free","reserved","occupied","seated", etc.
  occupant_name?: string;    // e.g. "John" or "John Smith"
  isSelected?: boolean;      // wizard highlight
}

export interface SeatSectionData {
  id: number | string;
  name: string;
  section_type: 'table' | 'counter';
  offset_x: number;
  offset_y: number;
  seats: DBSeat[];
}

interface DragState {
  isDragging: boolean;
  sectionId: string | number | null;
  startX: number;
  startY: number;
}

export interface SeatLayoutCanvasProps {
  width: number;
  height: number;
  zoom: number;
  showGrid?: boolean;
  sections: SeatSectionData[];

  onSeatClick?: (seat: DBSeat, section: SeatSectionData) => void;
  onSectionDrag?: (sectionId: number | string, dx: number, dy: number) => void;

  tableDiameter?: number; // default 80
  seatDiameter?: number;  // default 64
}

const DEFAULT_TABLE_DIAMETER = 80;
const DEFAULT_SEAT_DIAMETER  = 64;
const TABLE_OFFSET_Y         = 0;

export default function SeatLayoutCanvas({
  width,
  height,
  zoom,
  showGrid = true,
  sections,
  onSeatClick,
  onSectionDrag,
  tableDiameter = DEFAULT_TABLE_DIAMETER,
  seatDiameter  = DEFAULT_SEAT_DIAMETER,
}: SeatLayoutCanvasProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    sectionId: null,
    startX: 0,
    startY: 0,
  });

  function handleMouseDownSection(
    e: React.MouseEvent<HTMLDivElement>,
    sectionId: string | number
  ) {
    if (!onSectionDrag) return;
    e.stopPropagation();
    setDragState({
      isDragging: true,
      sectionId,
      startX: e.clientX,
      startY: e.clientY,
    });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragState.isDragging || !onSectionDrag) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    onSectionDrag(dragState.sectionId!, dx, dy);

    setDragState(prev => ({
      ...prev,
      startX: e.clientX,
      startY: e.clientY,
    }));
  }

  function handleMouseUp() {
    if (dragState.isDragging) {
      setDragState({ isDragging: false, sectionId: null, startX: 0, startY: 0 });
    }
  }

  function handleMouseLeave() {
    handleMouseUp();
  }

  return (
    <div
      className="border border-gray-200 rounded-lg overflow-auto relative"
      style={{
        width: '100%',
        height: '60vh',
        minHeight: 600,
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div
        style={{
          width,
          height,
          position: 'relative',
          transform: `scale(${zoom})`,
          transformOrigin: 'top left',
          backgroundImage: showGrid
            ? 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)'
            : 'none',
          backgroundSize: '20px 20px',
        }}
      >
        {sections.map((section) => {
          const isTable = (section.section_type === 'table');

          return (
            <div
              key={`section-${section.id}`}
              style={{
                position: 'absolute',
                left: section.offset_x,
                top:  section.offset_y,
                cursor: onSectionDrag ? 'move' : 'default',
              }}
              onMouseDown={(e) => {
                if (onSectionDrag) handleMouseDownSection(e, section.id);
              }}
            >
              {/* If it's a table, show the circle. */}
              {isTable && (
                <div
                  style={{
                    position: 'absolute',
                    width:  tableDiameter,
                    height: tableDiameter,
                    borderRadius: '50%',
                    backgroundColor: '#aaa',
                    opacity: 0.7,
                    top:  -tableDiameter / 2 + TABLE_OFFSET_Y,
                    left: -tableDiameter / 2,
                    zIndex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {section.name}
                  </span>
                </div>
              )}

              {/* Render seats */}
              <div style={{ position: 'relative' }}>
                {section.seats.map((seat, idx) => {
                  const diameter = seatDiameter;
                  const seatLeft = seat.position_x - diameter / 2;
                  const seatTop  = seat.position_y - diameter / 2
                                   - (isTable ? TABLE_OFFSET_Y : 0);

                  // occupant color logic
                  let seatColor = 'bg-green-500'; // default free
                  if (seat.occupant_status === 'reserved') {
                    seatColor = 'bg-yellow-400';
                  } else if (
                    seat.occupant_status === 'seated' ||
                    seat.occupant_status === 'occupied'
                  ) {
                    seatColor = 'bg-red-500';
                  }
                  // If seat is wizard‐selected & occupant_status = free => highlight blue
                  if (seat.isSelected && seat.occupant_status === 'free') {
                    seatColor = 'bg-blue-500';
                  }

                  // Show occupant’s first name if seat is not free
                  // otherwise show the seat label
                  let displayText = seat.label;
                  if (seat.occupant_status !== 'free' && seat.occupant_name) {
                    // just the occupant's first name (split on whitespace)
                    displayText = seat.occupant_name.split(/\s+/)[0];
                  }

                  return (
                    <div
                      key={`seat-${section.id}-${seat.id ?? idx}`}
                      onClick={() => onSeatClick?.(seat, section)}
                      style={{
                        position: 'absolute',
                        left: seatLeft,
                        top:  seatTop,
                        width: diameter,
                        height: diameter,
                        zIndex: 2,
                      }}
                      className={`
                        ${seatColor}
                        rounded-full flex items-center justify-center cursor-pointer
                        shadow-md text-white font-semibold text-xs
                        hover:opacity-90
                      `}
                      title={seat.label}
                    >
                      {displayText}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
