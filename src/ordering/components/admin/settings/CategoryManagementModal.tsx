// src/ordering/componenets/admin/settings/CategoryManagementModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Edit2, Trash2, Save, Layers } from 'lucide-react';
import {
  Category,
  fetchCategoriesByMenu,
  createCategory,
  updateCategory,
  deleteCategory
} from '../../../../shared/api/endpoints/categories';
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
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 sm:p-6 z-50 animate-fadeIn backdrop-blur-sm">
      <div className="bg-white rounded-lg max-w-3xl w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto transform transition-all duration-300 ease-in-out animate-slideUp shadow-xl">
        <div className="flex justify-between items-center mb-6 pb-3 border-b">
          <div className="flex items-center">
            <Layers className="h-5 w-5 text-[#c1902f] mr-2" />
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
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-[#c1902f] border-r-2 border-b-2 border-gray-200"></div>
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
                    className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] focus:outline-none transition-colors"
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
                    className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] focus:outline-none transition-colors"
                    placeholder="Brief description of this category"
                    rows={3}
                  />
                </div>
                
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:ring-opacity-50"
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
                <table className="min-w-full text-sm text-gray-700 divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Name &amp; Description</th>
                      <th className="px-4 py-3 font-medium text-right text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(categories || []).map((cat) => {
                      const isEditing = editingCategory && editingCategory.id === cat.id;
                      if (isEditing) {
                        // Inline editing row
                        return (
                          <tr key={cat.id} className="border-b">
                            <td className="px-4 py-3">
                              <label className="text-sm font-medium text-gray-700 mb-1 block">
                                Name
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
                                className="border border-gray-300 p-2 rounded-md w-full mb-2 focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] focus:outline-none transition-colors"
                                autoFocus
                                required
                              />
                              
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
                                className="border border-gray-300 p-2 rounded-md w-full focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] focus:outline-none transition-colors"
                                placeholder="Category description"
                                rows={3}
                              />
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                onClick={handleUpdateCategory}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                              >
                                <Save className="h-3.5 w-3.5 inline mr-1" />
                                Save
                              </button>
                              <button
                                onClick={() => setEditingCategory(null)}
                                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
                              >
                                <X className="h-3.5 w-3.5 inline mr-1" />
                                Cancel
                              </button>
                            </td>
                          </tr>
                        );
                      } else {
                        // Normal row (read-only)
                        return (
                          <tr key={cat.id} className="border-b hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="font-medium">{cat.name}</span>
                              {cat.description && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {cat.description}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => setEditingCategory(cat)}
                                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-100 mr-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f]"
                              >
                                <Edit2 className="h-3.5 w-3.5 inline mr-1" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="px-3 py-1.5 text-red-600 border border-red-300 rounded-md text-sm hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5 inline mr-1" />
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      }
                    })}
                    
                    {(categories || []).length === 0 && !loading && (
                      <tr>
                        <td colSpan={2} className="px-4 py-10 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="bg-gray-100 rounded-full p-3 mb-3">
                              <Layers className="h-6 w-6 text-gray-400" />
                            </div>
                            <p className="text-gray-500 font-medium">No categories yet</p>
                            <p className="text-gray-400 text-sm mt-1">
                              Add your first category using the form above
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
