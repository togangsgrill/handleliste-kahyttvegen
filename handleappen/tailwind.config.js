/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // ── Stitch "Market Flow" Design System ──
      colors: {
        // Light theme (primary)
        primary: {
          DEFAULT: '#006947',
          dim: '#005c3d',
          container: '#00feb2',
          fixed: '#00feb2',
          'fixed-dim': '#00eea6',
        },
        'on-primary': {
          DEFAULT: '#c8ffe0',
          container: '#005c3e',
          fixed: '#00472f',
          'fixed-variant': '#006746',
        },
        secondary: {
          DEFAULT: '#006853',
          dim: '#005b48',
          container: '#5afcd2',
          fixed: '#5afcd2',
          'fixed-dim': '#47edc4',
        },
        'on-secondary': {
          DEFAULT: '#c4ffea',
          container: '#005d4a',
          fixed: '#004939',
          'fixed-variant': '#006853',
        },
        tertiary: {
          DEFAULT: '#006575',
          dim: '#005866',
          container: '#00dcfd',
          fixed: '#00dcfd',
          'fixed-dim': '#00cdeb',
        },
        'on-tertiary': {
          DEFAULT: '#dcf7ff',
          container: '#004955',
          fixed: '#00343c',
          'fixed-variant': '#005360',
        },
        error: {
          DEFAULT: '#b31b25',
          dim: '#9f0519',
          container: '#fb5151',
        },
        'on-error': {
          DEFAULT: '#ffefee',
          container: '#570008',
        },
        surface: {
          DEFAULT: '#d8fff0',
          dim: '#8fe5c9',
          bright: '#d8fff0',
          'container-lowest': '#ffffff',
          'container-low': '#bffee7',
          container: '#b2f6de',
          'container-high': '#a7f1d8',
          'container-highest': '#9decd2',
          variant: '#9decd2',
          tint: '#006947',
        },
        'on-surface': {
          DEFAULT: '#00362a',
          variant: '#2f6555',
        },
        background: '#d8fff0',
        'on-background': '#00362a',
        outline: {
          DEFAULT: '#4c8170',
          variant: '#81b8a5',
        },
        'inverse-surface': '#00110c',
        'inverse-on-surface': '#72a895',
        'inverse-primary': '#00feb2',

        // Convenience aliases
        botanical: {
          50: '#ecfdf5',   // emerald-50
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#00110c',
        },
      },
      fontFamily: {
        headline: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
        label: ['Manrope', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
        full: '9999px',
      },
      boxShadow: {
        'stitch-sm': '0px 4px 12px rgba(0,54,42,0.03)',
        'stitch': '0px 10px 30px rgba(0,54,42,0.04)',
        'stitch-md': '0px 20px 40px rgba(0,54,42,0.08)',
        'stitch-lg': '0px 20px 50px rgba(0,105,71,0.3)',
        'stitch-nav': '0 -10px 40px rgba(0,54,42,0.08)',
        'stitch-header': '0px 10px 30px rgba(0,54,42,0.06)',
      },
    },
  },
  plugins: [],
};
