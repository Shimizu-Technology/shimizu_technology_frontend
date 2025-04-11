// src/ordering/components/loyalty/LoyaltyTeaser.tsx

import { Gift, Star } from 'lucide-react';

export function LoyaltyTeaser() {
  return (
    <div className="bg-gradient-to-r from-shimizu-dark-blue to-shimizu-blue text-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold mb-2">Rewards Program Coming Soon!</h3>
          <p className="text-white/90 mb-4">
            Join our loyalty program and earn points with every order.
          </p>
          <ul className="space-y-2">
            <li className="flex items-center">
              <Star className="h-5 w-5 mr-2" />
              Earn 1 point for every dollar spent
            </li>
            <li className="flex items-center">
              <Gift className="h-5 w-5 mr-2" />
              Redeem points for free items and exclusive deals
            </li>
          </ul>
        </div>
      </div>
      
      <div className="mt-6">
        <button
          className="bg-white text-shimizu-blue px-6 py-2 rounded-md font-semibold hover:bg-gray-100 transition-colors"
          onClick={() => alert('Coming soon! Stay tuned for our loyalty program launch.')}
        >
          Get Notified
        </button>
      </div>
    </div>
  );
}
