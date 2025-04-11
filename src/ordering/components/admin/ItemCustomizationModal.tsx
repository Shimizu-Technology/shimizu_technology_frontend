// src/ordering/components/admin/ItemCustomizationModal.tsx
import React, { useState, useEffect } from 'react';
import { MenuItem, OptionGroup, MenuOption } from '../../types/menu';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ItemCustomizationModalProps {
  item: MenuItem;
  onClose: () => void;
  onAddToCart: (item: MenuItem, customizations: any[], quantity: number) => void;
}

export function ItemCustomizationModal({ item, onClose, onAddToCart }: ItemCustomizationModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, MenuOption[]>>({});
  
  // Track which option group is expanded (accordion style)
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  
  // Track whether price breakdown is expanded or collapsed
  const [isPriceBreakdownExpanded, setIsPriceBreakdownExpanded] = useState(false);
  
  // Force re-render when selections change to update price calculations
  const [, forceUpdate] = useState({});

  // This effect was previously used for debugging option groups
  // Now removed to clean up console logs

  // Initialize selected options for required option groups
  useEffect(() => {
    if (item.option_groups && item.option_groups.length > 0) {
      const initialSelections: Record<string, MenuOption[]> = {};
      
      item.option_groups.forEach(group => {
        // For preselected options
        const preselectedOptions = group.options
          .filter(opt => opt.is_preselected)
          .map(opt => opt);
        
        if (preselectedOptions.length > 0) {
          // Only add preselected options up to max_select
          initialSelections[group.id.toString()] = preselectedOptions.slice(0, group.max_select);
        } else if (group.min_select > 0 && group.min_select === 1 && group.max_select === 1 && group.options.length > 0) {
          // For required groups with min_select = 1, pre-select the first option if no preselected options
          initialSelections[group.id.toString()] = [group.options[0]];
        } else {
          initialSelections[group.id.toString()] = [];
        }
      });
      
      setSelectedOptions(initialSelections);
      
      // Set the first group as expanded by default, or the first required group if any
      if (item.option_groups.length > 0) {
        const requiredGroup = item.option_groups.find(group => group.min_select > 0);
        setExpandedGroupId(requiredGroup?.id || item.option_groups[0]?.id || null);
      }
    }
  }, [item]);

  // Handle option selection/deselection
  const toggleOption = (group: OptionGroup, option: MenuOption) => {
    const groupIdStr = group.id.toString();
    
    setSelectedOptions(prev => {
      const currentSelections = [...(prev[groupIdStr] || [])];
      const optionIndex = currentSelections.findIndex(opt => opt.id === option.id);
      
      if (optionIndex >= 0) {
        // Option is already selected, remove it
        currentSelections.splice(optionIndex, 1);
      } else {
        // Option is not selected, add it if we haven't reached max_select
        if (currentSelections.length < group.max_select) {
          currentSelections.push(option);
        } else if (group.max_select === 1) {
          // If max_select is 1, replace the current selection
          return {
            ...prev,
            [groupIdStr]: [option]
          };
        } else {
          // If we are at max => remove the first selected
          return {
            ...prev,
            [groupIdStr]: [...currentSelections.slice(1), option]
          };
        }
      }
      
      // Force a re-render to update price calculations
      setTimeout(() => forceUpdate({}), 0);
      
      return {
        ...prev,
        [groupIdStr]: currentSelections
      };
    });
  };

  // Check if we've selected the minimum required options for each group
  const isValid = (): boolean => {
    if (!item.option_groups) return true;
    
    return item.option_groups.every(group => {
      const selections = selectedOptions[group.id.toString()] || [];
      return selections.length >= group.min_select;
    });
  };

  // Get option price with fallback to different price field names
  const getOptionPrice = (option: MenuOption): number => {
    if (typeof option.additional_price === 'number') {
      return option.additional_price;
    } else if (typeof option.additional_price_float === 'number') {
      return option.additional_price_float;
    } else if (typeof (option as any).additional_price_float === 'number') {
      return (option as any).additional_price_float;
    }
    return 0;
  };

  // Determine if an option would be free based on current selections
  const isOptionFree = (group: OptionGroup, optId: number): boolean => {
    const chosenOptions = selectedOptions[group.id.toString()] || [];
    const freeCount = group.free_option_count || 0;
    
    // If no free options available, nothing is free
    if (freeCount === 0) return false;
    
    // If option is not selected, check if it would be free if selected
    if (!chosenOptions.some(opt => opt.id === optId)) {
      // If we have fewer selections than free options, this option would be free
      return chosenOptions.length < freeCount;
    }
    
    // If option is already selected, we need to determine if it's one of the free ones
    // Get all selected options with their prices
    const selectedOptionsWithPrices = chosenOptions.map(option => ({
      id: option.id,
      price: getOptionPrice(option)
    }));
    
    // Sort by price (highest first) to be customer-friendly
    selectedOptionsWithPrices.sort((a, b) => b.price - a.price);
    
    // Get the IDs of the free options (the first 'freeCount' options after sorting)
    const freeOptionIds = selectedOptionsWithPrices.slice(0, freeCount).map(o => o.id);
    
    // Check if this option is in the free list
    return freeOptionIds.includes(optId);
  };

  // Get detailed price breakdown for each option group
  const getPriceBreakdown = (): { groupName: string; options: { name: string; price: number }[] }[] => {
    const breakdown: { groupName: string; options: { name: string; price: number }[] }[] = [];
    
    if (!item.option_groups) return breakdown;
    
    for (const group of item.option_groups) {
      const chosenOptions = selectedOptions[group.id.toString()] || [];
      
      // Skip if no selections
      if (chosenOptions.length === 0) continue;
      
      // Get the free option count for this group
      const freeCount = group.free_option_count || 0;
      
      // If we have more selections than free options, calculate additional price
      if (chosenOptions.length > freeCount) {
        // Get all selected options with their details
        const selectedOptionsWithPrices = chosenOptions.map(option => ({
          id: option.id,
          name: option.name,
          price: getOptionPrice(option)
        }));
        
        // Sort by price (highest first) to be customer-friendly
        selectedOptionsWithPrices.sort((a, b) => b.price - a.price);
        
        // Determine which options are paid (options beyond the free count)
        const paidOptions = selectedOptionsWithPrices.slice(freeCount)
          .map(opt => ({ name: opt.name, price: opt.price }))
          .filter(opt => opt.price > 0); // Only include options with a price > 0
        
        if (paidOptions.length > 0) {
          breakdown.push({
            groupName: group.name,
            options: paidOptions
          });
        }
      }
    }
    
    return breakdown;
  };

  // Sum up the additional price across all selected options, accounting for free options
  const calculateAdditionalPrice = (): number => {
    let sum = 0;
    
    if (!item.option_groups) return sum;
    
    for (const group of item.option_groups) {
      const chosenOptions = selectedOptions[group.id.toString()] || [];
      
      // Skip if no selections
      if (chosenOptions.length === 0) continue;
      
      // Get the free option count for this group
      const freeCount = group.free_option_count || 0;
      
      // If we have more selections than free options, calculate additional price
      if (chosenOptions.length > freeCount) {
        // Get all selected options with their prices
        const selectedOptionsWithPrices = chosenOptions.map(option => ({
          id: option.id,
          name: option.name,
          price: getOptionPrice(option)
        }));
        
        // Sort by price (highest first) to be customer-friendly
        selectedOptionsWithPrices.sort((a, b) => b.price - a.price);
        
        // Apply charges only to options beyond the free count
        const paidOptions = selectedOptionsWithPrices.slice(freeCount);
        
        for (const opt of paidOptions) {
          sum += opt.price;
        }
      }
    }
    
    return sum;
  };

  // Define types for option customization
  interface OptionWithGroup {
    option_group_id: number;
    option_group_name: string;
    option_id: number;
    option_name: string;
    price: number;
    group: {
      id: number;
      free_option_count: number;
    };
  }

  interface ProcessedOption extends OptionWithGroup {
    is_free: boolean;
    effective_price: number;
  }

  // Convert selected options to the format expected by the cart
  const formatCustomizations = (): ProcessedOption[] => {
    if (!item.option_groups) return [];
    
    // First, get all selected options with their group info
    const allSelectedOptions = Object.entries(selectedOptions).flatMap(([groupId, options]) => {
      const group = item.option_groups?.find(g => g.id.toString() === groupId);
      if (!group) return [];
      
      return options.map(option => ({
        option_group_id: parseInt(groupId),
        option_group_name: group?.name || '',
        option_id: option.id,
        option_name: option.name,
        price: getOptionPrice(option),
        // Include group info for free option calculation
        group: {
          id: group.id,
          free_option_count: group.free_option_count || 0
        }
      })) as OptionWithGroup[];
    });
    
    // Group options by group ID to handle free options
    const optionsByGroup: Record<number, OptionWithGroup[]> = {};
    allSelectedOptions.forEach(option => {
      const groupId = option.option_group_id;
      if (!optionsByGroup[groupId]) {
        optionsByGroup[groupId] = [];
      }
      optionsByGroup[groupId].push(option);
    });
    
    // Process each group to determine which options are free
    const processedOptions: ProcessedOption[] = [];
    for (const [groupId, options] of Object.entries(optionsByGroup)) {
      const freeCount = options[0]?.group?.free_option_count || 0;
      
      // Sort by price (highest first) to be customer-friendly
      options.sort((a, b) => b.price - a.price);
      
      // Mark options as free or paid
      options.forEach((option, index) => {
        const isFree = index < freeCount;
        processedOptions.push({
          ...option,
          is_free: isFree,
          // If it's free, set price to 0 for display purposes
          effective_price: isFree ? 0 : option.price
        });
      });
    }
    
    return processedOptions;
  };

  // Calculate prices
  const basePrice = item.price;
  const additionalPrice = calculateAdditionalPrice();
  const totalPrice = (basePrice + additionalPrice) * quantity;
  const priceBreakdown = getPriceBreakdown();

  // Toggle expanded/collapsed state for an option group
  const toggleGroupExpansion = (groupId: number) => {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId);
  };

  // Handle adding to cart
  const handleAddToCart = () => {
    if (isValid()) {
      // Get the original array format for compatibility
      const customizationsArray = formatCustomizations();
      
      // Create a copy of the item with the updated price and formatted customizations
      const itemWithUpdatedPrice = {
        ...item,
        price: basePrice + additionalPrice,
        // Add a properly formatted customizations object that will display correctly
        customizations: formatCustomizationsForDisplay()
      };
      
      // Debug log to help troubleshoot price calculations
      console.log('Adding to cart:', {
        itemName: item.name,
        basePrice: basePrice,
        additionalPrice: additionalPrice,
        totalItemPrice: totalPrice,
        quantity: quantity,
        customizations: itemWithUpdatedPrice.customizations
      });
      
      // Pass the updated item and the array of customizations
      onAddToCart(itemWithUpdatedPrice, customizationsArray, quantity);
    }
  };
  
  // Format customizations in a way that can be properly displayed in AdminEditOrderModal
  const formatCustomizationsForDisplay = () => {
    // Create an object where keys are option group names and values are arrays of option names
    const displayFormat: Record<string, string[]> = {};
    
    if (!item.option_groups) return displayFormat;
    
    // Group selected options by their group name
    Object.entries(selectedOptions).forEach(([groupId, options]) => {
      const group = item.option_groups?.find(g => g.id.toString() === groupId);
      if (!group || options.length === 0) return;
      
      // Use the group name as the key
      const groupName = group.name;
      
      // Create an array of option names
      const optionNames = options.map(option => option.name);
      
      // Add to the display format
      displayFormat[groupName] = optionNames;
    });
    
    return displayFormat;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-center items-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg h-auto max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white rounded-t-lg p-6 pb-2 border-b border-gray-100 z-10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h3 className="text-xl font-semibold pr-6">
            Customize: {item.name}
          </h3>
        </div>
        
        {/* Content - Option groups */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {!item.option_groups || item.option_groups.length === 0 ? (
            <p>No customizations available.</p>
          ) : (
            item.option_groups.map(group => {
              const groupId = group.id;
              const selectedCount = (selectedOptions[groupId.toString()] || []).length;
              const isRequired = group.min_select > 0;
              const needsMoreSelections = selectedCount < group.min_select;
              const freeCount = group.free_option_count || 0;
              const hasExceededFreeCount = selectedCount > freeCount;
              const isExpanded = expandedGroupId === groupId;
              
              // Determine if this group needs attention (required but not fulfilled)
              const needsAttention = isRequired && needsMoreSelections;
              
              return (
                <div key={groupId} className="mb-4 border rounded-md overflow-hidden">
                  {/* Collapsible Header - Always visible */}
                  <button
                    onClick={() => toggleGroupExpansion(groupId)}
                    className={`w-full p-3 text-left flex items-center justify-between
                      ${needsAttention ? 'bg-red-50' : isExpanded ? 'bg-[#c1902f]/10' : 'bg-gray-50'}
                      ${needsAttention ? 'border-red-200' : isExpanded ? 'border-[#c1902f]' : 'border-gray-200'}
                      transition-colors duration-200
                    `}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-700 flex items-center flex-wrap">
                        {group.name}{' '}
                        <span className="text-sm ml-2">
                          {isRequired ? (
                            <span className={`${needsMoreSelections ? 'text-red-500' : 'text-green-600'} font-semibold`}>
                              (Required: {selectedCount}/{group.min_select})
                            </span>
                          ) : (
                            <span className="text-gray-500">
                              (Select up to {group.max_select}
                              {group.free_option_count > 0 &&
                                `, ${group.free_option_count} free`}
                              )
                            </span>
                          )}
                        </span>
                      </div>
                      
                      {/* Show a summary of selections when collapsed */}
                      {!isExpanded && selectedCount > 0 && (
                        <p className="text-sm text-gray-600 mt-1 truncate">
                          Selected: {selectedOptions[groupId.toString()]
                            ?.map(opt => opt.name)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                    
                    {/* Expand/Collapse icon */}
                    <div className="ml-2 text-gray-500">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </button>
                  
                  {/* Collapsible Content - Only visible when expanded */}
                  {isExpanded && (
                    <div className="p-3 border-t border-gray-200">
                      {group.free_option_count > 0 && (
                        <p className="text-sm text-gray-600 mb-2">
                          First {group.free_option_count} selection{group.free_option_count !== 1 ? 's' : ''} free, additional selections will be charged.
                          {hasExceededFreeCount && (
                            <span className="text-orange-500 font-medium"> You have {selectedCount - freeCount} paid selection{selectedCount - freeCount !== 1 ? 's' : ''}.</span>
                          )}
                        </p>
                      )}
                      
                      <div className="space-y-2">
                        {group.options.map((option) => {
                          const isSelected = (selectedOptions[groupId.toString()] || [])
                            .some(opt => opt.id === option.id);
                          
                          const extraPrice = getOptionPrice(option);
                          const isFree = isOptionFree(group, option.id);
                          
                          // Determine what price indicator to show
                          let priceIndicator = null;
                          if (isSelected && isFree) {
                            priceIndicator = (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                Free
                              </span>
                            );
                          } else if (extraPrice > 0) {
                            priceIndicator = (
                              <span className="text-sm text-gray-500">
                                +${extraPrice.toFixed(2)}
                              </span>
                            );
                          }
                          
                          return (
                            <div
                              key={option.id}
                              className={`
                                block w-full text-left px-4 py-2 border rounded-md cursor-pointer
                                ${isSelected
                                  ? 'border-[#c1902f] bg-[#c1902f]/10'
                                  : 'border-gray-200 hover:border-[#c1902f]'
                                }
                              `}
                              onClick={() => toggleOption(group, option)}
                            >
                              <div className="flex justify-between items-center w-full">
                                <div>
                                  {option.name}{' '}
                                  {option.is_preselected && !isSelected && (
                                    <span className="ml-2 text-xs text-blue-500">
                                      (Recommended)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center">
                                  {priceIndicator}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {isRequired && needsMoreSelections && (
                        <p className="text-red-500 text-sm mt-2">
                          Please select at least {group.min_select} option{group.min_select > 1 ? 's' : ''}.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        {/* Footer with price breakdown, quantity and add to cart button */}
        <div className="sticky bottom-0 bg-white rounded-b-lg border-t border-gray-200 p-6">
          {/* Price breakdown - Collapsible */}
          <div className="mb-4">
            {/* Price breakdown header with toggle button */}
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-gray-700">Price Breakdown</h4>
              <button
                onClick={() => setIsPriceBreakdownExpanded(!isPriceBreakdownExpanded)}
                className="text-gray-500 hover:text-gray-700 flex items-center text-sm"
              >
                {isPriceBreakdownExpanded ? (
                  <>
                    <span className="mr-1">Hide details</span>
                    <ChevronUp size={16} />
                  </>
                ) : (
                  <>
                    <span className="mr-1">View details</span>
                    <ChevronDown size={16} />
                  </>
                )}
              </button>
            </div>
            
            {/* Collapsed view - Summary only */}
            {!isPriceBreakdownExpanded ? (
              <div className="space-y-1 mb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span>Base: ${basePrice.toFixed(2)}</span>
                    {additionalPrice > 0 && (
                      <span className="ml-1">+ Add-ons: ${additionalPrice.toFixed(2)}</span>
                    )}
                  </div>
                  <span className="font-semibold">${(basePrice + additionalPrice).toFixed(2)}</span>
                </div>
              </div>
            ) : (
              /* Expanded view - Full breakdown */
              <div className="space-y-1 mb-3 animate-fadeIn">
                <div className="flex justify-between">
                  <span>Base price:</span>
                  <span>${basePrice.toFixed(2)}</span>
                </div>
                
                {/* Detailed breakdown of paid options by group - only shown when there are paid options */}
                {priceBreakdown.length > 0 && (
                  <div className="mt-2">
                    {priceBreakdown.map((group, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-gray-600">
                          <span>{group.groupName} paid options:</span>
                          <span>+${group.options.reduce((sum, opt) => sum + opt.price, 0).toFixed(2)}</span>
                        </div>
                        {group.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex justify-between text-gray-600 text-sm pl-4">
                            <span>{opt.name}:</span>
                            <span>+${opt.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    
                    {/* Only show additional options total if there are paid options */}
                    {additionalPrice > 0 && (
                      <div className="flex justify-between text-gray-600 mt-2">
                        <span>Additional options total:</span>
                        <span>+${additionalPrice.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Item total with more spacing when no paid options */}
                <div className={`flex justify-between font-semibold border-t border-gray-200 pt-1 ${priceBreakdown.length === 0 ? 'mt-4' : 'mt-1'}`}>
                  <span>Item total:</span>
                  <span>${(basePrice + additionalPrice).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quantity & total row */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setQuantity((q) => Math.max(1, q - 1));
                  // Force update to recalculate prices
                  forceUpdate({});
                }}
                className="px-3 py-1 border rounded"
              >
                -
              </button>
              <span>{quantity}</span>
              <button
                onClick={() => {
                  setQuantity((q) => q + 1);
                  // Force update to recalculate prices
                  forceUpdate({});
                }}
                className="px-3 py-1 border rounded"
              >
                +
              </button>
            </div>
            <p className="text-lg font-semibold">
              Total: ${totalPrice.toFixed(2)}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!isValid()}
              className={`
                flex-1 py-3 bg-[#c1902f] text-white rounded-md font-medium
                focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:ring-opacity-50
                ${isValid()
                  ? 'hover:bg-[#a97c28]'
                  : 'opacity-50 cursor-not-allowed'
                }
              `}
            >
              Add to Cart
            </button>
            
            <button
              onClick={onClose}
              className="py-3 px-4 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
