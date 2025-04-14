// src/ordering/components/admin/DraggableCategoryList.tsx

// Import React hooks
import { useState } from 'react';
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
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Edit2, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Category } from '../../../shared/api/endpoints/categories';

interface DraggableCategoryListProps {
  categories: Category[];
  onUpdatePositions: (updatedCategories: Category[]) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: number) => void;
}

// Sortable category item component
const SortableCategoryItem = ({ 
  category, 
  onEdit, 
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast
}: { 
  category: Category; 
  onEdit: () => void; 
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const [moveDirection, setMoveDirection] = useState<'up' | 'down' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: category.id.toString() });
  
  const style = {
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
    position: 'relative' as const,
    backgroundColor: isAnimating 
      ? moveDirection === 'up' 
        ? 'rgba(0, 120, 212, 0.05)' 
        : 'rgba(0, 120, 212, 0.05)' 
      : 'transparent',
    transform: isAnimating 
      ? `translateY(${moveDirection === 'up' ? '-3px' : '3px'})` 
      : CSS.Transform.toString(transform),
    transition: isAnimating ? 'all 0.2s ease' : transition
  };
  
  const animatePositionChange = (direction: 'up' | 'down') => {
    setMoveDirection(direction);
    setIsAnimating(true);
    
    setTimeout(() => {
      setIsAnimating(false);
      setMoveDirection(null);
    }, 300);
  };
  
  const handleMoveUp = () => {
    animatePositionChange('up');
    onMoveUp();
  };
  
  const handleMoveDown = () => {
    animatePositionChange('down');
    onMoveDown();
  };
  
  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      className="border-b hover:bg-gray-50 transition-colors"
    >
      <td className="px-4 py-3 w-10">
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 rounded hover:bg-gray-100 inline-flex items-center justify-center touch-manipulation"
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium">{category.name}</span>
        {category.description && (
          <p className="text-sm text-gray-600 mt-1">
            {category.description}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {/* Position controls for accessibility */}
        <div className="mr-1.5 my-0.5 inline-block">
          <button
            onClick={handleMoveUp}
            disabled={isFirst}
            className={`p-1.5 rounded ${isFirst ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
            style={{ minHeight: '44px', minWidth: '44px' }}
            aria-label="Move up"
          >
            <ChevronUp className="h-5 w-5" />
          </button>
          <button
            onClick={handleMoveDown}
            disabled={isLast}
            className={`p-1.5 rounded ${isLast ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
            style={{ minHeight: '44px', minWidth: '44px' }}
            aria-label="Move down"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>
        
        <button
          onClick={onEdit}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-100 mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:border-[#0078d4]"
          style={{ minHeight: '44px' }}
        >
          <Edit2 className="h-3.5 w-3.5 inline mr-1" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-red-600 border border-red-300 rounded-md text-sm hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          style={{ minHeight: '44px' }}
        >
          <Trash2 className="h-3.5 w-3.5 inline mr-1" />
          Delete
        </button>
      </td>
    </tr>
  );
};

export function DraggableCategoryList({
  categories,
  onUpdatePositions,
  onEditCategory,
  onDeleteCategory
}: DraggableCategoryListProps) {
  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex(cat => cat.id.toString() === active.id);
      const newIndex = categories.findIndex(cat => cat.id.toString() === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const updatedCategories = arrayMove(categories, oldIndex, newIndex);
        
        // Update positions based on new order
        const categoriesWithUpdatedPositions = updatedCategories.map((cat, index) => ({
          ...cat,
          position: index + 1
        }));
        
        onUpdatePositions(categoriesWithUpdatedPositions);
      }
    }
  };
  
  // Handle manual position changes (up/down buttons)
  const handleMoveUp = (index: number) => {
    if (index > 0) {
      const updatedCategories = arrayMove(categories, index, index - 1);
      
      // Update positions based on new order
      const categoriesWithUpdatedPositions = updatedCategories.map((cat, index) => ({
        ...cat,
        position: index + 1
      }));
      
      onUpdatePositions(categoriesWithUpdatedPositions);
    }
  };
  
  const handleMoveDown = (index: number) => {
    if (index < categories.length - 1) {
      const updatedCategories = arrayMove(categories, index, index + 1);
      
      // Update positions based on new order
      const categoriesWithUpdatedPositions = updatedCategories.map((cat, index) => ({
        ...cat,
        position: index + 1
      }));
      
      onUpdatePositions(categoriesWithUpdatedPositions);
    }
  };
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <table className="min-w-full text-sm text-gray-700 divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700 w-10"></th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Name &amp; Description</th>
            <th className="px-4 py-3 font-medium text-right text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          <SortableContext
            items={categories.map(cat => cat.id.toString())}
            strategy={verticalListSortingStrategy}
          >
            {categories.map((category, index) => (
              <SortableCategoryItem
                key={category.id}
                category={category}
                onEdit={() => onEditCategory(category)}
                onDelete={() => onDeleteCategory(category.id)}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                isFirst={index === 0}
                isLast={index === categories.length - 1}
              />
            ))}
          </SortableContext>
          
          {categories.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-10 text-center">
                <p className="text-gray-500">No categories found</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </DndContext>
  );
}
