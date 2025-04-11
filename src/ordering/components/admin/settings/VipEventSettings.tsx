// src/ordering/components/admin/settings/VipEventSettings.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRestaurantStore } from '../../../../shared/store/restaurantStore';
import { 
  getSpecialEvents, 
  getVipCodes, 
  generateVipCodes 
} from '../../../../shared/api/endpoints/specialEvents';
import { getCodeUsage } from '../../../../shared/api/endpoints/vipCodes';
import { LoadingSpinner, SettingsHeader } from '../../../../shared/components/ui';
import { Calendar, Mail } from 'lucide-react';
import { VipCodeEmailModal } from './VipCodeEmailModal';
import toastUtils from '../../../../shared/utils/toastUtils';

interface SpecialEvent {
  id: number;
  description: string;
  event_date: string;
  vip_only_checkout?: boolean;
  code_prefix?: string;
}

interface VipAccessCode {
  id: number;
  code: string;
  name: string;
  max_uses?: number;
  current_uses: number;
  expires_at?: string;
  is_active: boolean;
  group_id?: string;
}

interface Recipient {
  email: string;
  sent_at: string;
}

interface CodeUsageData {
  recipients: Recipient[];
}

export const VipEventSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SpecialEvent | null>(null);
  const [vipCodes, setVipCodes] = useState<VipAccessCode[]>([]);
  const [codeGenParams, setCodeGenParams] = useState({
    batch: true,
    count: 10,
    name: '',
    maxUses: '',
  });
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [codeRecipients, setCodeRecipients] = useState<{[key: number]: Recipient[]}>({});
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const { restaurant, setCurrentEvent } = useRestaurantStore();
  
  // Function to fetch recipients for a code
  const fetchCodeRecipients = useCallback(async (codeId: number) => {
    try {
      const data = await getCodeUsage(codeId);
      return (data as CodeUsageData).recipients || [];
    } catch (error) {
      console.error(`Error fetching recipients for code ${codeId}:`, error);
      throw error;
    }
  }, []);
  
  // No need for debouncing since we're preloading all data
  useEffect(() => {
    setDebouncedSearchTerm(searchTerm);
  }, [searchTerm]);

  // Fetch special events and VIP codes
  useEffect(() => {
    if (!restaurant?.id) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const events = await getSpecialEvents(restaurant.id);
        setSpecialEvents(events);
        
        if (restaurant.current_event_id) {
          const currentEvent = events.find(e => e.id === restaurant.current_event_id);
          if (currentEvent) {
            setSelectedEvent(currentEvent);
            const codes = await getVipCodes(currentEvent.id);
            setVipCodes(codes);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toastUtils.error('Failed to load events');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [restaurant?.id, restaurant?.current_event_id]);

  // Preload recipient data when event changes or codes are loaded
  useEffect(() => {
    if (!selectedEvent || vipCodes.length === 0) {
      setCodeRecipients({});
      setSearchTerm('');
      setDebouncedSearchTerm('');
      setSearchError(null);
      return;
    }
    
    // Preload recipient data for all codes
    const preloadRecipients = async () => {
      setLoadingRecipients(true);
      setSearchError(null);
      
      try {
        // Create batches of 10 codes to reduce API load but load more data at once
        const batchSize = 10;
        const batches = [];
        for (let i = 0; i < vipCodes.length; i += batchSize) {
          batches.push(vipCodes.slice(i, i + batchSize));
        }
        
        const recipientsMap: {[key: number]: Recipient[]} = {...codeRecipients};
        
        // Process all batches in parallel for maximum speed
        await Promise.all(
          batches.map(async (batch) => {
            await Promise.all(
              batch.map(async (code) => {
                if (!recipientsMap[code.id]) {
                  try {
                    const recipients = await fetchCodeRecipients(code.id);
                    recipientsMap[code.id] = recipients;
                  } catch (error) {
                    console.error(`Error fetching recipients for code ${code.id}:`, error);
                    // Continue with other codes even if one fails
                  }
                }
              })
            );
          })
        );
        
        setCodeRecipients(recipientsMap);
      } catch (error) {
        console.error('Error preloading recipients:', error);
        setSearchError('Failed to preload some recipient data. Search results may be incomplete.');
      } finally {
        setLoadingRecipients(false);
      }
    };
    
    preloadRecipients();
  }, [selectedEvent, vipCodes, fetchCodeRecipients]);
  
  // No need for the email search effect since we're preloading all recipient data
  
  // Create a lookup map for email searches to make filtering faster
  const emailLookupMap = useMemo(() => {
    const map = new Map<string, Set<number>>();
    
    // For each code, add its ID to the set for each email
    Object.entries(codeRecipients).forEach(([codeId, recipients]) => {
      recipients.forEach(recipient => {
        const email = recipient.email.toLowerCase();
        // Add entries for the full email and each part of it
        for (let i = 1; i <= email.length; i++) {
          const substring = email.substring(0, i);
          if (!map.has(substring)) {
            map.set(substring, new Set());
          }
          map.get(substring)?.add(parseInt(codeId));
        }
      });
    });
    
    return map;
  }, [codeRecipients]);
  
  // Filter VIP codes based on search term - optimized for speed
  const filteredVipCodes = useMemo(() => {
    if (!searchTerm) return vipCodes;
    
    const term = searchTerm.toLowerCase();
    
    // Fast path for email searches using the lookup map
    if (term.includes('@')) {
      const matchingCodeIds = emailLookupMap.get(term) || new Set<number>();
      return vipCodes.filter(code => matchingCodeIds.has(code.id));
    }
    
    // Standard search for code and name
    return vipCodes.filter(code => {
      return code.code.toLowerCase().includes(term) || 
             code.name.toLowerCase().includes(term);
    });
  }, [vipCodes, searchTerm, emailLookupMap]);
  
  const handleEventChange = async (eventId: string) => {
    const id = parseInt(eventId);
    const event = specialEvents.find(e => e.id === id);
    setSelectedEvent(event || null);
    
    if (id) {
      try {
        setLoading(true);
        await setCurrentEvent(id);
        const codes = await getVipCodes(id);
        setVipCodes(codes);
        toastUtils.success('Event set as current event');
      } catch (error) {
        console.error('Error setting current event:', error);
        toastUtils.error('Failed to set current event');
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setLoading(true);
        await setCurrentEvent(null);
        setVipCodes([]);
        toastUtils.success('Current event cleared');
      } catch (error) {
        console.error('Error clearing current event:', error);
        toastUtils.error('Failed to clear current event');
      } finally {
        setLoading(false);
      }
    }
  };
  
  // Function to refresh VIP codes and their recipient data
  const refreshVipCodes = useCallback(async (withDelay = false) => {
    if (!selectedEvent) return;
    
    // Add a longer delay to ensure server has processed changes
    let loadingToast;
    if (withDelay) {
      loadingToast = toastUtils.loading('Waiting for server to process changes...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
    }
    
    try {
      setLoading(true);
      
      // Dismiss previous toast if it exists
      if (loadingToast) loadingToast.dismiss();
      
      const refreshToast = toastUtils.loading('Refreshing VIP codes...');
      
      console.log('Refreshing VIP codes for event:', selectedEvent.id);
      
      // Implement polling to ensure we get the latest data
      let attempts = 0;
      let updatedCodes: VipAccessCode[] = [];
      
      while (attempts < 3) { // Try up to 3 times
        attempts++;
        console.log(`Attempt ${attempts} to fetch updated codes`);
        
        try {
          // Refresh VIP codes list
          const fetchedCodes = await getVipCodes(selectedEvent.id);
          console.log('Fetched updated codes:', fetchedCodes.length);
          
          // If we got codes, save them and break out of the loop
          if (fetchedCodes.length > 0) {
            updatedCodes = fetchedCodes;
            break;
          }
        } catch (error) {
          console.error('Error fetching codes on attempt', attempts, error);
        }
        
        // Wait a bit before trying again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Update the state with the new codes
      setVipCodes(updatedCodes);
      
      // Clear recipient data to force a refresh
      setCodeRecipients({});
      
      // Preload recipient data for the updated codes
      const recipientsMap: {[key: number]: Recipient[]} = {};
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < updatedCodes.length; i += batchSize) {
        batches.push(updatedCodes.slice(i, i + batchSize));
      }
      
      console.log('Processing batches:', batches.length);
      
      // Process all batches in parallel
      await Promise.all(
        batches.map(async (batch) => {
          await Promise.all(
            batch.map(async (code) => {
              try {
                const recipients = await fetchCodeRecipients(code.id);
                recipientsMap[code.id] = recipients;
              } catch (error) {
                console.error(`Error fetching recipients for code ${code.id}:`, error);
              }
            })
          );
        })
      );
      
      console.log('Recipient data loaded for', Object.keys(recipientsMap).length, 'codes');
      setCodeRecipients(recipientsMap);
      
      refreshToast.success('VIP codes refreshed successfully');
    } catch (error) {
      console.error('Error refreshing VIP codes:', error);
      toastUtils.error('Failed to refresh VIP codes');
    } finally {
      setLoading(false);
    }
  }, [selectedEvent, fetchCodeRecipients]);
  
  const handleGenerateCodes = async () => {
    if (!selectedEvent) return;
    
    try {
      setLoading(true);
      const params = {
        batch: codeGenParams.batch,
        count: parseInt(codeGenParams.count.toString()),
        name: codeGenParams.name,
        max_uses: codeGenParams.maxUses ? parseInt(codeGenParams.maxUses) : undefined,
      };
      
      await generateVipCodes(selectedEvent.id, params);
      toastUtils.success(`Generated ${codeGenParams.batch ? params.count : 1} VIP code(s)`);
      
      // Refresh VIP codes and their recipient data with a delay
      await refreshVipCodes(true);
      
    } catch (error) {
      console.error('Error generating VIP codes:', error);
      toastUtils.error('Failed to generate VIP codes');
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };
  
  if (loading && !specialEvents.length) {
    return (
      <div className="space-y-8 animate-fadeIn">
        <div className="flex justify-between items-center">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 w-64 bg-gray-200 rounded"></div>
          </div>
        </div>
        
        {/* Event selection skeleton */}
        <div className="bg-white p-6 rounded-lg shadow transition-all duration-300 animate-fadeIn">
          <div className="h-5 w-40 bg-gray-200 rounded mb-4 animate-pulse"></div>
          <div className="h-10 w-full bg-gray-200 rounded animate-pulse"></div>
        </div>
        
        {/* VIP code generation skeleton */}
        <div className="bg-white p-6 rounded-lg shadow transition-all duration-300 animate-fadeIn">
          <div className="h-5 w-48 bg-gray-200 rounded mb-4 animate-pulse"></div>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
              <div className="flex space-x-4">
                <div className="h-6 w-40 bg-gray-200 rounded"></div>
                <div className="h-6 w-40 bg-gray-200 rounded"></div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 animate-pulse">
              <div>
                <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                <div className="h-10 w-full bg-gray-200 rounded"></div>
              </div>
              <div>
                <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                <div className="h-10 w-full bg-gray-200 rounded"></div>
              </div>
            </div>
            
            <div className="h-10 w-40 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        
        {/* VIP codes list skeleton */}
        <div className="bg-white p-6 rounded-lg shadow transition-all duration-300 animate-fadeIn">
          <div className="h-5 w-24 bg-gray-200 rounded mb-4 animate-pulse"></div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left">
                    <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex justify-between items-center">
        <SettingsHeader 
          title="VIP Event Settings"
          description="Configure special events and VIP access codes."
          icon={<Calendar className="h-6 w-6" />}
        />
      </div>
      
      {/* Event selection */}
      <div className="bg-white p-6 rounded-lg shadow transition-all duration-300 animate-fadeIn">
        <h3 className="font-semibold mb-4">Select Special Event</h3>
        <select
          value={selectedEvent?.id || ''}
          onChange={(e) => handleEventChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-200"
        >
          <option value="">-- Select an event --</option>
          {specialEvents.map(event => (
            <option key={event.id} value={event.id}>
              {event.description} ({formatDate(event.event_date)})
            </option>
          ))}
        </select>
      </div>
      
      {/* VIP code generation - only show if an event is selected */}
      {selectedEvent && (
        <div className="bg-white p-6 rounded-lg shadow transition-all duration-300 animate-fadeIn">
          <h3 className="font-semibold mb-4">Generate VIP Codes</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Generation Type
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-amber-600"
                    checked={codeGenParams.batch}
                    onChange={() => setCodeGenParams({...codeGenParams, batch: true})}
                  />
                  <span className="ml-2">Batch (Multiple Codes)</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-amber-600"
                    checked={!codeGenParams.batch}
                    onChange={() => setCodeGenParams({...codeGenParams, batch: false})}
                  />
                  <span className="ml-2">Single Group Code</span>
                </label>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              {codeGenParams.batch && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Codes
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={codeGenParams.count}
                    onChange={(e) => setCodeGenParams({...codeGenParams, count: parseInt(e.target.value) || 1})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code Name/Label
                </label>
                <input
                  type="text"
                  value={codeGenParams.name}
                  onChange={(e) => setCodeGenParams({...codeGenParams, name: e.target.value})}
                  placeholder={codeGenParams.batch ? "Individual VIP" : "Group VIP"}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              
              {!codeGenParams.batch && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Uses (blank for unlimited)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={codeGenParams.maxUses}
                    onChange={(e) => setCodeGenParams({...codeGenParams, maxUses: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
            
            <button
              onClick={handleGenerateCodes}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </span>
              ) : 'Generate VIP Codes'}
            </button>
          </div>
        </div>
      )}
      
      {/* VIP codes list - only show if codes exist */}
      {selectedEvent && vipCodes.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow transition-all duration-300 animate-fadeIn">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">VIP Codes</h3>
              <button
                onClick={() => refreshVipCodes(true)}
                disabled={loading}
                className="p-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                title="Refresh VIP Codes"
              >
                <svg className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="flex flex-col w-full md:w-64">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by name, code, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 pl-10 ${
                      searchError ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  {loadingRecipients && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-amber-500">
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>
                {searchError && (
                  <p className="text-xs text-red-500 mt-1">{searchError}</p>
                )}
                {loadingRecipients && (
                  <p className="text-xs text-gray-500 mt-1">
                    Loading recipient data for {vipCodes.length} codes...
                  </p>
                )}
                {!loadingRecipients && Object.keys(codeRecipients).length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Recipient data loaded for {Object.keys(codeRecipients).length} codes
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowEmailModal(true)}
                className="flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200"
              >
                <Mail size={16} className="mr-2" />
                Send VIP Codes via Email
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uses</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVipCodes.length > 0 ? (
                  filteredVipCodes.map((code: VipAccessCode) => (
                  <tr key={code.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{code.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{code.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.current_uses} / {code.max_uses || '∞'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full transition-colors duration-300 ${
                        code.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {code.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      {searchTerm ? 'No matching VIP codes found' : 'No VIP codes found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* VIP Code Email Modal */}
      {showEmailModal && (
        <VipCodeEmailModal
          onClose={() => setShowEmailModal(false)}
          onCodesUpdated={() => refreshVipCodes(true)}
        />
      )}
    </div>
  );
};
