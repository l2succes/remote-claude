import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette for Remote Claude
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        terminal: {
          bg: '#0a0a0a',
          fg: '#e4e4e7',
          prompt: '#22c55e',
          cursor: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'typewriter': 'typewriter 0.15s steps(1) infinite',
        'gradient': 'gradient 15s ease infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        typewriter: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': '#e4e4e7',
            '--tw-prose-headings': '#fafafa',
            '--tw-prose-links': '#3b82f6',
            '--tw-prose-bold': '#fafafa',
            '--tw-prose-counters': '#a1a1aa',
            '--tw-prose-bullets': '#52525b',
            '--tw-prose-hr': '#27272a',
            '--tw-prose-quotes': '#e4e4e7',
            '--tw-prose-quote-borders': '#27272a',
            '--tw-prose-captions': '#a1a1aa',
            '--tw-prose-code': '#fafafa',
            '--tw-prose-pre-code': '#e4e4e7',
            '--tw-prose-pre-bg': '#18181b',
            '--tw-prose-th-borders': '#27272a',
            '--tw-prose-td-borders': '#27272a',
          },
        },
      },
    },
  },
  plugins: [typography],
}

export default config