// src/ordering/components/admin/MerchandiseInventoryModal.tsx
import React, { useState, useEffect } from 'react';
import { MerchandiseItem, MerchandiseVariant } from '../../types/merchandise';
import { merchandiseItemsApi } from '../../../shared/api/endpoints/merchandiseItems';
import { useMerchandiseStore } from '../../store/merchandiseStore';
import { format } from 'date-fns';
import toastUtils from '../../../shared/utils/toastUtils';

interface MerchandiseInventoryModalProps {
  open: boolean;
  onClose: () => void;
  merchandiseItem?: MerchandiseItem;
  onSave: () => void;
}

interface VariantInventory {
  id: number;
  size: string;
  color: string;
  stock_quantity: number;
  damaged_quantity: number;
  low_stock_threshold: number;
  original_stock_quantity: number;
  original_damaged_quantity: number;
  original_low_stock_threshold: number;
  changed: boolean;
}

interface BatchOperation {
  type: 'add' | 'remove' | 'damaged' | 'threshold';
  amount: number;
  reason?: string;
}

const MerchandiseInventoryModal: React.FC<MerchandiseInventoryModalProps> = ({
  open,
  onClose,
  merchandiseItem,
  onSave
}) => {
  // Main state
  const [enableTracking, setEnableTracking] = useState(false);
  const [manualStockStatus, setManualStockStatus] = useState<'in_stock' | 'out_of_stock' | 'low_stock'>('in_stock');
  const [variantInventory, setVariantInventory] = useState<VariantInventory[]>([]);
  const [allSelected, setAllSelected] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());
  
  // Batch operation state
  const [showBatchOperation, setShowBatchOperation] = useState(false);
  const [batchOperation, setBatchOperation] = useState<BatchOperation>({
    type: 'add',
    amount: 1,
    reason: 'restock'
  });

  // Mark as damaged state
  const [damageQuantity, setDamageQuantity] = useState<number>(1);
  const [damageReason, setDamageReason] = useState<string>('fell');
  const [otherDamageReason, setOtherDamageReason] = useState<string>('');
  const [damageReasonOptions, setDamageReasonOptions] = useState<string[]>(['fell', 'bad/spoiled', 'other']);
  
  // Update stock state
  const [stockOperation, setStockOperation] = useState<'add' | 'remove'>('add');
  const [stockAdjustmentAmount, setStockAdjustmentAmount] = useState<number>(0);
  const [reasonType, setReasonType] = useState<'restock' | 'adjustment' | 'other'>('restock');
  const [reasonDetails, setReasonDetails] = useState<string>('');
  
  // Audit history state
  const [auditHistory, setAuditHistory] = useState<any[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  
  // Error and success states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [selectedVariantForAction, setSelectedVariantForAction] = useState<number | null>(null);
  
  const { startInventoryPolling, stopInventoryPolling } = useMerchandiseStore();

  // Load audit history
  const loadAuditHistory = async () => {
    if (!merchandiseItem) return;
    
    setLoadingAudits(true);
    try {
      // For now, we'll just set an empty array since the API endpoint doesn't exist yet
      // In the future, you can implement this endpoint in the merchandiseItemsApi
      console.log('Audit history not yet implemented for merchandise items');
      setAuditHistory([]);
      
      // When the API endpoint is implemented, you can use this code:
      // const audits = await merchandiseItemsApi.getStockAudits(merchandiseItem.id);
      // setAuditHistory(audits);
    } catch (err) {
      console.error('Failed to load audit history:', err);
      setError('Failed to load audit history');
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoadingAudits(false);
    }
  };

  // Initialize data when modal opens
  useEffect(() => {
    if (open && merchandiseItem) {
      // Check for either enable_inventory_tracking or enable_stock_tracking (for backward compatibility)
      setEnableTracking(Boolean(merchandiseItem.enable_inventory_tracking || merchandiseItem.enable_stock_tracking));
      
      // Initialize manual stock status
      setManualStockStatus(merchandiseItem.stock_status || 'in_stock');
      
      // Initialize variant inventory
      if (merchandiseItem.variants && merchandiseItem.variants.length > 0) {
        const variants = merchandiseItem.variants.map((variant) => ({
          id: variant.id,
          size: variant.size || '',
          color: variant.color || '',
          stock_quantity: variant.stock_quantity || 0,
          damaged_quantity: variant.damaged_quantity || 0,
          low_stock_threshold: variant.low_stock_threshold || 5,
          original_stock_quantity: variant.stock_quantity || 0,
          original_damaged_quantity: variant.damaged_quantity || 0,
          original_low_stock_threshold: variant.low_stock_threshold || 5,
          changed: false
        }));
        setVariantInventory(variants);
      } else {
        setVariantInventory([]);
      }
      
      setSelectedVariants(new Set());
      setAllSelected(false);
      startInventoryPolling(merchandiseItem.id);
      
      // Load audit history if tracking is enabled
      if (merchandiseItem.enable_inventory_tracking || merchandiseItem.enable_stock_tracking) {
        loadAuditHistory();
      }
    }
    
    return () => {
      stopInventoryPolling();
    };
  }, [open, merchandiseItem, startInventoryPolling, stopInventoryPolling]);

  // Toggle enable tracking
  const handleEnableTrackingToggle = async (enabled: boolean) => {
    if (!merchandiseItem) return;
    
    setEnableTracking(enabled);
    
    try {
      await merchandiseItemsApi.update(merchandiseItem.id, {
        enable_inventory_tracking: enabled,
        enable_stock_tracking: enabled // For backward compatibility
      });
      toastUtils.success(`Inventory tracking ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update tracking setting:', error);
      setEnableTracking(!enabled); // Revert on error
      toastUtils.error('Failed to update tracking setting');
    }
  };

  // Toggle select all variants
  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedVariants(new Set());
    } else {
      const allIds = new Set(variantInventory.map((v) => v.id));
      setSelectedVariants(allIds);
    }
    setAllSelected(!allSelected);
  };

  // Toggle single variant selection
  const handleSelectVariant = (id: number) => {
    const newSelected = new Set(selectedVariants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedVariants(newSelected);
    setAllSelected(newSelected.size === variantInventory.length);
  };

  // Update a specific variant's inventory
  const handleVariantChange = (
    id: number,
    field: keyof VariantInventory,
    value: number
  ) => {
    const newInventory = variantInventory.map((v) => {
      if (v.id === id) {
        const updated = { ...v, [field]: value, changed: true };
        return updated;
      }
      return v;
    });
    setVariantInventory(newInventory);
  };

  // Save changes to all variants
  const handleSaveChanges = async () => {
    if (!merchandiseItem) return;
    
    setSaving(true);
    
    try {
      // First update the item's tracking setting and status
      if (enableTracking) {
        // When tracking is enabled, just update the tracking setting
        await merchandiseItemsApi.update(merchandiseItem.id, {
          enable_inventory_tracking: enableTracking,
          enable_stock_tracking: enableTracking // For backward compatibility
        });
      } else {
        // When tracking is disabled, update both tracking setting and manual status
        await merchandiseItemsApi.update(merchandiseItem.id, {
          enable_inventory_tracking: enableTracking,
          enable_stock_tracking: enableTracking, // For backward compatibility
          stock_status: manualStockStatus
        });
      }
      
      // Then update each changed variant (only if tracking is enabled)
      if (enableTracking) {
        const changedVariants = variantInventory.filter((v) => v.changed);
        
        for (const variant of changedVariants) {
          await merchandiseItemsApi.updateVariantInventory(variant.id, {
            stock_quantity: variant.stock_quantity,
            damaged_quantity: variant.damaged_quantity,
            low_stock_threshold: variant.low_stock_threshold
          });
        }
        
        // Mark all as unchanged
        setVariantInventory((prev) =>
          prev.map((v) => ({
            ...v,
            original_stock_quantity: v.stock_quantity,
            original_damaged_quantity: v.damaged_quantity,
            original_low_stock_threshold: v.low_stock_threshold,
            changed: false
          }))
        );
      }
      
      toastUtils.success('Inventory saved successfully');
      onSave();
    } catch (error) {
      console.error('Failed to save inventory changes:', error);
      toastUtils.error('Failed to save inventory changes');
    } finally {
      setSaving(false);
    }
  };

  // Apply batch operation to selected variants
  const handleApplyBatchOperation = () => {
    if (selectedVariants.size === 0) {
      toastUtils.error('Please select at least one variant');
      return;
    }
    
    if (batchOperation.amount <= 0) {
      toastUtils.error('Amount must be greater than zero');
      return;
    }
    
    const newInventory = [...variantInventory];
    
    selectedVariants.forEach((id) => {
      const index = newInventory.findIndex((v) => v.id === id);
      if (index === -1) return;
      
      const variant = { ...newInventory[index] };
      
      switch (batchOperation.type) {
        case 'add':
          variant.stock_quantity += batchOperation.amount;
          break;
        case 'remove':
          variant.stock_quantity = Math.max(0, variant.stock_quantity - batchOperation.amount);
          break;
        case 'damaged':
          if (variant.stock_quantity >= batchOperation.amount) {
            variant.stock_quantity -= batchOperation.amount;
            variant.damaged_quantity += batchOperation.amount;
          } else {
            toastUtils.error(`Not enough stock for variant #${variant.id}`);
            return;
          }
          break;
        case 'threshold':
          variant.low_stock_threshold = batchOperation.amount;
          break;
      }
      
      variant.changed = true;
      newInventory[index] = variant;
    });
    
    setVariantInventory(newInventory);
    setShowBatchOperation(false);
    toastUtils.success('Batch operation applied');
  };

  // Reset all changes
  const handleResetChanges = () => {
    setVariantInventory((prev) =>
      prev.map((v) => ({
        ...v,
        stock_quantity: v.original_stock_quantity,
        damaged_quantity: v.original_damaged_quantity,
        low_stock_threshold: v.original_low_stock_threshold,
        changed: false
      }))
    );
    toastUtils.success('Changes reset');
  };

  // Get status label for a variant
  const getStatusLabel = (stock: number, damaged: number, threshold: number) => {
    const available = stock - damaged;
    if (available <= 0) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
          Out of Stock
        </span>
      );
    } else if (available <= threshold) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
          Low Stock
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
        In Stock
      </span>
    );
  };

  if (!merchandiseItem || !open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            Inventory Management: {merchandiseItem.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Inventory Tracking Toggle */}
          <div className="mb-6">
            <div className="flex items-center mb-2">
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableTracking}
                  onChange={(e) => handleEnableTrackingToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#c1902f]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white 
                  after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white 
                  after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 
                  after:transition-all peer-checked:bg-[#c1902f]"
                />
                <span className="ml-3 text-gray-900 font-medium">
                  Enable Inventory Tracking
                </span>
              </label>
            </div>
            <p className="text-sm text-gray-500">
              When enabled, inventory quantities will be tracked for all variants. When disabled,
              you can manually set the inventory status.
            </p>
          </div>
          
          {/* Manual Status Selector (when tracking is disabled) */}
          {!enableTracking && (
            <div className="mb-6">
              <div className="flex items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Inventory Status
                </label>
              </div>
              <select
                value={manualStockStatus}
                onChange={(e) => setManualStockStatus(e.target.value as 'in_stock' | 'out_of_stock' | 'low_stock')}
                className="w-full px-4 py-2 border rounded-md"
              >
                <option value="in_stock">In Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="low_stock">Low Stock</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                "Low Stock" shows a warning but still allows ordering.
                "Out of Stock" fully disables ordering.
              </p>
            </div>
          )}
          
          {enableTracking && (
            <>
              {/* Batch Operations */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">Variant Inventory</h3>
                  <div className="flex space-x-2">
                    {selectedVariants.size > 0 && (
                      <button
                        onClick={() => setShowBatchOperation(true)}
                        className="bg-[#c1902f] hover:bg-[#a97c28] text-white px-3 py-1.5 rounded-md text-sm font-medium"
                      >
                        Batch Update ({selectedVariants.size})
                      </button>
                    )}
                    <button
                      onClick={handleResetChanges}
                      disabled={!variantInventory.some((v) => v.changed)}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reset Changes
                    </button>
                  </div>
                </div>
                
                {/* Batch Operation Panel */}
                {showBatchOperation && (
                  <div className="mb-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                    <h4 className="font-medium text-gray-800 mb-3">
                      Batch Update Selected Variants
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Operation
                        </label>
                        <select
                          value={batchOperation.type}
                          onChange={(e) =>
                            setBatchOperation({
                              ...batchOperation,
                              type: e.target.value as BatchOperation['type']
                            })
                          }
                          className="w-full border border-gray-300 rounded-md py-1.5 px-3"
                        >
                          <option value="add">Add Stock</option>
                          <option value="remove">Remove Stock</option>
                          <option value="damaged">Mark as Damaged</option>
                          <option value="threshold">Set Low Stock Threshold</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {batchOperation.type === 'threshold' ? 'Threshold' : 'Amount'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={batchOperation.amount}
                          onChange={(e) =>
                            setBatchOperation({
                              ...batchOperation,
                              amount: parseInt(e.target.value, 10) || 0
                            })
                          }
                          className="w-full border border-gray-300 rounded-md py-1.5 px-3"
                        />
                      </div>
                      {batchOperation.type !== 'threshold' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reason
                          </label>
                          <select
                            value={batchOperation.reason}
                            onChange={(e) =>
                              setBatchOperation({ ...batchOperation, reason: e.target.value })
                            }
                            className="w-full border border-gray-300 rounded-md py-1.5 px-3"
                          >
                            <option value="restock">Restock</option>
                            <option value="adjustment">Inventory Adjustment</option>
                            <option value="damaged">Product Damaged</option>
                            <option value="returned">Customer Return</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex justify-end space-x-2">
                      <button
                        onClick={() => setShowBatchOperation(false)}
                        className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleApplyBatchOperation}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium"
                      >
                        Apply to {selectedVariants.size} variant
                        {selectedVariants.size !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Variants Table */}
              <div className="border border-gray-200 rounded-md overflow-hidden mb-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={handleSelectAll}
                            className="h-4 w-4 text-[#c1902f] border-gray-300 rounded focus:ring-[#c1902f]"
                          />
                        </div>
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Size
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Color
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Stock Quantity
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Damaged
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Low Stock Threshold
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {variantInventory.length > 0 ? (
                      variantInventory.map((variant) => (
                        <tr
                          key={variant.id}
                          className={variant.changed ? 'bg-blue-50' : ''}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedVariants.has(variant.id)}
                              onChange={() => handleSelectVariant(variant.id)}
                              className="h-4 w-4 text-[#c1902f] border-gray-300 rounded focus:ring-[#c1902f]"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                            {variant.size || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {variant.color || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              value={variant.stock_quantity}
                              onChange={(e) =>
                                handleVariantChange(
                                  variant.id,
                                  'stock_quantity',
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="w-20 border border-gray-300 rounded-md py-1 px-2 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              value={variant.damaged_quantity}
                              onChange={(e) =>
                                handleVariantChange(
                                  variant.id,
                                  'damaged_quantity',
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className="w-20 border border-gray-300 rounded-md py-1 px-2 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              min="1"
                              value={variant.low_stock_threshold}
                              onChange={(e) =>
                                handleVariantChange(
                                  variant.id,
                                  'low_stock_threshold',
                                  parseInt(e.target.value, 10) || 1
                                )
                              }
                              className="w-20 border border-gray-300 rounded-md py-1 px-2 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {getStatusLabel(
                              variant.stock_quantity,
                              variant.damaged_quantity,
                              variant.low_stock_threshold
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-4 text-center text-sm text-gray-500"
                        >
                          No variants found for this item.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-md mb-6">
                <h3 className="font-medium text-gray-900 mb-2">Inventory Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Total Variants</p>
                    <p className="text-xl font-medium">{variantInventory.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Stock</p>
                    <p className="text-xl font-medium">
                      {variantInventory.reduce((sum, v) => sum + v.stock_quantity, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Damaged</p>
                    <p className="text-xl font-medium">
                      {variantInventory.reduce((sum, v) => sum + v.damaged_quantity, 0)}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Update Stock Quantity */}
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-4">Update Stock Quantity</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Operation Buttons */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operation
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label
                        className={`flex items-center justify-center px-3 py-2 rounded-md cursor-pointer text-sm font-medium text-center
                          ${
                            stockOperation === 'add'
                              ? 'bg-green-100 text-green-800 border border-green-300'
                              : 'bg-gray-100 text-gray-700'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          checked={stockOperation === 'add'}
                          onChange={() => setStockOperation('add')}
                        />
                        <span>Add</span>
                      </label>
                      
                      <label
                        className={`flex items-center justify-center px-3 py-2 rounded-md cursor-pointer text-sm font-medium text-center
                          ${
                            stockOperation === 'remove'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-gray-100 text-gray-700'
                          }
                        `}
                      >
                        <input
                          type="radio"
                          className="sr-only"
                          checked={stockOperation === 'remove'}
                          onChange={() => setStockOperation('remove')}
                        />
                        <span>Remove</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity to {stockOperation === 'add' ? 'Add' : 'Remove'}
                    </label>
                    <input
                      type="number"
                      className={`w-full border rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${
                        stockOperation === 'add'
                          ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                          : 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      }`}
                      value={stockAdjustmentAmount}
                      min={1}
                      onChange={(e) =>
                        setStockAdjustmentAmount(parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  
                  {/* Reason Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason Type
                    </label>
                    <select
                      className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f]"
                      value={reasonType}
                      onChange={(e) => {
                        const selectedType = e.target.value as
                          | 'restock'
                          | 'adjustment'
                          | 'other';
                        setReasonType(selectedType);
                        // Automatically set the stock operation based on reason type
                        if (selectedType === 'restock') {
                          setStockOperation('add');
                        }
                      }}
                    >
                      <option value="restock">Restock</option>
                      <option value="adjustment">Inventory Adjustment</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  
                  {/* Details */}
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Details (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f]"
                      value={reasonDetails}
                      placeholder="Additional details about the update"
                      onChange={(e) => setReasonDetails(e.target.value)}
                    />
                  </div>
                  
                  {/* Apply Button */}
                  <div className="md:col-span-3">
                    <div className="flex items-center justify-end">
                      <button
                        className={`py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed text-white ${
                          stockOperation === 'add'
                            ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                            : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                        }`}
                        onClick={() => {
                          // Validate
                          if (stockAdjustmentAmount <= 0) {
                            toastUtils.error('Quantity must be greater than zero');
                            return;
                          }
                          
                          if (selectedVariants.size === 0) {
                            toastUtils.error('Please select at least one variant');
                            return;
                          }
                          
                          // Update the selected variants
                          const newInventory = variantInventory.map(v => {
                            if (selectedVariants.has(v.id)) {
                              if (stockOperation === 'add') {
                                return {
                                  ...v,
                                  stock_quantity: v.stock_quantity + stockAdjustmentAmount,
                                  changed: true
                                };
                              } else {
                                // Remove operation
                                const newQuantity = Math.max(0, v.stock_quantity - stockAdjustmentAmount);
                                return {
                                  ...v,
                                  stock_quantity: newQuantity,
                                  changed: true
                                };
                              }
                            }
                            return v;
                          });
                          
                          setVariantInventory(newInventory);
                          setStockAdjustmentAmount(0); // Reset the amount
                          toastUtils.success(`Stock ${stockOperation === 'add' ? 'added' : 'removed'} successfully`);
                        }}
                        disabled={stockAdjustmentAmount <= 0 || selectedVariants.size === 0}
                      >
                        {stockOperation === 'add' ? 'Add' : 'Remove'} Stock
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Mark Items as Damaged */}
              {selectedVariantForAction && (
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-4">Mark Items as Damaged</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-6">
                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity to Mark as Damaged
                      </label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f]"
                        value={damageQuantity}
                        min={1}
                        onChange={(e) =>
                          setDamageQuantity(parseInt(e.target.value) || 0)
                        }
                      />
                    </div>
                    
                    <div className="md:col-span-8">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for Damage
                      </label>
                      <select
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f]"
                        value={damageReason}
                        onChange={(e) => setDamageReason(e.target.value)}
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
                      <div className="md:col-span-8">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Specify Other Reason
                        </label>
                        <input
                          type="text"
                          className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:border-[#c1902f]"
                          value={otherDamageReason}
                          placeholder="Enter custom reason"
                          onChange={(e) => setOtherDamageReason(e.target.value)}
                        />
                      </div>
                    )}
                    
                    {damageReason === 'other' && otherDamageReason.trim() !== '' && (
                      <div className="md:col-span-8 flex items-center">
                        <input
                          type="checkbox"
                          id="saveCustomReason"
                          className="h-4 w-4 text-[#c1902f] focus:ring-[#c1902f] border-gray-300 rounded"
                        />
                        <label htmlFor="saveCustomReason" className="ml-2 block text-sm text-gray-700">
                          Save this reason for future use
                        </label>
                      </div>
                    )}
                    
                    <div className="md:col-span-12 flex justify-end">
                      <button
                        className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => {
                          // Find the selected variant
                          const variant = variantInventory.find(v => v.id === selectedVariantForAction);
                          if (!variant) return;
                          
                          // Validate
                          if (damageQuantity <= 0) {
                            toastUtils.error('Damage quantity must be greater than zero');
                            return;
                          }
                          
                          if (damageQuantity > variant.stock_quantity) {
                            toastUtils.error('Cannot mark more items as damaged than available stock');
                            return;
                          }
                          
                          // Determine the final reason
                          const finalReason = damageReason === 'other' ? otherDamageReason : damageReason;
                          
                          if (!finalReason.trim()) {
                            toastUtils.error('Please provide a reason for marking items as damaged');
                            return;
                          }
                          
                          // Update the variant
                          const newInventory = variantInventory.map(v => {
                            if (v.id === selectedVariantForAction) {
                              return {
                                ...v,
                                stock_quantity: v.stock_quantity - damageQuantity,
                                damaged_quantity: v.damaged_quantity + damageQuantity,
                                changed: true
                              };
                            }
                            return v;
                          });
                          
                          setVariantInventory(newInventory);
                          setSelectedVariantForAction(null);
                          toastUtils.success(`${damageQuantity} items marked as damaged`);
                        }}
                        disabled={damageQuantity <= 0 || !damageReason.trim()}
                      >
                        Mark as Damaged
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Audit History */}
              {auditHistory.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-4">Audit History</h3>
                  
                  <div className="max-h-[300px] overflow-auto border border-gray-200 rounded-md">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Date
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Previous Qty
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            New Qty
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Change
                          </th>
                          <th
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                          >
                            Reason
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {auditHistory.map((audit) => (
                          <tr key={audit.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {format(new Date(audit.created_at), 'MM/dd/yyyy HH:mm')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {audit.previous_quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {audit.new_quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {audit.new_quantity - audit.previous_quantity > 0 ? (
                                <span className="text-green-600">
                                  +{audit.new_quantity - audit.previous_quantity}
                                </span>
                              ) : (
                                <span className="text-red-600">
                                  {audit.new_quantity - audit.previous_quantity}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {audit.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <div>
            {variantInventory.some((v) => v.changed) && (
              <span className="text-sm text-blue-600">You have unsaved changes</span>
            )}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={
                saving || (!enableTracking && !variantInventory.some((v) => v.changed))
              }
              className="px-4 py-2 bg-[#c1902f] hover:bg-[#a97c28] text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchandiseInventoryModal;
