'use client';

import React from 'react';
import { Transaction } from '@/lib/transactions-service';

interface TransactionHistoryProps {
  transactions: Transaction[];
  isAdmin?: boolean;
}

export default function TransactionHistory({ transactions, isAdmin = false }: TransactionHistoryProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-[10px] text-[#8A8A8E] tracking-wider uppercase">No Transactions Yet</p>
      </div>
    );
  }

  const statusColorMap: Record<string, string> = {
    confirmed: 'bg-green-500/10 text-green-500',
    pending: 'bg-yellow-500/10 text-yellow-500',
    failed: 'bg-red-500/10 text-red-500',
    expired: 'bg-red-500/10 text-red-500',
  };

  const typeIconMap: Record<string, string> = {
    gold_purchase: '🏆',
    shipment: '📦',
  };

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div key={tx.id} className="p-3 bg-[#1b212c] border border-[#212836] rounded hover:border-[#C9A84C]/30 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{typeIconMap[tx.type] || '💳'}</span>
                <div>
                  <p className="text-[11px] font-semibold text-[#F5F5F5] truncate">{tx.description}</p>
                  <p className="text-[9px] text-[#8A8A8E]">
                    {new Date(tx.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 text-[9px]">
                <div>
                  <span className="text-[#8A8A8E]">Amount:</span>
                  <span className="text-[#C9A84C] font-semibold ml-1">${tx.amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-[#8A8A8E]">Crypto:</span>
                  <span className="text-[#C9A84C] font-semibold ml-1">
                    {tx.cryptoAmount.toFixed(6)} {tx.cryptoCurrency}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <div className="mt-2 text-[9px]">
                  <p className="text-[#8A8A8E]">
                    User: <span className="text-[#F5F5F5]">{tx.userName}</span>
                  </p>
                  <p className="text-[#8A8A8E]">
                    Email: <span className="text-[#F5F5F5] truncate">{tx.userEmail}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <span
                className={`px-2 py-1 rounded text-[9px] font-semibold uppercase tracking-wide ${
                  statusColorMap[tx.paymentStatus] || 'bg-gray-500/10 text-gray-500'
                }`}
              >
                {tx.paymentStatus}
              </span>
              <span className="text-[8px] text-[#8A8A8E] font-mono break-all text-right max-w-[150px]">
                ID: {tx.paymentId.substring(0, 8)}...
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
