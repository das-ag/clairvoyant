import type { Config } from 'tailwindcss'

const config: Config = {
  // Opt out of prefers-color-scheme: dark is toggled by the `dark` class on
  // <html>, which layout.tsx sets unconditionally. The light theme has
  // never been designed, so following the system preference was shipping
  // broken styling to users in light mode.
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary': {
          DEFAULT: '#0a153b',
          50: '#d3d8e8',
          100: '#aeb7d6',
          200: '#8491bd',
          500: '#263770',
          800: '#0a153b',
          900: '#030b26',
          950: '#010617'
        },
        'secondary': {
          DEFAULT: '#074f6b',
          50: '#d1e1e8',
          100: '#a5cad9',
          200: '#77abbf',
          500: '#263770',
          800: '#074f6b',
          900: '#032938',
          950: '#011117'
        },
        'tertiary': {
          DEFAULT: "#018138",
          50: "#d1f0e7",
          100: "#a2e1cd",
          200: "#6fcfb0",
          500: "#018138",
          800: "#005c2b",
          900: "#00371d"
        },
        'accent': {
          DEFAULT: '#6504db',
          200: '#a074d6',
          800: '#6504db'
        },
        'danger': {
          DEFAULT: '#690a00', 
          50: '#e8ccca',
          100: '#e3aba6',
          200: '#d99089',
          500: '#c43427',
          800: '#690a00',
          900: '#3d0600',
          950: '#210300'
        },
        'code-null': '#888888',
        'code-boolean': '#888888',
        'code-number': '#888888',
        'code-string': '#888888',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
export default config
