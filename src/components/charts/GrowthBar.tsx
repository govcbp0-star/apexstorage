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

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

interface GrowthBarProps {
  data: number[];
  labels: string[];
}

export default function GrowthBar({ data, labels }: GrowthBarProps) {
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

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#10141d',
        borderColor: '#1c222e',
        borderWidth: 1,
        titleColor: '#8A8A8E',
        bodyColor: '#C9A84C',
        bodyFont: { weight: 'bold' as const },
        padding: 8,
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => `${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y}%`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#8A8A8E', font: { size: 9 } },
        grid: { display: false },
        border: { color: '#1c222e' },
      },
      y: {
        ticks: { color: '#8A8A8E', font: { size: 9 }, callback: (val: string | number) => `${val}%` },
        grid: { color: 'rgba(28, 34, 46, 0.5)' },
        border: { color: '#1c222e' },
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
