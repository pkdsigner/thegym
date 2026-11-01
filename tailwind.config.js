/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        accent2: 'rgb(var(--accent2) / <alpha-value>)',
        lime: {
          DEFAULT: '#C6FF3D',
          400: '#D4FF6B',
          500: '#C6FF3D',
          600: '#A8E01F',
        },
        cyan: {
          DEFAULT: '#22E4F2',
          400: '#5CEBF6',
          500: '#22E4F2',
        },
        ember: '#FF7A3D',
        violet: '#9B7BFF',
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(198 255 61 / 0.25), 0 8px 40px -8px rgb(198 255 61 / 0.45)',
        'glow-cyan': '0 8px 40px -8px rgb(34 228 242 / 0.45)',
        card: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 20px 40px -24px rgb(0 0 0 / 0.6)',
      },
      backgroundImage: {
        'pulse-grad': 'linear-gradient(100deg, #C6FF3D 0%, #7DF59A 45%, #22E4F2 100%)',
      },
      keyframes: {
        'pulse-line': {
          '0%': { strokeDashoffset: '400' },
          '100%': { strokeDashoffset: '0' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '200% 50%' },
        },
      },
      animation: {
        'pulse-line': 'pulse-line 2.4s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 6s linear infinite',
      },
    },
  },
  plugins: [],
}
