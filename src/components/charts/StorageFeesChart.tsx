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

interface StorageFeesChartProps {
  months: string[];
  amounts: number[];
}

export default function StorageFeesChart({ months, amounts }: StorageFeesChartProps) {
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
        backgroundColor: '#10141d',
        borderColor: '#1c222e',
        borderWidth: 1,
        titleColor: '#8A8A8E',
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
        ticks: { color: '#8A8A8E', font: { size: 9 } },
        grid: { display: false },
        border: { color: '#1c222e' },
      },
      y: {
        suggestedMax: 100,
        ticks: { color: '#8A8A8E', font: { size: 9 }, callback: (val: string | number) => `$${val}` },
        grid: { color: 'rgba(28, 34, 46, 0.5)' },
        border: { color: '#1c222e' },
      },
    },
  };

  return <Bar data={data} options={options} />;
}
