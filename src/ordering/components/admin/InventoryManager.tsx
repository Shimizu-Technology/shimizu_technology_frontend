// src/components/admin/InventoryManager.tsx

import React, { useEffect, useState } from 'react';
import { useInventoryStore } from '../../store/inventoryStore';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Search, 
  Plus, 
  Minus, 
  RefreshCw, 
  Clock, 
  X,
  ChevronDown,
  Edit,
  BarChart,
  Filter
} from 'lucide-react';
import { InventoryStatus } from '../../types/inventory';

interface ItemDetailsModalProps {
  item: InventoryStatus;
  onClose: () => void;
  onUpdateInventory: (itemId: string, update: Partial<InventoryStatus>) => void;
}

const ItemDetailsModal: React.FC<ItemDetailsModalProps> = ({ item, onClose, onUpdateInventory }) => {
  const [tab, setTab] = useState<'update' | 'damaged' | 'history'>('update');
  const [quantity, setQuantity] = useState<number>(1);
  const [operation, setOperation] = useState<'add' | 'remove'>('add');
  const [reason, setReason] = useState<string>('restock');
  const [damagedQty, setDamagedQty] = useState<number>(1);
  const [damageReason, setDamageReason] = useState<string>('fell');
  const [otherDamageReason, setOtherDamageReason] = useState<string>('');
  const [damageReasonOptions, setDamageReasonOptions] = useState<string[]>(['fell', 'bad/spoiled', 'other']);
  const [details, setDetails] = useState<string>('');

  // Example audit data - in a real app, this might come from the backend
  const auditHistory = [
    { date: '03/11/2025 15:33', previousQty: 32, newQty: 27, change: -5, reason: 'Issues with it' },
    { date: '03/11/2025 15:33', previousQty: 22, newQty: 32, change: 10, reason: 'Restock' },
    { date: '03/11/2025 15:27', previousQty: 12, newQty: 22, change: 10, reason: 'Restock' },
    { date: '03/11/2025 15:26', previousQty: 7, newQty: 12, change: 5, reason: 'Restock' },
    { date: '03/11/2025 15:26', previousQty: 13, newQty: 7, change: -6, reason: 'Just got more' },
  ];

  const handleUpdateStock = () => {
    const newQty = operation === 'add' 
      ? (item.quantity || 0) + quantity 
      : Math.max(0, (item.quantity || 0) - quantity);
    
    onUpdateInventory(item.itemId, { 
      quantity: newQty,
      // Update inStock/lowStock automatically
      inStock: newQty > 0,
      lowStock: newQty > 0 && newQty <= 10 // example threshold
    });
    
    onClose();
  };

  const handleMarkDamaged = () => {
    // Determine the final reason (either selected preset or custom)
    const finalReason = damageReason === 'other' ? otherDamageReason : damageReason;
    
    // Save custom reason if checkbox is checked
    if (damageReason === 'other' && 
        (document.getElementById('saveCustomReason') as HTMLInputElement)?.checked && 
        otherDamageReason.trim() !== '') {
      // Add the new reason before 'other' in the options array
      setDamageReasonOptions(prev => [
        ...prev.filter(opt => opt !== 'other'), 
        otherDamageReason, 
        'other'
      ]);
    }
    
    const newQty = Math.max(0, (item.quantity || 0) - damagedQty);
    
    // We can't include damageReason in the update as it's not part of the InventoryStatus type
    // But we can log it for auditing purposes
    console.log(`Item ${item.itemId} marked as damaged. Reason: ${finalReason}`);
    
    onUpdateInventory(item.itemId, { 
      quantity: newQty,
      inStock: newQty > 0,
      lowStock: newQty > 0 && newQty <= 10
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b px-6 py-4">
          <h2 className="text-xl font-semibold">Inventory Management: {item.itemId}</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b">
          <button 
            className={`flex-1 px-4 py-3 text-center font-medium ${tab === 'update' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setTab('update')}
          >
            Update Stock
          </button>
          <button 
            className={`flex-1 px-4 py-3 text-center font-medium ${tab === 'damaged' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setTab('damaged')}
          >
            Mark Damaged
          </button>
          <button 
            className={`flex-1 px-4 py-3 text-center font-medium ${tab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setTab('history')}
          >
            History
          </button>
        </div>
        
        <div className="overflow-y-auto flex-1 p-6">
          {tab === 'update' && (
            <div className="space-y-6">
              <div>
                <p className="font-medium mb-1">Current Stock: {item.quantity || 0} items</p>
                <div className="flex items-center h-2 bg-gray-200 rounded overflow-hidden">
                  <div 
                    className={`h-full ${
                      !item.inStock ? 'bg-red-500' : 
                      item.lowStock ? 'bg-yellow-500' : 'bg-green-500'
                    }`} 
                    style={{width: `${Math.min(100, ((item.quantity || 0) / 30) * 100)}%`}}
                  />
                </div>
                <div className="flex items-center mt-1 text-sm text-gray-600">
                  {item.inStock ? (
                    item.lowStock ? (
                      <span className="flex items-center text-yellow-600">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Low Stock
                      </span>
                    ) : (
                      <span className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        In Stock
                      </span>
                    )
                  ) : (
                    <span className="flex items-center text-red-600">
                      <XCircle className="h-4 w-4 mr-1" />
                      Out of Stock
                    </span>
                  )}
                </div>
              </div>
              
              {/* Operation buttons (Add/Remove) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operation</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
className={`flex items-center justify-center p-3 rounded-md border w-[140px] ${
  operation === 'add' 
    ? 'bg-green-50 border-green-200 text-green-700' 
    : 'bg-white text-gray-700'
}`}
                    onClick={() => setOperation('add')}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add
                  </button>
                  <button
                    type="button"
className={`flex items-center justify-center p-3 rounded-md border w-[140px] ${
  operation === 'remove' 
    ? 'bg-red-50 border-red-200 text-red-700' 
    : 'bg-white text-gray-700'
}`}
                    onClick={() => setOperation('remove')}
                  >
                    <Minus className="h-5 w-5 mr-2" />
                    Remove
                  </button>
                </div>
              </div>
              
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity to {operation === 'add' ? 'Add' : 'Remove'}
                </label>
                <input
                  type="number"
                  id="quantity"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason Type
                </label>
                <select
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="restock">Restock</option>
                  <option value="adjustment">Inventory Adjustment</option>
                  <option value="returned">Returned Items</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="details" className="block text-sm font-medium text-gray-700 mb-1">
                  Details (Optional)
                </label>
                <textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Additional details about the update"
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-24"
                />
              </div>
              
              <div className="pt-4">
                <p className="text-sm text-gray-600 mb-2">
                  New total will be:{' '}
                  <span className="font-medium">
                    {operation === 'add' 
                      ? (item.quantity || 0) + quantity 
                      : Math.max(0, (item.quantity || 0) - quantity)}
                    {' '}items
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleUpdateStock}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-md transition duration-150 ease-in-out"
                >
                  {operation === 'add' ? 'Add' : 'Remove'}
                </button>
              </div>
            </div>
          )}
          
          {tab === 'damaged' && (
            <div className="space-y-6">
              <div>
                <p className="font-medium mb-1">Current Stock: {item.quantity || 0} items</p>
                <div className="flex items-center h-2 bg-gray-200 rounded overflow-hidden">
                  <div 
                    className={`h-full ${
                      !item.inStock ? 'bg-red-500' : 
                      item.lowStock ? 'bg-yellow-500' : 'bg-green-500'
                    }`} 
                    style={{width: `${Math.min(100, ((item.quantity || 0) / 30) * 100)}%`}}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="damagedQty" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity to Mark as Damaged
                </label>
                <input
                  type="number"
                  id="damagedQty"
                  min="1"
                  max={item.quantity || 0}
                  value={damagedQty}
                  onChange={(e) => setDamagedQty(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label htmlFor="damageReason" className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Damage
                </label>
                <select
                  id="damageReason"
                  value={damageReason}
                  onChange={(e) => setDamageReason(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {damageReasonOptions.map((option) => (
                    option !== 'other' ? 
                      <option key={option} value={option}>
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </option> 
                    : 
                      <option key="other" value="other">Other (specify)</option>
                  ))}
                </select>
              </div>
              
              {damageReason === 'other' && (
                <div className="mt-3">
                  <label htmlFor="otherDamageReason" className="block text-sm font-medium text-gray-700 mb-1">
                    Specify Other Reason
                  </label>
                  <input
                    type="text"
                    id="otherDamageReason"
                    value={otherDamageReason}
                    onChange={(e) => setOtherDamageReason(e.target.value)}
                    placeholder="Enter custom reason"
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
              
              {damageReason === 'other' && otherDamageReason.trim() !== '' && (
                <div className="mt-3 flex items-center">
                  <input
                    type="checkbox"
                    id="saveCustomReason"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="saveCustomReason" className="ml-2 block text-sm text-gray-700">
                    Save this reason for future use
                  </label>
                </div>
              )}
              
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleMarkDamaged}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-md transition duration-150 ease-in-out"
                >
                  Mark as Damaged
                </button>
              </div>
            </div>
          )}
          
          {tab === 'history' && (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Previous Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        New Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Change
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {auditHistory.map((entry, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {entry.date}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {entry.previousQty}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {entry.newQty}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className={`font-medium ${entry.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {entry.change >= 0 ? `+${entry.change}` : entry.change}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {entry.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        <div className="border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-md transition duration-150 ease-in-out"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export function InventoryManager() {
  const { inventory, updateInventoryStatus, fetchInventory, loading, error } = useInventoryStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryStatus | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [currentStockView, setCurrentStockView] = useState<'all' | 'low' | 'out'>('all');

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const handleStatusChange = (itemId: string, inStock: boolean, lowStock: boolean) => {
    updateInventoryStatus(itemId, { inStock, lowStock });
  };

  const handleUpdateInventory = (itemId: string, update: Partial<InventoryStatus>) => {
    updateInventoryStatus(itemId, update);
  };

  const openItemDetails = (item: InventoryStatus) => {
    setSelectedItem(item);
  };

  const closeItemDetails = () => {
    setSelectedItem(null);
  };

  const filteredInventory = Object.values(inventory).filter(item => {
    const matchesSearch = item.itemId.toLowerCase().includes(searchQuery.toLowerCase());
    if (currentStockView === 'all') return matchesSearch;
    if (currentStockView === 'low') return matchesSearch && item.lowStock;
    if (currentStockView === 'out') return matchesSearch && !item.inStock;
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-pulse flex flex-col items-center">
              <div className="h-12 w-12 rounded-full bg-blue-200 mb-4"></div>
              <div className="text-gray-600">Loading inventory…</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
          <div className="flex items-center">
            <XCircle className="h-6 w-6 text-red-500 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-red-800">Error loading inventory</h3>
              <p className="text-red-600 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchInventory}
            className="mt-4 flex items-center justify-center px-4 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 md:p-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h2 className="text-2xl font-bold">Inventory Management</h2>
          
          <div className="flex items-center mt-4 md:mt-0">
            <div className="relative mr-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search inventory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
              />
            </div>
            
            <div className="flex items-center ml-auto">
              <label className="inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={trackingEnabled}
                  onChange={() => setTrackingEnabled(!trackingEnabled)}
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ml-3 text-sm font-medium text-gray-900">Enable Tracking</span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <div className="flex overflow-x-auto space-x-2 p-1">
            <button
              onClick={() => setCurrentStockView('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                currentStockView === 'all'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setCurrentStockView('low')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                currentStockView === 'low'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Low Stock
            </button>
            <button
              onClick={() => setCurrentStockView('out')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                currentStockView === 'out'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              <XCircle className="h-4 w-4 inline mr-1" />
              Out of Stock
            </button>
          </div>
        </div>
        
        <div className="overflow-hidden">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredInventory.map(item => (
              <div 
                key={item.itemId} 
                className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-4"
                onClick={() => openItemDetails(item)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{item.itemId}</h3>
                    <div className="mt-2 flex items-center">
                      {item.inStock ? (
                        item.lowStock ? (
                          <span className="flex items-center text-yellow-600">
                            <AlertTriangle className="h-5 w-5 mr-2" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="flex items-center text-green-600">
                            <CheckCircle className="h-5 w-5 mr-2" />
                            In Stock
                          </span>
                        )
                      ) : (
                        <span className="flex items-center text-red-600">
                          <XCircle className="h-5 w-5 mr-2" />
                          Out of Stock
                        </span>
                      )}
                    </div>
                    {item.quantity !== undefined && (
                      <div className="mt-1 text-gray-600">Quantity: {item.quantity}</div>
                    )}
                  </div>
                  
                  <div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openItemDetails(item);
                      }}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                      aria-label="Edit"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                
                {trackingEnabled && item.quantity !== undefined && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>0</span>
                      <span>Stock Level</span>
                      <span>30+</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${
                          !item.inStock ? 'bg-red-600' :
                          item.lowStock ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{width: `${Math.min(100, (item.quantity / 30) * 100)}%`}}
                      ></div>
                    </div>
                  </div>
                )}
                
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(item.itemId, true, false);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium text-center ${
                      item.inStock && !item.lowStock
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-green-50'
                    }`}
                  >
                    In Stock
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(item.itemId, true, true);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium text-center ${
                      item.lowStock
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-yellow-50'
                    }`}
                  >
                    Low Stock
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStatusChange(item.itemId, false, false);
                    }}
                    className={`px-3 py-1.5 rounded text-xs font-medium text-center ${
                      !item.inStock
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-red-50'
                    }`}
                  >
                    Out
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {filteredInventory.length === 0 && (
          <div className="bg-gray-50 rounded-lg p-8 mt-4 text-center">
            <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No inventory items found</h3>
            <p className="text-gray-500">
              {searchQuery
                ? `No results matching "${searchQuery}"`
                : currentStockView !== 'all'
                ? `No items with ${currentStockView === 'low' ? 'low stock' : 'out of stock'} status`
                : 'Your inventory appears to be empty'}
            </p>
          </div>
        )}
      </div>
      
      {selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          onClose={closeItemDetails}
          onUpdateInventory={handleUpdateInventory}
        />
      )}
    </div>
  );
}
