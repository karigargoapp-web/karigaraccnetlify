import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoWallet, IoWarning, IoTime, IoGift, IoCard, IoArrowDown, IoCash } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Wallet, WalletTransaction } from '../../types'
import { BIDDING_FEE } from '../../types'
import toast from 'react-hot-toast'

function WithdrawSection({ balance, userId, onSuccess }: { balance: number; userId: string; onSuccess: () => void }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('JazzCash')
  const [accountNumber, setAccountNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const handleWithdraw = async () => {
    const amt = parseInt(amount)
    if (!amt || amt < 100) return toast.error('Minimum withdrawal is ₨100')
    if (amt > balance) return toast.error('Amount exceeds available balance')
    if (!accountNumber.trim()) return toast.error('Enter your account number')
    setLoading(true)
    const { error } = await supabase.from('wallets').update({ balance: balance - amt }).eq('user_id', userId)
    if (error) { setLoading(false); return toast.error('Withdrawal failed') }
    await supabase.from('wallet_transactions').insert({
      user_id: userId, type: 'withdrawal', amount: amt, direction: 'debit',
      description: `Withdrawal via ${method} to ${accountNumber}`,
    })
    setLoading(false); setShowForm(false); setAmount(''); setAccountNumber('')
    toast.success(`₨${amt.toLocaleString()} withdrawal request submitted`)
    onSuccess()
  }

  if (!showForm) return (
    <button onClick={() => setShowForm(true)}
      className="w-full flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
          <IoCash size={20} className="text-primary" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-primary">Withdraw Earnings</p>
          <p className="text-xs text-text-muted">Available: ₨{balance.toLocaleString()}</p>
        </div>
      </div>
      <span className="text-xs bg-primary text-white px-3 py-1.5 rounded-full font-medium">Withdraw</span>
    </button>
  )

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-text-muted mb-1 block">Amount (min ₨100)</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount"
          className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" />
      </div>
      <div>
        <label className="text-xs font-medium text-text-muted mb-1 block">Method</label>
        <select value={method} onChange={e => setMethod(e.target.value)}
          className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary bg-white">
          <option>JazzCash</option><option>EasyPaisa</option><option>Bank Transfer</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-medium text-text-muted mb-1 block">Account / Phone Number</label>
        <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
          placeholder="03XX-XXXXXXX or IBAN"
          className="w-full border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleWithdraw} disabled={loading}
          className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          {loading ? 'Processing...' : 'Confirm Withdrawal'}
        </button>
        <button onClick={() => setShowForm(false)} className="px-4 py-3 border border-border rounded-xl text-sm text-text-secondary">
          Cancel
        </button>
      </div>
      <p className="text-xs text-text-muted text-center">Withdrawals processed within 24-48 hours</p>
    </div>
  )
}

export default function WorkerWallet() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)

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
    top_up: 'Welcome Bonus / Top Up',
    inspection_payment: 'Inspection Fee Paid',
    escrow_lock: 'Job Amount Locked',
    escrow_release: 'Job Payment Received',
    commission: 'Platform Commission',
    reward: 'Reward Points Earned',
    reward_redemption: 'Reward Points Used',
    bidding_fee: 'Job Start Fee (₨20)',
    refund: 'Refund',
    partial_refund: 'Partial Refund',
    withdrawal: 'Withdrawal',
  }

  const balance = wallet?.balance || 0
  const lowBalance = balance < BIDDING_FEE
  const bidsRemaining = Math.min(Math.floor(balance / BIDDING_FEE), 5)

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
          <p className="text-white text-4xl font-bold mb-4">₨{balance.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <IoGift size={14} className="text-white/70" />
            <p className="text-white/80 text-sm">{wallet?.reward_points || 0} Reward Points</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {lowBalance && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <IoWarning className="text-amber-500 text-xl flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Low Balance Warning</p>
              <p className="text-xs text-amber-700 mt-0.5">You need at least ₨{BIDDING_FEE} to bid on jobs. Top up your wallet to continue bidding.</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-text-primary">Welcome Bonus 🎁</p>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">₨100 gift</span>
          </div>
          <p className="text-xs text-text-muted leading-relaxed mb-4">
            KarigarGo gives every new worker ₨100 to start bidding. Each bid costs ₨20, so your first 5 bids are on us. After that, top up your wallet to keep bidding. Platform commission (10%) always applies on completed jobs.
          </p>
          <div className="flex items-center gap-2">
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`flex-1 h-2 rounded-full ${i <= (5 - bidsRemaining) ? 'bg-gray-200' : 'bg-primary'}`} />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {bidsRemaining > 0
              ? `${bidsRemaining} free bid${bidsRemaining > 1 ? 's' : ''} remaining from welcome bonus`
              : 'Welcome bonus used — top up to continue bidding'
            }
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-1">Bidding Fee</p>
          <p className="text-xs text-text-muted mb-4">A ₨{BIDDING_FEE} fee is charged when a customer accepts your quote and work begins.</p>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3">
            <p className="text-sm font-bold text-green-800">🎁 Welcome Bonus — ₨100</p>
            <p className="text-xs text-green-700 mt-1 leading-relaxed">
              You received ₨100 as a signup gift. This covers your first 5 bids at ₨20 each — completely free. After that, top up your wallet to keep bidding.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-2 bg-green-200 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.min((balance / 100) * 100, 100)}%` }} />
              </div>
              <span className="text-xs font-semibold text-green-700">₨{balance}/100</span>
            </div>
            <p className="text-xs text-green-600 mt-1">{Math.floor(balance / BIDDING_FEE)} bids remaining from bonus</p>
          </div>

          <div className={`flex items-center gap-2 p-3 rounded-xl ${lowBalance ? 'bg-red-50' : 'bg-green-50'}`}>
            <div className={`w-2 h-2 rounded-full ${lowBalance ? 'bg-red-400' : 'bg-green-400'}`} />
            <p className={`text-xs font-medium ${lowBalance ? 'text-red-700' : 'text-green-700'}`}>
              {lowBalance ? 'Insufficient balance — top up to bid' : `₨${balance} available — you can bid on jobs`}
            </p>
          </div>
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
            You earn <strong>2% reward points</strong> on every completed job. Use them as a discount on your ₨20 bidding fee when a job starts — you pay the remaining amount and KarigarGo covers the rest.
          </p>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-800 space-y-1">
            <p className="font-medium">Example:</p>
            <p>Bidding fee ₨20 · You apply ₨10 reward points</p>
            <p>→ You pay <strong>₨10</strong> · KarigarGo covers ₨10</p>
          </div>
          <p className="text-xs text-text-muted mt-3 text-center">Reward redemption for bidding fee coming soon</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-1">Withdraw Earnings</p>
          <p className="text-xs text-text-muted mb-4">Transfer your balance to your payment account</p>
          <WithdrawSection balance={balance} userId={user!.id} onSuccess={() => {
            supabase.from('wallets').select('*').eq('user_id', user!.id).single().then(({ data }) => { if (data) setWallet(data as any) })
            supabase.from('wallet_transactions').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }).limit(30).then(({ data }) => { if (data) setTransactions(data as any) })
          }} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-4">Top Up Methods</p>
          <div className="space-y-3">
            {[
              { name: 'JazzCash', sub: 'Add money via JazzCash' },
              { name: 'EasyPaisa', sub: 'Add money via EasyPaisa' },
              { name: 'Bank Transfer', sub: 'Transfer from your bank account' },
            ].map(m => (
              <div key={m.name} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <IoCard size={20} className="text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{m.name}</p>
                    <p className="text-xs text-text-muted">{m.sub}</p>
                  </div>
                </div>
                <span className="text-xs bg-gray-200 text-gray-500 px-2 py-1 rounded-full">Soon</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted text-center mt-3">Payment gateways coming soon</p>
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
                      {tx.direction === 'credit'
                        ? <IoArrowDown size={16} className="text-green-500 rotate-180" />
                        : <IoArrowDown size={16} className="text-red-400" />
                      }
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
      </div>
    </div>
  )
}
