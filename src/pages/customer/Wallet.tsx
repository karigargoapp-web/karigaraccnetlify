import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoWallet, IoAddCircle, IoTime, IoGift, IoCard } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Wallet, WalletTransaction } from '../../types'

export default function CustomerWallet() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showTopUp, setShowTopUp] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('wallets').select('*').eq('user_id', user.id).single(),
      supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ]).then(([{ data: w }, { data: t }]) => {
      if (w) setWallet(w as Wallet)
      if (t) setTransactions(t as WalletTransaction[])
      setLoading(false)
    })
  }, [user])

  const TX_LABEL: Record<string, string> = {
    top_up: 'Wallet Top Up',
    inspection_payment: 'Inspection Fee Paid',
    escrow_lock: 'Job Amount Locked',
    escrow_release: 'Payment Received',
    commission: 'Service Fee',
    reward: 'Reward Points Earned',
    reward_redemption: 'Reward Points Used',
    bidding_fee: 'Bidding Fee',
    refund: 'Refund',
    partial_refund: 'Partial Refund',
    withdrawal: 'Withdrawal',
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <div className="bg-primary px-6 pt-10 pb-6 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => nav(-1)}><IoArrowBack size={24} className="text-white" /></button>
          <h1 className="text-white text-xl font-medium">My Wallet</h1>
        </div>
        <div className="bg-white/15 rounded-2xl p-5">
          <p className="text-white/70 text-sm mb-1">Available Balance</p>
          <p className="text-white text-4xl font-bold mb-4">₨{(wallet?.balance || 0).toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <IoGift size={14} className="text-white/70" />
            <p className="text-white/80 text-sm">{wallet?.reward_points || 0} Reward Points</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-4">Add Money</p>
          <div className="space-y-3">
            {[
              { name: 'JazzCash', color: 'bg-red-50 border-red-200 text-red-700', coming: true },
              { name: 'EasyPaisa', color: 'bg-green-50 border-green-200 text-green-700', coming: true },
              { name: 'Bank Transfer', color: 'bg-blue-50 border-blue-200 text-blue-700', coming: true },
            ].map(m => (
              <div key={m.name} className={`flex items-center justify-between p-4 rounded-xl border opacity-60 cursor-not-allowed ${m.color}`}>
                <div className="flex items-center gap-3">
                  <IoCard size={20} />
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs opacity-70">Coming Soon</p>
                  </div>
                </div>
                <span className="text-xs bg-white/60 px-2 py-1 rounded-full font-medium">Soon</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted text-center mt-3">Payment gateways will be connected soon</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <p className="text-sm font-semibold text-text-primary px-5 pt-4 pb-3">Transaction History</p>
          {transactions.length === 0 ? (
            <div className="py-10 text-center">
              <IoWallet size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-text-muted">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${tx.direction === 'credit' ? 'bg-green-50' : 'bg-red-50'}`}>
                      <IoTime size={16} className={tx.direction === 'credit' ? 'text-green-500' : 'text-red-400'} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-primary">{TX_LABEL[tx.type] || tx.type}</p>
                      <p className="text-xs text-text-muted">{new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${tx.direction === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.direction === 'credit' ? '+' : '-'}₨{tx.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IoGift size={18} className="text-primary" />
              <p className="text-sm font-semibold text-text-primary">Reward Points</p>
            </div>
            <span className="text-lg font-bold text-primary">₨{wallet?.reward_points || 0}</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mb-3">
            You earn <strong>2% reward points</strong> on every completed job. Apply them as a discount on inspection fees or work costs — you only pay the reduced amount.
          </p>
          <p className="text-xs text-text-muted text-center">Apply reward points on the job page when accepting a bid or work cost</p>
        </div>
      </div>
    </div>
  )
}
