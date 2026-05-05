import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { IoSearch, IoWallet, IoLockClosed, IoTrendingUp } from 'react-icons/io5'

type WalletTab = 'overview' | 'transactions' | 'escrow'

export default function AdminWallets() {
  const [tab, setTab] = useState<WalletTab>('overview')
  const [wallets, setWallets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [escrows, setEscrows] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ totalEscrow: 0, totalWalletBalance: 0, platformEarned: 0 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (tab === 'overview') {
      const [{ data: w }, { data: e }, { data: fees }] = await Promise.all([
        supabase.from('wallets').select('*, users(name, role, phone)').order('balance', { ascending: false }).limit(50),
        supabase.from('escrow').select('total_locked').in('status', ['inspection_held', 'work_held']),
        supabase.from('wallet_transactions').select('amount').eq('type', 'commission'),
      ])
      if (w) setWallets(w)
      const totalEscrow = e?.reduce((s, r) => s + (r.total_locked || 0), 0) || 0
      const totalWalletBalance = w?.reduce((s, r) => s + (r.balance || 0), 0) || 0
      const platformEarned = fees?.reduce((s, r) => s + (r.amount || 0), 0) || 0
      setSummary({ totalEscrow, totalWalletBalance, platformEarned })
    } else if (tab === 'transactions') {
      const { data } = await supabase
        .from('wallet_transactions')
        .select('*, users(name, role)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) setTransactions(data)
    } else {
      const { data } = await supabase
        .from('escrow')
        .select('*, jobs(title, customer_name, worker_name, status)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (data) setEscrows(data)
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { fetchData() }, [fetchData])

  const TX_COLOR: Record<string, string> = {
    top_up: 'text-green-600',
    escrow_release: 'text-green-600',
    refund: 'text-green-600',
    partial_refund: 'text-green-600',
    reward: 'text-purple-600',
    inspection_payment: 'text-red-500',
    escrow_lock: 'text-red-500',
    bidding_fee: 'text-red-500',
    commission: 'text-orange-600',
    withdrawal: 'text-red-600',
  }

  const ESCROW_COLOR: Record<string, string> = {
    inspection_held: 'bg-blue-100 text-blue-700',
    work_held: 'bg-purple-100 text-purple-700',
    released: 'bg-green-100 text-green-700',
    refunded: 'bg-gray-100 text-gray-600',
    partial_refund: 'bg-orange-100 text-orange-700',
  }

  const filteredWallets = wallets.filter(w =>
    w.users?.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.users?.phone?.includes(search)
  )
  const filteredTx = transactions.filter(t =>
    t.users?.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wallet & Escrow Monitor</h1>
        <p className="text-sm text-gray-500 mt-1">Full financial visibility</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total in Escrow', value: `₨${summary.totalEscrow.toLocaleString()}`, icon: IoLockClosed, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'All Wallet Balances', value: `₨${summary.totalWalletBalance.toLocaleString()}`, icon: IoWallet, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Platform Commissions', value: `₨${summary.platformEarned.toLocaleString()}`, icon: IoTrendingUp, color: 'text-primary', bg: 'bg-green-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
              <s.icon className={`text-xl ${s.color}`} />
            </div>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {([
          { key: 'overview', label: 'User Wallets' },
          { key: 'transactions', label: 'Transactions' },
          { key: 'escrow', label: 'Escrow Logs' },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {tab === 'overview' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Balance</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reward Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredWallets.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{w.users?.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${w.users?.role === 'worker' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
                          {w.users?.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">₨{w.balance.toLocaleString()}</td>
                      <td className="px-4 py-3 text-purple-700">{w.reward_points} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredWallets.length === 0 && <div className="text-center py-12 text-gray-500">No wallets found</div>}
            </div>
          )}

          {tab === 'transactions' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTx.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{t.users?.name}</p>
                        <p className="text-xs text-gray-400">{t.users?.role}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{t.type}</span>
                      </td>
                      <td className={`px-4 py-3 font-semibold ${TX_COLOR[t.type] || 'text-gray-700'}`}>
                        {t.direction === 'credit' ? '+' : '-'}₨{t.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{t.description}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredTx.length === 0 && <div className="text-center py-12 text-gray-500">No transactions found</div>}
            </div>
          )}

          {tab === 'escrow' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Job</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Inspection</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Work</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {escrows.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{e.jobs?.title}</p>
                        <p className="text-xs text-gray-400">{e.jobs?.customer_name} → {e.jobs?.worker_name}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">₨{e.inspection_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-gray-700">₨{e.work_amount.toLocaleString()}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">₨{e.total_locked.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${ESCROW_COLOR[e.status] || 'bg-gray-100 text-gray-600'}`}>
                          {e.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(e.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {escrows.length === 0 && <div className="text-center py-12 text-gray-500">No escrow records found</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
