// src/ordering/components/CartPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight, Minus, Plus, Settings } from 'lucide-react';
import { useOrderStore, CartItem } from '../store/orderStore';
import { useMenuStore } from '../store/menuStore';
import { CustomizationModal } from './CustomizationModal';
import OptimizedImage from '../../shared/components/ui/OptimizedImage';

export function CartPage() {
  const navigate = useNavigate();
  const { menuItems, fetchMenuItems } = useMenuStore();
  
  // State for customization modal
  const [itemToCustomize, setItemToCustomize] = useState<any>(null);

  // We pull the actions from our store
  const {
    cartItems,
    setCartQuantity,
    removeFromCart,
    setCartItemNotes
  } = useOrderStore();
  
  // Make sure menu items are loaded (for finding original items with option groups)
  React.useEffect(() => {
    if (menuItems.length === 0) {
      fetchMenuItems();
    }
  }, [fetchMenuItems, menuItems.length]);

  // Sum up the total
  const total = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (cartItems.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <h2 className="text-xl sm:text-2xl font-bold mb-4">Your cart is empty</h2>
        <p className="text-gray-600 mb-8">
          Add some delicious items to get started!
        </p>
        <Link
          to="/menu"
          className="inline-flex items-center px-6 py-3 border border-transparent
                     text-base font-medium rounded-md text-white
                     bg-[#c1902f] hover:bg-[#d4a43f]"
        >
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">
          Your Cart
        </h1>

        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Cart items list */}
          <div className="lg:col-span-7">
            {
              cartItems.map((item: CartItem) => {
                // Generate a unique key for this item using our composite key function
                const itemKey = useOrderStore.getState()._getItemKey(item);
                
                return (
                  <div
                    key={itemKey}
                    className="flex flex-col sm:flex-row sm:items-start
                             space-y-4 sm:space-y-0 sm:space-x-4 py-6 border-b"
                  >
                  {/* Image */}
                  <OptimizedImage
                    src={(item as any).image || '/placeholder-food.png'}
                    alt={item.name}
                    className="w-full sm:w-24 h-48 sm:h-24 object-cover rounded-md"
                    context="cart"
                  />

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>

                    {(item as any).description && (
                      <p className="mt-1 text-sm text-gray-500">{(item as any).description}</p>
                    )}

                    {/* If the item requires 24 hours, show it */}
                    {item.advance_notice_hours && item.advance_notice_hours >= 24 && (
                      <p className="mt-1 text-sm text-red-600">
                        Requires 24 hours notice
                      </p>
                    )}

                    {/* If customizations exist, show them */}
                    {item.customizations && (
                      <div className="mt-1 text-sm text-gray-600">
                        {Object.entries(item.customizations).map(([groupName, picks]) => (
                          <p key={groupName}>
                            <strong>{groupName}:</strong> {picks.join(', ')}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* NEW: Per-item notes text area */}
                    <textarea
                      className="mt-2 w-full border border-gray-300 rounded-md p-2 text-sm
                               focus:ring-[#c1902f] focus:border-[#c1902f]"
                      placeholder="Any notes for this item? (e.g. 'No onions', 'Extra sauce')"
                      value={item.notes || ''}
                      onChange={(e) => setCartItemNotes(itemKey, e.target.value)}
                    />

                    <div className="flex flex-wrap items-center justify-between mt-4 gap-2">
                      {/* Quantity controls */}
                      <div className="flex items-center border rounded-md">
                        <button
                          className="p-2 text-gray-600 hover:text-gray-900"
                          onClick={() => setCartQuantity(itemKey, item.quantity - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="px-4 py-2 border-x">{item.quantity}</span>
                        <button
                          className="p-2 text-gray-600 hover:text-gray-900"
                          onClick={() => setCartQuantity(itemKey, item.quantity + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <div className="flex items-center">
                        {/* "Customize Again" button - only show for items that can be customized */}
                        {item.customizations && Object.keys(item.customizations).length > 0 && (
                          <button
                            className="mr-2 px-3 py-1.5 text-sm text-[#c1902f] border border-[#c1902f] rounded-md hover:bg-[#c1902f]/10 flex items-center"
                            onClick={() => {
                              // Find the original menu item to get its option groups
                              const originalItem = menuItems.find(mi => mi.id === item.id);
                              if (originalItem) {
                                setItemToCustomize(originalItem);
                              }
                            }}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Customize Again
                          </button>
                        )}
                      
                        {/* Remove item */}
                        <button
                          className="text-red-600 hover:text-red-800 p-2"
                          onClick={() => removeFromCart(itemKey)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <span className="text-lg font-medium text-gray-900">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                  </div>
                );
              })
            }
          </div>

          {/* Order summary */}
          <div className="lg:col-span-5 mt-8 lg:mt-0">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-20">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Order Summary
              </h2>
              <div className="space-y-4">
                <div className="flex justify-between text-lg font-medium">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
                <button
                  className="w-full flex items-center justify-center px-6 py-3 border
                           border-transparent text-base font-medium rounded-md text-white
                           bg-[#c1902f] hover:bg-[#d4a43f]"
                  onClick={() => navigate('/checkout')}
                >
                  Proceed to Checkout
                  <ArrowRight className="ml-2 h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Customization Modal */}
      {itemToCustomize && (
        <CustomizationModal
          item={itemToCustomize}
          onClose={() => setItemToCustomize(null)}
        />
      )}
    </>
  );
}
