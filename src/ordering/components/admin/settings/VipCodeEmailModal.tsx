import React, { useState, useEffect } from 'react';
import { X, Check, RefreshCw, Info } from 'lucide-react';
import toastUtils from '../../../../shared/utils/toastUtils';
import { useRestaurantStore } from '../../../../shared/store/restaurantStore';
import { 
  bulkSendVipCodes, 
  sendExistingVipCodes
} from '../../../../shared/api/endpoints/vipCodes';
import {
  getVipCodes
} from '../../../../shared/api/endpoints/specialEvents';

interface VipAccessCode {
  id: number;
  code: string;
  name: string;
  max_uses?: number | null;
  current_uses: number;
  expires_at?: string;
  is_active: boolean;
  group_id?: string;
  archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface VipCodeEmailModalProps {
  onClose: () => void;
  selectedCode?: VipAccessCode | null;
  onCodesUpdated?: () => void; // Callback to notify parent that codes were updated
}

export const VipCodeEmailModal: React.FC<VipCodeEmailModalProps> = ({ onClose, selectedCode, onCodesUpdated }) => {
  const { restaurant } = useRestaurantStore();
  const [loading, setLoading] = useState(false);
  const [fetchingCodes, setFetchingCodes] = useState(false);
  const [emails, setEmails] = useState<string>('');
  const [mode, setMode] = useState<'generate' | 'existing'>('generate');
  const [bulkOptions, setBulkOptions] = useState({
    batchSize: 50,
    name: 'VIP Customer',
    prefix: 'VIP',
    maxUses: '',
    oneCodePerBatch: true,
  });
  const [availableCodes, setAvailableCodes] = useState<VipAccessCode[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch available VIP codes when the modal opens
  useEffect(() => {
    if (restaurant?.id && restaurant?.current_event_id) {
      fetchVipCodes();
    }
    
    // If a specific code was passed in, pre-select it and set mode to 'existing'
    if (selectedCode) {
      setMode('existing');
      setSelectedCodes([selectedCode.id]);
    }
  }, [restaurant?.id, restaurant?.current_event_id, selectedCode]);
  
  // Filter codes based on search term
  const filteredCodes = availableCodes.filter(code => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      code.code.toLowerCase().includes(term) ||
      code.name.toLowerCase().includes(term)
    );
  });
  
  const fetchVipCodes = async () => {
    if (!restaurant?.current_event_id) {
      toastUtils.error('No current event selected');
      return;
    }
    
    setFetchingCodes(true);
    try {
      console.log('Fetching VIP codes for event:', restaurant.current_event_id);
      const codes = await getVipCodes(restaurant.current_event_id);
      console.log('Fetched codes:', codes.length);
      
      // Only show active codes
      setAvailableCodes(codes.filter(code => code.is_active));
    } catch (error) {
      console.error('Error fetching VIP codes:', error);
      toastUtils.error('Failed to load VIP codes');
    } finally {
      setFetchingCodes(false);
    }
  };
  
  const handleSendEmails = async () => {
    if (!restaurant?.id) {
      toastUtils.error('Restaurant information is missing');
      return;
    }
    
    if (!emails.trim()) {
      toastUtils.error('Please enter at least one email address');
      return;
    }
    
    // In existing mode, ensure at least one code is selected
    if (mode === 'existing' && selectedCodes.length === 0) {
      toastUtils.error('Please select at least one VIP code');
      return;
    }
    
    setLoading(true);
    
    try {
      const emailList = emails
        .split(/[\n,;]/) // Split by newline, comma, or semicolon
        .map(email => email.trim())
        .filter(email => email.length > 0 && email.includes('@')); // Basic validation
      
      if (emailList.length === 0) {
        toastUtils.error('No valid email addresses found');
        setLoading(false);
        return;
      }
      
      let response;
      
      if (mode === 'generate') {
        // Send bulk emails with newly generated VIP codes
        response = await bulkSendVipCodes({
          email_list: emailList,
          batch_size: parseInt(bulkOptions.batchSize.toString()),
          name: bulkOptions.name,
          prefix: bulkOptions.prefix || undefined,
          max_uses: bulkOptions.maxUses ? parseInt(bulkOptions.maxUses) : undefined,
          one_code_per_batch: bulkOptions.oneCodePerBatch,
        });
      } else {
        // Send emails with existing VIP codes
        response = await sendExistingVipCodes({
          email_list: emailList,
          code_ids: selectedCodes,
          batch_size: parseInt(bulkOptions.batchSize.toString()),
        });
      }
      
      // Type assertion for the response
      interface BulkSendResponse {
        total_recipients: number;
        batch_count: number;
        message: string;
      }
      const responseData = response as BulkSendResponse;
      // Close the modal immediately
      onClose();
      
      // Show success message
      toastUtils.success(`Queued ${responseData.total_recipients} emails in ${responseData.batch_count} batches`);
      
      // Add a delay before notifying parent component that codes were updated
      // This gives the server time to process the changes, but doesn't block the UI
      setTimeout(() => {
        console.log('Notifying parent that codes were updated');
        if (onCodesUpdated) {
          onCodesUpdated();
        }
      }, 2000); // 2 second delay
    } catch (error) {
      console.error('Error sending VIP code emails:', error);
      toastUtils.error('Failed to send VIP code emails');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleCodeSelection = (id: number) => {
    if (selectedCodes.includes(id)) {
      setSelectedCodes(selectedCodes.filter(codeId => codeId !== id));
    } else {
      setSelectedCodes([...selectedCodes, id]);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Send VIP Codes via Email</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Mode selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b pb-4">
            <span className="text-sm font-medium text-gray-700">Select Mode:</span>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-purple-600"
                  checked={mode === 'generate'}
                  onChange={() => setMode('generate')}
                />
                <span className="ml-2">Generate New Codes</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-purple-600"
                  checked={mode === 'existing'}
                  onChange={() => setMode('existing')}
                />
                <span className="ml-2">Use Existing Codes</span>
              </label>
            </div>
          </div>
          
          {/* Generate new codes options */}
          {mode === 'generate' && (
            <div className="space-y-4 border p-4 rounded-md bg-gray-50">
              <h3 className="font-medium">New VIP Code Options</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Batch Size
                    </label>
                    <div className="relative ml-2 text-gray-500 cursor-pointer group">
                      <Info size={16} />
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-2 px-3 w-64 shadow-lg z-10">
                        Batch size controls how many emails are sent in each processing group. Using smaller batches (like 50) improves reliability when sending to large groups, prevents timeouts, and makes it easier to track progress.
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={bulkOptions.batchSize}
                    onChange={(e) => setBulkOptions({...bulkOptions, batchSize: parseInt(e.target.value) || 50})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Sending in smaller batches improves delivery reliability for large email lists
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code Name/Label
                  </label>
                  <input
                    type="text"
                    value={bulkOptions.name}
                    onChange={(e) => setBulkOptions({...bulkOptions, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Code Prefix (optional)
                  </label>
                  <input
                    type="text"
                    value={bulkOptions.prefix}
                    onChange={(e) => setBulkOptions({...bulkOptions, prefix: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Uses (blank for unlimited)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bulkOptions.maxUses}
                    onChange={(e) => setBulkOptions({...bulkOptions, maxUses: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code Generation Method
                </label>
                <div className="flex flex-col space-y-2">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-purple-600"
                      checked={bulkOptions.oneCodePerBatch}
                      onChange={() => setBulkOptions({...bulkOptions, oneCodePerBatch: true})}
                    />
                    <span className="ml-2">One code for all recipients</span>
                    <div className="ml-2 text-xs text-gray-500">
                      (All recipients will receive the same VIP code)
                    </div>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio text-purple-600"
                      checked={!bulkOptions.oneCodePerBatch}
                      onChange={() => setBulkOptions({...bulkOptions, oneCodePerBatch: false})}
                    />
                    <span className="ml-2">Unique code for each recipient</span>
                    <div className="ml-2 text-xs text-gray-500">
                      (Each recipient will receive their own unique VIP code)
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
          
          {/* Existing codes selector */}
          {mode === 'existing' && (
            <div className="space-y-4 border p-4 rounded-md bg-gray-50">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Select Existing VIP Codes</h3>
                <button 
                  onClick={fetchVipCodes}
                  disabled={fetchingCodes}
                  className="text-purple-600 hover:text-purple-800 flex items-center"
                >
                  <RefreshCw size={16} className={`mr-1 ${fetchingCodes ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
              
              <div>
                <div className="flex items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Batch Size
                  </label>
                  <div className="relative ml-2 text-gray-500 cursor-pointer group">
                    <Info size={16} />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 invisible group-hover:visible bg-gray-800 text-white text-xs rounded py-2 px-3 w-64 shadow-lg z-10">
                      Batch size controls how many emails are sent in each processing group. Using smaller batches (like 50) improves reliability when sending to large groups, prevents timeouts, and makes it easier to track progress.
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={bulkOptions.batchSize}
                  onChange={(e) => setBulkOptions({...bulkOptions, batchSize: parseInt(e.target.value) || 50})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Sending in smaller batches improves delivery reliability for large email lists
                </p>
              </div>
              
              <div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search codes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 pl-10"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                {fetchingCodes ? (
                  <div className="p-4 text-center text-gray-500">
                    Loading VIP codes...
                  </div>
                ) : filteredCodes.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {searchTerm ? 'No matching VIP codes found' : 'No active VIP codes available'}
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {filteredCodes.map(code => (
                      <li 
                        key={code.id}
                        className={`p-3 hover:bg-gray-50 cursor-pointer flex items-center ${
                          selectedCodes.includes(code.id) ? 'bg-purple-50' : ''
                        }`}
                        onClick={() => toggleCodeSelection(code.id)}
                      >
                        <div className="mr-3">
                          <div className={`w-5 h-5 border rounded-md flex items-center justify-center ${
                            selectedCodes.includes(code.id) 
                              ? 'bg-purple-600 border-purple-600' 
                              : 'border-gray-300'
                          }`}>
                            {selectedCodes.includes(code.id) && (
                              <Check size={14} className="text-white" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{code.code}</div>
                          <div className="text-sm text-gray-500">{code.name}</div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {code.max_uses ? `${code.current_uses}/${code.max_uses} uses` : 'Unlimited uses'}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              <div className="text-sm text-gray-500">
                {selectedCodes.length} code{selectedCodes.length !== 1 ? 's' : ''} selected
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Addresses
            </label>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="Enter email addresses (one per line, or separated by commas)"
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter multiple email addresses separated by commas, semicolons, or new lines
            </p>
          </div>
        </div>
        
        <div className="flex justify-end p-6 border-t space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSendEmails}
            disabled={loading || !emails.trim() || (mode === 'existing' && selectedCodes.length === 0)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send VIP Codes'}
          </button>
        </div>
      </div>
    </div>
  );
};
