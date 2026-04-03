/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Stitch Material Design 3 — dark
        primary: '#00eea6',
        'primary-dim': '#00eea6',
        'primary-container': '#006746',
        'primary-fixed': '#00feb2',
        'primary-fixed-dim': '#00eea6',
        'on-primary': '#003825',
        'on-primary-container': '#005c3e',
        'on-primary-fixed': '#002114',

        secondary: '#47edc4',
        'secondary-container': '#00503f',
        'secondary-fixed': '#5afcd2',
        'on-secondary': '#00382b',
        'on-secondary-container': '#c4ffea',

        tertiary: '#00dcfd',
        'tertiary-container': '#004d59',
        'on-tertiary': '#00363d',
        'on-tertiary-container': '#00dcfd',

        error: '#ffb4ab',
        'error-container': '#93000a',
        'on-error': '#690005',

        surface: '#001510',
        'surface-dim': '#001510',
        'surface-bright': '#002018',
        'surface-container-lowest': '#00110c',
        'surface-container-low': '#001d16',
        'surface-container': '#00251e',
        'surface-container-high': '#002f26',
        'surface-container-highest': '#00362a',
        'surface-variant': '#2f6555',

        'on-surface': '#d8fff0',
        'on-surface-variant': '#a7f1d8',
        'on-background': '#d8fff0',

        background: '#001510',
        outline: '#81b8a5',
        'outline-variant': '#2f6555',
        'inverse-surface': '#d8fff0',
        'inverse-on-surface': '#00362a',
        'inverse-primary': '#006947',
        'surface-tint': '#00eea6',
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
        full: '9999px',
      },
    },
  },
  plugins: [],
};
