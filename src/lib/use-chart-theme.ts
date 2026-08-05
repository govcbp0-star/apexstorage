'use client';

import { useTheme } from '@/lib/theme-context';

/**
 * Theme-aware colors for Chart.js configs (Chart.js uses canvas, not CSS,
 * so colors must be provided via JS). Only used inside dashboard pages,
 * where theme switching is enabled.
 */
export function useChartTheme() {
  const { theme } = useTheme();
  const light = theme === 'light';

  return {
    isLight: light,
    tickColor: light ? '#5D6570' : '#8A8A8E',
    gridColor: light ? 'rgba(93, 101, 112, 0.15)' : 'rgba(28, 34, 46, 0.5)',
    gridColorSoft: light ? 'rgba(93, 101, 112, 0.1)' : 'rgba(28, 34, 46, 0.2)',
    axisBorder: light ? '#E3E6EB' : '#1c222e',
    tooltipBg: light ? '#FFFFFF' : '#10141d',
    tooltipBorder: light ? '#E3E6EB' : '#1c222e',
    tooltipTitle: light ? '#5D6570' : '#8A8A8E',
    tooltipBody: light ? '#1A1D24' : '#F5F5F5',
    donutBorder: light ? '#FFFFFF' : '#10141d',
    emptyColors: light
      ? ['#E3E6EB', '#D5DAE1', '#C6CDD6']
      : ['#161e2b', '#212c3f', '#2c3c56'],
  };
}
