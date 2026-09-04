import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{vue,js,ts,jsx,tsx}',
    './config/**/*.ts',
  ],
  theme: {
    extend: {
      colors: {
        // CalmEar brand — calm, earthy teal/sage
        primary: {
          50: '#f0faf9',
          100: '#d1f0ee',
          200: '#a8e0dc',
          300: '#71c9c4',
          400: '#3daaa5',
          500: '#258e8a',
          600: '#1b7370',
          700: '#185d5b',
          800: '#184b49',
          900: '#183f3e',
          950: '#082423',
        },
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
} satisfies Config
