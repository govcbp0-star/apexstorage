'use client';

import React from 'react';
import {
  Chart as ChartJS,
  type ChartOptions,
  type TooltipItem,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useChartTheme } from '@/lib/use-chart-theme';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface GrowthBarProps {
  data: number[];
  labels: string[];
}

export default function GrowthBar({ data, labels }: GrowthBarProps) {
  const ct = useChartTheme();
  const hasData = data.length > 0 && data.some(v => v !== 0);

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: data.map((v) => (v >= 0 ? '#C9A84C' : '#EF4444')),
        borderRadius: 2,
        barThickness: 14,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
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
          label: (ctx: TooltipItem<'bar'>) => {
            const value = ctx.parsed.y ?? 0;
            return `${value >= 0 ? '+' : ''}${value}%`;
          },
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
        ticks: { color: ct.tickColor, font: { size: 9 }, callback: (val: string | number) => `${val}%` },
        grid: { color: ct.gridColor },
        border: { color: ct.axisBorder },
      },
    },
  };

  if (!hasData) {
    return (
      <div className="h-full flex items-center justify-center">
        <span className="text-[10px] text-[#8A8A8E] tracking-wider uppercase">No Data</span>
      </div>
    );
  }

  return <Bar data={chartData} options={options} />;
}
