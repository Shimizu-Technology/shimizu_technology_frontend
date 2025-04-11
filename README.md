# Shimizu Technology Frontend

Frontend web application for the Shimizu Technology restaurant management system. This is a demo version based on the Hafaloha frontend, customized for multi-tenant use.

## Features

- Online ordering system with customizable menu items
- Reservation system with table layout visualization
- Admin dashboard for order management and analytics
- Customer profiles with order history
- VIP code system for exclusive access
- Merchandise store with variant support, categories, and filtering
- Real-time notifications with enhanced delivery options
- Push notifications via Pushover integration
- Multi-language support (English, Japanese, Korean)
- Responsive design for mobile and desktop
- Inventory tracking system for menu items and merchandise
- Multiple payment methods (PayPal, Stripe)
- Order payment history and refund functionality
- Store credit system for customers
- Stock management dashboard for inventory control
- Staff discount system (50% for on-duty, 30% for off-duty)
- House account system for staff payroll deduction
- Comprehensive role-based access control (RBAC) with four distinct roles (customer, staff, admin, super_admin)
- Multi-tenant architecture with restaurant context

## Setup

### Environment Configuration

Create a `.env` file in the root directory with the following variables:

```
VITE_API_URL=http://localhost:3000
VITE_RESTAURANT_ID=2
```

The `VITE_RESTAURANT_ID=2` setting ensures that this frontend connects to the Shimizu Technology restaurant in the multi-tenant backend.

### Development

```bash
# Install dependencies
npm install

# Start development server on port 5175
npm run dev
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Multi-Tenant Architecture

This frontend is configured to work with the multi-tenant backend system. Key points:

- All API requests automatically include the restaurant_id parameter (set to 2 for Shimizu Technology)
- WebSocket connections are isolated per restaurant
- Push notifications are tenant-specific
- Staff orders and discounts are properly handled within the tenant context

## Documentation

### Core Systems

- [Authentication and Authorization](docs/authentication_authorization.md) - JWT-based authentication with role-based access control
- [State Management](docs/state_management.md) - Zustand stores and React Query integration
- [Inventory Tracking System](docs/inventory_tracking_system.md) - Comprehensive inventory management
- [Merchandise Management System](docs/merchandise_management_system.md) - Merchandise collections, categories, and variants

### Payment Systems

- [Payment Processing](docs/payment_processing.md) - Overview of payment handling
- [PayPal Integration](docs/paypal_integration.md) - PayPal SDK implementation
- [Stripe Integration](docs/stripe_integration.md) - Stripe Elements and webhooks
- [Staff Discount and House Account System](docs/staff_discount_house_account_system.md) - Staff discounts and house account management

### Access Control

- [VIP Code System](docs/vip_code_system.md) - Exclusive access management

### Notifications

- [Pushover Integration](docs/pushover_integration.md) - Real-time push notifications via Pushover
- [Web Push Integration](docs/web_push_integration.md) - Browser-based push notifications for PWA
- [WebSocket Integration](docs/websocket_integration.md) - Real-time updates using WebSockets
- [Order Notification System](docs/order_notification_system.md) - Comprehensive documentation of the notification system including WebSocket connections, deduplication, and fallback mechanisms
- [Order Notification Consistency](../hafaloha_api/docs/order_notification_consistency.md) - Ensuring consistent order notifications across devices and sessions

## Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite
- React Router
- React Query
- Zustand (state management)
- i18next (internationalization)
- Chart.js (analytics)
- date-fns (date manipulation)
- PayPal SDK
- Stripe Elements

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/hafaloha-frontend.git
cd hafaloha-frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn
```

3. Set up environment variables:
- Create a `.env.local` file in the project root with:
```
VITE_API_URL=http://localhost:3000
VITE_DEFAULT_LANGUAGE=en
```

4. Start the development server:
```bash
npm run dev
# or
yarn dev
```

By default, the application will run at `http://localhost:5173`.

## Project Structure

```
src/
├── shared/            # Shared components, hooks, and utilities
│   ├── api/           # API client and endpoints
│   ├── auth/          # Authentication related components
│   ├── components/    # Shared UI components
│   ├── hooks/         # Custom React hooks
│   ├── store/         # Global state management
│   └── utils/         # Utility functions
│
├── ordering/          # Online ordering system
│   ├── components/    # Ordering-specific components
│   ├── store/         # Ordering-specific state
│   ├── types/         # TypeScript types for ordering
│   └── utils/         # Ordering-specific utilities
│
├── reservations/      # Reservation system
│   ├── components/    # Reservation-specific components
│   ├── store/         # Reservation-specific state
│   └── types/         # TypeScript types for reservations
│
├── RootApp.tsx        # Main application component
└── main.tsx          # Entry point
```

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check code quality
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests (when implemented)

## Environment Variables

- `VITE_API_URL` - URL for the backend API
- `VITE_DEFAULT_LANGUAGE` - Default language for the application
- `VITE_ENABLE_MOCK_API` - Enable mock API for development (optional)
- `VITE_ENABLE_ANALYTICS` - Enable analytics tracking (optional)

## Deployment

The application is configured for deployment to Netlify. The `_redirects` file in the `public` directory ensures proper routing for single-page applications.

### Build for Production

```bash
npm run build
# or
yarn build
```

This will generate optimized static assets in the `dist` directory, which can be deployed to any static hosting service.

## Internationalization

The application supports multiple languages using i18next. Translation files are located in:

```
public/locales/{language-code}/{namespace}.json
```

Currently supported languages:
- English (en)
- Japanese (ja)
- Korean (ko)

To add a new language, create a new directory with the language code and copy the translation files from an existing language.

## Contributing

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests and ensure code quality (`npm run lint && npm run test`)
5. Commit your changes (`git commit -m 'Add some feature'`)
6. Push to the branch (`git push origin feature/your-feature`)
7. Create a new Pull Request

## License

This project is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.
