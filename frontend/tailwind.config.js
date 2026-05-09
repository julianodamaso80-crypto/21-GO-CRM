/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 21Go Blue — Azul Institucional #293C82 (manual oficial v1.0 abr/2026)
        // Escala recentrada com 500 = #293C82 (cor principal da marca)
        blue: {
          50: '#EBEEF7',
          100: '#CFD6EB',
          200: '#9FAED7',
          300: '#6E85C2',
          400: '#445DA8',
          500: '#293C82',
          600: '#22326C',
          700: '#1B2856',
          800: '#141E40',
          900: '#0C1228',
          950: '#070B1A',
        },
        // 21Go Orange — Laranja 21Go #F2911D (manual oficial v1.0 abr/2026)
        // Cor de ação: CTAs, ícones, energia
        orange: {
          50: '#FEF4E7',
          100: '#FCE2BD',
          200: '#FACA88',
          300: '#F8B154',
          400: '#F5A039',
          500: '#F2911D',
          600: '#D97A0F',
          700: '#B5630B',
          800: '#8E4D08',
          900: '#5C3205',
          950: '#331C03',
        },
        // 21Go Lime — Verde Localização #C7D301 (manual oficial)
        // Cor de apoio: pin, acentos, destaques positivos discretos
        lime: {
          50: '#FAFCE5',
          100: '#F4FACC',
          200: '#E8F394',
          300: '#DCEC5C',
          400: '#D2E230',
          500: '#C7D301',
          600: '#A3AE01',
          700: '#7C8401',
          800: '#555B01',
          900: '#2E3100',
          950: '#181A00',
        },
        // gold — alias legado mapeado pra orange (compatibilidade com componentes existentes)
        gold: {
          300: '#F8B154',
          400: '#F5A039',
          500: '#F2911D',
          600: '#D97A0F',
        },
        // Dark palette — tier system tipo Xan (Base / Panel / Elevated / Input)
        // Continua via CSS vars pra suportar light/dark theme
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
        // Borda padrão (Xan-style: 1px sólido, mais sutil que a paleta dark)
        hairline: {
          DEFAULT: 'rgb(var(--color-hairline) / <alpha-value>)',
          strong: 'rgb(var(--color-hairline-strong) / <alpha-value>)',
        },
        // Accent — destaques semânticos (alinhados ao manual + Xan)
        accent: {
          purple: '#A78BFA',
          emerald: '#34D399',
          rose: '#FB7185',
          amber: '#FBBF24',
          cyan: '#22D3EE',
          lime: '#C7D301',
        },
        // Semantic — feedback e status
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
          DEFAULT: '#445DA8',
          subtle: '#1B2856',
        },
      },
      fontFamily: {
        // Inter como fonte oficial (alternativa web da DIN Next LT Pro do manual)
        // Usada pra display E body — ganho de consistência tipográfica
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        'xl': '0.75rem',   // 12px — botões, inputs
        '2xl': '1rem',     // 16px — cards
        '3xl': '1.5rem',   // 24px — modais/destaques
      },
      boxShadow: {
        // Glow azul (cor primária do manual)
        'glow-blue': '0 0 20px rgba(41, 60, 130, 0.25)',
        'glow-blue-lg': '0 0 40px rgba(41, 60, 130, 0.35)',
        // Glow laranja (CTA)
        'glow-orange': '0 0 20px rgba(242, 145, 29, 0.25)',
        'glow-orange-lg': '0 0 40px rgba(242, 145, 29, 0.4)',
        // Aliases gold legados
        'glow-gold': '0 0 20px rgba(242, 145, 29, 0.25)',
        'glow-gold-lg': '0 0 40px rgba(242, 145, 29, 0.4)',
        // Glass (modais, drawers)
        'glass': '0 8px 32px rgba(0, 0, 0, 0.35)',
        'glass-lg': '0 16px 48px rgba(0, 0, 0, 0.45)',
        // Cards Xan-style: sombra discreta em repouso, mais firme em hover
        'card': '0 1px 2px rgba(0, 0, 0, 0.25), 0 1px 3px rgba(0, 0, 0, 0.18)',
        'card-hover': '0 4px 16px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)',
        'sidebar': '4px 0 24px rgba(0, 0, 0, 0.35)',
        // CTA com glow azul/laranja inline (Xan: shadow no botão primário)
        'cta-blue': '0 0 20px rgba(41, 60, 130, 0.4)',
        'cta-orange': '0 0 20px rgba(242, 145, 29, 0.4)',
      },
      backgroundImage: {
        // Gradientes oficiais (cores do manual)
        'gradient-blue': 'linear-gradient(135deg, #293C82, #445DA8)',
        'gradient-blue-deep': 'linear-gradient(180deg, #1B2856, #0C1228)',
        'gradient-orange': 'linear-gradient(135deg, #F2911D, #F5A039, #F8B154)',
        'gradient-orange-subtle': 'linear-gradient(135deg, rgba(242, 145, 29, 0.12), rgba(242, 145, 29, 0.04))',
        'gradient-blue-subtle': 'linear-gradient(135deg, rgba(41, 60, 130, 0.12), rgba(41, 60, 130, 0.04))',
        'gradient-card': 'linear-gradient(135deg, rgba(20, 30, 64, 0.7), rgba(12, 18, 40, 0.85))',
        // Aliases gold legados (mapeiam pra laranja oficial)
        'gradient-gold': 'linear-gradient(135deg, #F2911D, #F5A039, #F8B154)',
        'gradient-gold-subtle': 'linear-gradient(135deg, rgba(242, 145, 29, 0.12), rgba(242, 145, 29, 0.04))',
        // Spotlight Xan: radial seguindo --mouse-x/y (consumido em SpotlightCard)
        'spotlight-blue': 'radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(68, 93, 168, 0.12) 0%, transparent 60%)',
        // Noise sutil pra textura em backgrounds grandes
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
        // Pulse dot (Xan): status badge com bolinha que pulsa
        'dot-pulse': 'dotPulse 2s ease-in-out infinite',
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
          '0%, 100%': { boxShadow: '0 0 15px rgba(41, 60, 130, 0.15)' },
          '50%': { boxShadow: '0 0 30px rgba(41, 60, 130, 0.35)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        dotPulse: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.15)' },
        },
      },
      transitionTimingFunction: {
        // Easing Xan-style (assinatura do design): bem mais fluido que ease-smooth padrão
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
