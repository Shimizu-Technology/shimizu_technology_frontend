// src/ordering/components/admin/OptionGroupsModal.tsx

import React, { useState } from 'react';
import { Trash2, X, Save } from 'lucide-react';
import { api } from '../../lib/api';
import type { MenuItem } from '../../types/menu';

interface OptionRow {
  id: number;
  name: string;
  additional_price: number;
  position: number;
  // Pre-selected support
  is_preselected?: boolean;
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
          });
        }
        // Update
        for (const oUpd of optsToUpdate) {
          await api.patch(`/options/${oUpd.id}`, {
            name: oUpd.name,
            additional_price: oUpd.additional_price,
            position: oUpd.position,
            is_preselected: oUpd.is_preselected || false,
          });
        }
      }

      // Refresh from server
      await fetchGroups();

      // Close
      onClose();
    } catch (err) {
      console.error(err);
      alert('Something went wrong saving changes.');
    }
  };

  // If user closes without saving, discard local changes
  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn transition-all duration-300">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 animate-slideUp transform-gpu will-change-transform">
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
                  className="px-2 py-1 bg-[#c1902f] text-white text-sm rounded hover:bg-[#d4a43f]"
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
                  <button
                    onClick={() => handleLocalCreateOption(group.id)}
                    className="flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 text-sm rounded"
                  >
                    + Add Option
                  </button>

                  {group.options.length === 0 && (
                    <p className="text-sm text-gray-400 mt-2">No options yet.</p>
                  )}

                  {group.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="flex items-center justify-between mt-2"
                    >
                      {/* Option name */}
                      <input
                        type="text"
                        value={opt.name}
                        onChange={(e) =>
                          handleLocalUpdateOption(group.id, opt.id, {
                            name: e.target.value,
                          })
                        }
                        className="border-b text-sm flex-1 mr-2 focus:outline-none"
                      />
                      {/* Additional price */}
                      <span className="mr-2 text-sm text-gray-600">
                        $
                        <input
                          type="number"
                          step="0.01"
                          value={opt.additional_price}
                          onChange={(e) =>
                            handleLocalUpdateOption(group.id, opt.id, {
                              additional_price: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-16 ml-1 border-b focus:outline-none text-sm"
                        />
                      </span>
                      {/* Pre-selected checkbox */}
                      <label className="flex items-center space-x-1 text-xs mr-2">
                        <input
                          type="checkbox"
                          checked={opt.is_preselected || false}
                          onChange={(e) =>
                            handleLocalUpdateOption(group.id, opt.id, {
                              is_preselected: e.target.checked,
                            })
                          }
                        />
                        <span>Pre-selected</span>
                      </label>
                      {/* Delete option */}
                      <button
                        onClick={() => handleLocalDeleteOption(group.id, opt.id)}
                        className="p-1 text-gray-600 hover:text-red-600"
                        title="Delete Option"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
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
            className="px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#d4a43f] transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save className="h-5 w-5 mr-2 inline" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default OptionGroupsModal;
