import React, { useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '../../../shared/components/ui';

interface PayPalCardFieldsProps {
  onCardFieldsReady?: (isValid: boolean) => void;
  onError?: (error: Error) => void;
}

export function PayPalCardFields({ onCardFieldsReady, onError }: PayPalCardFieldsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [cardType, setCardType] = useState<string | null>(null);
  
  // Refs for the card field containers
  const cardNumberRef = useRef<HTMLDivElement>(null);
  const cardExpiryRef = useRef<HTMLDivElement>(null);
  const cardCvvRef = useRef<HTMLDivElement>(null);
  
  // Refs for the PayPal hosted fields instances
  const cardNumberField = useRef<any>(null);
  const cardExpiryField = useRef<any>(null);
  const cardCvvField = useRef<any>(null);

  useEffect(() => {
    // Wait for PayPal SDK to be loaded
    if (!window.paypal) {
      return;
    }

    try {
      // Check if the PayPal SDK has the card fields component
      if (!window.paypal.CardNumberField || !window.paypal.CardExpiryField || !window.paypal.CardCvvField) {
        throw new Error('PayPal card fields are not available. Make sure to include "card-fields" in the components parameter when loading the PayPal SDK.');
      }
      
      // Initialize card number field
      if (cardNumberRef.current && !cardNumberField.current) {
        cardNumberField.current = window.paypal.CardNumberField();
        cardNumberField.current.render(cardNumberRef.current);
        
        // Listen for validity changes
        cardNumberField.current.on('validityChange', (event: any) => {
          updateValidity();
        });
        
        // Listen for card type changes
        cardNumberField.current.on('cardTypeChange', (event: any) => {
          setCardType(event.cards.length === 1 ? event.cards[0].type : null);
        });
      }
      
      // Initialize card expiry field
      if (cardExpiryRef.current && !cardExpiryField.current) {
        cardExpiryField.current = window.paypal.CardExpiryField();
        cardExpiryField.current.render(cardExpiryRef.current);
        
        // Listen for validity changes
        cardExpiryField.current.on('validityChange', (event: any) => {
          updateValidity();
        });
      }
      
      // Initialize card CVV field
      if (cardCvvRef.current && !cardCvvField.current) {
        cardCvvField.current = window.paypal.CardCvvField();
        cardCvvField.current.render(cardCvvRef.current);
        
        // Listen for validity changes
        cardCvvField.current.on('validityChange', (event: any) => {
          updateValidity();
        });
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing PayPal card fields:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
      setIsLoading(false);
    }
    
    // Cleanup function
    return () => {
      // No explicit cleanup needed as PayPal handles this internally
    };
  }, [onError]);
  
  // Function to check if all fields are valid
  const updateValidity = () => {
    // Check if all fields are valid
    const numberValid = cardNumberField.current?.isValid || false;
    const expiryValid = cardExpiryField.current?.isValid || false;
    const cvvValid = cardCvvField.current?.isValid || false;
    
    const newIsValid = numberValid && expiryValid && cvvValid;
    setIsValid(newIsValid);
    
    if (onCardFieldsReady) {
      onCardFieldsReady(newIsValid);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-4">
        <LoadingSpinner className="w-6 h-6" />
        <span className="ml-2 text-sm text-gray-600">Loading card fields...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card Number Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Card Number
          {cardType && <span className="ml-2 text-sm text-gray-500">({cardType})</span>}
        </label>
        <div 
          ref={cardNumberRef}
          className="h-10 border border-gray-300 rounded-md bg-white"
        />
      </div>
      
      {/* Two columns for expiry and CVV */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiration Date
          </label>
          <div 
            ref={cardExpiryRef}
            className="h-10 border border-gray-300 rounded-md bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CVV
          </label>
          <div 
            ref={cardCvvRef}
            className="h-10 border border-gray-300 rounded-md bg-white"
          />
        </div>
      </div>
      
      {/* Validation status */}
      <div className={`text-sm ${isValid ? 'text-green-600' : 'text-gray-500'}`}>
        {isValid ? 'Card information is valid' : 'Please enter your card details'}
      </div>
    </div>
  );
}
