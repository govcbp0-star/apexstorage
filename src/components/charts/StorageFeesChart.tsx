'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useChartTheme } from '@/lib/use-chart-theme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface StorageFeesChartProps {
  months: string[];
  amounts: number[];
}

export default function StorageFeesChart({ months, amounts }: StorageFeesChartProps) {
  const ct = useChartTheme();
  const hasData = amounts.length > 0 && amounts.some(v => v !== 0);

  const data = {
    labels: months,
    datasets: [
      {
        data: amounts,
        backgroundColor: '#C9A84C',
        borderRadius: 2,
        barThickness: 12,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        borderWidth: 1,
        titleColor: ct.tooltipTitle,
        bodyColor: '#C9A84C',
        bodyFont: { weight: 'bold' as const },
        padding: 8,
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => `$${ctx.parsed.y}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: ct.tickColor, font: { size: 9 } },
        grid: { display: false },
        border: { color: ct.axisBorder },
      },
      y: {
        suggestedMax: 100,
        ticks: { color: ct.tickColor, font: { size: 9 }, callback: (val: string | number) => `$${val}` },
        grid: { color: ct.gridColor },
        border: { color: ct.axisBorder },
      },
    },
  };

  return <Bar data={data} options={options} />;
}
