'use client';

import React, { useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useChartTheme } from '@/lib/use-chart-theme';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

interface PerformanceChartProps {
  open: boolean;
  onClose: () => void;
  priceHistory: number[];
  labels: string[];
  currentPrice: number;
}

export default function PerformanceChart({ open, onClose, priceHistory, labels, currentPrice }: PerformanceChartProps) {
  const chartRef = useRef<ChartJS<'Line'>>(null);
  const ct = useChartTheme();

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  if (!open) return null;

  // Sample data for better chart display
  const sampledIndices = priceHistory.length > 30
    ? Array.from({ length: 30 }, (_, i) => Math.floor(i * (priceHistory.length - 1) / 29))
    : priceHistory.map((_, i) => i);

  const sampledPrices = sampledIndices.map(i => priceHistory[i]);
  const sampledLabels = sampledIndices.map(i => labels[i] || '');

  const data = {
    labels: sampledLabels,
    datasets: [
      {
        label: 'Gold Price (USD)',
        data: sampledPrices,
        borderColor: '#C9A84C',
        backgroundColor: 'rgba(201, 168, 76, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4,
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
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        borderWidth: 1,
        titleColor: ct.tooltipTitle,
        bodyColor: '#C9A84C',
        bodyFont: { weight: 'bold' as const },
        padding: 10,
        displayColors: false,
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => `$${ctx.parsed.y.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: ct.tickColor, font: { size: 9 }, maxTicksLimit: 6 },
        grid: { color: ct.gridColor },
        border: { color: ct.axisBorder },
      },
      y: {
        min: sampledPrices.length > 0 ? Math.floor(Math.min(...sampledPrices) * 0.99) : undefined,
        max: sampledPrices.length > 0 ? Math.ceil(Math.max(...sampledPrices) * 1.01) : undefined,
        ticks: {
          color: ct.tickColor,
          font: { size: 9 },
          callback: (val: string | number) => `$${Number(val).toLocaleString()}`,
        },
        grid: { color: ct.gridColor },
        border: { color: ct.axisBorder },
      },
    },
    interaction: { intersect: false, mode: 'index' as const },
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#10141d] border border-[#1c222e] rounded-xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold tracking-[0.15em] text-[#F5F5F5] uppercase">Gold Performance</h3>
              <p className="text-[10px] text-[#8A8A8E] mt-0.5">90-day spot price (USD/oz)</p>
            </div>
            <button onClick={onClose} className="text-[#8A8A8E] hover:text-[#C9A84C] transition-colors p-0.5 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#C9A84C]/20 bg-[#C9A84C]/5 rounded-full">
              <span className="live-dot" />
              <span className="text-[11px] text-[#C9A84C] font-bold">
                ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/oz
              </span>
            </div>
          </div>
          <div className="h-56">
            <Line ref={chartRef} data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}
