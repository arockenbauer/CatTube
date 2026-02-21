/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cat: {
          dark: '#0f0f0f',
          darker: '#030303',
          card: '#1a1a1a',
          hover: '#272727',
          border: '#333333',
          accent: '#ff6b35',
          accentHover: '#ff8555',
          text: '#f1f1f1',
          textSecondary: '#aaaaaa',
          success: '#2ecc71',
          danger: '#e74c3c',
          warning: '#f39c12',
          premium: '#ffd700'
        }
      }
    }
  },
  plugins: []
};
