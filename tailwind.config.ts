import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0E7FDB',
          dark: '#0B5FA5',
          light: '#E8F3FC',
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
