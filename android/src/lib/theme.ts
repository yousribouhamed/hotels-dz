import { useColorScheme } from 'react-native';
import { useStore } from './store';

// Palette: forest #2A7C13 · leaf #76C457 · cream #FFF8CF · sand #FBE6C2 (same tokens as the iOS app).
// Light mode sits on cream with sand surfaces and forest for actions.
// Dark mode sits on a deep forest-black with leaf for actions.
const light = {
  canvas: '#FFFBE5',
  surface: '#FCEFD3',
  brandSoft: '#DDEFC9',
  line: '#E8D5AE',
  placeholder: '#F3E3C2',
  onAccent: '#FFFFFF',
  accent: '#2A7C13',
  good: '#2A7C13',
  star: '#B5760F',
  heart: '#DB405E',
  text: '#000000',
  secondary: 'rgba(60,60,67,0.6)',
  tertiary: 'rgba(60,60,67,0.3)',
  bar: 'rgba(255,251,229,0.94)',
};

const dark: typeof light = {
  canvas: '#0E1509',
  surface: '#1A2614',
  brandSoft: '#22371A',
  line: '#2F3F27',
  placeholder: '#202C1A',
  onAccent: '#0E1509',
  accent: '#76C457',
  good: '#76C457',
  star: '#F2C14E',
  heart: '#DB405E',
  text: '#FFFFFF',
  secondary: 'rgba(235,235,245,0.6)',
  tertiary: 'rgba(235,235,245,0.3)',
  bar: 'rgba(14,21,9,0.94)',
};

export type Colors = typeof light;
export const pinGood = '#2A7C13';

export function useTheme() {
  const system = useColorScheme();
  const appearance = useStore((s) => s.appearance);
  const isDark = appearance === 'dark' || (appearance === 'system' && system === 'dark');
  return { c: isDark ? dark : light, isDark };
}

export const palettes = { light, dark };
