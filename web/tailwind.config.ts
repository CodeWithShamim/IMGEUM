import type {Config} from 'tailwindcss';

/**
 * Neo-Dancheong design system (build spec §5).
 * Palette tokens are named exactly as specified; color always encodes meaning:
 *   gold = money, green = trust, vermilion = breach, cobalt = action.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0E0B16', // near-black indigo base
        hanji: '#F7F2E7', // warm paper white (evidence/docs)
        cheong: '#2245FF', // electric cobalt (primary action)
        vermil: '#FF3D2E', // vermilion (arrears, urgency, destructive)
        'dan-gold': '#FFB300', // lacquer gold (money, earned wage, success)
        nok: '#00C48C', // malachite green (solvency, verified)
        'jade-mist': '#B8E8FF', // pale sky (subtle fills, hover washes)
        // Derived shades used sparingly for surfaces on the ink shell.
        'ink-2': '#161227',
        'ink-3': '#211B38',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Pretendard', 'system-ui', 'sans-serif'],
        sans: ['Pretendard', '"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        // Small and consistent per spec.
        DEFAULT: '6px',
        sm: '4px',
        lg: '6px',
        xl: '6px',
      },
      boxShadow: {
        // 2px offset HARD shadows in palette colors — not soft blur.
        'hard-cheong': '2px 2px 0 0 #2245FF',
        'hard-gold': '2px 2px 0 0 #FFB300',
        'hard-vermil': '2px 2px 0 0 #FF3D2E',
        'hard-nok': '2px 2px 0 0 #00C48C',
        'hard-ink': '2px 2px 0 0 #0E0B16',
        'hard-ink-lg': '4px 4px 0 0 #0E0B16',
        'hard-hanji': '2px 2px 0 0 rgba(14,11,22,0.9)',
      },
      fontSize: {
        // Extreme optical sizes for hero numerals.
        mega: ['clamp(3rem, 12vw, 9rem)', {lineHeight: '0.9', letterSpacing: '-0.03em'}],
        giant: ['clamp(2.5rem, 7vw, 5rem)', {lineHeight: '0.95', letterSpacing: '-0.02em'}],
      },
      keyframes: {
        'block-pulse': {
          '0%, 100%': {opacity: '0.35', transform: 'scale(1)'},
          '50%': {opacity: '1', transform: 'scale(1.35)'},
        },
        'stamp-in': {
          '0%': {opacity: '0', transform: 'scale(2.4) rotate(-18deg)'},
          '70%': {opacity: '1', transform: 'scale(0.94) rotate(-11deg)'},
          '100%': {transform: 'scale(1) rotate(-12deg)'},
        },
      },
      animation: {
        'block-pulse': 'block-pulse 1s steps(2, jump-none) infinite',
        'stamp-in': 'stamp-in 350ms cubic-bezier(0.83,0,0.17,1) forwards',
      },
    },
  },
  plugins: [],
} satisfies Config;
