import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0F2A52', 2: '#1F4B8A' },
        brand: { blue: '#1A6FC4', saffron: '#F39C34', orange: '#E67E22', green: '#1E8449', red: '#C0392B', amber: '#D68910' },
        bg: '#EEF2F7',
        card: '#FFFFFF',
        line: '#D6DFEB',
        muted: { DEFAULT: '#5B6B82', foreground: '#5B6B82' },
      },
      borderRadius: { card: '10px' },
      fontFamily: { sans: ['var(--font-inter)', 'system-ui', 'sans-serif'] },
      fontSize: { title: ['22px', { lineHeight: '28px', fontWeight: '700' }] },
      keyframes: {
        'pop-in': { '0%': { opacity: '0', transform: 'scale(.96) translateY(6px)' }, '100%': { opacity: '1', transform: 'scale(1) translateY(0)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(243,156,52,.55)' }, '100%': { boxShadow: '0 0 0 14px rgba(243,156,52,0)' } },
        'slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
      },
      animation: {
        'pop-in': 'pop-in .28s cubic-bezier(.2,.8,.2,1)',
        'pulse-ring': 'pulse-ring 1.4s ease-out infinite',
        'slide-in-right': 'slide-in-right .25s ease-out',
      },
    },
  },
  plugins: [animate],
};
export default config;
