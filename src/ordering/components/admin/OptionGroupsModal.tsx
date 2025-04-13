// src/ordering/components/admin/OptionGroupsModal.tsx

import React, { useState } from 'react';
import { Trash2, X, Save, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { MenuItem } from '../../types/menu';
import toastUtils from '../../../shared/utils/toastUtils';
import DraggableOptionList from './DraggableOptionList';

interface OptionRow {
  id: number;
  name: string;
  additional_price: number;
  position: number;
  // Pre-selected support
  is_preselected?: boolean;
  // Availability toggle
  is_available?: boolean;
}

interface OptionGroup {
  id: number;
  name: string;
  min_select: number;
  max_select: number;
  free_option_count: number;
  position: number;
  options: OptionRow[];
}

interface OptionGroupsModalProps {
  item: MenuItem;
  onClose: () => void;
}

export function OptionGroupsModal({ item, onClose }: OptionGroupsModalProps) {
  const [originalOptionGroups, setOriginalOptionGroups] = useState<OptionGroup[]>([]);
  const [draftOptionGroups, setDraftOptionGroups] = useState<OptionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for bulk actions
  const [selectedOptions, setSelectedOptions] = useState<Record<number, Set<number>>>({});
  const [bulkActionVisible, setBulkActionVisible] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // New group form fields
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMin, setNewGroupMin] = useState(0);
  const [newGroupMax, setNewGroupMax] = useState(1);
  const [newGroupFreeCount, setNewGroupFreeCount] = useState(0);

  // We'll generate temporary negative IDs for new groups/options
  const [tempIdCounter, setTempIdCounter] = useState(-1);

  React.useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line
  }, [item.id]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/menu_items/${item.id}/option_groups`);
      // Sort groups/options by position
      const sorted = (data as OptionGroup[]).map((g) => ({
        ...g,
        options: g.options.slice().sort((a, b) => (a.position || 0) - (b.position || 0)),
      }));
      sorted.sort((a, b) => (a.position || 0) - (b.position || 0));

      setOriginalOptionGroups(sorted);
      // Deep clone to make an editable draft
      setDraftOptionGroups(JSON.parse(JSON.stringify(sorted)));
    } catch (err) {
      console.error(err);
      setOriginalOptionGroups([]);
      setDraftOptionGroups([]);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Local manipulations
  // -----------------------------

  // Create local group
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;

    // Place the new group at the end by position
    const maxPos = draftOptionGroups.reduce(
      (acc, g) => Math.max(acc, g.position || 0),
      0
    );
    const newGroup: OptionGroup = {
      id: tempIdCounter,
      name: newGroupName,
      min_select: Math.max(0, newGroupMin),   // clamp min ≥ 0
      max_select: Math.max(1, newGroupMax),   // clamp max ≥ 1
      free_option_count: Math.max(0, Math.min(newGroupFreeCount, newGroupMax)), // clamp between 0 and max_select
      position: maxPos + 1,
      options: [],
    };
    setDraftOptionGroups((prev) => [...prev, newGroup]);

    // Reset fields
    setNewGroupName('');
    setNewGroupMin(0);
    setNewGroupMax(1);
    setNewGroupFreeCount(0);
    setTempIdCounter((prevId) => prevId - 1);
  };

  // Update local group
  const handleLocalUpdateGroup = (
    groupId: number,
    changes: Partial<Omit<OptionGroup, 'options'>>
  ) => {
    setDraftOptionGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          // Ensure min≥0, max≥1
          if (typeof changes.min_select === 'number') {
            changes.min_select = Math.max(0, changes.min_select);
          }
          if (typeof changes.max_select === 'number') {
            changes.max_select = Math.max(1, changes.max_select);
          }
          if (typeof changes.free_option_count === 'number') {
            // Ensure free_option_count is between 0 and max_select
            const maxSelect = typeof changes.max_select === 'number' 
              ? changes.max_select 
              : g.max_select;
            changes.free_option_count = Math.max(0, Math.min(changes.free_option_count, maxSelect));
          }
          return { ...g, ...changes };
        }
        return g;
      })
    );
  };

  // Delete local group
  const handleLocalDeleteGroup = (groupId: number) => {
    if (!window.confirm('Delete this option group?')) return;
    setDraftOptionGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  // Create local option
  const handleLocalCreateOption = (groupId: number) => {
    setDraftOptionGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const maxOptPos = g.options.reduce(
            (acc, o) => Math.max(acc, o.position || 0),
            0
          );
          const newOpt: OptionRow = {
            id: tempIdCounter,
            name: '',
            additional_price: 0,
            position: maxOptPos + 1,
            is_preselected: false,
            is_available: true,
          };
          return { ...g, options: [...g.options, newOpt] };
        }
        return g;
      })
    );
    setTempIdCounter((prevId) => prevId - 1);
  };

  // Update local option
  const handleLocalUpdateOption = (
    groupId: number,
    optionId: number,
    changes: Partial<OptionRow>
  ) => {
    // Check if we're updating availability and turning it off
    if (changes.is_available === false) {
      // Find the group
      const group = draftOptionGroups.find(g => g.id === groupId);
      if (group && group.min_select > 0) {
        // Count how many options would still be available after this change
        const availableOptionsCount = group.options.filter(o => {
          // If this is the option we're updating, use the new value
          if (o.id === optionId) return false;
          // Otherwise use the existing value, defaulting to true if undefined
          return o.is_available !== false;
        }).length;
        
        // If this would make all options unavailable in a required group, show a warning
        if (availableOptionsCount === 0) {
          const confirmChange = window.confirm(
            `Warning: This will make all options unavailable in the required group "${group.name}". ` +
            `Customers won't be able to order this item until at least one option is available again. ` +
            `Continue?`
          );
          
          if (!confirmChange) {
            return; // Don't make the change if the user cancels
          }
        }
      }
    }
    
    setDraftOptionGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return {
            ...g,
            options: g.options.map((o) =>
              o.id === optionId ? { ...o, ...changes } : o
            ),
          };
        }
        return g;
      })
    );
  };

  // Delete local option
  const handleLocalDeleteOption = (groupId: number, optId: number) => {
    if (!window.confirm('Delete this option?')) return;
    setDraftOptionGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          return { ...g, options: g.options.filter((o) => o.id !== optId) };
        }
        return g;
      })
    );
  };

  // -----------------------------
  // Bulk action functions
  // -----------------------------
  const toggleOptionSelection = (groupId: number, optionId: number) => {
    setSelectedOptions(prev => {
      const newSelected = { ...prev };
      
      // Initialize set for this group if it doesn't exist
      if (!newSelected[groupId]) {
        newSelected[groupId] = new Set();
      }
      
      // Toggle selection
      if (newSelected[groupId].has(optionId)) {
        newSelected[groupId].delete(optionId);
      } else {
        newSelected[groupId].add(optionId);
      }
      
      // Remove empty sets
      if (newSelected[groupId].size === 0) {
        delete newSelected[groupId];
      }
      
      // Show/hide bulk action bar based on whether any options are selected
      const hasSelections = Object.values(newSelected).some(set => set.size > 0);
      setBulkActionVisible(hasSelections);
      
      return newSelected;
    });
  };
  
  const toggleAllOptionsInGroup = (groupId: number, select: boolean) => {
    const group = draftOptionGroups.find(g => g.id === groupId);
    if (!group) return;
    
    setSelectedOptions(prev => {
      const newSelected = { ...prev };
      
      if (select) {
        // Select all options in the group
        newSelected[groupId] = new Set(
          group.options.map(opt => opt.id)
        );
      } else {
        // Deselect all options in the group
        delete newSelected[groupId];
      }
      
      // Show/hide bulk action bar
      const hasSelections = Object.values(newSelected).some(set => set.size > 0);
      setBulkActionVisible(hasSelections);
      
      return newSelected;
    });
  };
  
  
  const isAllGroupSelected = (groupId: number) => {
    const group = draftOptionGroups.find(g => g.id === groupId);
    if (!group || !selectedOptions[groupId]) return false;
    
    return group.options.every(opt => selectedOptions[groupId].has(opt.id));
  };
  
  const getSelectedOptionsCount = () => {
    return Object.values(selectedOptions).reduce(
      (total, set) => total + set.size, 0
    );
  };
  
  const handleBulkUpdate = async (setAvailable: boolean) => {
    setBulkActionLoading(true);
    
    try {
      // Collect all selected option IDs
      const optionIds: number[] = [];
      Object.values(selectedOptions).forEach(set => {
        set.forEach(id => {
          // Only include positive IDs (existing options, not new ones)
          if (id > 0) optionIds.push(id);
        });
      });
      
      if (optionIds.length === 0) {
        toastUtils.error('No existing options selected');
        setBulkActionLoading(false);
        return;
      }
      
      // Call the batch update API
      await api.patch('/options/batch_update', {
        option_ids: optionIds,
        updates: { is_available: setAvailable }
      });
      
      // Update local state
      setDraftOptionGroups(prev => {
        return prev.map(group => ({
          ...group,
          options: group.options.map(opt => {
            if (selectedOptions[group.id]?.has(opt.id)) {
              return { ...opt, is_available: setAvailable };
            }
            return opt;
          })
        }));
      });
      
      // Clear selections
      setSelectedOptions({});
      setBulkActionVisible(false);
      
      // Show success message
      toastUtils.success(`${optionIds.length} options ${setAvailable ? 'marked as available' : 'marked as unavailable'}`);
    } catch (error) {
      console.error('Bulk update failed:', error);
      toastUtils.error('Failed to update options');
    } finally {
      setBulkActionLoading(false);
    }
  };
  
  // -----------------------------
  // Save all changes at once
  // -----------------------------
  const handleSaveAllChanges = async () => {
    try {
      // Compare draft vs original
      const draftGroupIds = draftOptionGroups.map((g) => g.id);
      const originalGroupIds = originalOptionGroups.map((g) => g.id);

      // Groups to delete
      const groupsToDelete = originalOptionGroups.filter(
        (og) => !draftGroupIds.includes(og.id)
      );
      // Groups to create
      const groupsToCreate = draftOptionGroups.filter((dg) => dg.id < 0);
      // Groups to update
      const groupsToUpdate = draftOptionGroups.filter(
        (dg) => dg.id > 0 && originalGroupIds.includes(dg.id)
      );

      // 1) Delete removed groups
      for (const gDel of groupsToDelete) {
        await api.delete(`/option_groups/${gDel.id}`);
      }

      // 2) Create new groups
      const newGroupIdMap: Record<number, number> = {};
      for (const gNew of groupsToCreate) {
        const created: any = await api.post(
          `/menu_items/${item.id}/option_groups`,
          {
            name: gNew.name,
            min_select: gNew.min_select,
            max_select: gNew.max_select,
            free_option_count: gNew.free_option_count,
            position: gNew.position,
          }
        );
        // Map the local negative ID to the newly created group ID
        newGroupIdMap[gNew.id] = created.id;
      }

      // 3) Update existing groups
      for (const gUpd of groupsToUpdate) {
        await api.patch(`/option_groups/${gUpd.id}`, {
          name: gUpd.name,
          min_select: gUpd.min_select,
          max_select: gUpd.max_select,
          free_option_count: gUpd.free_option_count,
          position: gUpd.position,
        });
      }

      // 4) Handle options
      for (const draftGroup of draftOptionGroups) {
        let realGroupId = draftGroup.id;
        if (realGroupId < 0 && newGroupIdMap[realGroupId]) {
          realGroupId = newGroupIdMap[realGroupId];
        }
        const origGroup = originalOptionGroups.find((og) => og.id === draftGroup.id);
        const origOptions = origGroup?.options || [];

        const draftOptIds = draftGroup.options.map((o) => o.id);
        const origOptIds = origOptions.map((o) => o.id);

        // Options to delete
        const optsToDelete = origOptions.filter((o) => !draftOptIds.includes(o.id));
        // Options to create
        const optsToCreate = draftGroup.options.filter((o) => o.id < 0);
        // Options to update
        const optsToUpdate = draftGroup.options.filter(
          (o) => o.id > 0 && origOptIds.includes(o.id)
        );

        // Delete
        for (const oDel of optsToDelete) {
          await api.delete(`/options/${oDel.id}`);
        }
        // Create
        for (const oNew of optsToCreate) {
          await api.post(`/option_groups/${realGroupId}/options`, {
            name: oNew.name,
            additional_price: oNew.additional_price,
            position: oNew.position,
            is_preselected: oNew.is_preselected || false,
            is_available: oNew.is_available !== false, // Default to true if undefined
          });
        }
        // Update
        for (const oUpd of optsToUpdate) {
          await api.patch(`/options/${oUpd.id}`, {
            name: oUpd.name,
            additional_price: oUpd.additional_price,
            position: oUpd.position,
            is_preselected: oUpd.is_preselected || false,
            is_available: oUpd.is_available !== false, // Default to true if undefined
          });
        }
      }

      // Refresh from server
      await fetchGroups();

      // Show success toast
      toastUtils.success('Options saved successfully');

      // Close
      onClose();
    } catch (err) {
      console.error(err);
      toastUtils.error('Something went wrong saving changes.');
    }
  };

  // If user closes without saving, discard local changes
  const handleClose = () => {
    onClose();
  };
  
  // Handle batch position updates when options are reordered
  const handleBatchPositionUpdate = async (_groupId: number, reorderedOptions: OptionRow[]) => {
    try {
      // Only update positions for existing options (positive IDs)
      const positionsData = reorderedOptions
        .filter(opt => opt.id > 0) // Only include existing options (positive IDs)
        .map(opt => ({
          id: opt.id,
          position: opt.position
        }));
      
      if (positionsData.length === 0) return; // No existing options to update
      
      // Call the batch update positions endpoint
      await api.patch('/options/batch_update_positions', {
        positions: positionsData
      });
      
      // No need to refresh from server as we're already updating the local state
    } catch (err) {
      console.error('Failed to update positions:', err);
      toastUtils.error('Failed to update option positions');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn transition-all duration-300">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 animate-slideUp transform-gpu will-change-transform">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            Manage Option Groups for: {item.name}
          </h2>
          <button onClick={handleClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-6 animate-pulse">
            {/* Skeleton for "Add Option Group" section */}
            <div className="border-b pb-4 mb-4">
              <div className="h-6 w-48 bg-gray-200 rounded mb-4"></div>
              <div className="flex flex-wrap gap-2">
                <div className="h-9 w-40 bg-gray-200 rounded"></div>
                <div className="h-9 w-20 bg-gray-200 rounded"></div>
                <div className="h-9 w-20 bg-gray-200 rounded"></div>
                <div className="h-9 w-24 bg-gray-200 rounded"></div>
                <div className="h-9 w-32 bg-gray-200 rounded"></div>
              </div>
            </div>
            
            {/* Skeleton for option groups */}
            {[1, 2].map((i) => (
              <div key={i} className="border rounded-md p-4 mb-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="w-full">
                    <div className="h-7 w-48 bg-gray-200 rounded mb-2"></div>
                    <div className="flex space-x-4">
                      <div className="h-5 w-24 bg-gray-200 rounded"></div>
                      <div className="h-5 w-24 bg-gray-200 rounded"></div>
                      <div className="h-5 w-32 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 ml-2">
                  <div className="h-8 w-28 bg-gray-200 rounded mb-4"></div>
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center justify-between mt-2">
                      <div className="h-6 w-48 bg-gray-200 rounded"></div>
                      <div className="h-6 w-24 bg-gray-200 rounded"></div>
                      <div className="h-6 w-8 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Create New Group */}
            <div className="border-b pb-4 mb-4">
              <h3 className="font-semibold mb-2">Add Option Group</h3>
              <div className="flex flex-wrap items-center space-x-2 space-y-2">
                <input
                  type="text"
                  className="border p-1 rounded text-sm"
                  placeholder="Group Name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
                <div className="flex items-center space-x-1 text-xs">
                  <span>Min:</span>
                  <input
                    type="number"
                    min="0"
                    className="border p-1 w-14 rounded"
                    value={newGroupMin}
                    onChange={(e) =>
                      setNewGroupMin(Math.max(0, parseInt(e.target.value) || 0))
                    }
                  />
                </div>
                <div className="flex items-center space-x-1 text-xs">
                  <span>Max:</span>
                  <input
                    type="number"
                    min="1"
                    className="border p-1 w-14 rounded"
                    value={newGroupMax}
                    onChange={(e) =>
                      setNewGroupMax(Math.max(1, parseInt(e.target.value) || 1))
                    }
                  />
                </div>
                <div className="flex items-center space-x-1 text-xs">
                  <span>Free Options:</span>
                  <input
                    type="number"
                    min="0"
                    max={newGroupMax}
                    className="border p-1 w-14 rounded"
                    value={newGroupFreeCount}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setNewGroupFreeCount(Math.max(0, Math.min(value, newGroupMax)));
                    }}
                  />
                </div>
                <button
                  onClick={handleCreateGroup}
                  className="px-2 py-1 bg-[#0078d4] text-white text-sm rounded hover:bg-[#50a3d9]"
                >
                  + Create Group
                </button>
              </div>
            </div>

            {draftOptionGroups.length === 0 && (
              <p className="text-sm text-gray-500">No Option Groups yet.</p>
            )}

            {/* Existing Groups */}
            {draftOptionGroups.map((group) => (
              <div key={group.id} className="border rounded-md p-4 mb-4">
                {/* Group header */}
                <div className="flex justify-between items-center">
                  <div>
                    <input
                      type="text"
                      className="text-lg font-semibold border-b focus:outline-none"
                      value={group.name}
                      onChange={(e) =>
                        handleLocalUpdateGroup(group.id, { name: e.target.value })
                      }
                    />
                    <div className="text-xs text-gray-500 mt-1 flex items-center space-x-3">
                      {/* Min, Max, and Free Options */}
                      <div className="flex items-center">
                        <span>Min:</span>
                        <input
                          type="number"
                          min="0"
                          className="w-14 ml-1 border p-1 rounded text-xs"
                          value={group.min_select}
                          onChange={(e) =>
                            handleLocalUpdateGroup(group.id, {
                              min_select: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center">
                        <span>Max:</span>
                        <input
                          type="number"
                          min="1"
                          className="w-14 ml-1 border p-1 rounded text-xs"
                          value={group.max_select}
                          onChange={(e) =>
                            handleLocalUpdateGroup(group.id, {
                              max_select: parseInt(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                      <div className="flex items-center">
                        <span>Free:</span>
                        <input
                          type="number"
                          min="0"
                          max={group.max_select}
                          className="w-14 ml-1 border p-1 rounded text-xs"
                          value={group.free_option_count || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            handleLocalUpdateGroup(group.id, {
                              free_option_count: Math.max(0, Math.min(value, group.max_select)),
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleLocalDeleteGroup(group.id)}
                    className="p-2 text-gray-600 hover:text-red-600"
                    title="Delete this group"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                {/* Options */}
                <div className="mt-4 ml-2">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center">
                      {/* Select All Checkbox */}
                      {group.options.length > 0 && (
                        <label className="flex items-center space-x-1 text-xs mr-2 cursor-pointer">
                          <div onClick={() => toggleAllOptionsInGroup(group.id, !isAllGroupSelected(group.id))} className="cursor-pointer">
                            {isAllGroupSelected(group.id) ? (
                              <CheckSquare className="h-4 w-4 text-[#0078d4]" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <span>Select All</span>
                        </label>
                      )}
                    </div>
                    <button
                      onClick={() => handleLocalCreateOption(group.id)}
                      className="flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 text-sm rounded"
                    >
                      + Add Option
                    </button>
                  </div>

                  {group.options.length === 0 && (
                    <p className="text-sm text-gray-400 mt-2">No options yet.</p>
                  )}

                  <DraggableOptionList
                    options={group.options}
                    onOptionsReorder={(reorderedOptions) => {
                      // Update the group with the reordered options
                      setDraftOptionGroups(prev =>
                        prev.map(g => {
                          if (g.id === group.id) {
                            return { ...g, options: reorderedOptions };
                          }
                          return g;
                        })
                      );
                      
                      // Send batch position update to the server
                      handleBatchPositionUpdate(group.id, reorderedOptions);
                    }}
                    onUpdateOption={(optionId, changes) => {
                      handleLocalUpdateOption(group.id, optionId, changes);
                    }}
                    onDeleteOption={(optionId) => {
                      handleLocalDeleteOption(group.id, optionId);
                    }}
                    selectedOptionIds={selectedOptions[group.id]}
                    onToggleOptionSelect={(optionId) => {
                      toggleOptionSelection(group.id, optionId);
                    }}
                  />
                </div>
              </div>
            ))}
          </>
        )}

        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 transition-colors duration-200"
          >
            Close (Discard)
          </button>
          <button
            onClick={handleSaveAllChanges}
            className="px-4 py-2 bg-[#0078d4] text-white rounded-md hover:bg-[#50a3d9] transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save className="h-5 w-5 mr-2 inline" />
            Save Changes
          </button>
        </div>
      </div>
      
      {/* Floating action bar for bulk actions */}
      {bulkActionVisible && (
        <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg border-t p-4 flex justify-between items-center z-50">
          <div className="flex items-center">
            <span className="font-medium">{getSelectedOptionsCount()} options selected</span>
            {bulkActionLoading && (
              <div className="ml-4 flex items-center text-gray-500">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span>Processing...</span>
              </div>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setSelectedOptions({});
                setBulkActionVisible(false);
              }}
              className="px-4 py-2 border rounded-md hover:bg-gray-50 transition-colors duration-200"
              disabled={bulkActionLoading}
            >
              Cancel
            </button>
            <button
              onClick={() => handleBulkUpdate(false)}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors duration-200"
              disabled={bulkActionLoading}
            >
              Mark Unavailable
            </button>
            <button
              onClick={() => handleBulkUpdate(true)}
              className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors duration-200"
              disabled={bulkActionLoading}
            >
              Mark Available
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default OptionGroupsModal;
