// src/RootApp.tsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, ScrollToTop, RestaurantProvider } from './shared';
import PostHogProvider from './shared/components/analytics/PostHogProvider';
import { ToastContainer } from './shared/components/ToastContainer';
import { PaymentScriptPreloader } from './shared/components/payment/PaymentScriptPreloader';

import GlobalLayout from './GlobalLayout';
import ReservationsApp from './reservations/ReservationsApp';
import OnlineOrderingApp from './ordering/OnlineOrderingApp';

export default function RootApp() {
  return (
    <AuthProvider>
      <RestaurantProvider>
        {/* Preload payment scripts based on restaurant settings */}
        <PaymentScriptPreloader />
        
        {/* Move PostHogProvider inside AuthProvider and RestaurantProvider */}
        <PostHogProvider>
          <BrowserRouter>
            <ScrollToTop />
            <ToastContainer
              position="top-right"
              reverseOrder={false}
              containerStyle={{
                maxHeight: '100vh',
                overflow: 'auto',
                paddingRight: '10px',
                scrollBehavior: 'smooth'
              }}
              containerClassName="scrollable-toast-container"
              gutter={8}
              toastOptions={{
                // Customize for different screen sizes
                className: '',
                style: {
                  maxWidth: '100%',
                  width: 'auto'
                },
                // Default duration of 5 seconds for regular toasts
                // Order notifications in AdminDashboard will override this with their own duration: Infinity
                duration: 5000
              }}
            />

            <Routes>
              <Route element={<GlobalLayout />}>
                {/* Serve Reservations at /reservations/* */}
                <Route path="/reservations/*" element={<ReservationsApp />} />

                {/* Everything else => OnlineOrderingApp at the root */}
                <Route path="/*" element={<OnlineOrderingApp />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PostHogProvider>
      </RestaurantProvider>
    </AuthProvider>
  );
}
