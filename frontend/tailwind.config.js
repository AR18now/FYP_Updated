module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['DM Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          500: '#1a1aff',
          600: '#1616e6',
          700: '#1212bf',
        },
        /** Req2Design — logo-blue accent system */
        r2d: {
          primary: '#1e3a8a',
          primaryLight: '#2563eb',
          primaryDark: '#0b1226',
          accent: '#1a1aff',
          accentSoft: '#818cf8',
          accentMuted: '#e0e7ff',
          surface: '#f8faff',
          surfaceElevated: '#ffffff',
          border: '#dbe5ff',
          success: '#059669',
          successMuted: '#d1fae5',
          warning: '#d97706',
          warningMuted: '#fef3c7',
          error: '#dc2626',
          errorMuted: '#fee2e2',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(37 99 235 / 0.10)',
        'card-hover': '0 4px 24px -6px rgb(15 23 42 / 0.14), 0 8px 28px -8px rgb(26 26 255 / 0.16)',
        nav: '0 4px 28px -6px rgba(24, 24, 27, 0.45)',
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
