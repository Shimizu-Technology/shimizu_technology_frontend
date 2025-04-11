// src/ordering/components/CustomizationModal.tsx
import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { useOrderStore } from '../store/orderStore';
import type { MenuItem, OptionGroup, MenuOption } from '../types/menu';

interface CustomizationModalProps {
  item: MenuItem;
  onClose: () => void;
}

export function CustomizationModal({ item, onClose }: CustomizationModalProps) {
  const addToCart = useOrderStore((state) => state.addToCart);

  // 1) Track user selections: selections[groupId] = array of optionIds
  const [selections, setSelections] = useState<Record<number, number[]>>({});
  const [quantity, setQuantity] = useState(1);
  
  // Track which option group is expanded (accordion style)
  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  
  // Track whether price breakdown is expanded or collapsed
  const [isPriceBreakdownExpanded, setIsPriceBreakdownExpanded] = useState(false);
  
  // Force re-render when selections change to update price calculations
  const [, forceUpdate] = useState({});

  // Safely handle no option_groups
  const optionGroups = item.option_groups || [];

  // Initialize selections based on option groups
  useEffect(() => {
    // Option groups initialization logic
  }, [optionGroups]);

  // Initialize selections with pre-selected options and set first group as expanded
  useEffect(() => {
    const initialSelections: Record<number, number[]> = {};
    
    optionGroups.forEach(group => {
      const preselectedOptions = group.options
        .filter(opt => opt.is_preselected)
        .map(opt => opt.id);
      
      if (preselectedOptions.length > 0) {
        // Only add preselected options up to max_select
        initialSelections[group.id] = preselectedOptions.slice(0, group.max_select);
      } else {
        initialSelections[group.id] = [];
      }
    });
    
    setSelections(initialSelections);
    
    // Set the first group as expanded by default, or the first required group if any
    if (optionGroups.length > 0) {
      const requiredGroup = optionGroups.find(group => group.min_select > 0);
      setExpandedGroupId(requiredGroup?.id || optionGroups[0]?.id || null);
    }
  }, [optionGroups]);

  // Toggle an option in a group, respecting max_select
  function handleOptionToggle(group: OptionGroup, opt: MenuOption) {
    setSelections((prev) => {
      const current = prev[group.id] || [];
      let newSelections;
      
      if (current.includes(opt.id)) {
        // Remove this opt.id
        newSelections = {
          ...prev,
          [group.id]: current.filter((id) => id !== opt.id),
        };
      } else if (current.length >= group.max_select) {
        // If we are at max => remove the first selected
        newSelections = {
          ...prev,
          [group.id]: [...current.slice(1), opt.id],
        };
      } else {
        // Otherwise, just add it
        newSelections = {
          ...prev,
          [group.id]: [...current, opt.id],
        };
      }
      
      // Force a re-render to update price calculations
      setTimeout(() => forceUpdate({}), 0);
      
      return newSelections;
    });
  }

  // Get detailed price breakdown for each option group
  function getPriceBreakdown(): { groupName: string; options: { name: string; price: number }[] }[] {
    const breakdown: { groupName: string; options: { name: string; price: number }[] }[] = [];
    
    for (const group of optionGroups) {
      const chosenIds = selections[group.id] || [];
      
      // Skip if no selections
      if (chosenIds.length === 0) continue;
      
      // Get the free option count for this group
      const freeCount = group.free_option_count || 0;
      
      // If we have more selections than free options, calculate additional price
      if (chosenIds.length > freeCount) {
        // Get all selected options with their details
        const selectedOptions = chosenIds
          .map(id => {
            const option = group.options.find(o => o.id === id);
            // Debug: Log the option and its price
            // Option found and being processed
            
            // Try different ways to access the price
            const price = option ? 
              (typeof option.additional_price === 'number' ? option.additional_price : 
               typeof option.additional_price_float === 'number' ? option.additional_price_float : 
               typeof (option as any).additional_price_float === 'number' ? (option as any).additional_price_float : 
               2.0) : 0;
            
            // Price calculation for option
            
            return option ? {
              id,
              name: option.name,
              price: price
            } : null;
          })
          .filter(Boolean) as { id: number; name: string; price: number }[];
        
        // Sort by price (highest first) to be customer-friendly
        selectedOptions.sort((a, b) => b.price - a.price);
        
        // Determine which options are paid (options beyond the free count)
        const paidOptions = selectedOptions.slice(freeCount)
          .map(opt => ({ name: opt.name, price: opt.price }));
        
        if (paidOptions.length > 0) {
          breakdown.push({
            groupName: group.name,
            options: paidOptions
          });
        }
      }
    }
    
    return breakdown;
  }

  // Sum up the additional price across all selected options, accounting for free options
  function getAdditionalPrice(): number {
    let sum = 0;
    
    for (const group of optionGroups) {
      const chosenIds = selections[group.id] || [];
      
      // Skip if no selections
      if (chosenIds.length === 0) continue;
      
      // Get the free option count for this group
      const freeCount = group.free_option_count || 0;
      
      // If we have more selections than free options, calculate additional price
      if (chosenIds.length > freeCount) {
        // Get all selected options with their prices
        const selectedOptions = chosenIds
          .map(id => {
            const option = group.options.find(o => o.id === id);
            
            // Try different ways to access the price
            const price = option ? 
              (typeof option.additional_price === 'number' ? option.additional_price : 
               typeof option.additional_price_float === 'number' ? option.additional_price_float : 
               typeof (option as any).additional_price_float === 'number' ? (option as any).additional_price_float : 
               2.0) : 0;
            
            return option ? {
              id,
              name: option.name,
              price: price
            } : null;
          })
          .filter(Boolean) as { id: number; name: string; price: number }[];
        
        // Sort by price (highest first) to be customer-friendly
        selectedOptions.sort((a, b) => b.price - a.price);
        
        // Apply charges only to options beyond the free count
        const paidOptions = selectedOptions.slice(freeCount);
        
        for (const opt of paidOptions) {
          sum += opt.price;
          // Adding option price to total sum
        }
      }
    }
    
    return sum;
  }
  
  // Determine if an option would be free based on current selections
  function isOptionFree(group: OptionGroup, optId: number): boolean {
    const chosenIds = selections[group.id] || [];
    const freeCount = group.free_option_count || 0;
    
    // If no free options available, nothing is free
    if (freeCount === 0) return false;
    
    // If option is not selected, check if it would be free if selected
    if (!chosenIds.includes(optId)) {
      // If we have fewer selections than free options, this option would be free
      return chosenIds.length < freeCount;
    }
    
    // If option is already selected, we need to determine if it's one of the free ones
    // Get all selected options with their prices
    const selectedOptions = chosenIds
      .map(id => {
        const option = group.options.find(o => o.id === id);
        
        // Try different ways to access the price
        const price = option ? 
          (typeof option.additional_price === 'number' ? option.additional_price : 
           typeof option.additional_price_float === 'number' ? option.additional_price_float : 
           typeof (option as any).additional_price_float === 'number' ? (option as any).additional_price_float : 
           2.0) : 0;
        
        return option ? {
          id,
          price: price
        } : null;
      })
      .filter(Boolean) as { id: number, price: number }[];
    
    // Sort by price (highest first) to be customer-friendly
    selectedOptions.sort((a, b) => b.price - a.price);
    
    // Get the IDs of the free options (the first 'freeCount' options after sorting)
    const freeOptionIds = selectedOptions.slice(0, freeCount).map(o => o.id);
    
    // Check if this option is in the free list
    return freeOptionIds.includes(optId);
  }

  // Check if all required groups have the minimum number of selections
  function validateSelections(): boolean {
    for (const group of optionGroups) {
      // If min_select > 0, the group is required
      if (group.min_select > 0) {
        const selectedCount = (selections[group.id] || []).length;
        if (selectedCount < group.min_select) {
          return false;
        }
      }
    }
    return true;
  }

  // Calculate prices
  const basePrice = item.price;
  const addlPrice = getAdditionalPrice();
  const totalItemPrice = (basePrice + addlPrice) * quantity;
  const isValid = validateSelections();
  const priceBreakdown = getPriceBreakdown();

  // Get paid options count per group
  const paidOptionsByGroup = Object.entries(selections).map(([groupId, selectedIds]) => {
    const group = optionGroups.find(g => g.id === Number(groupId));
    if (!group) return null;
    
    const freeCount = group.free_option_count || 0;
    const paidCount = Math.max(0, selectedIds.length - freeCount);
    
    if (paidCount <= 0) return null;
    
    // Calculate total price for this group's paid options
    const selectedOptions = selectedIds
      .map(id => {
        const option = group.options.find(o => o.id === id);
        
        // Try different ways to access the price
        const price = option ? 
          (typeof option.additional_price === 'number' ? option.additional_price : 
           typeof option.additional_price_float === 'number' ? option.additional_price_float : 
           typeof (option as any).additional_price_float === 'number' ? (option as any).additional_price_float : 
           2.0) : 0;
        
        return option ? {
          id,
          name: option.name,
          price: price
        } : null;
      })
      .filter(Boolean) as { id: number; name: string; price: number }[];
    
    // Sort by price (highest first)
    selectedOptions.sort((a, b) => b.price - a.price);
    
    // Get paid options
    const paidOptions = selectedOptions.slice(freeCount);
    
    // Calculate total price
    const totalPrice = paidOptions.reduce((sum, opt) => sum + opt.price, 0);
    
    // Only include groups with a non-zero total price
    if (totalPrice <= 0) return null;
    
    return {
      groupId: Number(groupId),
      groupName: group.name,
      paidCount,
      totalPrice,
      paidOptions: paidOptions.filter(opt => opt.price > 0) // Only include options with a price > 0
    };
  }).filter(Boolean) as {
    groupId: number;
    groupName: string;
    paidCount: number;
    totalPrice: number;
    paidOptions: { id: number; name: string; price: number }[];
  }[];

  // On "Add to Cart": build a customizations object => groupName => [optionName, ...]
  function handleAddToCart() {
    if (!isValid) {
      alert("Please make all required selections before adding to cart.");
      return;
    }

    const finalCustomizations: Record<string, string[]> = {};

    // For each group => collect the chosen names
    for (const group of optionGroups) {
      const chosenIds = selections[group.id] || [];
      if (chosenIds.length > 0) {
        const chosenNames = group.options
          .filter((o) => chosenIds.includes(o.id))
          .map((o) => o.name);
        finalCustomizations[group.name] = chosenNames;
      }
    }

    // Use the final price = base + addl
    addToCart(
      {
        id: item.id,
        name: item.name,
        price: basePrice + addlPrice,
        customizations: finalCustomizations as any,
        image: item.image, // Include the image property
      } as any,
      quantity
    );

    onClose();
  }

  // Toggle expanded/collapsed state for an option group
  function toggleGroupExpansion(groupId: number) {
    setExpandedGroupId(expandedGroupId === groupId ? null : groupId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col animate-slideUp mt-8 sm:mt-16">
        {/* Fixed Header */}
        <div className="sticky top-0 bg-white rounded-t-lg p-6 pb-2 border-b border-gray-100 z-10">
          <button
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </button>

          <h3 className="text-xl font-semibold pr-6">
            Customize: {item.name}
          </h3>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          {/* If no optionGroups, just show "no customizations" */}
          {optionGroups.length === 0 ? (
            <p>No customizations available.</p>
          ) : (
            optionGroups.map((group) => {
              const groupId = group.id;
              const selectedCount = (selections[groupId] || []).length;
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
                          Selected: {group.options
                            .filter(opt => selections[groupId]?.includes(opt.id))
                            .map(opt => opt.name)
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
                        {group.options.map((opt) => {
                          const selected = selections[groupId]?.includes(opt.id);
                          
                          // Try different ways to access the price
                          const extraPrice = typeof opt.additional_price === 'number' ? opt.additional_price : 
                                            typeof opt.additional_price_float === 'number' ? opt.additional_price_float : 
                                            typeof (opt as any).additional_price_float === 'number' ? (opt as any).additional_price_float : 
                                            2.0;
                          
                          const isFree = isOptionFree(group, opt.id);
                          
                          // Determine what price indicator to show
                          let priceIndicator = null;
                          if (selected && isFree) {
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
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleOptionToggle(group, opt)}
                              className={`block w-full text-left px-4 py-2 border rounded-md 
                                ${
                                  selected
                                    ? 'border-[#c1902f] bg-[#c1902f]/10'
                                    : 'border-gray-200 hover:border-[#c1902f]'
                                }
                              `}
                            >
                              <div className="flex justify-between items-center w-full">
                                <div>
                                  {opt.name}{' '}
                                  {opt.is_preselected && !selected && (
                                    <span className="ml-2 text-xs text-blue-500">
                                      (Recommended)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center">
                                  {priceIndicator}
                                </div>
                              </div>
                            </button>
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

        {/* Fixed Footer */}
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
                    {addlPrice > 0 && (
                      <span className="ml-1">+ Add-ons: ${addlPrice.toFixed(2)}</span>
                    )}
                  </div>
                  <span className="font-semibold">${(basePrice + addlPrice).toFixed(2)}</span>
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
                {paidOptionsByGroup.length > 0 && (
                  <div className="mt-2">
                    {paidOptionsByGroup.map((group, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-gray-600">
                          <span>{group.groupName} paid options ({group.paidCount}):</span>
                          <span>+${group.totalPrice.toFixed(2)}</span>
                        </div>
                        {group.paidOptions.map((opt, optIdx) => (
                          <div key={optIdx} className="flex justify-between text-gray-600 text-sm pl-4">
                            <span>{opt.name}:</span>
                            <span>+${opt.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                    
                    {/* Only show additional options total if there are paid options */}
                    {addlPrice > 0 && (
                      <div className="flex justify-between text-gray-600 mt-2">
                        <span>Additional options total:</span>
                        <span>+${addlPrice.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Item total with more spacing when no paid options */}
                <div className={`flex justify-between font-semibold border-t border-gray-200 pt-1 ${paidOptionsByGroup.length === 0 ? 'mt-4' : 'mt-1'}`}>
                  <span>Item total:</span>
                  <span>${(basePrice + addlPrice).toFixed(2)}</span>
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
              Total: ${totalItemPrice.toFixed(2)}
            </p>
          </div>

          {/* Bottom Buttons */}
          <div className="flex justify-end space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToCart}
              className={`px-4 py-2 text-white rounded-md ${
                isValid 
                  ? 'bg-[#c1902f] hover:bg-[#d4a43f]' 
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={!isValid}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
