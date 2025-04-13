// src/ordering/components/admin/DraggableOptionList.tsx

// Import React hooks
import { useState } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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
}: SortableOptionItemProps & {
  options: DraggableOption[];
  onOptionsReorder: (newOptions: DraggableOption[]) => void;
}) {
  // State for position change animation
  const [moveDirection, setMoveDirection] = useState<'up' | 'down' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
    position: 'relative' as 'relative',
    backgroundColor: isDragging ? '#f0f9ff' : 'white',
    borderRadius: '0.375rem',
  };

  // Animation helper function
  const animatePositionChange = (direction: 'up' | 'down') => {
    setMoveDirection(direction);
    setIsAnimating(true);
    
    // Reset animation after it completes
    setTimeout(() => {
      setIsAnimating(false);
      setMoveDirection(null);
    }, 800); // Match this with the CSS animation duration
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`flex flex-wrap items-center p-2 border rounded mb-1.5 transition-all duration-800 
        ${isDragging ? 'shadow-lg' : ''} 
        ${isSelected ? 'bg-blue-50 border-blue-300' : ''}
        ${isAnimating && moveDirection === 'up' ? 'translate-y-[-5px] bg-blue-100 shadow-md border-blue-400' : ''}
        ${isAnimating && moveDirection === 'down' ? 'translate-y-[5px] bg-blue-100 shadow-md border-blue-400' : ''}
      `}
    >
      {/* Drag handle - make it larger for iPad touch targets */}
      <div 
        {...attributes} 
        {...listeners} 
        className="flex items-center justify-center w-9 h-9 mr-1.5 cursor-grab touch-manipulation"
        aria-label="Drag to reorder"
      >
        <GripVertical size={20} className="text-gray-400" />
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
              // Trigger animation first
              animatePositionChange('up');
              
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
          className="p-1 text-gray-500 hover:text-blue-700 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed h-9 w-9 flex items-center justify-center"
          aria-label="Move option up"
        >
          <ChevronUp size={16} />
        </button>
        <button
          onClick={() => {
            // Find the current index of this option
            const currentIndex = options.findIndex(opt => opt.id === option.id);
            if (currentIndex < options.length - 1) {
              // Trigger animation first
              animatePositionChange('down');
              
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
          className="p-1 text-gray-500 hover:text-blue-700 focus:outline-none disabled:opacity-30 disabled:cursor-not-allowed h-9 w-9 flex items-center justify-center"
          aria-label="Move option down"
        >
          <ChevronDown size={16} />
        </button>
      </div>
      
      {/* Delete button */}
      <button
        onClick={() => onDeleteOption(option.id)}
        className="p-1 text-red-500 hover:text-red-700 focus:outline-none h-9 w-9 flex items-center justify-center my-0.5"
        aria-label="Delete option"
      >
        <Trash2 size={18} />
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
  // Configure sensors for different input methods
  const sensors = useSensors(
    // Mouse/touch pointer
    useSensor(PointerSensor, {
      // Require a small drag distance to avoid accidental drags
      activationConstraint: {
        distance: 8,
      },
    }),
    // Touch screen (better for iPad)
    useSensor(TouchSensor, {
      // Delay before activation to distinguish from taps
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    // Keyboard accessibility
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
