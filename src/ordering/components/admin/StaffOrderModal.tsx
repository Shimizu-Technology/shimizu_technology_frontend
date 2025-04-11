// src/ordering/componenets/admin/StaffOrderModal.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import toastUtils from '../../../shared/utils/toastUtils';
import { useMenuStore } from '../../store/menuStore';
import { useOrderStore } from '../../store/orderStore';
import { useRestaurantStore } from '../../../shared/store/restaurantStore';
import { useAuthStore } from '../../store/authStore';
import { MenuItem } from '../../types/menu';
import { apiClient } from '../../../shared/api/apiClient';
// import { orderPaymentOperationsApi } from '../../../shared/api/endpoints/orderPaymentOperations';

// Payment components
import { StripeCheckout, StripeCheckoutRef } from '../../components/payment/StripeCheckout';
import { PayPalCheckout, PayPalCheckoutRef } from '../../components/payment/PayPalCheckout';

// Child components
// Used in JSX below - TypeScript doesn't detect this correctly
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ItemCustomizationModal } from './ItemCustomizationModal';
import { StaffOrderOptions } from './StaffOrderOptions';


interface StaffOrderModalProps {
  onClose: () => void;
  onOrderCreated: (orderId: string) => void;
  restaurantId?: string; // Optional if needed
}

/** --------------------------------------------------------------------
 * UTILITY FUNCTIONS
 * -------------------------------------------------------------------*/

/** Validate phone e.g. +16711234567 */
function isValidPhone(phoneStr: string) {
  return /^\+\d{3,4}\d{7}$/.test(phoneStr);
}

/** Hook that returns true if width < 768px (mobile) */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);
  return isMobile;
}

/** --------------------------------------------------------------------
 * MENU ITEMS PANEL
 * -------------------------------------------------------------------*/
interface MenuItemsPanelProps {
  menuItems: MenuItem[];
  menuLoading: boolean;
  categories: Map<number, string>;
  selectedCategory: number | 'all';
  setSelectedCategory: (cat: number | 'all') => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  findCartItem: (id: string) => any;
  handleAddItem: (item: MenuItem) => void;
  setCustomizingItem: (item: MenuItem) => void;
  setCartQuantity: (key: any, qty: number) => void;
  removeFromCart: (key: any) => void;
  getItemKey: (item: any) => string;
}

function MenuItemsPanel({
  menuItems,
  menuLoading,
  categories,
  selectedCategory,
  setSelectedCategory,
  searchTerm,
  setSearchTerm,
  findCartItem,
  handleAddItem,
  setCustomizingItem,
  setCartQuantity,
  removeFromCart,
  getItemKey
}: MenuItemsPanelProps) {
  // Debug: Log categories when they change
  useEffect(() => {
    // Categories processed for menu items panel
  }, [categories]);
  // Filter items by search term & category
  const filteredMenuItems = menuItems.filter(item => {
    const matchesSearch =
      !searchTerm ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat =
      selectedCategory === 'all' ||
      (item.category_ids && item.category_ids.includes(Number(selectedCategory)));
    return matchesSearch && matchesCat;
  });

  // Group items by category
  function groupedMenuItems() {
    if (selectedCategory !== 'all') {
      return {
        [selectedCategory.toString()]: filteredMenuItems.filter(item =>
          item.category_ids?.includes(Number(selectedCategory))
        ),
      };
    }
    const grouped: Record<string, MenuItem[]> = { uncategorized: [] };
    filteredMenuItems.forEach(item => {
      if (!item.category_ids?.length) {
        grouped.uncategorized.push(item);
      } else {
        item.category_ids.forEach(catId => {
          const key = catId.toString();
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(item);
        });
      }
    });
    if (!grouped.uncategorized.length) delete grouped.uncategorized;
    return grouped;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Search & categories */}
      <div>
        <input
          type="text"
          placeholder="Search items..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md
                     focus:outline-none focus:ring-2 focus:ring-[#c1902f]"
        />
        <div className="flex items-center mt-3 gap-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium
            ${selectedCategory === 'all'
              ? 'bg-[#c1902f] text-white shadow'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Items
          </button>
          {Array.from(categories.entries()).map(([catId, catName]) => (
            <button
              key={catId}
              onClick={() => setSelectedCategory(catId)}
              className={`whitespace-nowrap px-4 py-3 rounded-md text-sm font-medium
              ${selectedCategory === catId
                ? 'bg-[#c1902f] text-white shadow'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {catName}
            </button>
          ))}
        </div>
      </div>

      {/* Item cards */}
      <div className="mt-4">
        {menuLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c1902f]" />
          </div>
        ) : filteredMenuItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No menu items found.</div>
        ) : (
          Object.entries(groupedMenuItems()).map(([catId, items]) => (
            <div key={catId} className="mb-6">
              <h3 className="font-medium text-lg mb-3 pb-1 border-b border-gray-100">
                {categories.get(Number(catId)) ||
                  (catId === 'uncategorized' ? 'Uncategorized' : `Category ${catId}`)}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map(item => {
                  const cartItem = findCartItem(item.id);
                  const isInCart = !!cartItem;
                  const hasOptions = item.option_groups && item.option_groups.length > 0;

                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg hover:shadow-md transition-shadow p-1
                        ${isInCart
                          ? 'border-[#c1902f] bg-yellow-50 shadow'
                          : 'border-gray-200'
                        }`}
                    >
                      <div className="flex h-full w-full">
                        {/* Item image */}
                        <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 overflow-hidden rounded-l-lg">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={e => {
                              (e.target as HTMLImageElement).src = '/placeholder-food.png';
                            }}
                          />
                        </div>
                        
                        {/* Item details */}
                        <div className="flex-1 p-2 flex flex-col justify-between overflow-hidden">
                          <div className="flex flex-col mb-1">
                            <h4 className="font-medium text-gray-900 text-sm sm:text-base leading-tight line-clamp-2">
                              {item.name}
                            </h4>
                            <p className="text-[#c1902f] font-semibold text-sm sm:text-base mt-1">
                              ${item.price.toFixed(2)}
                            </p>
                          </div>
                          
                          {/* Stock indicator */}
                          {(item.enable_stock_tracking || item.stock_status === 'out_of_stock' || item.stock_status === 'low_stock') && (
                            <p className="text-xs text-gray-500 mb-1">
                              {(() => {
                                // Check manually set stock status first
                                if (item.stock_status === 'out_of_stock') {
                                  return 'Out of stock';
                                }
                                if (item.stock_status === 'low_stock') {
                                  return 'Low stock';
                                }
                                
                                // Then check inventory tracking
                                if (item.enable_stock_tracking && item.available_quantity !== undefined) {
                                  // Calculate effective available quantity by subtracting cart quantity
                                  const cartItem = findCartItem(item.id);
                                  const cartQuantity = cartItem ? cartItem.quantity : 0;
                                  const effectiveQuantity = item.available_quantity - cartQuantity;
                                  return effectiveQuantity > 0
                                    ? `${effectiveQuantity} left`
                                    : 'Out of stock';
                                }
                                return '';
                              })()}
                            </p>
                          )}

                          {/* Add / Customize / Stock buttons */}
                          <div className="flex justify-end">
                            {(item.stock_status === 'out_of_stock' ||
                              (item.enable_stock_tracking && item.available_quantity !== undefined && (() => {
                                // Calculate effective available quantity by subtracting cart quantity
                                const cartItem = findCartItem(item.id);
                                const cartQuantity = cartItem ? cartItem.quantity : 0;
                                const effectiveQuantity = item.available_quantity - cartQuantity;
                                return effectiveQuantity <= 0;
                              })())
                            ) ? (
                              // Out of stock
                              <button
                                disabled
                                className="bg-gray-300 text-gray-500 px-3 py-1 rounded text-sm font-medium cursor-not-allowed"
                              >
                                Out of Stock
                              </button>
                            ) : isInCart && !hasOptions ? (
                              <div className="flex items-center">
                                {/* Decrease */}
                                <button
                                  onClick={() => {
                                    const itemKey = getItemKey(item);
                                    if (cartItem.quantity > 1) {
                                      setCartQuantity(itemKey, cartItem.quantity - 1);
                                    } else {
                                      removeFromCart(itemKey);
                                    }
                                  }}
                                  className="text-gray-600 hover:text-[#c1902f] p-2.5"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor">
                                    <path
                                      fillRule="evenodd"
                                      d="M5 10a1 1 0
                                      011-1h8a1 1 0
                                      110 2H6a1 1 0
                                      01-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </button>
                                <span className="mx-2 text-sm">{cartItem.quantity}</span>
                                {/* Increase */}
                                <button
                                  onClick={() => {
                                    const itemKey = getItemKey(item);
                                    setCartQuantity(itemKey, cartItem.quantity + 1);
                                  }}
                                  className="text-gray-600 hover:text-[#c1902f] p-2.5"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor">
                                    <path
                                      fillRule="evenodd"
                                      d="M10 5a1 1 0
                                      011 1v3h3a1 1 0
                                      110 2h-3v3a1 1 0
                                      11-2 0v-3H6a1 1 0
                                      110-2h3V6a1 1 0
                                      011-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </button>
                              </div>
                            ) : hasOptions ? (
                              <button
                                onClick={() => setCustomizingItem(item)}
                                className="bg-[#c1902f] text-white px-2 py-2.5 rounded text-base font-medium hover:bg-[#a97c28]"
                              >
                                {isInCart ? 'Add Another' : 'Customize'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAddItem(item)}
                                className="text-[#c1902f] hover:bg-[#c1902f] hover:text-white px-4 py-2.5 rounded text-base font-medium"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** --------------------------------------------------------------------
 * ORDER PANEL
 * -------------------------------------------------------------------*/
interface OrderPanelProps {
  cartItems: any[];
  findCartItem: (id: string) => any;
  setCartQuantity: (key: any, qty: number) => void;
  removeFromCart: (key: any) => void;
  handleSubmitOrder: () => void;
  orderTotal: number;
  orderLoading: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  setCustomizingItem: (item: MenuItem) => void;
  // Staff order props
  isStaffOrder: boolean;
  setIsStaffOrder: (value: boolean) => void;
  staffMemberId: number | null;
  setStaffMemberId: (value: number | null) => void;
  staffOnDuty: boolean;
  setStaffOnDuty: (value: boolean) => void;
  useHouseAccount: boolean;
  setUseHouseAccount: (value: boolean) => void;
  createdByStaffId: number | null;
  setCreatedByStaffId: (value: number | null) => void;
  preDiscountTotal: number;
}

function OrderPanel({
  cartItems,
  findCartItem,
  setCartQuantity,
  removeFromCart,
  handleSubmitOrder,
  orderTotal,
  orderLoading,
  onClose,
  menuItems,
  setCustomizingItem,
  // Staff order props
  isStaffOrder,
  setIsStaffOrder,
  staffMemberId,
  setStaffMemberId,
  staffOnDuty,
  setStaffOnDuty,
  useHouseAccount,
  setUseHouseAccount,
  createdByStaffId,
  setCreatedByStaffId,
  preDiscountTotal,
}: OrderPanelProps) {
  const getItemKey = useOrderStore(state => state._getItemKey);
  const [staffOptionsExpanded, setStaffOptionsExpanded] = useState(true);

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable cart section */}
      <div className="overflow-y-auto flex-1 p-4 pb-[150px]">
        <h3 className="text-lg font-semibold mb-4">Current Order</h3>
        
        {/* Staff Order Checkbox and Toggle */}
        <div className="bg-gray-50 p-3 rounded-md mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="staff-order-checkbox"
                checked={isStaffOrder}
                onChange={(e) => setIsStaffOrder(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="staff-order-checkbox" className="ml-2 text-sm font-medium text-gray-900">
                Staff Order
              </label>
            </div>
            {isStaffOrder && (
              <button 
                onClick={() => setStaffOptionsExpanded(!staffOptionsExpanded)}
                className="text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
              >
                {staffOptionsExpanded ? 'Collapse' : 'Expand'}
              </button>
            )}
          </div>
          
          {/* Collapsible Staff Order Options */}
          {isStaffOrder && staffOptionsExpanded && (
            <div className="mt-3">
              <StaffOrderOptions
                isStaffOrder={isStaffOrder}
                setIsStaffOrder={setIsStaffOrder}
                staffMemberId={staffMemberId}
                setStaffMemberId={setStaffMemberId}
                staffOnDuty={staffOnDuty}
                setStaffOnDuty={setStaffOnDuty}
                useHouseAccount={useHouseAccount}
                setUseHouseAccount={setUseHouseAccount}
                createdByStaffId={createdByStaffId}
                setCreatedByStaffId={setCreatedByStaffId}
              />
            </div>
          )}
        </div>
        {cartItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No items in the order yet</div>
        ) : (
          <div className="space-y-3">
            {cartItems.map(item => {
              const itemKey = getItemKey(item);
              return (
                <div
                  key={itemKey}
                  className="border border-gray-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium text-gray-800 text-sm sm:text-base line-clamp-1 pr-2 flex-1">
                      {item.name}
                    </p>
                    <div className="flex items-center">
                      <span className="text-gray-700 font-medium text-sm sm:text-base mr-2">
                        ${(item.price * item.quantity).toFixed(2)}
                        {item.customizations && item.customizations.length > 0 && (
                          <span className="text-xs text-gray-500 ml-1">
                            (${item.price.toFixed(2)} each)
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => removeFromCart(itemKey)}
                        className="text-gray-400 hover:text-red-500 p-1 focus:outline-none"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1
                            1 0
                            011.414 0L10
                            8.586l4.293-4.293a1 1 0
                            011.414 1.414L11.414
                            10l4.293
                            4.293a1 1 0
                            01-1.414
                            1.414L10
                            11.414l-4.293
                            4.293a1 1 0
                            01-1.414-1.414L8.586
                            10 4.293
                            5.707a1 1 0
                            010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Customizations */}
                  {item.customizations && (
                    <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                      {Array.isArray(item.customizations) ? (
                        item.customizations.map((custom: any, idx: number) => {
                          // Attempt to find actual names from menu item
                          const menuItem = menuItems.find(m => m.id === item.id);
                          let optionGroupName = `Group ${custom.option_group_id}`;
                          let optionName = `Option ${custom.option_id}`;
                          if (menuItem && menuItem.option_groups) {
                            const group = menuItem.option_groups.find(g => g.id === custom.option_group_id);
                            if (group) {
                              optionGroupName = group.name;
                              const opt = group.options.find(o => o.id === custom.option_id);
                              if (opt) optionName = opt.name;
                            }
                          }
                          return (
                            <div key={idx} className="flex items-center">
                              <span className="inline-block w-2 h-2 bg-[#c1902f] rounded-full mr-1.5"></span>
                              <span className="font-medium">{optionGroupName}:</span> {optionName}
                            </div>
                          );
                        })
                      ) : (
                        // Object-based customizations
                        Object.entries(item.customizations).map(([groupName, options], idx: number) => (
                          <div key={idx} className="flex items-center">
                            <span className="inline-block w-2 h-2 bg-[#c1902f] rounded-full mr-1.5"></span>
                            <span className="font-medium">{groupName}:</span>{' '}
                            {Array.isArray(options) ? options.join(', ') : String(options)}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* +/- controls */}
                  <div className="flex items-center justify-between mt-2 flex-wrap">
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                      {/* Decrease */}
                      <button
                        onClick={() => {
                          if (item.quantity > 1) {
                            setCartQuantity(itemKey, item.quantity - 1);
                          } else {
                            removeFromCart(itemKey);
                          }
                        }}
                        className="text-gray-600 hover:text-[#c1902f] p-2.5 rounded-l"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M5 10a1 1 0
                            011-1h8a1 1 0
                            110 2H6a1 1 0
                            01-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      <span className="mx-2 w-6 text-center text-sm font-medium">{item.quantity}</span>
                      {/* Increase */}
                      <button
                        onClick={() => {
                          setCartQuantity(itemKey, item.quantity + 1);
                        }}
                        disabled={(() => {
                          const menuItem = menuItems.find(m => m.id === item.id);
                          if (menuItem?.enable_stock_tracking && menuItem.available_quantity !== undefined) {
                            const cartItem = findCartItem(menuItem.id);
                            const cartQuantity = cartItem ? cartItem.quantity : 0;
                            const effectiveQuantity = menuItem.available_quantity - cartQuantity;
                            return effectiveQuantity <= 0;
                          }
                          return false;
                        })()}
                        className="text-gray-600 hover:text-[#c1902f] p-2.5 rounded-r"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 5a1 1 0
                            011 1v3h3a1 1 0
                            110 2h-3v3a1 1 0
                            11-2 0v-3H6a1 1 0
                            110-2h3V6a1 1 0
                            011-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    {/* Add Another if custom */}
                    {item.customizations && item.id && (
                      <button
                        onClick={() => {
                          const mi = menuItems.find(m => m.id === item.id);
                          if (mi?.option_groups?.length) {
                            // Check stock before adding
                            if (mi.enable_stock_tracking && mi.available_quantity !== undefined) {
                              const cartItem = findCartItem(mi.id);
                              const cartQuantity = cartItem ? cartItem.quantity : 0;
                              const effectiveQuantity = mi.available_quantity - cartQuantity;
                              if (effectiveQuantity <= 0) {
                                toastUtils.error(`Cannot add more ${mi.name}. Stock limit reached.`);
                                return;
                              }
                            }
                            setCustomizingItem(mi);
                          }
                        }}
                        disabled={(() => {
                          const menuItem = menuItems.find(m => m.id === item.id);
                          if (menuItem?.enable_stock_tracking && menuItem.available_quantity !== undefined) {
                            const cartItem = findCartItem(menuItem.id);
                            const cartQuantity = cartItem ? cartItem.quantity : 0;
                            const effectiveQuantity = menuItem.available_quantity - cartQuantity;
                            return effectiveQuantity <= 0;
                          }
                          return false;
                        })()}
                        className="mt-1 sm:mt-0 text-[#c1902f] border border-[#c1902f]
                                   hover:bg-[#c1902f] hover:text-white px-4 py-2
                                   rounded text-sm font-medium transition-colors"
                      >
                        Add Another
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom bar for totals and 'Create Order' */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-md">
        {isStaffOrder && (
          <div className="mb-3 bg-gray-50 p-2 rounded-md border border-gray-200">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700">Original Price:</span>
              <span className="text-gray-700">${preDiscountTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-700">
                Discount ({staffOnDuty ? '50%' : '30%'}):
              </span>
              <span className="text-green-600">-${(preDiscountTotal - orderTotal).toFixed(2)}</span>
            </div>
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold text-gray-700 text-lg">Total:</span>
          <span className="font-bold text-xl text-[#c1902f]">
            ${orderTotal.toFixed(2)}
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={onClose}
            className="py-3 text-gray-700 bg-gray-100 rounded-md font-medium hover:bg-gray-200
              focus:outline-none focus:ring-2 focus:ring-gray-300 shadow-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitOrder}
            disabled={!cartItems.length || orderLoading}
            className="py-3 bg-[#c1902f] text-white rounded-md font-medium hover:bg-[#a97c28]
              focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:ring-opacity-50
              disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            {orderLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none" viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0
                      018-8V0C5.373 0 0 5.373 0 12h4zm2
                      5.291A7.962
                      7.962
                      0
                      014
                      12H0c0
                      3.042
                      1.135
                      5.824
                      3
                      7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </span>
            ) : (
              'Create Order'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


/** --------------------------------------------------------------------
 * CUSTOMER INFO PANEL
 * (with scrollable content, pinned button at bottom)
 * -------------------------------------------------------------------*/
interface CustomerInfoPanelProps {
  contactName: string;
  setContactName: (val: string) => void;
  contactPhone: string;
  setContactPhone: (val: string) => void;
  contactEmail: string;
  setContactEmail: (val: string) => void;
  specialInstructions: string;
  setSpecialInstructions: (val: string) => void;
  
  handleSubmitOrder: () => void;
  cartItems: any[];
  orderLoading: boolean;
  onBack: () => void;
}

function CustomerInfoPanel({
  contactName, setContactName,
  contactPhone, setContactPhone,
  contactEmail, setContactEmail,
  specialInstructions, setSpecialInstructions,
  handleSubmitOrder,
  cartItems,
  orderLoading,
  onBack,
}: CustomerInfoPanelProps) {

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="overflow-y-auto flex-1">
        <div className="px-4 py-4 space-y-4 pb-16">
          <h3 className="text-lg font-semibold text-gray-800 sticky top-0 bg-white z-10 py-2">Customer Information</h3>
          
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none
                         focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] text-sm shadow-sm"
              placeholder="Customer name"
            />
          </div>
          
          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={e => setContactPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none
                         focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] text-sm shadow-sm"
              placeholder="+1671"
            />
          </div>
          
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={e => setContactEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none
                         focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] text-sm shadow-sm"
              placeholder="Email address"
            />
          </div>
          
          {/* Special Instructions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Special Instructions
            </label>
            <textarea
              value={specialInstructions}
              onChange={e => setSpecialInstructions(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none
                         focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] text-sm shadow-sm"
              placeholder="Special instructions or notes"
              rows={4}
            />
          </div>

        </div>
      </div>

      {/* Bottom button: "Back to Order" */}
      <div className="px-4 absolute bottom-4 left-0 right-0">
        <button
          onClick={onBack}
          className="w-full py-2.5 text-sm font-medium bg-gray-50 border border-gray-300
                     hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
        >
          Back to Order
        </button>
      </div>

    </div>
  );
}

/** --------------------------------------------------------------------
 * PAYMENT PANEL
 * (For non-staff payments)
 * -------------------------------------------------------------------*/
interface PaymentPanelProps {
  orderTotal: number;
  onPaymentSuccess: (details: {
    status: string;
    transaction_id: string;
    payment_id?: string;
    amount: string;
    currency?: string;
    payment_details?: any;
  }) => void;
  onPaymentError: (error: Error) => void;
  onBack: () => void;
  isProcessing: boolean;
}

function PaymentPanel({
  orderTotal,
  onPaymentSuccess,
  onPaymentError,
  onBack,
  isProcessing
}: PaymentPanelProps) {
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'cash' | 'payment_link' | 'clover' | 'revel' | 'other' | 'stripe_reader'>('credit_card');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('');
  const [paymentLinkSent, setPaymentLinkSent] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  // For dynamic height adjustment
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  // Simplified payment state management
  const [paymentState, setPaymentState] = useState<'idle' | 'loading' | 'processing' | 'success' | 'error'>('idle');
  
  // Manual payment details
  const [transactionId, setTransactionId] = useState('');
  // Set default payment date to today
  const today = new Date().toISOString().split('T')[0];
  // Cash register functionality
  const [cashReceived, setCashReceived] = useState<string>(orderTotal.toString());
  
  // For simplicity, we'll use a temporary ID for the cash payment
  // In a real implementation, you would get this from the order being created
  const tempOrderId = 'temp-order';
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentNotes, setPaymentNotes] = useState('');
  
  // Get current user from auth store
  const { user } = useAuthStore();

  // Payment processor config
  const stripeRef = useRef<StripeCheckoutRef>(null);
  const paypalRef = useRef<PayPalCheckoutRef>(null);
  const restaurant = useRestaurantStore((state) => state.restaurant);
  const paymentGateway = restaurant?.admin_settings?.payment_gateway || {};
  const paymentProcessor = paymentGateway.payment_processor || 'paypal';
  const testMode = paymentGateway.test_mode !== false;
  
  // Handle resize when payment method changes or payment elements load
  useEffect(() => {
    const handleResize = () => {
      setContainerHeight(window.innerHeight);
    };
    
    // Call once when payment method changes
    handleResize();
    
    // Also listen for window resize events
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [paymentMethod]);

  const handleCashPayment = async () => {
    // Convert string to number for calculations
    const cashReceivedNum = cashReceived === '' ? 0 : parseFloat(cashReceived);
    
    // Validate that cash received is sufficient
    if (cashReceivedNum < orderTotal) {
      setPaymentError('Cash received must be at least equal to the order total');
      return;
    }
    
    setPaymentState('processing');
    
    // For now, we'll simulate the cash payment without calling the backend
    // In a real implementation, you would call the API endpoint
    try {
      // Calculate change
      const changeDue = cashReceivedNum - orderTotal;
      
      // Show change due to the user if needed
      if (changeDue > 0) {
        toastUtils.success(`Payment successful. Change due: $${changeDue.toFixed(2)}`);
      } else {
        toastUtils.success('Payment successful');
      }
      
      // Complete the order process
      onPaymentSuccess({
        status: 'succeeded',
        transaction_id: `cash_${Date.now()}`,
        amount: orderTotal.toString(),
        payment_details: {
          payment_method: 'cash',
          transaction_id: `cash_${Date.now()}`,
          payment_date: today,
          notes: `Cash payment - Received: $${cashReceivedNum.toFixed(2)}, Change: $${changeDue.toFixed(2)}`,
          cash_received: cashReceivedNum,
          change_due: changeDue,
          status: 'succeeded'
        }
      });
      
      setPaymentState('success');
    } catch (err: any) {
      console.error('Error processing cash payment:', err);
      const errorMessage = err.response?.data?.error || 'Failed to process cash payment';
      toastUtils.error(errorMessage);
      setPaymentError(errorMessage);
      setPaymentState('error');
    }
  };

  const handleSendPaymentLink = async () => {
    if (!customerEmail && !customerPhone) {
      setPaymentError('Please provide either an email or phone number to send the payment link.');
      return;
    }
    setPaymentError(null);
    try {
      // Simulate payment link creation
      const mockPaymentLink = `https://payment.example.com/order/${Date.now()}?token=abc123`;
      setPaymentLinkUrl(mockPaymentLink);
      setPaymentLinkSent(true);
    } catch (error) {
      console.error('Error creating payment link:', error);
      setPaymentError('Failed to create payment link. Please try again.');
    }
  };

  const handleProcessPayment = async () => {
    if (paymentState === 'processing') return;
    
    if (paymentMethod === 'cash') {
      handleCashPayment();
      return;
    }
    if (paymentMethod === 'payment_link') {
      handleSendPaymentLink();
      return;
    }
    if (['stripe_reader', 'clover', 'revel', 'other'].includes(paymentMethod)) {
      handleManualPayment();
      return;
    }
    
    // Credit Card Payment
    try {
      setPaymentState('processing');
      
      if (paymentProcessor === 'stripe' && stripeRef.current) {
        const success = await stripeRef.current.processPayment();
        if (!success) {
          setPaymentState('error');
        }
      } else if (paymentProcessor === 'paypal' && paypalRef.current) {
        const success = await paypalRef.current.processPayment();
        if (!success) {
          setPaymentState('error');
        }
      } else {
        toastUtils.error('Payment processor not configured');
        setPaymentState('error');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      onPaymentError(error instanceof Error ? error : new Error('Payment processing failed'));
      setPaymentState('error');
    }
  };

  // New function to handle manual payments
  const handleManualPayment = () => {
    // Validate required fields
    if (!paymentDate) {
      setPaymentError('Payment date is required');
      return;
    }
    
    setPaymentState('processing');
    
    try {
      // Create payment details object
      const paymentDetails = {
        payment_method: paymentMethod,
        transaction_id: transactionId || `${paymentMethod}_${Date.now()}`,
        payment_date: paymentDate,
        staff_id: user?.id, // Capture the current user's ID
        notes: paymentNotes || `Payment processed via ${paymentMethod}`,
        status: 'succeeded',
        processor: paymentMethod === 'stripe_reader' ? 'stripe' : paymentMethod
      };
      
      // Call the success callback with the payment details
      onPaymentSuccess({
        status: 'succeeded',
        transaction_id: paymentDetails.transaction_id,
        amount: orderTotal.toString(),
        payment_details: paymentDetails
      });
      
      setPaymentState('success');
    } catch (error) {
      console.error('Error processing manual payment:', error);
      setPaymentError('Failed to process manual payment');
      setPaymentState('error');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area with more padding for payment elements */}
      <div className="overflow-y-auto p-4 pb-28 flex-1">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 sticky top-0 bg-white z-10 py-2">Payment</h3>

        {/* Payment Method Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            <button
              type="button"
              className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                paymentMethod === 'credit_card'
                  ? 'bg-[#c1902f] text-white border-[#c1902f]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setPaymentMethod('credit_card')}
            >
              Credit Card
            </button>
            <button
              type="button"
              className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                paymentMethod === 'stripe_reader'
                  ? 'bg-[#c1902f] text-white border-[#c1902f]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setPaymentMethod('stripe_reader')}
            >
              Stripe Reader
            </button>
            <button
              type="button"
              className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                paymentMethod === 'cash'
                  ? 'bg-[#c1902f] text-white border-[#c1902f]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setPaymentMethod('cash')}
            >
              Cash
            </button>
            <button
              type="button"
              className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                paymentMethod === 'payment_link'
                  ? 'bg-[#c1902f] text-white border-[#c1902f]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setPaymentMethod('payment_link')}
            >
              Send Link
            </button>
            <button
              type="button"
              className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                paymentMethod === 'clover'
                  ? 'bg-[#c1902f] text-white border-[#c1902f]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setPaymentMethod('clover')}
            >
              Clover
            </button>
            <button
              type="button"
              className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                paymentMethod === 'revel'
                  ? 'bg-[#c1902f] text-white border-[#c1902f]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setPaymentMethod('revel')}
            >
              Revel
            </button>
            <button
              type="button"
              className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors ${
                paymentMethod === 'other'
                  ? 'bg-[#c1902f] text-white border-[#c1902f]'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => setPaymentMethod('other')}
            >
              Other
            </button>
          </div>
        </div>

        {/* Credit Card Panel - with improved layout */}
        {paymentMethod === 'credit_card' && !paymentLinkSent && (
          <div className="border border-gray-200 rounded-md p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Credit Card Payment</h4>
            <div className="sm:flex sm:space-x-4">
              <div className="w-full">
                <div className="w-full">
                  {paymentProcessor === 'stripe' ? (
                    <StripeCheckout
                      ref={stripeRef}
                      amount={orderTotal.toString()}
                      publishableKey={(paymentGateway.publishable_key as string) || ""}
                      currency="USD"
                      testMode={testMode}
                      onPaymentSuccess={onPaymentSuccess}
                      onPaymentError={onPaymentError}
                    />
                  ) : (
                    <PayPalCheckout
                      ref={paypalRef}
                      amount={orderTotal.toString()}
                      clientId={(paymentGateway.client_id as string) || "sandbox_client_id"}
                      currency="USD"
                      testMode={testMode}
                      onPaymentSuccess={onPaymentSuccess}
                      onPaymentError={onPaymentError}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cash Payment Panel */}
        {paymentMethod === 'cash' && !paymentLinkSent && (
          <div className="border border-gray-200 rounded-md p-4 mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Cash Payment</h4>
            <div className="space-y-4">
              {/* Order Total Display */}
              <div className="flex justify-between items-center font-medium bg-gray-50 p-3 rounded-md">
                <span>Order Total:</span>
                <span className="text-lg text-[#c1902f]">${orderTotal.toFixed(2)}</span>
              </div>
              
              {/* Cash Received Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cash Received
                </label>
                
                {/* Quick denomination buttons */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[5, 10, 20, 50, 100].map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setCashReceived(amount.toString())}
                      className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors
                        ${cashReceived === amount.toString()
                          ? 'bg-[#c1902f] text-white border-[#c1902f]'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      ${amount}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashReceived(Math.ceil(orderTotal).toString())}
                    className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors
                      ${cashReceived === Math.ceil(orderTotal).toString()
                        ? 'bg-[#c1902f] text-white border-[#c1902f]'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    ${Math.ceil(orderTotal)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashReceived(orderTotal.toString())}
                    className={`px-3 py-2 border rounded-md text-sm font-medium transition-colors
                      ${cashReceived === orderTotal.toString()
                        ? 'bg-[#c1902f] text-white border-[#c1902f]'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    Exact
                  </button>
                </div>
                
                {/* Custom amount input */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={e => {
                      // Ensure we're always working with a string
                      const newValue = e.target.value;
                      setCashReceived(newValue);
                    }}
                    onFocus={e => {
                      // Select all text when focused to make it easier to replace
                      e.target.select();
                    }}
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                    placeholder="Other amount"
                  />
                </div>
              </div>
              
              {/* Change Calculation (only shown if cashReceived > orderTotal) */}
              {parseFloat(cashReceived || '0') > orderTotal && (
                <div className="bg-green-50 border border-green-100 rounded-md p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Change Due:</span>
                    <span className="text-lg font-bold text-green-700">
                      ${(parseFloat(cashReceived || '0') - orderTotal).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
{/* Manual Payment Panel (Stripe Reader, Clover, Revel, Other) */}
{['stripe_reader', 'clover', 'revel', 'other'].includes(paymentMethod) && (
  <div className="border border-gray-200 rounded-md p-4 mb-6">
    <h4 className="text-sm font-medium text-gray-700 mb-3">
      {paymentMethod === 'stripe_reader'
        ? 'Stripe Card Reader'
        : paymentMethod === 'clover'
          ? 'Clover'
          : paymentMethod === 'revel'
            ? 'Revel'
            : 'Other'} Payment Details
    </h4>
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Transaction ID/Reference Number (optional)
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
          value={transactionId}
          onChange={e => setTransactionId(e.target.value)}
          placeholder="Enter transaction ID or reference number"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Payment Date
        </label>
        <input
          type="date"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
          value={paymentDate}
          onChange={e => setPaymentDate(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes (optional)
        </label>
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
          value={paymentNotes}
          onChange={e => setPaymentNotes(e.target.value)}
          placeholder="Enter any additional payment notes"
          rows={3}
        />
      </div>
    </div>
  </div>
)}

        {/* Payment Link Panel */}
        {paymentMethod === 'payment_link' && !paymentLinkSent && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Email (optional)
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Phone (optional)
              </label>
              <input
                type="tel"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#c1902f] focus:border-[#c1902f]"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+1234567890"
              />
            </div>
            <p className="text-sm text-gray-500">
              Please provide at least one contact method to send the payment link.
            </p>
          </div>
        )}

        {/* Payment Link Sent */}
        {paymentLinkSent && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293
                      a1 1 0 00-1.414-1.414L9 10.586 7.707
                      9.293a1 1 0 00-1.414 1.414l2 2
                      a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Payment Link Sent</h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>A payment link has been sent. The customer can complete payment via:</p>
                  <div className="mt-2 bg-white p-2 rounded border border-gray-200 break-all">
                    <a
                      href={paymentLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {paymentLinkUrl}
                    </a>
                  </div>
                  <p className="mt-2">
                    You can mark items as paid once the customer finishes payment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Error */}
        {paymentError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16
                      8 8 0 000 16zM8.707 7.293a1 1 0
                      00-1.414 1.414L8.586 10l-1.293
                      1.293a1 1 0 101.414
                      1.414L10 11.414l1.293
                      1.293a1 1 0 001.414-1.414L11.414
                      10l1.293-1.293a1 1 0
                      00-1.414-1.414L10
                      8.586 8.707
                      7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{paymentError}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed buttons at the bottom */}
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-md z-20 mt-auto">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={onBack}
            className="py-3 text-gray-700 bg-gray-100 rounded-md font-medium
                       hover:bg-gray-200 focus:outline-none focus:ring-2
                       focus:ring-gray-300 shadow-sm transition-colors"
            disabled={isProcessing}
          >
            Back
          </button>
          {!paymentLinkSent ? (
            <button
              onClick={handleProcessPayment}
              disabled={
                paymentState === 'processing' || isProcessing ||
                (paymentMethod === 'payment_link' && !customerEmail && !customerPhone) ||
                (paymentMethod === 'cash' && (parseFloat(cashReceived || '0') < orderTotal))
              }
              className="py-3 bg-[#c1902f] text-white rounded-md font-medium hover:bg-[#a97c28]
                        focus:outline-none focus:ring-2 focus:ring-[#c1902f]
                        focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed
                        shadow-sm transition-colors"
            >
              {isProcessing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0
                          0 5.373 0 12h4zm2
                          5.291A7.962
                          7.962
                          0
                          014
                          12H0c0
                          3.042
                          1.135
                          5.824
                          3
                          7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                paymentMethod === 'cash'
                  ? 'Complete Cash Payment'
                  : paymentMethod === 'payment_link'
                    ? 'Send Payment Link'
                    : ['clover', 'revel', 'other'].includes(paymentMethod)
                      ? `Complete ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} Payment`
                      : 'Process Payment'
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                // Mark as "pending" or "paid" in your real system
                const mockTransactionId = `link_${Date.now()}`;
                
                // Create detailed payment information
                const paymentDetails = {
                  payment_method: 'payment_link',
                  transaction_id: mockTransactionId,
                  payment_date: today,
                  status: 'pending',
                  notes: `Payment link sent to ${customerEmail || customerPhone}`,
                  processor: 'payment_link'
                };
                
                onPaymentSuccess({
                  status: 'pending',
                  transaction_id: mockTransactionId,
                  amount: orderTotal.toString(),
                  payment_details: paymentDetails
                });
              }}
              className="py-3 bg-[#c1902f] text-white rounded-md font-medium hover:bg-[#a97c28]
                        focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:ring-opacity-50"
            >
              Mark as Paid &amp; Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** --------------------------------------------------------------------
 * STAFF ORDER MODAL (MAIN)
 * -------------------------------------------------------------------*/
export function StaffOrderModal({ onClose, onOrderCreated }: StaffOrderModalProps): JSX.Element {
  // Used in conditional rendering logic
  const isMobile = useIsMobile();

  // Basic Customer info - used in customer info panel
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [contactName, setContactName] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [contactPhone, setContactPhone] = useState('+1671');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [contactEmail, setContactEmail] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  // Staff order info - used in staff order options
  const [isStaffOrder, setIsStaffOrder] = useState(false);
  const [staffMemberId, setStaffMemberId] = useState<number | null>(null);
  const [staffOnDuty, setStaffOnDuty] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [useHouseAccount, setUseHouseAccount] = useState(false);
  // Used for tracking order creation metadata
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [createdByStaffId, setCreatedByStaffId] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [createdByUserId, setCreatedByUserId] = useState<number | null>(null);
  

  // Used for price calculations
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [preDiscountTotal, setPreDiscountTotal] = useState(0);


  // Data & cart from store
  const { menuItems, fetchMenuItems, loading: menuLoading, currentMenuId } = useMenuStore();
  
  // Debug: Log currentMenuId when it changes
  useEffect(() => {
    // Current menu ID updated
  }, [currentMenuId]);
  const {
    cartItems,
    addToCart,
    removeFromCart,
    setCartQuantity,
    clearCart,
    addOrder,
    loading: orderLoading
  } = useOrderStore();

  // Categories
  const [categories, setCategories] = useState<Map<number, string>>(new Map());
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // For item customization
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  
  // Fetch current user's staff member record to auto-set the createdByStaffId and createdByUserId
  useEffect(() => {
    const { user } = useAuthStore.getState();
    // Getting current user from auth store
    
    // Set the created_by_user_id from the current user
    if (user && user.id) {
      // Convert string id to number if needed
      const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
      setCreatedByUserId(userId);
      // Setting order creator to current user
    }
    
    async function fetchCurrentUserStaffRecord() {
      if (user && user.id) {
        try {
          // Fetching staff record for current user
          // Use the updated API endpoint with user_id filter
          const response = await apiClient.get(`/staff_members`, {
            params: { user_id: user.id }
          });
          // Staff members data received
          
          let staffMemberData;
          
          // Handle different response formats
          if (response.data && response.data.staff_members && response.data.staff_members.length > 0) {
            // New format with pagination
            staffMemberData = response.data.staff_members[0];
          } else if (Array.isArray(response.data) && response.data.length > 0) {
            // Old format without pagination
            staffMemberData = response.data[0];
          }
          
          if (staffMemberData && staffMemberData.id) {
            // Found staff record for current user
            setCreatedByStaffId(staffMemberData.id);
          } else {
            // No staff record found for current user
            // Don't set a default staff ID - the system should use the authenticated user
            // This will ensure the order is properly attributed to the current user
          }
        } catch (err) {
          console.error('Error fetching current user staff record:', err);
        }
      } else {
        // No user ID available, cannot fetch staff record
      }
    }
    
    fetchCurrentUserStaffRecord();
  }, []);

  // Mobile tabs
  const [activeTab, setActiveTab] = useState<'menu' | 'order' | 'customer' | 'payment'>('menu');

  // Desktop "Add Customer Info" toggle
  const [showCustomerInfoDesktop, setShowCustomerInfoDesktop] = useState(false);
  
  // Payment overlay
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  // Used for tracking payment transactions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [paymentTransactionId, setPaymentTransactionId] = useState<string | null>(null);

  // Calculate raw total (before any discounts)
  const rawTotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  
  // Update pre-discount total for staff orders
  useEffect(() => {
    setPreDiscountTotal(rawTotal);
  }, [rawTotal, setPreDiscountTotal]);
  
  // Calculate discounted total for staff orders
  const orderTotal = useMemo(() => {
    if (isStaffOrder && staffMemberId) {
      // Apply staff discount based on duty status
      if (staffOnDuty) {
        // 50% discount for on-duty staff
        return rawTotal * 0.5;
      } else {
        // 30% discount for off-duty staff
        return rawTotal * 0.7;
      }
    }
    // No discount for regular orders
    return rawTotal;
  }, [rawTotal, isStaffOrder, staffMemberId, staffOnDuty]);

  // On mount, fetch menu items
  useEffect(() => {
    fetchMenuItems();
    return () => {
      clearCart();
    };
  }, [fetchMenuItems, clearCart]);

  // Store all categories from API
  const [allCategories, setAllCategories] = useState<any[]>([]);
  
  // Load all categories once menuItems is present
  useEffect(() => {
    async function fetchCats() {
      try {
        // Fetching all categories
        const res = await apiClient.get('/categories');
        
        // Store all categories in state
        setAllCategories(res.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setAllCategories([]);
      }
    }
    if (menuItems.length > 0) {
      fetchCats();
    }
  }, [menuItems]);
  
  // Filter categories by current menu ID using useMemo
  const filteredCategories = useMemo(() => {
    // Filtering categories by current menu
    
    // Get the active menu ID from the menuStore if currentMenuId is null
    const menuStore = useMenuStore.getState();
    const activeMenuId = currentMenuId || menuStore.currentMenuId;
    // Using active menu ID for category filtering
    
    const catMap = new Map<number, string>();
    
    if (activeMenuId && allCategories.length > 0) {
      // Filter categories by active menu ID
      allCategories.forEach((c: any) => {
        if (Number(c.menu_id) === Number(activeMenuId)) {
          // Adding category that matches active menu
          catMap.set(c.id, c.name);
        }
      });
    } else if (allCategories.length > 0) {
      // Fallback: if no activeMenuId but we have categories, use menu item categories as fallback
      // No active menu ID, using fallback from menu items
      menuItems.forEach(item => {
        if (item.category_ids) {
          item.category_ids.forEach(catId => {
            // Try to find the category name in allCategories
            const category = allCategories.find(c => c.id === catId);
            if (category) {
              catMap.set(catId, category.name);
            } else if (!catMap.has(catId)) {
              catMap.set(catId, `Category ${catId}`);
            }
          });
        }
      });
    }
    
    // Category mapping completed
    
    return catMap;
  }, [allCategories, currentMenuId, menuItems]);
  
  // Update categories state when filteredCategories changes
  useEffect(() => {
    setCategories(filteredCategories);
  }, [filteredCategories]);

  // Restaurant store
  const restaurantStore = useRestaurantStore();
  // Helper for cart keys
  const getItemKey = useOrderStore(state => state._getItemKey);

  function findCartItem(id: string) {
    // direct match or fallback to composite key
    let item = cartItems.find(c => c.id === id);
    if (!item) {
      const itemKey = getItemKey({ id });
      item = cartItems.find(c => getItemKey(c) === itemKey);
    }
    return item || null;
  }

  /** Add normal or customized items */
  function handleAddItem(item: MenuItem) {
    // Check manually set stock status first
    if (item.stock_status === 'out_of_stock') {
      toastUtils.error(`${item.name} is out of stock.`);
      return;
    }
    
    // Then check inventory tracking
    if (item.enable_stock_tracking && item.available_quantity !== undefined) {
      const cartItem = findCartItem(item.id);
      const cartQuantity = cartItem ? cartItem.quantity : 0;
      const effectiveQuantity = item.available_quantity - cartQuantity;
      if (effectiveQuantity <= 0) {
        toastUtils.error(`${item.name} is out of stock.`);
        return;
      }
    }
    
    // If item has custom options, open customization modal
    if (item.option_groups?.length) {
      setCustomizingItem(item);
    } else {
      addToCart({ ...item, type: 'food' }, 1);
    }
  }

  function handleAddCustomizedItem(item: MenuItem, custom: any[], qty: number) {
    // Check manually set stock status first
    if (item.stock_status === 'out_of_stock') {
      toastUtils.error(`${item.name} is out of stock.`);
      setCustomizingItem(null);
      return;
    }
    
    // Then check inventory tracking
    if (item.enable_stock_tracking && item.available_quantity !== undefined) {
      const cartItem = findCartItem(item.id);
      const cartQuantity = cartItem ? cartItem.quantity : 0;
      const effectiveQuantity = item.available_quantity - cartQuantity;
      if (effectiveQuantity <= 0) {
        toastUtils.error(`${item.name} is out of stock.`);
        setCustomizingItem(null);
        return;
      }
      if (qty > effectiveQuantity) {
        toastUtils.error(`Cannot add ${qty} more ${item.name}. Only ${effectiveQuantity} available.`);
        setCustomizingItem(null);
        return;
      }
    }
    
    // Important: Use the price that was already calculated in the ItemCustomizationModal
    // The item passed from ItemCustomizationModal already has the updated price
    const finalPrice = item.price;
    
    // The customizations from ItemCustomizationModal are already in the correct format
    // and the price has been properly calculated
    
    // Debug log to help troubleshoot price calculations
    // Adding customized item to cart
    // console.log('Adding customized item to cart:', {
    //   itemName: item.name,
    //   finalPrice: finalPrice,
    //   quantity: qty,
    //   customizations: item.customizations
    // });
    
    // Add to cart with the price and customizations already set in ItemCustomizationModal
    addToCart({
      id: item.id,
      name: item.name,
      price: finalPrice,
      type: 'food',
      image: item.image,
      customizations: item.customizations || custom // Use item.customizations if available, otherwise use custom
    }, qty);
    
    setCustomizingItem(null);
  }

  /** Payment success for non-staff path */
  const handlePaymentSuccess = (details: {
    status: string;
    transaction_id: string;
    payment_id?: string;
    amount: string;
    currency?: string;
    payment_method?: string;
    payment_intent_id?: string;
    payment_details?: any;
  }) => {
    setPaymentProcessing(false);
    setPaymentTransactionId(details.transaction_id);
    
    // Get the payment processor from restaurant settings
    const restaurant = useRestaurantStore.getState().restaurant;
    const paymentGateway = restaurant?.admin_settings?.payment_gateway || {};
    const currentPaymentProcessor = paymentGateway.payment_processor || 'paypal';
    
    // Determine the actual payment method based on the processor
    let actualPaymentMethod = 'credit_card';
    if (currentPaymentProcessor === 'stripe') {
      actualPaymentMethod = 'stripe';
    } else if (currentPaymentProcessor === 'paypal') {
      actualPaymentMethod = 'paypal';
    }
    
    // If payment details are already provided, use them
    let paymentDetails = details.payment_details;
    
    // If not, create comprehensive payment details
    if (!paymentDetails) {
      paymentDetails = {
        status: details.status || 'succeeded',
        payment_method: details.payment_method || actualPaymentMethod,
        transaction_id: details.transaction_id,
        payment_date: new Date().toISOString().split('T')[0],
        payment_intent_id: details.payment_intent_id || details.transaction_id,
        processor: currentPaymentProcessor,
        notes: `Payment processed via ${currentPaymentProcessor === 'stripe' ? 'Stripe' : 'PayPal'}`
      };
    }
    
    // For cash payments, add cash-specific details
    if (actualPaymentMethod === 'cash' && details.payment_details) {
      paymentDetails.cash_received = details.payment_details.cash_received;
      paymentDetails.change_due = details.payment_details.change_due;
    }
    
    submitOrderWithPayment(
      details.transaction_id,
      paymentDetails,
      paymentDetails.payment_method || actualPaymentMethod
    );
  };

  const handlePaymentError = (error: Error) => {
    console.error('Payment failed:', error);
    toastUtils.error(`Payment failed: ${error.message}`);
    setPaymentProcessing(false);
  };

  async function submitOrderWithPayment(transactionId: string, paymentDetails?: any, paymentMethod: string = 'credit_card') {
    if (!cartItems.length) {
      toastUtils.error('Please add items to the order');
      return;
    }
    const finalPhone = contactPhone.trim() === '+1671' ? '' : contactPhone.trim();
    if (finalPhone && !isValidPhone(finalPhone)) {
      toastUtils.error('Phone must be + (3 or 4 digit area code) + 7 digits');
      return;
    }
    
    // Validate staff order parameters if it's a staff order
    if (isStaffOrder && !staffMemberId) {
      toastUtils.error('Please select a staff member for this staff order');
      return;
    }
    
    try {
      // Prepare staff order parameters
      // Preparing staff order parameters
      
      // Use the current user's staff ID as the creator
      let finalCreatedByStaffId = createdByStaffId;
      if (!finalCreatedByStaffId) {
        // No staff ID found for current user
      } else {
        // Using staff ID for order attribution
      }
      
      // Always include created_by_staff_id and created_by_user_id regardless of whether it's a staff order or not
      const staffOrderParams = isStaffOrder ? {
        is_staff_order: true,
        staff_member_id: staffMemberId,
        staff_on_duty: staffOnDuty,
        use_house_account: useHouseAccount,
        created_by_staff_id: finalCreatedByStaffId,
        created_by_user_id: createdByUserId,
        pre_discount_total: preDiscountTotal
      } : {
        created_by_staff_id: finalCreatedByStaffId, // Track creator even for customer orders
        created_by_user_id: createdByUserId // Always track the user who created the order
      };
      
      // Staff order parameters prepared
      
      // Include staffOrderParams in the paymentDetails object to work around TypeScript interface limitations
      const enhancedPaymentDetails = {
        ...paymentDetails,
        staffOrderParams: staffOrderParams
      };
      
      const newOrder = await addOrder(
        cartItems,
        orderTotal,
        specialInstructions,
        contactName,
        finalPhone,
        contactEmail,
        transactionId,
        paymentMethod,
        '', // vipCode parameter
        true, // Add staff_modal parameter to indicate this is a staff-created order
        enhancedPaymentDetails // Combined payment details and staff order params
      );
      
      // Create an OrderPayment record for manual payment methods
      // Note: We exclude stripe_reader since it's already creating OrderPayment records
      if (['cash', 'other', 'clover', 'revel', 'house_account'].includes(paymentMethod)) {
        try {
          if (paymentMethod === 'cash') {
            // Use the cash-specific endpoint for cash payments
            await apiClient.post(`/orders/${newOrder.id}/payments/cash`, {
              order_total: orderTotal,
              cash_received: paymentDetails?.cash_received || orderTotal,
              payment_method: 'cash',
              transaction_id: transactionId
            });
          } else if (paymentMethod === 'house_account') {
            // For house account payments, no additional API call is needed
            // The backend already processes the house account payment when creating the order
            // House account payment processed
          } else {
            // For other manual payment methods, use the additional endpoint
            await apiClient.post(`/orders/${newOrder.id}/payments/additional`, {
              amount: orderTotal,
              payment_method: paymentMethod,
              payment_details: paymentDetails,
              transaction_id: transactionId,
              items: [] // No additional items, just creating a payment record
            });
          }
          // Payment record created
        } catch (paymentErr) {
          // Just log the error but don't fail the order creation
          console.error('Failed to create payment record:', paymentErr);
        }
      }
      
      toastUtils.success('Order created successfully!');
      onOrderCreated(newOrder.id);
    } catch (err: any) {
      console.error('Error creating order:', err);
      // Stock or generic error
      if (err.response?.data?.error?.includes('stock') || err.response?.data?.error?.includes('inventory')) {
        toastUtils.error('Some items are no longer available.');
        fetchMenuItems();
      } else {
        toastUtils.error('Failed to create order. Please try again.');
      }
    }
  }

  /** Handle order submission */
  async function handleSubmitOrder() {
    if (!cartItems.length) {
      toastUtils.error('Please add items to the order');
      return;
    }
    const finalPhone = contactPhone.trim() === '+1671' ? '' : contactPhone.trim();
    if (finalPhone && !isValidPhone(finalPhone)) {
      toastUtils.error('Phone must be + (3 or 4 digit area code) + 7 digits');
      return;
    }
    
    // Validate staff order parameters if it's a staff order
    if (isStaffOrder && !staffMemberId) {
      toastUtils.error('Please select a staff member for this staff order');
      return;
    }
    
    // If this is a staff order using house account, bypass payment panel
    if (isStaffOrder && useHouseAccount && staffMemberId) {
      // Process house account payment directly
      setPaymentProcessing(true);
      try {
        // Generate a unique transaction ID for house account
        const houseAccountTransactionId = `house_account_${Date.now()}_${staffMemberId}`;
        
        // Submit order with house account payment method
        await submitOrderWithPayment(houseAccountTransactionId, {}, 'house_account');
      } catch (error) {
        console.error('Error processing house account payment:', error);
        toastUtils.error('Failed to process house account payment. Please try again.');
      } finally {
        setPaymentProcessing(false);
      }
    } else {
      // Show payment overlay or go to payment tab on mobile for regular payment flow
      if (isMobile) {
        setActiveTab('payment');
      } else {
        setShowPaymentPanel(true);
      }
    }
  }

  // MOBILE TABS
  function renderMobileLayout(): JSX.Element {
    return (
      <div className="flex flex-col overflow-hidden h-full">
        {/* Tab bar */}
        <div className="border-b border-gray-200 flex items-center justify-around bg-white shadow-sm">
          <button
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-3 text-sm font-medium text-center ${
              activeTab === 'menu'
                ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Menu Items
          </button>
          <button
            onClick={() => setActiveTab('order')}
            className={`flex-1 py-3 text-sm font-medium text-center relative ${
              activeTab === 'order'
                ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Current Order
            {cartItems.length > 0 && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#c1902f] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {cartItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('customer')}
            className={`flex-1 py-3 text-sm font-medium text-center ${
              activeTab === 'customer'
                ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Customer Info
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`flex-1 py-3 text-sm font-medium text-center ${
              activeTab === 'payment'
                ? 'text-[#c1902f] border-b-2 border-[#c1902f]'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Payment
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'menu' && (
          <MenuItemsPanel
            menuItems={menuItems}
            menuLoading={menuLoading}
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            findCartItem={findCartItem}
            handleAddItem={handleAddItem}
            setCustomizingItem={setCustomizingItem}
            setCartQuantity={setCartQuantity}
            removeFromCart={removeFromCart}
            getItemKey={getItemKey}
          />
        )}
        {activeTab === 'order' && (
          <OrderPanel
            cartItems={cartItems}
            findCartItem={findCartItem}
            setCartQuantity={setCartQuantity}
            removeFromCart={removeFromCart}
            handleSubmitOrder={handleSubmitOrder}
            orderTotal={orderTotal}
            orderLoading={orderLoading}
            onClose={onClose}
            menuItems={menuItems}
            setCustomizingItem={setCustomizingItem}
            isStaffOrder={isStaffOrder}
            setIsStaffOrder={setIsStaffOrder}
            staffMemberId={staffMemberId}
            setStaffMemberId={setStaffMemberId}
            staffOnDuty={staffOnDuty}
            setStaffOnDuty={setStaffOnDuty}
            useHouseAccount={useHouseAccount}
            setUseHouseAccount={setUseHouseAccount}
            createdByStaffId={createdByStaffId}
            setCreatedByStaffId={setCreatedByStaffId}
            preDiscountTotal={preDiscountTotal}
          />
        )}
        {activeTab === 'customer' && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <CustomerInfoPanel
                contactName={contactName}
                setContactName={setContactName}
                contactPhone={contactPhone}
                setContactPhone={setContactPhone}
                contactEmail={contactEmail}
                setContactEmail={setContactEmail}
                specialInstructions={specialInstructions}
                setSpecialInstructions={setSpecialInstructions}
                handleSubmitOrder={handleSubmitOrder}
                cartItems={cartItems}
                orderLoading={orderLoading}
                onBack={() => setActiveTab('order')}
              />
            </div>
          </div>
        )}
        {activeTab === 'payment' && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden max-h-[calc(100vh-120px)]">
              <PaymentPanel
                orderTotal={orderTotal}
                onPaymentSuccess={handlePaymentSuccess}
                onPaymentError={handlePaymentError}
                onBack={() => setActiveTab('customer')}
                isProcessing={paymentProcessing}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // DESKTOP / TABLET Layout
  function renderDesktopLayout(): JSX.Element {
    if (showPaymentPanel) {
      // Payment overlay with higher z-index
      return (
        <div className="flex-1 flex overflow-hidden h-full relative">
          {/* Dimmed background */}
          <div className="absolute inset-0 bg-black bg-opacity-30 z-10"></div>
          {/* Payment Panel on top (z-20) */}
          <div className="absolute inset-0 flex items-start sm:items-center justify-center z-20 p-4 pt-8 sm:pt-4 md:p-6 lg:p-8 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md sm:max-w-lg md:max-w-2xl my-auto sm:my-4 md:my-6 max-h-[90vh]">
              <div className="flex flex-col h-full">
                <PaymentPanel
                  orderTotal={orderTotal}
                  onPaymentSuccess={handlePaymentSuccess}
                  onPaymentError={handlePaymentError}
                  onBack={() => setShowPaymentPanel(false)}
                  isProcessing={paymentProcessing}
                />
              </div>
            </div>
          </div>

          {/* Main layout behind overlay */}
          <div className="flex-1 flex overflow-hidden h-full">
            {/* Left column: Menu Items */}
            <div className="w-2/3 flex flex-col border-r border-gray-200">
              <MenuItemsPanel
                menuItems={menuItems}
                menuLoading={menuLoading}
                categories={categories}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                findCartItem={findCartItem}
                handleAddItem={handleAddItem}
                setCustomizingItem={setCustomizingItem}
                setCartQuantity={setCartQuantity}
                removeFromCart={removeFromCart}
                getItemKey={getItemKey}
              />
            </div>

            {/* Right column: Order + optional Customer Info */}
            <div className="w-1/3 flex flex-col relative">
              <OrderPanel
                cartItems={cartItems}
                findCartItem={findCartItem}
                setCartQuantity={setCartQuantity}
                removeFromCart={removeFromCart}
                handleSubmitOrder={handleSubmitOrder}
                orderTotal={orderTotal}
                orderLoading={orderLoading}
                onClose={onClose}
                menuItems={menuItems}
                setCustomizingItem={setCustomizingItem}
                isStaffOrder={isStaffOrder}
                setIsStaffOrder={setIsStaffOrder}
                staffMemberId={staffMemberId}
                setStaffMemberId={setStaffMemberId}
                staffOnDuty={staffOnDuty}
                setStaffOnDuty={setStaffOnDuty}
                useHouseAccount={useHouseAccount}
                setUseHouseAccount={setUseHouseAccount}
                createdByStaffId={createdByStaffId}
                setCreatedByStaffId={setCreatedByStaffId}
                preDiscountTotal={preDiscountTotal}
              />
              <div className={`absolute ${isStaffOrder ? 'bottom-[190px]' : 'bottom-[150px]'} left-0 right-0 px-4`}>
                {!showCustomerInfoDesktop ? (
                  <button
                    onClick={() => setShowCustomerInfoDesktop(true)}
                    className="w-full py-2.5 text-sm font-medium bg-gray-50 border border-gray-300
                      hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
                  >
                    Add Customer Info
                  </button>
                ) : (
                  <div className="mt-4 border border-gray-200 rounded-md p-3 shadow-sm bg-gray-50">
                    <CustomerInfoPanel
                      contactName={contactName}
                      setContactName={setContactName}
                      contactPhone={contactPhone}
                      setContactPhone={setContactPhone}
                      contactEmail={contactEmail}
                      setContactEmail={setContactEmail}
                      specialInstructions={specialInstructions}
                      setSpecialInstructions={setSpecialInstructions}
                      handleSubmitOrder={handleSubmitOrder}
                      cartItems={cartItems}
                      orderLoading={orderLoading}
                      onBack={() => setShowCustomerInfoDesktop(false)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Normal desktop layout
    return (
      <div className="flex-1 flex overflow-hidden h-full">
        {/* Left: Menu Items */}
        <div className="w-2/3 flex flex-col border-r border-gray-200">
          <MenuItemsPanel
            menuItems={menuItems}
            menuLoading={menuLoading}
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            findCartItem={findCartItem}
            handleAddItem={handleAddItem}
            setCustomizingItem={setCustomizingItem}
            setCartQuantity={setCartQuantity}
            removeFromCart={removeFromCart}
            getItemKey={getItemKey}
          />
        </div>

        {/* Right: Order + optional Customer Info */}
        <div className="w-1/3 flex flex-col relative">
          <OrderPanel
            cartItems={cartItems}
            findCartItem={findCartItem}
            setCartQuantity={setCartQuantity}
            removeFromCart={removeFromCart}
            handleSubmitOrder={handleSubmitOrder}
            orderTotal={orderTotal}
            orderLoading={orderLoading}
            onClose={onClose}
            menuItems={menuItems}
            setCustomizingItem={setCustomizingItem}
            isStaffOrder={isStaffOrder}
            setIsStaffOrder={setIsStaffOrder}
            staffMemberId={staffMemberId}
            setStaffMemberId={setStaffMemberId}
            staffOnDuty={staffOnDuty}
            setStaffOnDuty={setStaffOnDuty}
            useHouseAccount={useHouseAccount}
            setUseHouseAccount={setUseHouseAccount}
            createdByStaffId={createdByStaffId}
            setCreatedByStaffId={setCreatedByStaffId}
            preDiscountTotal={preDiscountTotal}
          />
          {/* Fixed position Add Customer Info button or Customer Info panel - only shown for non-staff orders */}
          {!isStaffOrder && (
            <div className="absolute bottom-[140px] left-0 right-0 px-4 z-10">
              {!showCustomerInfoDesktop ? (
                <button
                  onClick={() => setShowCustomerInfoDesktop(true)}
                  className="w-full py-2.5 text-sm font-medium bg-gray-50 border border-gray-300
                    hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
                >
                  Add Customer Info
                </button>
              ) : (
                <div>
                  <div className="border border-gray-200 rounded-md shadow-sm bg-gray-50 max-h-[450px] overflow-auto mb-4">
                    <div className="px-4 py-4 pb-4 space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800 sticky top-0 bg-gray-50 z-10 py-2">Customer Information</h3>
                      
                      {/* Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={contactName}
                          onChange={e => setContactName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none
                                  focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] text-sm shadow-sm"
                          placeholder="Customer name"
                        />
                      </div>
                      
                      {/* Phone */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={contactPhone}
                          onChange={e => setContactPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none
                                  focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] text-sm shadow-sm"
                          placeholder="+1671"
                        />
                      </div>
                      
                      {/* Email */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={e => setContactEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none
                                  focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] text-sm shadow-sm"
                          placeholder="Email address"
                        />
                      </div>
                      
                      {/* Special Instructions */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Special Instructions
                        </label>
                        <textarea
                          value={specialInstructions}
                          onChange={e => setSpecialInstructions(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none
                                  focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f] text-sm shadow-sm"
                          placeholder="Special instructions or notes"
                          rows={4}
                        />
                      </div>

                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowCustomerInfoDesktop(false)}
                    className="w-full py-2.5 text-sm font-medium bg-gray-50 border border-gray-300
                      hover:bg-gray-100 rounded-md transition-colors flex items-center justify-center"
                  >
                    Back to Order
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /** RENDER */
  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4">
      <div
        className="bg-white rounded-lg shadow-xl
                   w-[95vw] max-w-[1100px]
                   h-[90vh] max-h-[800px]
                   flex flex-col
                   overflow-hidden"
      >
        {/* Header with "Close" button */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800">
            Create Order
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none
                       rounded-full hover:bg-gray-100 p-1 transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isMobile ? renderMobileLayout() : renderDesktopLayout()}
      </div>

      {/* Customization modal (shown if user is customizing an item) */}
      {customizingItem && (
        <ItemCustomizationModal
          item={customizingItem}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={handleAddCustomizedItem}
        />
      )}
    </div>
  );
}
