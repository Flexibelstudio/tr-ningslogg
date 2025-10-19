/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        'dotted-pattern': "radial-gradient(hsl(215 20% 85%) 1px, transparent 0)",
      },
      backgroundSize: {
        'dotted-size': '25px 25px',
      },
      colors: {
        flexibel: '#3bab5a',
        'flexibel-orange': '#f97316',
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        blue: { 500: '#3b82f6' }
      },
      animation: {
        'fade-in-down': 'fadeInDown 0.5s ease-out',
        'pulse-cta': 'pulse-cta 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-icon': 'pulse-icon 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'highlight-new': 'highlight-fade 3s ease-out'
      },
      keyframes: {
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-cta': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'pulse-icon': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.25)', opacity: '0.75' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'highlight-fade': {
          '0%': { backgroundColor: '#dcfce7' },
          '100%': { backgroundColor: 'transparent' },
        },
      }
    }
  },
  plugins: [],
}