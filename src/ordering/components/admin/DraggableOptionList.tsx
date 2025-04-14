// src/ordering/components/admin/DraggableOptionList.tsx

import React from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

// Interface for option items
export interface DraggableOption {
  id: number;
  name: string;
  additional_price: number;
  position: number;
  is_preselected?: boolean;
  is_available?: boolean;
}

// Props for the sortable item component
interface SortableOptionItemProps {
  option: DraggableOption;
  onUpdateOption: (id: number, changes: Partial<DraggableOption>) => void;
  onDeleteOption: (id: number) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  options: DraggableOption[];
  onOptionsReorder: (newOptions: DraggableOption[]) => void;
}

// Individual sortable option item
function SortableOptionItem({ 
  option, 
  onUpdateOption, 
  onDeleteOption,
  isSelected,
  onToggleSelect,
  options,
  onOptionsReorder
}: SortableOptionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ 
    id: option.id
  });

  const style = {
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    transform: CSS.Transform.toString(transform),
    transition
  };



  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex flex-wrap items-center p-2 border rounded mb-1.5 
        ${isDragging ? 'shadow-lg bg-blue-50 border-blue-300' : ''} 
        ${isSelected ? 'bg-blue-50 border-blue-300' : ''}
      `}
    >
      {/* Drag handle - make it larger for iPad touch targets */}
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-2 rounded hover:bg-gray-100 inline-flex items-center justify-center touch-manipulation"
        style={{ minHeight: '44px', minWidth: '44px' }}
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </div>

      {/* Checkbox for selection (if selection is enabled) */}
      {onToggleSelect && (
        <div 
          className="flex items-center justify-center w-9 h-9 mr-1.5 cursor-pointer"
          onClick={() => onToggleSelect(option.id)}
        >
          <input 
            type="checkbox" 
            checked={isSelected} 
            onChange={() => onToggleSelect(option.id)}
            className="w-4 h-4 cursor-pointer"
          />
        </div>
      )}

      {/* Option name */}
      <div className="flex-1 mr-1.5 min-w-[180px]">
        <input
          type="text"
          value={option.name}
          onChange={(e) => onUpdateOption(option.id, { name: e.target.value })}
          className="w-full p-2 border rounded text-sm"
          placeholder="Option name"
        />
      </div>

      {/* Price input */}
      <div className="w-20 mr-1.5 my-0.5">
        <div className="relative">
          <span className="absolute left-2 top-1.5">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={option.additional_price}
            onChange={(e) => onUpdateOption(option.id, { additional_price: parseFloat(e.target.value) || 0 })}
            className="w-full p-2 pl-5 border rounded text-sm"
            placeholder="Price"
          />
        </div>
      </div>

      {/* Availability toggle */}
      <div className="mr-3 my-0.5 w-[140px]">
        <label className="inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={option.is_available !== false}
            onChange={(e) => onUpdateOption(option.id, { is_available: e.target.checked })}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ms-2 text-sm font-medium w-[80px]">
            {option.is_available !== false ? "Available" : "Unavailable"}
          </span>
        </label>
      </div>

      {/* Pre-selected toggle */}
      <div className="mr-3 my-0.5 w-[140px]">
        <label className="inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            checked={option.is_preselected === true}
            onChange={(e) => onUpdateOption(option.id, { is_preselected: e.target.checked })}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          <span className="ms-2 text-sm font-medium w-[80px]">
            {option.is_preselected ? "Pre-selected" : "Optional"}
          </span>
        </label>
      </div>

      {/* Position controls for accessibility */}
      <div className="flex flex-col mr-1.5 my-0.5">
        <button
          onClick={() => {
            // Find the current index of this option
            const currentIndex = options.findIndex(opt => opt.id === option.id);
            if (currentIndex > 0) {
              // Move the option up one position
              const newOptions = [...options];
              const temp = newOptions[currentIndex];
              newOptions[currentIndex] = newOptions[currentIndex - 1];
              newOptions[currentIndex - 1] = temp;
              
              // Update positions
              const reorderedOptions = newOptions.map((opt, index) => ({
                ...opt,
                position: index + 1
              }));
              
              onOptionsReorder(reorderedOptions);
            }
          }}
          disabled={options.findIndex(opt => opt.id === option.id) === 0}
          className="p-1.5 rounded disabled:text-gray-300 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 focus:outline-none"
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-label="Move option up"
        >
          <ChevronUp size={16} />
        </button>
        <button
          onClick={() => {
            // Find the current index of this option
            const currentIndex = options.findIndex(opt => opt.id === option.id);
            if (currentIndex < options.length - 1) {
              // Move the option down one position
              const newOptions = [...options];
              const temp = newOptions[currentIndex];
              newOptions[currentIndex] = newOptions[currentIndex + 1];
              newOptions[currentIndex + 1] = temp;
              
              // Update positions
              const reorderedOptions = newOptions.map((opt, index) => ({
                ...opt,
                position: index + 1
              }));
              
              onOptionsReorder(reorderedOptions);
            }
          }}
          disabled={options.findIndex(opt => opt.id === option.id) === options.length - 1}
          className="p-1.5 rounded disabled:text-gray-300 disabled:cursor-not-allowed text-gray-600 hover:bg-gray-100 focus:outline-none"
          style={{ minHeight: '44px', minWidth: '44px' }}
          aria-label="Move option down"
        >
          <ChevronDown size={16} />
        </button>
      </div>
      
      {/* Delete button */}
      <button
        onClick={() => onDeleteOption(option.id)}
        className="px-3 py-1.5 text-red-600 border border-red-300 rounded-md text-sm hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
        style={{ minHeight: '44px' }}
        aria-label="Delete option"
      >
        <Trash2 className="h-3.5 w-3.5 inline mr-1" />
        Delete
      </button>
    </div>
  );
}

// Props for the draggable option list component
interface DraggableOptionListProps {
  options: DraggableOption[];
  onOptionsReorder: (newOptions: DraggableOption[]) => void;
  onUpdateOption: (id: number, changes: Partial<DraggableOption>) => void;
  onDeleteOption: (id: number) => void;
  selectedOptionIds?: Set<number>;
  onToggleOptionSelect?: (id: number) => void;
}

// Main component for the draggable option list
export function DraggableOptionList({
  options,
  onOptionsReorder,
  onUpdateOption,
  onDeleteOption,
  selectedOptionIds,
  onToggleOptionSelect
}: DraggableOptionListProps) {
  // Set up sensors for drag and drop with optimized settings
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced distance for quicker activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle the end of a drag operation
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      // Find the indices of the dragged item and the drop target
      const oldIndex = options.findIndex(option => option.id === active.id);
      const newIndex = options.findIndex(option => option.id === over.id);
      
      // Create a new array with the item moved to the new position
      const newOptions = arrayMove(options, oldIndex, newIndex);
      
      // Update positions based on the new order
      const reorderedOptions = newOptions.map((option, index) => ({
        ...option,
        position: index + 1
      }));
      
      // Call the callback with the reordered options
      onOptionsReorder(reorderedOptions);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={options.map(opt => opt.id)} 
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {options.map(option => (
            <SortableOptionItem
              key={option.id}
              option={option}
              onUpdateOption={onUpdateOption}
              onDeleteOption={onDeleteOption}
              isSelected={selectedOptionIds?.has(option.id)}
              onToggleSelect={onToggleOptionSelect}
              options={options}
              onOptionsReorder={onOptionsReorder}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default DraggableOptionList;
