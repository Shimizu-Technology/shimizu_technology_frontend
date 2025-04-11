/**
 * Utility functions for device-specific features
 */

/**
 * Trigger haptic feedback on devices that support it
 * @param duration Duration of vibration in milliseconds (default: 50ms)
 */
export const triggerHapticFeedback = (duration: number = 50) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(duration); // Short vibration
  }
};

/**
 * Check if the current device is a mobile device
 * @returns boolean indicating if the device is mobile
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

/**
 * Check if the current device is an iPad
 * @returns boolean indicating if the device is an iPad
 */
export const isIPad = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Check for iPad specifically in the user agent
  const isIpadOS = navigator.userAgent.includes('iPad');
  
  // iPadOS 13+ reports as MacOS, so we need additional checks
  const isIpadOSModern = 
    navigator.userAgent.includes('Mac') && 
    typeof navigator.maxTouchPoints === 'number' && 
    navigator.maxTouchPoints > 1;
    
  return isIpadOS || isIpadOSModern;
};
