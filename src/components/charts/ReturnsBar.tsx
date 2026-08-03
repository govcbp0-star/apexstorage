'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface ReturnsBarProps {
  data: number[];
  labels: string[];
}

export default function ReturnsBar({ data, labels }: ReturnsBarProps) {
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
        grid: { color: 'rgba(28, 34, 46, 0.2)' },
        border: { color: '#1c222e' },
      },
      y: {
        suggestedMin: -5,
        suggestedMax: 5,
        ticks: { color: '#8A8A8E', font: { size: 9 }, callback: (val: string | number) => `${val}%` },
        grid: { color: 'rgba(28, 34, 46, 0.5)' },
        border: { color: '#1c222e' },
      },
    },
  };

  return <Line data={chartData} options={options} />;
}
