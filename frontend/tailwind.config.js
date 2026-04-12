module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        /** Req2Design enterprise palette */
        r2d: {
          primary: '#0f2744',
          primaryLight: '#163a5e',
          primaryDark: '#0a1929',
          accent: '#2563eb',
          accentSoft: '#93c5fd',
          accentMuted: '#dbeafe',
          surface: '#f1f5f9',
          surfaceElevated: '#ffffff',
          border: '#e2e8f0',
          success: '#16a34a',
          successMuted: '#dcfce7',
          warning: '#ea580c',
          warningMuted: '#ffedd5',
          error: '#dc2626',
          errorMuted: '#fee2e2',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 39 68 / 0.06), 0 4px 12px -2px rgb(15 39 68 / 0.08)',
        'card-hover': '0 4px 20px -4px rgb(15 39 68 / 0.12), 0 8px 24px -6px rgb(15 39 68 / 0.1)',
        nav: '0 4px 24px -4px rgba(15, 39, 68, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      scale: {
        '102': '1.02',
        '103': '1.03',
      }
    },
  },
  plugins: [],
}
