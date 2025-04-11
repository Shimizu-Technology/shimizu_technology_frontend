// A robust implementation for converting VAPID keys
// Based on the web-push library's implementation with additional safeguards

/**
 * Takes a base64 URL encoded string and converts it to a Uint8Array
 * This is a critical function for Web Push to work correctly
 * 
 * @param {string} base64String A base64 URL encoded string
 * @returns {Uint8Array} A Uint8Array representation of the base64 string
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  try {
    // Normalize the base64 string
    let normalizedBase64 = base64String.trim();
    
    // Add padding if needed
    const padding = '='.repeat((4 - (normalizedBase64.length % 4)) % 4);
    
    // Convert URL-safe base64 to regular base64
    const base64 = (normalizedBase64 + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Create a binary string from the base64 string
    const binaryString = window.atob(base64);
    
    // Create a Uint8Array from the binary string
    const bytes = new Uint8Array(binaryString.length);
    
    // Fill the Uint8Array with the binary data
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  } catch (error) {
    console.error('Error converting base64 to Uint8Array:', error);
    
    // Fallback approach for browsers with issues
    try {
      // Try a different approach to decode the base64 string
      const base64 = base64String.trim()
        .replace(/-/g, '+')
        .replace(/_/g, '/') + 
        '='.repeat((4 - (base64String.trim().length % 4)) % 4);
      
      // Use TextEncoder to convert the base64 string to a Uint8Array
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      return bytes;
    } catch (fallbackError) {
      console.error('Fallback approach failed:', fallbackError);
      throw new Error('Failed to convert VAPID key to Uint8Array');
    }
  }
}
