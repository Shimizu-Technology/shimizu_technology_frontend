// src/components/SeatLayoutEditor.tsx

import React, { useEffect, useState } from 'react';
import {
  Save, Trash2, Plus as LucidePlus, Settings, Edit2,
  Minus, Maximize, Power
} from 'lucide-react';
import toastUtils from '../../shared/utils/toastUtils';

import {
  fetchAllLayouts,
  fetchLayout,
  createLayout,
  updateLayout,
  activateLayout,
} from '../services/api';

import RenameSeatsModal from './RenameSeatsModal';

/** ---------- Data Interfaces ---------- **/
interface LayoutData {
  id: number;
  name: string;
  restaurant_id: number;
  sections_data: {
    sections: SeatSection[];
  };
}

interface SeatSection {
  id: string;
  dbId?: number;
  name: string;
  type: 'counter' | 'table';
  orientation: 'vertical' | 'horizontal';
  offsetX: number;
  offsetY: number;
  floorNumber: number;
  seats: DBSeat[];
}

interface DBSeat {
  id?: number;
  label?: string;
  position_x: number;
  position_y: number;
  capacity: number;
}

interface SectionConfig {
  name: string;
  seatCount: number;
  type: 'counter' | 'table';
  orientation: 'vertical' | 'horizontal';
}

/** Predefined layout sizes or "auto" bounding. */
const LAYOUT_PRESETS = {
  auto:   { width: 0,    height: 0,    seatScale: 1.0 },
  small:  { width: 1200, height: 800,  seatScale: 1.0 },
  medium: { width: 2000, height: 1200, seatScale: 1.0 },
  large:  { width: 3000, height: 1800, seatScale: 1.0 },
};

export default function SeatLayoutEditor() {
  // Layout states
  const [allLayouts, setAllLayouts]         = useState<LayoutData[]>([]);
  const [activeLayoutId, setActiveLayoutId] = useState<number | null>(null);
  const [layoutName,     setLayoutName]     = useState('New Layout');
  const [sections,       setSections]       = useState<SeatSection[]>([]);

  // Canvas sizing + zoom
  const [layoutSize, setLayoutSize] = useState<'auto'|'small'|'medium'|'large'>('medium');
  const [canvasWidth,  setCanvasWidth]  = useState(2000);
  const [canvasHeight, setCanvasHeight] = useState(1200);
  const [seatScale,    setSeatScale]    = useState(1.0);
  const [zoom,         setZoom]         = useState(1.0);
  const [showGrid,     setShowGrid]     = useState(true);

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);

  // Dragging a section
  const [isDragging,       setIsDragging]       = useState(false);
  const [selectedSection,  setSelectedSection]  = useState<string | null>(null);
  const [dragStart,        setDragStart]        = useState<{ x: number; y: number } | null>(null);

  // Add/Edit Section dialog
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [editingSectionId,  setEditingSectionId]  = useState<string | null>(null);

  // For the new/edit section form
  const [sectionConfig, setSectionConfig] = useState<SectionConfig>({
    name: '',
    seatCount: 4,
    type: 'table',
    orientation: 'horizontal',
  });
  const [seatCountText,    setSeatCountText]    = useState('4');
  const [sectionFloorText, setSectionFloorText] = useState('1');
  const [seatCapacityText, setSeatCapacityText] = useState('1');

  // Basic geometry constants
  const TABLE_DIAMETER = 80;
  const TABLE_RADIUS   = TABLE_DIAMETER / 2;
  const TABLE_OFFSET_Y = 15;
  const SEAT_DIAMETER  = 64;
  const SEAT_MARGIN    = 10;

  // Floor logic
  const floorNumbers = Array.from(new Set(sections.map(s => s.floorNumber || 1))).sort((a, b) => a - b);
  const [activeFloor, setActiveFloor] = useState(floorNumbers.length > 0 ? floorNumbers[0] : 1);
  const sectionsForActiveFloor = sections.filter(s => (s.floorNumber || 1) === activeFloor);

  // Rename seats modal
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameModalSeats, setRenameModalSeats] = useState<DBSeat[]>([]);
  const [renameModalSectionName, setRenameModalSectionName] = useState('');

  /** On mount => fetch all layouts. */
  useEffect(() => {
    (async () => {
      try {
        const layouts = await fetchAllLayouts();
        setAllLayouts(layouts);
        if (layouts.length > 0) {
          const firstId = layouts[0].id;
          setActiveLayoutId(firstId);
          loadOneLayout(firstId);
        }
      } catch (err) {
        console.error('Error loading layouts:', err);
        toastUtils.error('Failed to load layouts.');
      }
    })();
  }, []);

  /** Load seat sections from the chosen layout. */
  async function loadOneLayout(id: number) {
    try {
      const layout = await fetchLayout(id);
      const secWithFloors = (layout.sections_data.sections || []).map((sec: any) => ({
        ...sec,
        floorNumber: sec.floorNumber ?? 1,
      }));
      setLayoutName(layout.name || 'Untitled Layout');
      setSections(secWithFloors);

      // pick the first floor
      const floors = Array.from(new Set(secWithFloors.map((s: any) => s.floorNumber))).sort((a,b)=>a-b);
      setActiveFloor(floors.length > 0 ? floors[0] : 1);
    } catch (err) {
      console.error('Error loading layout ID=', id, err);
      toastUtils.error('Failed to load layout.');
    }
  }

  /** On layout selection from dropdown. */
  function handleSelectLayout(id: number) {
    if (id === 0) {
      // new layout
      setActiveLayoutId(null);
      setLayoutName('New Layout');
      setSections([]);
      setActiveFloor(1);
      return;
    }
    setActiveLayoutId(id);
    loadOneLayout(id);
  }

  /** Recompute bounding box whenever layoutSize or sectionsForActiveFloor changes. */
  useEffect(() => {
    if (layoutSize === 'auto') {
      computeAutoBounds();
    } else {
      const preset = LAYOUT_PRESETS[layoutSize];
      setCanvasWidth(preset.width);
      setCanvasHeight(preset.height);
      setSeatScale(preset.seatScale);
    }
  }, [layoutSize, sectionsForActiveFloor]);

  function computeAutoBounds() {
    if (sectionsForActiveFloor.length === 0) {
      setCanvasWidth(1200);
      setCanvasHeight(800);
      setSeatScale(1.0);
      return;
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    sectionsForActiveFloor.forEach((sec) => {
      sec.seats.forEach((seat) => {
        const gx = sec.offsetX + seat.position_x;
        const gy = sec.offsetY + seat.position_y;
        if (gx < minX) minX = gx;
        if (gx > maxX) maxX = gx;
        if (gy < minY) minY = gy;
        if (gy > maxY) maxY = gy;
      });

      if (sec.type === 'table') {
        const tableLeft   = sec.offsetX - TABLE_RADIUS;
        const tableRight  = sec.offsetX + TABLE_RADIUS;
        const tableTop    = sec.offsetY - TABLE_RADIUS;
        const tableBottom = sec.offsetY + TABLE_RADIUS;
        if (tableLeft   < minX) minX = tableLeft;
        if (tableRight  > maxX) maxX = tableRight;
        if (tableTop    < minY) minY = tableTop;
        if (tableBottom > maxY) maxY = tableBottom;
      }
    });

    const margin = 200;
    const w = maxX - minX + margin;
    const h = maxY - minY + margin;
    setCanvasWidth(Math.max(w, 800));
    setCanvasHeight(Math.max(h, 600));
    setSeatScale(1.0);
  }

  function handleClickFloorTab(floorNum: number) {
    setActiveFloor(floorNum);
  }

  // Dragging logic
  function handleDragStart(e: React.PointerEvent, sectionId: string) {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setSelectedSection(sectionId);
    setDragStart({ x: e.clientX, y: e.clientY });
  }
  function handleDragMove(e: React.PointerEvent) {
    if (!isEditMode || !isDragging || !dragStart || !selectedSection) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    setSections(prev =>
      prev.map(sec => {
        if (sec.id !== selectedSection) return sec;
        return {
          ...sec,
          offsetX: sec.offsetX + dx,
          offsetY: sec.offsetY + dy,
        };
      })
    );
    setDragStart({ x: e.clientX, y: e.clientY });
  }
  function handleDragEnd() {
    if (!isEditMode) return;
    setIsDragging(false);
    setSelectedSection(null);
    setDragStart(null);
  }

  // Numeric input filters
  function handleSeatCountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    setSeatCountText(digits);
  }
  function handleFloorNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    setSectionFloorText(digits);
  }
  function handleSeatCapacityChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '');
    setSeatCapacityText(digits);
  }

  // Add section
  function handleAddSection() {
    setEditingSectionId(null);
    setSectionConfig({
      name: `New Table ${sections.length + 1}`,
      seatCount: 4,
      type: 'table',
      orientation: 'horizontal',
    });
    setSeatCountText('4');
    setSectionFloorText(String(activeFloor));
    setSeatCapacityText('1');
    setShowSectionDialog(true);
  }
  function handleEditSectionClick(sectionId: string) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;

    setEditingSectionId(sectionId);
    setSectionConfig({
      name: sec.name,
      seatCount: sec.seats.length,
      type: sec.type,
      orientation: sec.orientation,
    });

    setSectionFloorText(String(sec.floorNumber || 1));
    setSeatCountText(String(sec.seats.length || 1));
    if (sec.seats.length > 0) {
      setSeatCapacityText(String(sec.seats[0].capacity || 1));
    } else {
      setSeatCapacityText('1');
    }

    setShowSectionDialog(true);
  }
  function deleteSection(sectionId: string) {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  }

  function createOrEditSection() {
    const finalFloor     = parseInt(sectionFloorText, 10) || 1;
    const finalSeatCount = parseInt(seatCountText, 10)    || 1;
    const finalCapacity  = parseInt(seatCapacityText, 10) || 1;

    if (editingSectionId) {
      // update existing
      const oldSection = sections.find(s => s.id === editingSectionId);
      if (!oldSection) {
        setShowSectionDialog(false);
        return;
      }
      const oldCount = oldSection.seats.length;
      const newCount = finalSeatCount;

      setSections(prev =>
        prev.map(sec => {
          if (sec.id !== editingSectionId) return sec;
          return {
            ...sec,
            name: sectionConfig.name,
            type: sectionConfig.type,
            orientation: sectionConfig.orientation,
            floorNumber: finalFloor,
          };
        })
      );

      // If seatCount changed => re‐layout seats
      if (sectionConfig.type === 'table' && newCount !== oldCount) {
        const newSeats = layoutTableSeats(newCount, finalCapacity);
        setSections(prev =>
          prev.map(sec => {
            if (sec.id !== editingSectionId) return sec;
            return { ...sec, seats: newSeats };
          })
        );
      } else if (sectionConfig.type === 'counter' && newCount !== oldCount) {
        const newSeats = layoutCounterSeats(newCount, sectionConfig.orientation, finalCapacity);
        setSections(prev =>
          prev.map(sec => {
            if (sec.id !== editingSectionId) return sec;
            return { ...sec, seats: newSeats };
          })
        );
      }
    } else {
      // create new
      const newSectionId = `section-${sections.length + 1}`;
      let newSeats: DBSeat[] = [];

      if (sectionConfig.type === 'table') {
        newSeats = layoutTableSeats(finalSeatCount, finalCapacity);
      } else {
        newSeats = layoutCounterSeats(finalSeatCount, sectionConfig.orientation, finalCapacity);
      }

      const newSection: SeatSection = {
        id: newSectionId,
        name: sectionConfig.name,
        type: sectionConfig.type,
        orientation: sectionConfig.orientation,
        offsetX: 100,
        offsetY: 100,
        floorNumber: finalFloor,
        seats: newSeats,
      };
      setSections(prev => [...prev, newSection]);
    }
    setShowSectionDialog(false);
  }

  function layoutTableSeats(seatCount: number, capacity: number): DBSeat[] {
    const angleStep = (2 * Math.PI) / seatCount;
    const angleOffset = -Math.PI / 2;
    const radius = TABLE_RADIUS + (SEAT_DIAMETER / 2) + SEAT_MARGIN;

    const seats: DBSeat[] = [];
    for (let i = 0; i < seatCount; i++) {
      const angle = angleOffset + i * angleStep;
      const x = Math.round(radius * Math.cos(angle));
      const y = Math.round(radius * Math.sin(angle));
      seats.push({
        label: `Seat #${i + 1}`,
        position_x: x,
        position_y: y,
        capacity,
      });
    }
    return seats;
  }
  function layoutCounterSeats(
    seatCount: number,
    orientation: 'vertical'|'horizontal',
    capacity: number
  ): DBSeat[] {
    const seats: DBSeat[] = [];
    const spacing = 70;
    for (let i = 0; i < seatCount; i++) {
      let px = 0, py = 0;
      if (orientation === 'vertical') {
        py = i * spacing;
      } else {
        px = i * spacing;
      }
      seats.push({
        label: `Seat #${i + 1}`,
        position_x: px,
        position_y: py,
        capacity,
      });
    }
    return seats;
  }

  // Save Layout
  async function handleSaveLayout() {
    try {
      const payload = {
        name: layoutName,
        sections_data: {
          sections: sections.map(sec => ({
            ...sec,
            floorNumber: sec.floorNumber,
          })),
        },
      };

      if (activeLayoutId) {
        // update existing
        const updatedLayout = await updateLayout(activeLayoutId, payload);
        toastUtils.success('Layout updated successfully!');
        setLayoutName(updatedLayout.name);

        const secWithFloors = (updatedLayout.sections_data.sections || []).map((sec: any) => ({
          ...sec,
          floorNumber: sec.floorNumber ?? 1,
        }));
        setSections(secWithFloors);

        // recalc floors
        const floors = Array.from(new Set(secWithFloors.map((s: any) => s.floorNumber))).sort((a,b)=>a-b);
        setActiveFloor(floors.length > 0 ? floors[0] : 1);
      } else {
        // create new
        const newLayout = await createLayout(payload);
        toastUtils.success('Layout created!');
        setAllLayouts(prev => [...prev, newLayout]);
        setActiveLayoutId(newLayout.id);
        setLayoutName(newLayout.name);

        const secWithFloors = (newLayout.sections_data.sections || []).map((sec: any) => ({
          ...sec,
          floorNumber: sec.floorNumber ?? 1,
        }));
        setSections(secWithFloors);

        const floors = Array.from(new Set(secWithFloors.map((s: any) => s.floorNumber))).sort((a,b)=>a-b);
        setActiveFloor(floors.length > 0 ? floors[0] : 1);
      }
    } catch (err) {
      console.error('Error saving layout:', err);
      toastUtils.error('Failed to save layout. Check console.');
    }
  }

  async function handleActivateLayout() {
    if (!activeLayoutId) {
      toastUtils.error('Cannot activate a layout that is not saved yet!');
      return;
    }
    try {
      const resp = await activateLayout(activeLayoutId);
      toastUtils.success(resp.message || 'Layout activated.');
    } catch (err) {
      console.error('Error activating layout:', err);
      toastUtils.error('Failed to activate layout. Check console.');
    }
  }

  // Rename Seats
  function handleOpenRenameModal(sectionId: string) {
    const sec = sections.find(s => s.id === sectionId);
    if (!sec) return;
    setRenameModalOpen(true);
    setRenameModalSeats([...sec.seats]);
    setRenameModalSectionName(sec.name);
  }
  function handleCloseRenameModal() {
    setRenameModalOpen(false);
    setRenameModalSeats([]);
    setRenameModalSectionName('');
  }
  function handleRenameModalSave(updatedSeats: DBSeat[]) {
    setSections(prev =>
      prev.map(sec => {
        if (sec.name === renameModalSectionName) {
          return { ...sec, seats: updatedSeats };
        }
        return sec;
      })
    );
    setRenameModalOpen(false);
    setRenameModalSeats([]);
    setRenameModalSectionName('');
  }

  // Zoom
  function handleZoomIn() {
    setZoom(z => Math.min(z + 0.25, 5.0));
  }
  function handleZoomOut() {
    setZoom(z => Math.max(z - 0.25, 0.2));
  }
  function handleZoomReset() {
    setZoom(1.0);
  }

  return (
    <div className="bg-white shadow rounded-md">
      {/* Hafaloha-style header */}
      <div className="border-b border-gray-200 bg-hafaloha-gold/5 rounded-t-md px-4 py-3">
        <h2 className="text-xl font-bold text-gray-900">Layout Editor</h2>
      </div>

      {/* Main content container */}
      <div className="p-4 relative">
        {/* ---------- Top Controls ---------- */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {/* Layout dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold">Choose Layout:</label>
            <select
              value={activeLayoutId ?? 0}
              onChange={e => handleSelectLayout(Number(e.target.value))}
              className="border border-gray-300 rounded p-1"
            >
              <option value={0}>(New Layout)</option>
              {allLayouts.map(lyt => (
                <option key={lyt.id} value={lyt.id}>
                  {lyt.name}
                </option>
              ))}
            </select>
          </div>

          {/* Layout name */}
          <input
            type="text"
            value={layoutName}
            onChange={e => setLayoutName(e.target.value)}
            className="border border-gray-300 rounded p-1"
            placeholder="Layout Name"
          />

          {/* Layout size */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Layout Size:</label>
            <select
              value={layoutSize}
              onChange={e => setLayoutSize(e.target.value as 'auto'|'small'|'medium'|'large')}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="auto">Auto</option>
              <option value="small">Small (1200×800)</option>
              <option value="medium">Medium (2000×1200)</option>
              <option value="large">Large (3000×1800)</option>
            </select>
          </div>

          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`
              px-3 py-1 rounded text-sm
              ${showGrid
                ? 'bg-hafaloha-gold/10 text-hafaloha-gold border border-hafaloha-gold/20'
                : 'bg-gray-100 text-gray-600'
              }
            `}
          >
            <Settings className="inline w-4 h-4 mr-1" />
            Grid
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomOut}
              className="p-1 bg-gray-100 rounded hover:bg-gray-200"
              title="Zoom Out"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1 bg-gray-100 rounded hover:bg-gray-200"
              title="Zoom In"
            >
              <LucidePlus className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomReset}
              className="p-1 bg-gray-100 rounded hover:bg-gray-200"
              title="Reset Zoom"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          {/* Edit Mode Toggle */}
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-4 py-2 rounded text-sm text-white
              ${isEditMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'}
            `}
          >
            {isEditMode ? 'Disable Edit Mode' : 'Enable Edit Mode'}
          </button>

          {/* Save Layout */}
          <button
            onClick={handleSaveLayout}
            className="
              flex items-center px-4 py-2
              bg-hafaloha-gold text-white rounded
              hover:bg-hafaloha-coral
              transition-colors
            "
          >
            <Save className="w-4 h-4 mr-1" />
            Save Layout
          </button>

          {/* Activate Layout (only if layout is saved) */}
          {activeLayoutId && (
            <button
              onClick={handleActivateLayout}
              className="
                flex items-center px-4 py-2
                bg-blue-600 text-white rounded
                hover:bg-blue-700
              "
            >
              <Power className="w-4 h-4 mr-1" />
              Activate
            </button>
          )}
        </div>

        {/* Floor Tabs */}
        <div className="flex gap-2 mb-4">
          {floorNumbers.map(floorNum => (
            <button
              key={floorNum}
              onClick={() => handleClickFloorTab(floorNum)}
              className={`
                px-4 py-2 rounded text-sm
                ${floorNum === activeFloor
                  ? 'bg-hafaloha-gold/10 text-hafaloha-gold border border-hafaloha-gold/20'
                  : 'bg-gray-100 text-gray-700 hover:bg-hafaloha-gold/5'
                }
              `}
            >
              Floor {floorNum}
            </button>
          ))}
        </div>

        {/* Main Canvas */}
        <div
          className="border border-gray-200 rounded-lg overflow-auto"
          style={{
            width: '100%',
            height: '80vh',
            minHeight: '600px',
            touchAction: 'none',
          }}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerLeave={handleDragEnd}
        >
          <div
            style={{
              width: canvasWidth,
              height: canvasHeight,
              position: 'relative',
              backgroundImage: showGrid
                ? 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)'
                : 'none',
              backgroundSize: '20px 20px',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            {sectionsForActiveFloor.map((section) => {
              // "move" cursor in edit mode
              const sectionCursor = isEditMode ? 'move' : 'default';

              return (
                <div
                  key={section.id}
                  style={{
                    position: 'absolute',
                    left: section.offsetX,
                    top:  section.offsetY,
                    cursor: sectionCursor,
                  }}
                  onPointerDown={(e) => handleDragStart(e, section.id)}
                >
                  {/* Table circle if type="table" */}
                  {section.type === 'table' && (
                    <div
                      style={{
                        position: 'absolute',
                        width:  TABLE_DIAMETER,
                        height: TABLE_DIAMETER,
                        borderRadius: '50%',
                        backgroundColor: '#aaa',
                        opacity: 0.7,
                        top:  -(TABLE_DIAMETER / 2) + TABLE_OFFSET_Y,
                        left: -(TABLE_DIAMETER / 2),
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

                  {/* Section header w/ edit & delete */}
                  <div
                    className="bg-white/80 rounded px-2 py-1 shadow flex items-center justify-between"
                    style={{
                      position: 'relative',
                      zIndex: 999,
                      cursor: 'default',
                      marginBottom: 4,
                    }}
                  >
                    <span className="font-medium text-sm text-gray-700 mr-2">
                      {section.name}{section.dbId ? ` (ID ${section.dbId})` : ''}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleEditSectionClick(section.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Edit2 className="w-3 h-3 text-gray-500" />
                      </button>
                      <button
                        onClick={(ev) => {
                          ev.stopPropagation();
                          deleteSection(section.id);
                        }}
                        className="p-1 hover:bg-gray-100 rounded text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Seats */}
                  <div style={{ position: 'relative' }}>
                    {section.seats.map((seat, idx) => {
                      const diameter = SEAT_DIAMETER * seatScale;
                      const leftPos  = seat.position_x - diameter / 2;
                      const topPos   = seat.position_y - diameter / 2 - TABLE_OFFSET_Y;

                      return (
                        <div
                          key={seat.id ?? `temp-${section.id}-${idx}`}
                          style={{
                            position: 'absolute',
                            left: leftPos,
                            top:  topPos,
                            width: diameter,
                            height: diameter,
                            zIndex: 2,
                          }}
                          className="
                            rounded-full flex items-center justify-center cursor-pointer
                            shadow-md text-white font-semibold text-sm
                            bg-green-500 hover:opacity-90
                          "
                          onClick={() => console.log('Clicked seat:', seat.label)}
                        >
                          {seat.label ?? 'Seat'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Table button */}
        <button
          onClick={handleAddSection}
          className="
            flex items-center px-4 py-2
            bg-hafaloha-gold text-white rounded
            hover:bg-hafaloha-coral
            transition-colors
            mt-4
          "
        >
          <LucidePlus className="w-4 h-4 mr-2" />
          Add Table
        </button>

        {/* ========== Add/Edit Section Dialog ========== */}
        {showSectionDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded p-6 w-96 relative">
              <button
                onClick={() => setShowSectionDialog(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-gray-800"
              >
                ✕
              </button>
              <h3 className="text-lg font-semibold mb-4">
                {editingSectionId ? 'Edit Section' : 'Add Section'}
              </h3>

              <div className="space-y-4">
                {/* Section Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section Name
                  </label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={sectionConfig.name}
                    onChange={(e) =>
                      setSectionConfig((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>

                {/* Floor Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Floor Number
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={sectionFloorText}
                    onChange={handleFloorNumberChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Which floor is this table/counter on?
                  </p>
                </div>

                {/* Seat Count */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Seats
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={seatCountText}
                    onChange={handleSeatCountChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                </div>

                {/* Section Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section Type
                  </label>
                  <select
                    value={sectionConfig.type}
                    onChange={(e) =>
                      setSectionConfig((prev) => ({
                        ...prev,
                        type: e.target.value as 'counter' | 'table',
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="counter">Counter</option>
                    <option value="table">Table</option>
                  </select>
                </div>

                {/* Orientation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Orientation
                  </label>
                  <select
                    value={sectionConfig.orientation}
                    onChange={(e) =>
                      setSectionConfig((prev) => ({
                        ...prev,
                        orientation: e.target.value as 'vertical' | 'horizontal',
                      }))
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                  </select>
                </div>

                {/* Seat Capacity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Seat Capacity
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={seatCapacityText}
                    onChange={handleSeatCapacityChange}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    e.g. 1 for a barstool, or 4 for a booth seat
                  </p>
                </div>
              </div>

              {/* Dialog Buttons */}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                {editingSectionId &&
                  sections.find((s) => s.id === editingSectionId)?.seats.length ? (
                  <button
                    onClick={() => handleOpenRenameModal(editingSectionId!)}
                    className="px-4 py-2 bg-hafaloha-gold text-white rounded hover:bg-hafaloha-coral text-sm"
                  >
                    Rename Seats
                  </button>
                ) : null}

                <button
                  onClick={() => setShowSectionDialog(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={createOrEditSection}
                  className="px-4 py-2 bg-hafaloha-gold text-white rounded hover:bg-hafaloha-coral text-sm"
                >
                  {editingSectionId ? 'Save' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rename Seats Modal */}
        {renameModalOpen && (
          <RenameSeatsModal
            sectionName={renameModalSectionName}
            seats={renameModalSeats}
            onClose={handleCloseRenameModal}
            onSave={handleRenameModalSave}
          />
        )}
      </div>
    </div>
  );
}
