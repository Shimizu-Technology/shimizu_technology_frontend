// src/ordering/components/VipCodeInput.tsx

import React, { useState } from 'react';
import { useRestaurantStore } from '../../shared/store/restaurantStore';
import { validateVipCode } from '../../shared/api/endpoints/vipAccess';
import toastUtils from '../../shared/utils/toastUtils';

interface VipCodeInputProps {
  onChange: (code: string, valid: boolean) => void;
}

export const VipCodeInput: React.FC<VipCodeInputProps> = ({ onChange }) => {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const restaurant = useRestaurantStore((state) => state.restaurant);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    setIsValid(false);
    onChange(newCode, false);
  };
  
  const validateCode = async () => {
    if (!restaurant || !code.trim()) return;
    
    setIsValidating(true);
    setErrorMessage('');
    
    try {
      const response = await validateVipCode(restaurant.id, code);
      
      if (response.valid) {
        setIsValid(true);
        onChange(code, true);
        toastUtils.success('VIP code validated successfully!');
      } else {
        setIsValid(false);
        setErrorMessage(response.message || 'Invalid VIP code');
        onChange(code, false);
        toastUtils.error(response.message || 'Invalid VIP code');
      }
    } catch (error) {
      setIsValid(false);
      setErrorMessage('Failed to validate VIP code');
      onChange(code, false);
      toastUtils.error('Failed to validate VIP code');
    } finally {
      setIsValidating(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6 transition-all duration-300 animate-fadeIn">
      <h2 className="text-xl font-semibold mb-4">VIP Access Required</h2>
      <p className="text-gray-600 mb-4">
        This restaurant is currently accepting orders from VIP guests only.
        Please enter your VIP code to continue.
      </p>
      
      <div className="flex flex-col space-y-4">
        <div>
          <input
            type="text"
            value={code}
            onChange={handleChange}
            placeholder="Enter VIP code"
            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 ${
              isValid 
                ? 'border-green-300 focus:ring-green-500' 
                : errorMessage 
                  ? 'border-red-300 focus:ring-red-500' 
                  : 'border-gray-300 focus:ring-[#c1902f]'
            }`}
          />
          {errorMessage && (
            <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
          )}
          {isValid && (
            <p className="mt-1 text-sm text-green-600">VIP code validated!</p>
          )}
        </div>
        
        <button
          onClick={validateCode}
          disabled={isValidating || !code.trim()}
          className={`px-4 py-2 bg-[#c1902f] text-white rounded-md hover:bg-[#a67927] focus:outline-none focus:ring-2 focus:ring-[#c1902f] focus:ring-opacity-50 ${
            (isValidating || !code.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isValidating ? 'Validating...' : 'Validate Code'}
        </button>
      </div>
    </div>
  );
};
