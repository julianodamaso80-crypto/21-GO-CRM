/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 21Go Blue — cor primaria da marca (ver brand-guide.md)
        blue: {
          50: '#EBF0FA',
          100: '#D1DFFA',
          200: '#A3BEF5',
          300: '#6B96EB',
          400: '#3D72DE',
          500: '#1B4DA1',
          600: '#164087',
          700: '#11336D',
          800: '#0D2653',
          900: '#081A3A',
          950: '#050F24',
        },
        // 21Go Orange — cor secundaria, CTAs, logo
        orange: {
          50: '#FFF4EB',
          100: '#FFE4CC',
          200: '#FFC999',
          300: '#FFAA61',
          400: '#F08C28',
          500: '#E07620',
          600: '#C46218',
          700: '#9C4E14',
          800: '#743A0F',
          900: '#4D260A',
          950: '#2E1706',
        },
        // gold mapeado para orange (paleta oficial da marca 21Go)
        gold: {
          300: '#FFAA61',
          400: '#F08C28',
          500: '#E07620',
          600: '#C46218',
        },
        // Dark palette — backgrounds sofisticados (tema dark/light via CSS vars)
        dark: {
          50: 'rgb(var(--color-dark-50) / <alpha-value>)',
          100: 'rgb(var(--color-dark-100) / <alpha-value>)',
          200: 'rgb(var(--color-dark-200) / <alpha-value>)',
          300: 'rgb(var(--color-dark-300) / <alpha-value>)',
          400: 'rgb(var(--color-dark-400) / <alpha-value>)',
          500: 'rgb(var(--color-dark-500) / <alpha-value>)',
          600: 'rgb(var(--color-dark-600) / <alpha-value>)',
          700: 'rgb(var(--color-dark-700) / <alpha-value>)',
          800: 'rgb(var(--color-dark-800) / <alpha-value>)',
          900: 'rgb(var(--color-dark-900) / <alpha-value>)',
          950: 'rgb(var(--color-dark-950) / <alpha-value>)',
        },
        // Accent — para destaques secundarios
        accent: {
          purple: '#A78BFA',
          emerald: '#34D399',
          rose: '#FB7185',
          amber: '#FBBF24',
          cyan: '#22D3EE',
          lime: '#A3E635',
        },
        // Semantic — feedback e status (ver brand-guide.md)
        success: {
          DEFAULT: '#34D399',
          subtle: '#065F46',
        },
        warning: {
          DEFAULT: '#FBBF24',
          subtle: '#78350F',
        },
        error: {
          DEFAULT: '#FB7185',
          subtle: '#881337',
        },
        info: {
          DEFAULT: '#60A5FA',
          subtle: '#1E3A5F',
        },
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(27, 77, 161, 0.15)',
        'glow-blue-lg': '0 0 40px rgba(27, 77, 161, 0.2)',
        'glow-orange': '0 0 20px rgba(224, 118, 32, 0.15)',
        'glow-gold': '0 0 20px rgba(224, 118, 32, 0.15)',
        'glow-gold-lg': '0 0 40px rgba(224, 118, 32, 0.2)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.4)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)',
        'sidebar': '4px 0 24px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-gold': 'linear-gradient(135deg, #E07620, #F08C28, #FFAA61)',
        'gradient-gold-subtle': 'linear-gradient(135deg, rgba(224, 118, 32, 0.1), rgba(224, 118, 32, 0.05))',
        'gradient-blue': 'linear-gradient(135deg, #1B4DA1, #3D72DE)',
        'gradient-blue-dark': 'linear-gradient(180deg, #111827, #0B1120)',
        'gradient-orange': 'linear-gradient(135deg, #E07620, #F08C28, #FFAA61)',
        'gradient-orange-subtle': 'linear-gradient(135deg, rgba(224, 118, 32, 0.1), rgba(224, 118, 32, 0.05))',
        'gradient-card': 'linear-gradient(135deg, rgba(26, 31, 53, 0.8), rgba(17, 24, 39, 0.9))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.3s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.3s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'scale-in': 'scaleIn 0.2s ease-out forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'stagger-1': 'fadeInUp 0.5s ease-out 0.05s forwards',
        'stagger-2': 'fadeInUp 0.5s ease-out 0.1s forwards',
        'stagger-3': 'fadeInUp 0.5s ease-out 0.15s forwards',
        'stagger-4': 'fadeInUp 0.5s ease-out 0.2s forwards',
        'stagger-5': 'fadeInUp 0.5s ease-out 0.25s forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(27, 77, 161, 0.1)' },
          '50%': { boxShadow: '0 0 25px rgba(27, 77, 161, 0.25)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
