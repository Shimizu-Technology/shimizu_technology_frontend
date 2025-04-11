import React from 'react';
import { X } from 'lucide-react';
import type { MenuItem } from '../../types/menu';

interface UpsellModalProps {
  item: MenuItem;
  onClose: () => void;
  onAddToCart: (item: MenuItem) => void;
}

export function UpsellModal({ item, onClose, onAddToCart }: UpsellModalProps) {
  const handleAdd = () => {
    onAddToCart(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
          <div className="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              className="rounded-md bg-white text-gray-400 hover:text-gray-500"
              onClick={onClose}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div>
            <div className="mt-3 text-center sm:mt-5">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">
                Complete Your Meal!
              </h3>
              <div className="mt-2">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-48 object-cover rounded-md"
                />
                <p className="mt-4 text-sm text-gray-500">
                  Would you like to add a {item.name} to your order?
                </p>
                <p className="mt-1 text-lg font-semibold">
                  ${item.price.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 sm:mt-6 space-y-2">
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-md bg-[#c1902f] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#d4a43f]"
              onClick={handleAdd}
            >
              Add to Order
            </button>
            <button
              type="button"
              className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              onClick={onClose}
            >
              No Thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}