// src/GlobalLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header, Footer } from './shared/components/navigation';

export default function GlobalLayout() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Shared header for ALL routes */}
      <Header />

      {/* Main content area — child routes go here */}
      <main className="flex-grow tropical-pattern">
        <Outlet />
      </main>

      {/* The Online Ordering Footer at the bottom */}
      <Footer />
    </div>
  );
}
