// src/shared/utils/formatters.ts

/**
 * Formats a phone number string into a more readable format
 * Input: "+16719893444"
 * Output: "+1 (671) 989-3444"
 */
export function formatPhoneNumber(phoneNumber: string | null | undefined): string {
  if (!phoneNumber) return '';
  
  // Remove any non-digit characters except the leading +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Check if it's a valid phone number format
  if (cleaned.startsWith('+')) {
    // For numbers with country code (e.g., +16719893444)
    const countryCode = cleaned.substring(0, 2); // +1
    const areaCode = cleaned.substring(2, 5);    // 671
    const firstPart = cleaned.substring(5, 8);   // 989
    const secondPart = cleaned.substring(8);     // 3444
    
    return `${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
  } else if (cleaned.length === 10) {
    // For 10-digit US numbers without country code
    const areaCode = cleaned.substring(0, 3);
    const firstPart = cleaned.substring(3, 6);
    const secondPart = cleaned.substring(6);
    
    return `(${areaCode}) ${firstPart}-${secondPart}`;
  }
  
  // If it doesn't match expected formats, return as is
  return phoneNumber;
}
