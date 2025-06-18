// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Pacifico', 'cursive'],
      },
      fontSize: {
        base: '1.125rem', // ~18px
      },
      colors: {
        // Shimizu Technology color scheme
        'shimizu-blue': '#0078d4',
        'shimizu-light-blue': '#50a3d9',
        'shimizu-dark-blue': '#005a9e',
        'shimizu-gray': '#505050',
        'shimizu-light-gray': '#f3f3f3',
      },
      animation: {
        'fadeIn': 'fadeIn 0.3s ease-in-out',
        'shimmer': 'shimmer 2s infinite linear',
        'slideUp': 'slideUp 0.3s ease-out',
        'slideDown': 'slideDown 0.3s ease-out',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-light': 'pulse-light 2s ease-in-out infinite',
        'expandDown': 'expandDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'pulse-light': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 214, 0, 0.2)' },
          '50%': { boxShadow: '0 0 0 6px rgba(255, 214, 0, 0.2)' },
        },
        expandDown: {
          '0%': { maxHeight: '0', opacity: '0', overflow: 'hidden' },
          '100%': { maxHeight: '1000px', opacity: '1', overflow: 'visible' },
        },
      },
      transitionDuration: {
        '250': '250ms',
        '300': '300ms',
        '400': '400ms',
      },
    },
  },
  plugins: [],
};
