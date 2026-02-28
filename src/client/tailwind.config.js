/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ai: {
          primary: '#6366f1',
          'primary-hover': '#4f46e5',
          surface: '#eef2ff',
          border: '#c7d2fe',
          muted: '#a5b4fc',
          text: '#3730a3',
        },
        confidence: {
          high: '#22c55e',
          medium: '#f59e0b',
          low: '#ef4444',
        },
        risk: {
          critical: '#dc2626',
          high: '#f97316',
          medium: '#eab308',
          low: '#22c55e',
        },
        sidebar: {
          bg: '#1e1b4b',
          hover: '#312e81',
          active: '#4338ca',
          text: '#c7d2fe',
          'text-active': '#ffffff',
        },
      },
      animation: {
        'ai-pulse': 'ai-pulse 2s ease-in-out infinite',
        'ai-typing': 'ai-typing 1.4s infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'ai-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'ai-typing': {
          '0%': { opacity: '0.3' },
          '50%': { opacity: '1' },
          '100%': { opacity: '0.3' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      width: {
        'sidebar': '240px',
        'sidebar-collapsed': '64px',
        'ai-panel': '380px',
      },
      minWidth: {
        'ai-panel': '380px',
      },
      maxWidth: {
        'ai-panel': '480px',
      },
    },
  },
  plugins: [],
}
