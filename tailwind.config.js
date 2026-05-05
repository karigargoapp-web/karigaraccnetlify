/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#006600',
          light: '#00A86B',
          dark: '#004D00',
        },
        warning: '#f97316',
        rating: '#FFB800',
        danger: '#CC3300',
        info: '#0066CC',
        surface: '#f5f5f5',
        card: '#ffffff',
        border: '#e0e0e0',
        'text-primary': '#333333',
        'text-secondary': '#666666',
        'text-muted': '#999999',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      maxWidth: {
        mobile: '430px',
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
}
