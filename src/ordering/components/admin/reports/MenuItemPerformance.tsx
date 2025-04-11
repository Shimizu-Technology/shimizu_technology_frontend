// src/ordering/components/admin/reports/MenuItemPerformance.tsx
import React, { useState, useMemo } from 'react';
import { MenuItemReport, CategoryReport } from '../../../../shared/api';
import * as XLSX from 'xlsx';

interface MenuItemPerformanceProps {
  menuItems: MenuItemReport[];
  categories: CategoryReport[];
}

export function MenuItemPerformance({ menuItems, categories }: MenuItemPerformanceProps) {
  // State for sorting
  const [sortField, setSortField] = useState<'name' | 'category' | 'quantity_sold' | 'revenue'>('quantity_sold');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Handle sort click
  const handleSortClick = (field: 'name' | 'category' | 'quantity_sold' | 'revenue') => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sorted menu items
  const sortedItems = useMemo(() => {
    return [...menuItems].sort((a, b) => {
      let comparison = 0;
      
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'category') {
        comparison = a.category.localeCompare(b.category);
      } else if (sortField === 'quantity_sold') {
        comparison = Number(a.quantity_sold) - Number(b.quantity_sold);
      } else if (sortField === 'revenue') {
        comparison = Number(a.revenue) - Number(b.revenue);
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [menuItems, sortField, sortDirection]);

  // Sorted categories
  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  }, [categories]);
// Export to Excel function
const exportToExcel = () => {
  if (menuItems.length === 0 && categories.length === 0) {
    alert('No data to export');
    return;
  }

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Format category data for export
  const categoryData = sortedCategories.map(cat => ({
    'Category': cat.name,
    'Items Sold': cat.quantity_sold,
    'Revenue': `$${Number(cat.revenue).toFixed(2)}`
  }));

  // Format menu item data for export
  const itemData = sortedItems.map(item => ({
    'Item': item.name,
    'Category': item.category,
    'Quantity Sold': item.quantity_sold,
    'Revenue': `$${Number(item.revenue).toFixed(2)}`,
    'Avg. Price': `$${item.average_price ? Number(item.average_price).toFixed(2) : '0.00'}`
  }));

  // Add categories sheet
  const catSheet = XLSX.utils.json_to_sheet(categoryData);
  XLSX.utils.book_append_sheet(wb, catSheet, 'Categories');

  // Add menu items sheet
  const itemSheet = XLSX.utils.json_to_sheet(itemData);
  XLSX.utils.book_append_sheet(wb, itemSheet, 'Menu Items');

  // Write file
  const now = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Menu_Item_Performance_${now}.xlsx`);
};

return (
  <div className="bg-white rounded-lg shadow p-4 mb-4">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xl font-bold">Menu Item Performance</h3>
      
      {/* Export button */}
      {(menuItems.length > 0 || categories.length > 0) && (
        <button
          onClick={exportToExcel}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center"
        >
          <span className="mr-1">Export to Excel</span>
        </button>
      )}
    </div>
    
    {/* Category breakdown */}
      {/* Category breakdown */}
      <h4 className="font-semibold text-lg mb-2">Revenue by Category</h4>
      {sortedCategories.length > 0 ? (
        <div className="overflow-x-auto mb-6">
          <table className="table-auto w-full text-sm border border-gray-200">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Category</th>
                <th className="px-4 py-2 text-right font-semibold">Items Sold</th>
                <th className="px-4 py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((cat, idx) => (
                <tr key={idx} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-2">{cat.name}</td>
                  <td className="px-4 py-2 text-right">{cat.quantity_sold}</td>
                  <td className="px-4 py-2 text-right">${cat.revenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500 mb-4">No category data available.</p>
      )}
      
      {/* Individual items */}
      <h4 className="font-semibold text-lg mb-2">All Menu Items</h4>
      {sortedItems.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="table-auto w-full text-sm border border-gray-200">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th 
                  className="px-4 py-2 text-left font-semibold cursor-pointer"
                  onClick={() => handleSortClick('name')}
                >
                  Item {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-2 text-left font-semibold cursor-pointer"
                  onClick={() => handleSortClick('category')}
                >
                  Category {sortField === 'category' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-2 text-right font-semibold cursor-pointer"
                  onClick={() => handleSortClick('quantity_sold')}
                >
                  Quantity Sold {sortField === 'quantity_sold' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th 
                  className="px-4 py-2 text-right font-semibold cursor-pointer"
                  onClick={() => handleSortClick('revenue')}
                >
                  Revenue {sortField === 'revenue' && (sortDirection === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-4 py-2 text-right font-semibold">Avg. Price</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, idx) => (
                <tr key={idx} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-2">{item.name}</td>
                  <td className="px-4 py-2">{item.category}</td>
                  <td className="px-4 py-2 text-right">{item.quantity_sold}</td>
                  <td className="px-4 py-2 text-right">${Number(item.revenue).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">${item.average_price ? Number(item.average_price).toFixed(2) : '0.00'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">No item data available.</p>
      )}
    </div>
  );
}