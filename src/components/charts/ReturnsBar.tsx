'use client';

import React from 'react';
import {
  Chart as ChartJS,
  type ChartOptions,
  type TooltipItem,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useChartTheme } from '@/lib/use-chart-theme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface ReturnsBarProps {
  data: number[];
  labels: string[];
}

export default function ReturnsBar({ data, labels }: ReturnsBarProps) {
  const ct = useChartTheme();
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Monthly Return',
        data,
        borderColor: '#C9A84C',
        backgroundColor: 'rgba(201, 168, 76, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#C9A84C',
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
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
          label: (ctx: TooltipItem<'line'>) => {
            const value = ctx.parsed.y ?? 0;
            return `${value >= 0 ? '+' : ''}${value}%`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: ct.tickColor, font: { size: 9 } },
        grid: { color: ct.gridColorSoft },
        border: { color: ct.axisBorder },
      },
      y: {
        suggestedMin: -5,
        suggestedMax: 5,
        ticks: { color: ct.tickColor, font: { size: 9 }, callback: (val: string | number) => `${val}%` },
        grid: { color: ct.gridColor },
        border: { color: ct.axisBorder },
      },
    },
  };

  return <Line data={chartData} options={options} />;
}
