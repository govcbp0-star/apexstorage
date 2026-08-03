'use client';

import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface VaultDonutProps {
  bars: number;
  coins: number;
  jewellery: number;
}

export default function VaultDonut({ bars, coins, jewellery }: VaultDonutProps) {
  const total = bars + coins + jewellery;
  const hasData = total > 0;

  const data = {
    labels: ['Gold Bars', 'Gold Coins', 'Jewellery'],
    datasets: [
      {
        data: hasData ? [bars, coins, jewellery] : [1, 1, 1],
        backgroundColor: hasData
          ? ['#C9A84C', '#38BDF8', '#A855F7']
          : ['#161e2b', '#212c3f', '#2c3c56'],
        borderColor: '#10141d',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: hasData,
        backgroundColor: '#10141d',
        borderColor: '#1c222e',
        borderWidth: 1,
        titleColor: '#8A8A8E',
        bodyColor: '#F5F5F5',
        bodyFont: { weight: 'bold' as const },
        padding: 8,
      },
    },
  };

  return (
    <div className="relative">
      <Doughnut data={data} options={options} />
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-[#8A8A8E] tracking-wider uppercase">No Data</span>
        </div>
      )}
    </div>
  );
}
