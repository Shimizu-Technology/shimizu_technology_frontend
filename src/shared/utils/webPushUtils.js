/**
 * Web Push Utilities
 * 
 * This file contains utilities for working with Web Push notifications.
 * It's based on the web-push library's implementation.
 */

/**
 * Converts a base64 string to a Uint8Array
 * This is a direct port of the web-push library's implementation
 * 
 * @param {string} base64String A base64 URL encoded string
 * @returns {Uint8Array} A Uint8Array representation of the base64 string
 */
export function urlBase64ToUint8Array(base64String) {
  console.log('Original VAPID key:', base64String);
  
  // Handle the special case where the key starts with a dash
  // This can cause issues with some browsers
  if (base64String.startsWith('-')) {
    console.log('VAPID key starts with a dash, removing it');
    base64String = base64String.substring(1);
  }

  try {
    // Add the uncompressed point format indicator byte (0x04)
    // This is required for the applicationServerKey to be valid
    // The server generates keys without this byte, so we need to add it
    if (base64String.length === 86 && !base64String.startsWith('B')) {
      console.log('Adding uncompressed point format indicator');
      
      // First, decode the base64 string to get the raw bytes
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      const rawData = atob(base64);
      
      // Create a new Uint8Array with space for the indicator byte
      const outputArray = new Uint8Array(rawData.length + 1);
      
      // Set the first byte to 0x04 (uncompressed point format)
      outputArray[0] = 4;
      
      // Copy the rest of the bytes
      for (let i = 0; i < rawData.length; i++) {
        outputArray[i + 1] = rawData.charCodeAt(i);
      }
      
      console.log('Added uncompressed point format indicator');
      console.log('Output array length:', outputArray.length);
      console.log('First few bytes:', Array.from(outputArray.slice(0, 5)));
      
      return outputArray;
    }
    
    // Standard processing for keys that already have the correct format
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    console.log('Processed base64 string:', base64);

    const rawData = atob(base64);
    console.log('Raw data length:', rawData.length);
    
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    console.log('Output array length:', outputArray.length);
    console.log('First few bytes:', Array.from(outputArray.slice(0, 5)));

    return outputArray;
  } catch (error) {
    console.error('Error in urlBase64ToUint8Array:', error);
    throw error;
  }
}
