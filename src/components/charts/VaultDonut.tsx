'use client';

import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useChartTheme } from '@/lib/use-chart-theme';

ChartJS.register(ArcElement, Tooltip, Legend);

interface VaultDonutProps {
  bars: number;
  coins: number;
  jewellery: number;
}

export default function VaultDonut({ bars, coins, jewellery }: VaultDonutProps) {
  const ct = useChartTheme();
  const total = bars + coins + jewellery;
  const hasData = total > 0;

  const data = {
    labels: ['Gold Bars', 'Gold Coins', 'Jewellery'],
    datasets: [
      {
        data: hasData ? [bars, coins, jewellery] : [1, 1, 1],
        backgroundColor: hasData
          ? ['#C9A84C', '#38BDF8', '#A855F7']
          : ct.emptyColors,
        borderColor: ct.donutBorder,
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
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        borderWidth: 1,
        titleColor: ct.tooltipTitle,
        bodyColor: ct.tooltipBody,
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
