// src/ordering/componenets/admin/settings/CategoryManagementModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, Layers } from 'lucide-react';
import {
  Category,
  fetchCategoriesByMenu,
  createCategory,
  updateCategory,
  deleteCategory,
  batchUpdateCategoryPositions
} from '../../../../shared/api/endpoints/categories';
import { DraggableCategoryList } from '../DraggableCategoryList';
import { useRestaurantStore } from '../../../../shared/store/restaurantStore';
import { Menu } from '../../../../shared/api/endpoints/menu';
import toastUtils from '../../../../shared/utils/toastUtils';

interface CategoryManagementModalProps {
  menu: Menu;
  isOpen: boolean;
  onClose: () => void;
  prefetchedCategories?: Category[];
  initialLoading?: boolean;
}

export function CategoryManagementModal({
  menu,
  isOpen,
  onClose,
  prefetchedCategories = [],
  initialLoading = false
}: CategoryManagementModalProps) {
  // State for categories
  const [categories, setCategories] = useState<Category[]>(prefetchedCategories);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);
  
  // For new category form
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  
  // For editing an existing category
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // For tracking if positions have been updated - used for optimistic UI updates
  const [, setPositionsUpdated] = useState(false);
  
  // Add a safety timeout to ensure loading state is reset
  useEffect(() => {
    if (loading) {
      const safetyTimeout = setTimeout(() => {
        setLoading(false);
      }, 5000); // 5 seconds timeout
      
      return () => clearTimeout(safetyTimeout);
    }
  }, [loading]);

  // Update categories when prefetchedCategories changes
  useEffect(() => {
    if (prefetchedCategories.length > 0) {
      setCategories(prefetchedCategories);
      setLoading(false);
    }
  }, [prefetchedCategories]);

  // Fetch categories when the modal opens (only if we don't have prefetched categories)
  useEffect(() => {
    if (isOpen && menu) {
      if (prefetchedCategories.length === 0) {
        fetchCategoriesForMenu(menu.id);
      } else {
        // Ensure loading is set to false when using prefetched categories
        setLoading(false);
      }
    }
  }, [isOpen, menu, prefetchedCategories.length]);
  
  // Fetch categories for the menu
  const { restaurant } = useRestaurantStore();

  async function fetchCategoriesForMenu(menuId: number) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCategoriesByMenu(menuId, restaurant?.id);
      const categories: Category[] = Array.isArray(response) ? response : [];
      setCategories(categories || []);
    } catch (err: any) {
      setError(err.message);
      setCategories([]); // Ensure categories is always an array even on error
    } finally {
      setLoading(false);
    }
  }
  
  // Create a new category
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim() || !menu) return;
    
    try {
      const newCategory = await createCategory(menu.id, {
        name: newCategoryName,
        description: newCategoryDescription,
        position: 0,
        menu_id: menu.id,
      }, restaurant?.id);
      setCategories([...categories, newCategory]);
      setNewCategoryName('');
      setNewCategoryDescription('');
      toastUtils.success('Created category');
    } catch (err: any) {
      toastUtils.error(err.message || 'Failed to create category');
    }
  }
  
  // Update an existing category
  async function handleUpdateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCategory || !menu) return;
    
    const { id, name, description } = editingCategory;
    if (!name.trim()) return;
    
    try {
      const updatedCategory = await updateCategory(menu.id, id, {
        name,
        description,
        position: 0,
      }, restaurant?.id);
      setCategories(categories.map(c => (c.id === id ? updatedCategory : c)));
      setEditingCategory(null);
      toastUtils.success('Updated category');
    } catch (err: any) {
      toastUtils.error(err.message || 'Failed to update category');
    }
  }
  
  // Delete a category
  async function handleDeleteCategory(id: number) {
    if (!window.confirm('Delete this category?') || !menu) return;
    
    try {
      await deleteCategory(menu.id, id, restaurant?.id);
      setCategories(categories.filter(c => c.id !== id));
      toastUtils.success('Deleted category');
    } catch (err: any) {
      // Check for 422 error which indicates the category has menu items
      if (err.status === 422) {
        toastUtils.error('Cannot delete this category because it has menu items associated with it. Remove the items from this category first.');
      } else {
        toastUtils.error(err.message || 'Failed to delete category');
      }
    }
  }
  
  // Update category positions
  async function handleUpdatePositions(updatedCategories: Category[]) {
    if (!menu) return;
    
    // Optimistically update the UI
    setCategories(updatedCategories);
    setPositionsUpdated(true);
    
    try {
      // Prepare the positions data for the API
      const positionsData = updatedCategories.map(category => ({
        id: category.id,
        position: category.position || 0
      }));
      
      // Call the batch update API
      await batchUpdateCategoryPositions(menu.id, positionsData, restaurant?.id);
    } catch (err: any) {
      toastUtils.error(err.message || 'Failed to update category positions');
      // If there's an error, refresh the categories to get the correct order
      fetchCategoriesForMenu(menu.id);
    }
  }
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 sm:p-6 z-50 animate-fadeIn backdrop-blur-sm">
      <div className="bg-white rounded-lg max-w-3xl w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto transform transition-all duration-300 ease-in-out animate-slideUp shadow-xl">
        <div className="flex justify-between items-center mb-6 pb-3 border-b">
          <div className="flex items-center">
            <Layers className="h-5 w-5 text-[#0078d4] mr-2" />
            <h3 className="text-xl font-semibold text-gray-800">
              Categories for {menu.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors duration-200 p-1 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <div className="min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-[#0078d4] border-r-2 border-b-2 border-gray-200"></div>
                <p className="mt-3 text-sm text-gray-500">Loading categories...</p>
              </div>
            </div>
          ) : (
          <>
            {/* NEW CATEGORY FORM */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-6">
              <h4 className="text-lg font-medium text-gray-800 mb-3">Add New Category</h4>
              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div className="w-full">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-[#0078d4] focus:border-[#0078d4] focus:outline-none transition-colors"
                    placeholder="e.g. Beverages"
                    required
                  />
                </div>
                
                <div className="w-full">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-[#0078d4] focus:border-[#0078d4] focus:outline-none transition-colors"
                    placeholder="Brief description of this category"
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0078d4] text-white rounded-md hover:bg-[#50a3d9] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0078d4] focus:ring-opacity-50"
                  >
                    Add Category
                  </button>
                </div>
              </form>
            </div>
            
            {/* CATEGORIES LIST */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                <h4 className="font-medium text-gray-700">Categories</h4>
                <span className="text-xs text-gray-500">{categories.length} {categories.length === 1 ? 'category' : 'categories'}</span>
              </div>
              <div className="overflow-x-auto">
                {editingCategory ? (
                  // Editing form
                  <div className="bg-white p-4 border rounded-md mb-4">
                    <h4 className="text-lg font-medium text-gray-800 mb-3">Edit Category</h4>
                    <form onSubmit={handleUpdateCategory} className="space-y-4">
                      <div className="w-full">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Category Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editingCategory.name}
                          onChange={(e) =>
                            setEditingCategory({
                              ...editingCategory,
                              name: e.target.value,
                            })
                          }
                          className="border border-gray-300 p-2 rounded-md w-full mb-2 focus:ring-2 focus:ring-[#0078d4] focus:outline-none transition-colors"
                          autoFocus
                          required
                          style={{ minHeight: '44px' }}
                        />
                      </div>
                      
                      <div className="w-full">
                        <label className="text-sm font-medium text-gray-700 mb-1 block">
                          Description (Optional)
                        </label>
                        <textarea
                          value={editingCategory.description || ''}
                          onChange={(e) =>
                            setEditingCategory({
                              ...editingCategory,
                              description: e.target.value,
                            })
                          }
                          className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-[#0078d4] focus:border-[#0078d4] focus:outline-none transition-colors"
                          placeholder="Category description"
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={() => setEditingCategory(null)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-100 mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                          style={{ minHeight: '44px' }}
                        >
                          <X className="h-4 w-4 inline mr-1" />
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                          style={{ minHeight: '44px' }}
                        >
                          <Save className="h-4 w-4 inline mr-1" />
                          Save Changes
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  // Draggable category list
                  <>
                    {categories.length > 0 && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <p className="text-sm text-blue-700">
                          <strong>Tip:</strong> Drag and drop categories to reorder them, or use the up/down arrows.
                        </p>
                      </div>
                    )}
                    
                    <DraggableCategoryList
                      categories={categories}
                      onUpdatePositions={handleUpdatePositions}
                      onEditCategory={setEditingCategory}
                      onDeleteCategory={handleDeleteCategory}
                    />
                  </>
                )}
                
                {(categories || []).length === 0 && !loading && (
                  <div className="text-center py-10 bg-white border border-gray-200 rounded-lg">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-gray-100 rounded-full p-3 mb-3">
                        <Layers className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-gray-500 font-medium">No categories yet</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Add your first category using the form above
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
