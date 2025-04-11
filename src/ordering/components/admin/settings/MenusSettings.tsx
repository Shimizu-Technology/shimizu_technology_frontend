// src/ordering/componenets/admin/settings/MenusSettings.tsx
import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  Copy,
  X,
  Save,
  Book,
  Layers
} from 'lucide-react';

import { Tooltip, SettingsHeader } from '../../../../shared/components/ui';
import toastUtils from '../../../../shared/utils/toastUtils';
import { Link } from 'react-router-dom';

// Store imports
import { useMenuStore } from '../../../store/menuStore';
import { useRestaurantStore } from '../../../../shared/store/restaurantStore';

// Endpoint or store-level type
import { Menu } from '../../../../shared/api/endpoints/menu';

import {
  Category,
  fetchCategoriesByMenu,
  createCategory,
  updateCategory,
  deleteCategory
} from '../../../../shared/api/endpoints/categories';

// Import the CategoryManagementModal
import { CategoryManagementModal } from './CategoryManagementModal';

interface MenusSettingsProps {
  restaurantId?: string;
}

export function MenusSettings({ restaurantId }: MenusSettingsProps) {
  const {
    menus,
    menuItems,
    currentMenuId,
    loading,
    error,
    fetchMenus,
    fetchAllMenuItemsForAdmin,
    createMenu,
    updateMenu,
    deleteMenu,
    setActiveMenu,
    cloneMenu
  } = useMenuStore();

  const { restaurant } = useRestaurantStore();

  // Modal state for creating or editing a menu
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingMenu, setEditingMenu] = useState<Partial<Menu>>({ name: '' });
  
  // State for category management modal
  const [selectedMenuForCategories, setSelectedMenuForCategories] = useState<Menu | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryModalLoading, setCategoryModalLoading] = useState(false);
  const [prefetchedCategories, setPrefetchedCategories] = useState<Category[]>([]);
  
  // On mount, fetch menus & items
  useEffect(() => {
    async function initializeData() {
      await fetchMenus();
      await fetchAllMenuItemsForAdmin();
    }
    initializeData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * MENU CREATION / EDITING
   */
  const handleOpenCreateModal = () => {
    setModalMode('create');
    setEditingMenu({ name: '' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (menu: Menu) => {
    setModalMode('edit');
    setEditingMenu({ ...menu });
    setIsModalOpen(true);
  };

  const handleSaveMenu = async () => {
    if (!editingMenu.name?.trim()) {
      alert('Menu name is required');
      return;
    }

    if (modalMode === 'create' && restaurant?.id) {
      await createMenu(editingMenu.name, restaurant.id);
    } else if (modalMode === 'edit' && editingMenu.id) {
      await updateMenu(editingMenu.id, { name: editingMenu.name });
    }
    setIsModalOpen(false);
  };

  const handleDeleteMenu = async (id: number) => {
    if (id === currentMenuId) {
      alert('Cannot delete the active menu. Please set another menu as active first.');
      return;
    }
    if (
      window.confirm(
        'Are you sure you want to delete this menu? This will also delete all menu items associated with it.'
      )
    ) {
      await deleteMenu(id);
    }
  };

  /**
   * OPTIMISTIC UI for Active Menu
   */
  const [optimisticActiveMenuId, setOptimisticActiveMenuId] = useState<number | null>(null);
  const effectiveCurrentMenuId = optimisticActiveMenuId !== null 
    ? optimisticActiveMenuId 
    : currentMenuId;

  useEffect(() => {
    setOptimisticActiveMenuId(currentMenuId);
  }, [currentMenuId]);

  const handleSetActiveMenu = async (id: number) => {
    // Optimistic update
    setOptimisticActiveMenuId(id);
    try {
      await setActiveMenu(id);
    } catch (error) {
      setOptimisticActiveMenuId(currentMenuId);
    }
  };

  /**
   * MENU CLONING
   */
  const [cloningMenuId, setCloningMenuId] = useState<number | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    if (refreshTrigger > 0) {
      const refreshTimeout = setTimeout(() => {
        fetchMenus();
        fetchAllMenuItemsForAdmin();
      }, 1000);
      return () => clearTimeout(refreshTimeout);
    }
  }, [refreshTrigger, fetchMenus, fetchAllMenuItemsForAdmin]);

  const handleCloneMenu = async (id: number) => {
    if (
      !window.confirm(
        'Are you sure you want to clone this menu? This will create a copy of the menu and all its items.'
      )
    ) {
      return;
    }
    setCloningMenuId(id);
    setCloneError(null);

    try {
      const clonedMenu = await cloneMenu(id);
      if (clonedMenu) {
        // Refresh immediately
        await fetchMenus();
        await fetchAllMenuItemsForAdmin();
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (error: any) {
      if (error?.status !== 422) {
        setCloneError('Failed to clone menu. Please try again.');
      } else {
        // For 422, attempt silent refresh
        await fetchMenus();
        await fetchAllMenuItemsForAdmin();
        setRefreshTrigger(prev => prev + 1);
      }
    } finally {
      setCloningMenuId(null);
    }
  };

  /**
   * COUNT MENU ITEMS
   */
  const getMenuItemCount = (menuId: number) => {
    const count = menuItems.filter(item => Number(item.menu_id) === menuId).length;
    return count;
  };

  /**
   * CATEGORY MANAGEMENT
   */
  // Select a menu for category management and pre-fetch categories
  async function handleSelectMenuForCategories(menu: Menu) {
    // First set the selected menu
    setSelectedMenuForCategories(menu);
    
    // Set loading state
    setCategoryModalLoading(true);
    
    try {
      // Pre-fetch categories before opening the modal
      const response = await fetchCategoriesByMenu(menu.id, restaurant?.id) as Category[];
      
      // Process the response
      const categories: Category[] = Array.isArray(response) ? response : [];
      
      // Update state with fetched categories
      setPrefetchedCategories(categories);
      
      // Open the modal with loading set to false
      setCategoryModalLoading(false);
      setIsCategoryModalOpen(true);
    } catch (error) {
      // If there's an error, still open the modal but with empty categories
      setPrefetchedCategories([]);
      setCategoryModalLoading(false);
      setIsCategoryModalOpen(true);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <SettingsHeader 
          title="Menu Management"
          description="Create and manage menus for your restaurant."
          icon={<Book className="h-6 w-6" />}
        />
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center px-3 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f] w-auto"
          disabled={loading}
        >
          <Plus className="h-4 w-4 mr-1" />
          Create New Menu
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading && <p>Loading menus...</p>}

      {!loading && menus.length === 0 && (
        <div className="bg-gray-50 p-6 text-center rounded-lg">
          <p className="text-gray-500">No menus found. Create your first menu to get started.</p>
        </div>
      )}

      {/* Render the CategoryManagementModal */}
      {selectedMenuForCategories && (
        <CategoryManagementModal
          menu={selectedMenuForCategories}
          isOpen={isCategoryModalOpen}
          prefetchedCategories={prefetchedCategories}
          initialLoading={categoryModalLoading}
          onClose={() => {
            setIsCategoryModalOpen(false);
            setSelectedMenuForCategories(null);
            setPrefetchedCategories([]);
          }}
        />
      )}

      {/* MENU LIST */}
      {menus.length > 0 && (
        <>
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden sm:block bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Menu Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {menus.map(menu => (
                  <tr
                    key={menu.id}
                    className="h-16 transition-colors duration-300 ease-in-out"
                    style={{
                      backgroundColor:
                        menu.id === effectiveCurrentMenuId
                          ? 'rgba(254, 240, 138, 0.5)'
                          : 'white',
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {menu.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-6 flex items-center">
                        {menu.id === effectiveCurrentMenuId ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        {getMenuItemCount(menu.id)} items
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        {/* Set Active */}
                        {menu.id !== effectiveCurrentMenuId && (
                          <Tooltip content="Set as Active Menu">
                            <button
                              onClick={() => handleSetActiveMenu(menu.id)}
                              className="text-blue-600 hover:text-blue-900 transition-colors duration-200"
                              disabled={loading}
                            >
                              <Check className="h-5 w-5" />
                            </button>
                          </Tooltip>
                        )}

                        {/* Edit Menu */}
                        <Tooltip content="Edit Menu">
                          <button
                            onClick={() => handleOpenEditModal(menu)}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors duration-200"
                            disabled={loading}
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                        </Tooltip>

                        {/* Manage Categories */}
                        <Tooltip content="Manage Categories">
                          <button
                            onClick={() => handleSelectMenuForCategories(menu)}
                            className="text-purple-600 hover:text-purple-900 transition-colors duration-200"
                            disabled={loading}
                          >
                            <Layers className="h-5 w-5" />
                          </button>
                        </Tooltip>

                        {/* Clone Menu */}
                        <Tooltip content="Clone Menu">
                          <button
                            onClick={() => handleCloneMenu(menu.id)}
                            className="text-orange-600 hover:text-orange-900 transition-colors duration-200"
                            disabled={loading}
                          >
                            <Copy className="h-5 w-5" />
                          </button>
                        </Tooltip>

                        {/* Delete Menu */}
                        <Tooltip
                          content={
                            menu.id === currentMenuId
                              ? 'Cannot delete active menu'
                              : 'Delete Menu'
                          }
                        >
                          <button
                            onClick={() => handleDeleteMenu(menu.id)}
                            className={`transition-colors duration-200 ${
                              menu.id === currentMenuId
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-red-600 hover:text-red-900'
                            }`}
                            disabled={loading || menu.id === currentMenuId}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD VIEW */}
          <div className="sm:hidden space-y-4">
            {menus.map(menu => (
              <div
                key={menu.id}
                className="bg-white rounded-lg shadow p-4 transition-all duration-300 ease-in-out"
                style={{
                  borderLeft:
                    menu.id === effectiveCurrentMenuId
                      ? '4px solid #10b981'
                      : '4px solid transparent',
                }}
              >
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-gray-900">{menu.name}</h4>
                  <div className="h-6 flex items-center">
                    {menu.id === effectiveCurrentMenuId ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center text-sm text-gray-500 mb-3">
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                    {getMenuItemCount(menu.id)} items
                  </span>
                </div>

                <div className="flex justify-between border-t pt-3">
                  {/* Set Active (mobile) */}
                  <div className="w-20 h-8 flex items-center">
                    {menu.id !== effectiveCurrentMenuId && (
                      <button
                        onClick={() => handleSetActiveMenu(menu.id)}
                        className="flex items-center text-blue-600 text-sm transition-colors duration-200"
                        disabled={loading}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Set Active
                      </button>
                    )}
                  </div>
                  {/* Actions (mobile) */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => handleOpenEditModal(menu)}
                      className="text-indigo-600 transition-colors duration-200"
                      disabled={loading}
                      aria-label="Edit Menu"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>

                    <button
                      onClick={() => handleSelectMenuForCategories(menu)}
                      className="text-purple-600 transition-colors duration-200"
                      disabled={loading}
                      aria-label="Manage Categories"
                    >
                      <Layers className="h-5 w-5" />
                    </button>

                    <button
                      onClick={() => handleCloneMenu(menu.id)}
                      className="text-orange-600 transition-colors duration-200"
                      disabled={loading}
                      aria-label="Clone Menu"
                    >
                      <Copy className="h-5 w-5" />
                    </button>

                    <button
                      onClick={() => handleDeleteMenu(menu.id)}
                      className={`transition-colors duration-200 ${
                        menu.id === currentMenuId
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-red-600'
                      }`}
                      disabled={loading || menu.id === currentMenuId}
                      aria-label={
                        menu.id === currentMenuId
                          ? 'Cannot delete active menu'
                          : 'Delete Menu'
                      }
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* CREATE/EDIT MENU MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">
                {modalMode === 'create' ? 'Create New Menu' : 'Edit Menu'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 transition-colors duration-200"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Menu Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editingMenu.name || ''}
                onChange={(e) =>
                  setEditingMenu({ ...editingMenu, name: e.target.value })
                }
                className="w-full px-4 py-2 border rounded-md"
                placeholder="e.g., Regular Menu, Holiday Special, etc."
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border rounded-md hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMenu}
                className="inline-flex items-center px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f] transition-colors duration-200"
                disabled={loading}
              >
                <Save className="h-5 w-5 mr-2" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INFO BANNER */}
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">About Menu Management</h4>
        <p className="text-sm text-blue-700">
          Create multiple menus for different occasions or events. Set one menu as active
          to display to customers. You can clone an existing menu to create a new one with
          all the same items, then modify it as needed.
        </p>
        <p className="text-sm text-blue-700 mt-2">
          Use the Menu Manager to add, edit, or remove items from your menus.
        </p>
      </div>
    </div>
  );
}
