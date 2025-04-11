// src/shared/components/navigation/Header.tsx
import { useState, useRef, useEffect } from 'react';
import {
  ShoppingCart,
  Menu as MenuIcon,
  X,
  Clock,
  MapPin,
  Phone,
  User,
  ChevronDown,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth';
import { useAuthStore } from '../../auth';
import toastUtils from '../../utils/toastUtils';
import { useRestaurantStore } from '../../store/restaurantStore';
import { formatPhoneNumber } from '../../utils/formatters';

// Create a custom hook to safely use the order store
function useCartItems() {
  // Default empty state
  const [cartItems, setCartItems] = useState<any[]>([]);
  
  // Effect to load the order store if available
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    
    const loadOrderStore = async () => {
      try {
        // Dynamic import
        const orderingModule = await import('../../../ordering/store/orderStore');
        
        if (!mounted) return;
        
        if (orderingModule && orderingModule.useOrderStore) {
          // Get initial cart items
          const store = orderingModule.useOrderStore.getState();
          if (store && Array.isArray(store.cartItems)) {
            setCartItems(store.cartItems);
          }
          
          // Subscribe to changes
          unsubscribe = orderingModule.useOrderStore.subscribe(
            (state: any) => {
              if (mounted && Array.isArray(state.cartItems)) {
                setCartItems(state.cartItems);
              }
            }
          );
        }
      } catch (e) {
        console.log('Order store not available, using empty cart');
      }
    };
    
    // Execute the async function
    loadOrderStore();
    
    // Cleanup function
    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);
  
  return cartItems;
}

export function Header() {
  const { user, logout: signOut } = useAuth();
  const authStore = useAuthStore();
  const { restaurant } = useRestaurantStore();
  
  // Check if user has admin access
  const hasAdminAccess = user && (authStore.isSuperAdmin() || authStore.isAdmin() || authStore.isStaff());
  const location = useLocation();

  // Cart items - will only have items in the ordering app context
  const cartItems = useCartItems();
  const cartCount = cartItems.reduce((acc: number, item: any) => acc + item.quantity, 0);

  // Animate cart icon
  const [cartBounce, setCartBounce] = useState(false);
  const prevCartCountRef = useRef(cartCount);

  useEffect(() => {
    if (cartCount > prevCartCountRef.current) {
      setCartBounce(true);
      const timer = setTimeout(() => setCartBounce(false), 300);
      return () => clearTimeout(timer);
    }
    prevCartCountRef.current = cartCount;
  }, [cartCount]);

  // Mobile menu toggle
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Profile/Admin dropdown (desktop)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close mobile menu when location changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  // Handle clicks outside of dropdown and mobile menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Close dropdown if clicked outside
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      
      // Close mobile menu if clicked outside (but not if clicking the toggle button)
      if (
        isMobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('[data-mobile-toggle]')
      ) {
        setIsMobileMenuOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Role checks
  const isStaffOnly = user && authStore.isStaff() && !authStore.isAdmin() && !authStore.isSuperAdmin();
  const isAdminOrAbove = user && (authStore.isAdmin() || authStore.isSuperAdmin());

  // Display name
  const firstName = user?.first_name || user?.email?.split('@')[0] || 'Guest';

  // Active link style
  const activeLinkClass = "text-[#0078d4] font-medium";
  const isActiveLink = (path: string) => location.pathname === path ? activeLinkClass : "";

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Mobile menu button */}
          <button
            data-mobile-toggle="true"
            className="p-2 rounded-md text-gray-700 hover:text-[#0078d4] hover:bg-gray-100 
                     transition-colors duration-200 lg:hidden focus:outline-none focus:ring-2 
                     focus:ring-[#c1902f] focus:ring-opacity-50"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <MenuIcon className="h-6 w-6" />
            )}
          </button>

          {/* Logo => link to "/" */}
          <Link
            to="/"
            className="flex items-center text-2xl font-bold text-gray-900
                     hover:text-[#0078d4] transition-colors duration-200"
            aria-label="Shimizu Technology Home"
          >
            <span>Shimizu Tech</span>
          </Link>

          {/* Desktop Nav (hidden on mobile) */}
          <nav className="hidden lg:flex items-center space-x-2 xl:space-x-6">
            <Link
              to="/menu"
              className={`px-3 py-2 rounded-md text-gray-700 hover:text-[#0078d4] hover:bg-gray-50
                        transition-colors duration-200 ${isActiveLink('/menu')}`}
            >
              Menu
            </Link>
            {/* Merchandise link temporarily hidden
            <Link
              to="/merchandise"
              className={`px-3 py-2 rounded-md text-gray-700 hover:text-[#0078d4] hover:bg-gray-50
                        transition-colors duration-200 ${isActiveLink('/merchandise')}`}
            >
              Merchandise
            </Link>
            */}
            {/* Reservations link temporarily hidden
            <Link
              to="/reservations"
              className={`px-3 py-2 rounded-md text-gray-700 hover:text-[#0078d4] hover:bg-gray-50
                        transition-colors duration-200 ${isActiveLink('/reservations')}`}
            >
              Reservations
            </Link>
            */}
            
            {/* Info section with subtle divider */}
            <div className="flex items-center space-x-2 sm:space-x-3 xl:space-x-4 pl-2 border-l border-gray-200">
              <div className="hidden xl:flex items-center text-gray-600 group">
                <Clock className="h-4 w-4 mr-1.5 text-[#0078d4] group-hover:scale-110 transition-transform duration-200" />
                <span className="text-sm">11AM-9PM</span>
              </div>
              
              <div className="hidden lg:flex xl:flex items-center text-gray-600 group">
                <MapPin className="h-4 w-4 mr-1.5 text-[#0078d4] group-hover:scale-110 transition-transform duration-200" />
                <span className="text-sm truncate max-w-[100px] xl:max-w-none">{restaurant?.address ? restaurant.address.split(',')[0] : 'Tamuning'}</span>
              </div>
              
              {restaurant?.phone_number ? (
                <a
                  href={`tel:${restaurant.phone_number}`}
                  className="flex items-center text-gray-600 hover:text-[#0078d4] 
                           transition-colors duration-200 group"
                >
                  <Phone className="h-4 w-4 mr-1 xl:mr-1.5 text-[#0078d4] group-hover:scale-110 transition-transform duration-200" />
                  <span className="hidden sm:inline text-sm">{formatPhoneNumber(restaurant.phone_number)}</span>
                </a>
              ) : (
                <a
                  href="tel:+16719893444"
                  className="flex items-center text-gray-600 hover:text-[#0078d4] 
                           transition-colors duration-200 group"
                >
                  <Phone className="h-4 w-4 mr-1 xl:mr-1.5 text-[#0078d4] group-hover:scale-110 transition-transform duration-200" />
                  <span className="hidden sm:inline text-sm">(671) 989-3444</span>
                </a>
              )}
            </div>
          </nav>

          {/* Right side: Profile & Cart */}
          <div className="flex items-center space-x-1 sm:space-x-4">
            {/* If user is logged in => dropdown */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  className="flex items-center text-gray-700 hover:text-[#0078d4] px-2 py-1.5 rounded-md 
                           hover:bg-gray-50 transition-colors duration-200 focus:outline-none 
                           focus:ring-2 focus:ring-[#0078d4] focus:ring-opacity-50"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="true"
                >
                  <User className="h-5 w-5 text-[#0078d4]" />
                  <span className="ml-1.5 hidden sm:inline text-sm font-medium">{firstName}</span>
                  <ChevronDown className={`h-4 w-4 ml-1 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 
                                border border-gray-100 animate-fadeIn">
                    {/* Admin Tools if user has admin access */}
                    {hasAdminAccess && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50">
                          {isStaffOnly ? 'Staff Tools' : 'Admin Tools'}
                        </div>
                        
                        {/* Reservations Dashboard - only visible to admin and super_admin */}
                        {isAdminOrAbove && (
                          <Link
                            to="/reservations/dashboard"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0078d4]
                                     transition-colors duration-150"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            Manage Reservations
                          </Link>
                        )}
                        
                        {/* Admin Dashboard - visible to all admin roles */}
                        <Link
                          to="/admin"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0078d4]
                                   transition-colors duration-150"
                          onClick={() => setIsDropdownOpen(false)}
                        >
                          {isStaffOnly ? 'Order Management' : 'Admin Dashboard'}
                        </Link>
                        

                        
                        <hr className="my-1 border-gray-100" />
                      </>
                    )}

                    {/* Normal user links */}
                    <Link
                      to="/orders"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0078d4]
                               transition-colors duration-150"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      Order History
                    </Link>
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#0078d4]
                               transition-colors duration-150"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      My Profile
                    </Link>
                    <hr className="my-1 border-gray-100" />

                    <button
                      onClick={() => {
                        signOut();
                        toastUtils.success('Signed out successfully!');
                        setIsDropdownOpen(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 
                               hover:bg-gray-50 hover:text-[#0078d4] transition-colors duration-150"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // If not logged in => show Sign In/Up (desktop only)
              <div className="hidden sm:flex items-center space-x-2">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-[#0078d4] px-3 py-1.5 rounded-md 
                           hover:bg-gray-50 transition-colors duration-200 text-sm font-medium"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-[#c1902f] text-white px-3 py-1.5 rounded-md hover:bg-[#d4a43f] 
                           transition-colors duration-200 text-sm font-medium"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Cart icon */}
            <Link
              to="/cart"
              className="p-2 relative text-gray-700 hover:text-[#0078d4] hover:bg-gray-50 
                       transition-colors duration-200 rounded-md focus:outline-none 
                       focus:ring-2 focus:ring-[#0078d4] focus:ring-opacity-50"
              aria-label={`Shopping cart with ${cartCount} items`}
            >
              <ShoppingCart
                className={`h-5 w-5 ${cartBounce ? 'animate-bounce' : ''}`}
              />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 
                           bg-[#c1902f] text-white text-xs font-bold
                           rounded-full h-5 w-5 flex items-center justify-center
                           shadow-sm animate-fadeIn"
                >
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Menu - Slide-in drawer */}
      <div 
        ref={mobileMenuRef}
        className={`fixed inset-y-0 left-0 transform ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } w-full max-w-xs bg-white shadow-xl z-50 overflow-y-auto transition-transform duration-300 ease-in-out lg:hidden`}
      >
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <Link 
            to="/" 
            className="text-xl font-bold text-[#0078d4]"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            håfaloha!
          </Link>
          <button
            className="p-2 rounded-md text-gray-700 hover:text-[#0078d4] hover:bg-gray-100 
                     transition-colors duration-200 focus:outline-none"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Navigation Links */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Navigation</h3>
            <Link
              to="/menu"
              className={`block px-3 py-2 rounded-md text-base font-medium text-gray-700
                         hover:text-[#0078d4] hover:bg-gray-50 transition-colors duration-150
                         ${isActiveLink('/menu')}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Menu
            </Link>
            {/* Merchandise link temporarily hidden
            <Link
              to="/merchandise"
              className={`block px-3 py-2 rounded-md text-base font-medium text-gray-700
                         hover:text-[#0078d4] hover:bg-gray-50 transition-colors duration-150
                         ${isActiveLink('/merchandise')}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Merchandise
            </Link>
            */}
            {/* Reservations link temporarily hidden
            <Link
              to="/reservations"
              className={`block px-3 py-2 rounded-md text-base font-medium text-gray-700
                         hover:text-[#0078d4] hover:bg-gray-50 transition-colors duration-150
                         ${isActiveLink('/reservations')}`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Reservations
            </Link>
            */}
          </div>
          
          {/* Restaurant Info */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Restaurant Info</h3>
            <div className="px-3 py-2 text-base text-gray-700 flex items-center">
              <Clock className="inline-block h-4 w-4 mr-3 text-[#0078d4]" />
              11AM-9PM
            </div>
            <div className="px-3 py-2 text-base text-gray-700 flex items-center">
              <MapPin className="inline-block h-4 w-4 mr-3 text-[#0078d4]" />
              {restaurant?.address ? restaurant.address.split(',')[0] : 'Tamuning'}
            </div>
            {restaurant?.phone_number ? (
              <a
                href={`tel:${restaurant.phone_number}`}
                className="px-3 py-2 text-base text-gray-700 hover:text-[#0078d4]
                         hover:bg-gray-50 transition-colors duration-150 flex items-center"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Phone className="h-4 w-4 mr-3 text-[#0078d4]" />
                {formatPhoneNumber(restaurant.phone_number)}
              </a>
            ) : (
              <a
                href="tel:+16719893444"
                className="px-3 py-2 text-base text-gray-700 hover:text-[#0078d4]
                         hover:bg-gray-50 transition-colors duration-150 flex items-center"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Phone className="h-4 w-4 mr-3 text-[#0078d4]" />
                (671) 989-3444
              </a>
            )}
          </div>

          {/* User Account */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {user ? 'Your Account' : 'Account'}
            </h3>
            
            {user ? (
              <>
                {hasAdminAccess && (
                  <>
                    {/* Reservations Dashboard - only visible to admin and super_admin */}
                    {isAdminOrAbove && (
                      <Link
                        to="/reservations/dashboard"
                        className="block px-3 py-2 rounded-md text-base font-medium text-gray-700
                                 hover:text-[#0078d4] hover:bg-gray-50 transition-colors duration-150"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        Manage Reservations
                      </Link>
                    )}
                    
                    {/* Admin Dashboard - visible to all admin roles */}
                    <Link
                      to="/admin"
                      className="block px-3 py-2 rounded-md text-base font-medium text-gray-700
                               hover:text-[#0078d4] hover:bg-gray-50 transition-colors duration-150"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {isStaffOnly ? 'Order Management' : 'Admin Dashboard'}
                    </Link>
                    

                  </>
                )}

                <Link
                  to="/orders"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700
                           hover:text-[#0078d4] hover:bg-gray-50 transition-colors duration-150"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Order History
                </Link>
                <Link
                  to="/profile"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700
                           hover:text-[#0078d4] hover:bg-gray-50 transition-colors duration-150"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  My Profile
                </Link>

                <button
                  onClick={() => {
                    signOut();
                    toastUtils.success('Signed out successfully!');
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium
                           text-gray-700 hover:text-[#0078d4] hover:bg-gray-50 transition-colors duration-150"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700
                           hover:text-[#0078d4] hover:bg-gray-50 transition-colors duration-150"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="block px-3 py-2 rounded-md bg-[#c1902f] text-white
                           hover:bg-[#d4a43f] transition-colors duration-150"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
          
          {/* Cart Link */}
          <div className="pt-2 border-t border-gray-100">
            <Link
              to="/cart"
              className="flex items-center justify-between px-3 py-2 rounded-md text-base font-medium
                       text-gray-700 hover:text-[#c1902f] hover:bg-gray-50 transition-colors duration-150"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>Shopping Cart</span>
              <div className="flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                {cartCount > 0 && (
                  <span className="bg-[#c1902f] text-white text-xs font-bold rounded-full h-5 w-5 
                                 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </div>
      
      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-25 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </header>
  );
}

// Add these animations to your global CSS or tailwind config
// @keyframes fadeIn {
//   from { opacity: 0; }
//   to { opacity: 1; }
// }
// .animate-fadeIn {
//   animation: fadeIn 0.2s ease-in-out;
// }
