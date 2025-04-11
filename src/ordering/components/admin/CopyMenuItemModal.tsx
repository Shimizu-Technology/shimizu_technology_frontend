import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import toastUtils from '../../../shared/utils/toastUtils';
import { useCategoryStore } from '../../store/categoryStore';
import { MenuItem } from '../../types/menu';
import { Menu } from '../../../shared/api/endpoints/menu';
import { Category } from '../../../shared/api/endpoints/categories';
import { useMenuStore } from '../../store/menuStore';

interface CopyMenuItemModalProps {
  item: MenuItem;
  menus: Menu[];
  isOpen: boolean;
  onClose: () => void;
}

export function CopyMenuItemModal({ 
  item, 
  menus, 
  isOpen, 
  onClose 
}: CopyMenuItemModalProps) {
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [targetMenuCategories, setTargetMenuCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  
  const { copyMenuItem } = useMenuStore();
  const { categories, fetchCategoriesForMenu } = useCategoryStore();
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedMenuId(null);
      setSelectedCategories([]);
      setTargetMenuCategories([]);
    }
  }, [isOpen]);
  
  // Fetch categories when a target menu is selected
  useEffect(() => {
    if (selectedMenuId) {
      fetchCategoriesForMenu(selectedMenuId);
    }
  }, [selectedMenuId, fetchCategoriesForMenu]);
  
  // Update target menu categories when categories change
  useEffect(() => {
    if (selectedMenuId) {
      const filteredCategories = categories.filter(cat => cat.menu_id === selectedMenuId);
      setTargetMenuCategories(filteredCategories);
    }
  }, [categories, selectedMenuId]);
  
  const handleCopy = async () => {
    if (!selectedMenuId) {
      toastUtils.error('Please select a destination menu');
      return;
    }
    
    if (selectedCategories.length === 0) {
      toastUtils.error('Please select at least one category');
      return;
    }
    
    setLoading(true);
    try {
      await copyMenuItem(item.id, selectedMenuId, selectedCategories);
      toastUtils.success('Item copied successfully!');
      onClose();
    } catch (error) {
      toastUtils.error('Failed to copy item');
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-lg max-w-md w-full p-6 animate-slideUp">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Copy Item to Another Menu</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Copy "{item.name}" to another menu. You'll need to select which menu to copy to and which categories the item should appear in.
          </p>
          
          {/* Destination Menu Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destination Menu <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedMenuId || ''}
              onChange={(e) => setSelectedMenuId(Number(e.target.value))}
              className="w-full px-4 py-2 border rounded-md"
              required
            >
              <option value="">Select a menu</option>
              {menus
                .filter(menu => menu.id !== Number(item.menu_id)) // Filter out current menu
                .map(menu => (
                  <option key={menu.id} value={menu.id}>
                    {menu.name}
                  </option>
                ))
              }
            </select>
          </div>
          
          {/* Category Selection */}
          {selectedMenuId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categories <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Select which categories this item should appear in
              </p>
              
              {targetMenuCategories.length === 0 ? (
                <p className="text-sm text-orange-600">
                  This menu has no categories. Please create categories first.
                </p>
              ) : (
                <div className="max-h-60 overflow-y-auto border rounded-md p-2">
                  {targetMenuCategories.map(category => (
                    <label key={category.id} className="flex items-center space-x-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories([...selectedCategories, category.id]);
                          } else {
                            setSelectedCategories(
                              selectedCategories.filter(id => id !== category.id)
                            );
                          }
                        }}
                      />
                      <span>{category.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f] transition-colors duration-200"
            disabled={loading || !selectedMenuId || selectedCategories.length === 0}
          >
            <Save className="h-5 w-5 mr-2" />
            {loading ? 'Copying...' : 'Copy Item'}
          </button>
        </div>
      </div>
    </div>
  );
}