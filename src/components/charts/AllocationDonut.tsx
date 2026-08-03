'use client';

import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip);

interface AllocationDonutProps {
  bars: number;
  coins: number;
  jewellery: number;
}

export default function AllocationDonut({ bars, coins, jewellery }: AllocationDonutProps) {
  const total = bars + coins + jewellery;
  const hasData = total > 0;
  const barPct = total > 0 ? Math.round((bars / total) * 100) : 0;
  const coinPct = total > 0 ? Math.round((coins / total) * 100) : 0;

  const data = {
    labels: ['Gold Bars', 'Gold Coins', 'Jewellery'],
    datasets: [
      {
        data: hasData ? [bars, coins, jewellery] : [1, 1, 1],
        backgroundColor: hasData
          ? ['#C9A84C', '#38BDF8', '#A855F7']
          : ['#161e2b', '#212c3f', '#2c3c56'],
        borderColor: '#10141d',
        borderWidth: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '70%',
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
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-40 h-40 shrink-0">
        <Doughnut data={data} options={options} />
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] text-[#8A8A8E] tracking-wider uppercase">No Data</span>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#C9A84C' }} />
          <span className="text-[11px] text-[#8A8A8E]">Gold Bars</span>
          <span className="ml-auto text-[11px] font-bold text-[#F5F5F5]">{barPct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#38BDF8' }} />
          <span className="text-[11px] text-[#8A8A8E]">Gold Coins</span>
          <span className="ml-auto text-[11px] font-bold text-[#F5F5F5]">{coinPct}%</span>
        </div>
        {(jewellery > 0 || !hasData) && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: '#A855F7' }} />
            <span className="text-[11px] text-[#8A8A8E]">Jewellery</span>
            <span className="ml-auto text-[11px] font-bold text-[#F5F5F5]">{hasData ? (100 - barPct - coinPct) : 0}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
