import { ThemeMode } from '../types';

export interface ThemePalette {
  mode: ThemeMode;
  background: string;
  card: string;
  innerBox: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  accentBlue: string;
  mathText: string;
}

export const DARK_PALETTE: ThemePalette = {
  mode: 'DARK',
  background: '#0F172A',
  card: '#1E293B',
  innerBox: '#0F172A',
  border: '#334155',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  primary: '#6366F1',
  primaryText: '#A5B4FC',
  accentBlue: '#38BDF8',
  mathText: '#F8FAFC',
};

export const LIGHT_PALETTE: ThemePalette = {
  mode: 'LIGHT',
  background: '#F1F5F9',
  card: '#FFFFFF',
  innerBox: '#F8FAFC',
  border: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  primary: '#4F46E5',
  primaryText: '#4F46E5',
  accentBlue: '#0284C7',
  mathText: '#0F172A',
};

export function getThemePalette(mode: ThemeMode = 'DARK'): ThemePalette {
  return mode === 'LIGHT' ? LIGHT_PALETTE : DARK_PALETTE;
}
