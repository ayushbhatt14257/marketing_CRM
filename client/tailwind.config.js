/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          500: '#3b5fe0',
          600: '#2f4cc7',
          700: '#2540a3',
        },
      },
    },
  },
  plugins: [],
};
