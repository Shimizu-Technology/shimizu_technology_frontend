// src/data/menu.ts
import type { MenuItem } from '../types/menu';
import { Category } from '../../shared/api/endpoints/categories';

// Note: This hardcoded data is kept for reference only.
// In production, categories should be fetched from the API using the categoryStore.
// These example categories now match the updated Category interface with numeric IDs and menu_id.
export const exampleCategories: Category[] = [
  {
    id: 1,
    name: 'Appetizers',
    description: 'Start your meal with these island favorites',
    menu_id: 1,
    position: 1
  },
  {
    id: 2,
    name: 'Poke Bowls',
    description: 'Fresh Hawaiian-style fish with your choice of toppings',
    menu_id: 1,
    position: 2
  },
  {
    id: 3,
    name: 'Island Burgers',
    description: 'Signature burgers with a tropical twist',
    menu_id: 1,
    position: 3
  },
  {
    id: 4,
    name: 'Desserts',
    description: 'Cool down with our tropical treats',
    menu_id: 1,
    position: 4
  },
  {
    id: 5,
    name: 'Drinks',
    description: 'Refresh yourself with island beverages',
    menu_id: 1,
    position: 5
  }
];

// With backend data, we no longer need hardcoded menu items.
export const menuItems: MenuItem[] = [];
