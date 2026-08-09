'use client';

import { useTheme } from '@/lib/theme-context';

/**
 * Theme-aware colors for Chart.js configs (Chart.js uses canvas, not CSS,
 * so colors must be provided via JS). Only used inside dashboard pages,
 * where theme switching is enabled.
 * Warm Assay Ledger palette: panel #161109, bronze hairline #2A2114,
 * ink #EFE7D8, muted #B9AE9B / faint #8C8272.
 */
export function useChartTheme() {
  const { theme } = useTheme();
  const light = theme === 'light';

  return {
    isLight: light,
    tickColor: light ? '#5D6570' : '#8C8272',
    gridColor: light ? 'rgba(93, 101, 112, 0.15)' : 'rgba(42, 33, 20, 0.5)',
    gridColorSoft: light ? 'rgba(93, 101, 112, 0.1)' : 'rgba(42, 33, 20, 0.25)',
    axisBorder: light ? '#E3E6EB' : '#2A2114',
    tooltipBg: light ? '#FFFFFF' : '#161109',
    tooltipBorder: light ? '#E3E6EB' : '#2A2114',
    tooltipTitle: light ? '#5D6570' : '#B9AE9B',
    tooltipBody: light ? '#1A1D24' : '#EFE7D8',
    donutBorder: light ? '#FFFFFF' : '#161109',
    emptyColors: light
      ? ['#E3E6EB', '#D5DAE1', '#C6CDD6']
      : ['#241C10', '#2A2114', '#3A2E1B'],
  };
}
