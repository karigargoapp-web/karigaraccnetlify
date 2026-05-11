import { useState, useEffect, useCallback } from 'react'
import { IoSearch, IoWallet, IoLockClosed, IoTrendingUp, IoRefresh } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'

type Tab = 'overview'|'transactions'|'escrow'

const TX_COLOR: Record<string, string> = {
  top_up:'text-green-600', escrow_release:'text-green-600', refund:'text-green-600',
  partial_refund:'text-blue-600', reward:'text-purple-600',
  inspection_payment:'text-red-500', escrow_lock:'text-red-500',
  bidding_fee:'text-orange-500', commission:'text-orange-600', withdrawal:'text-red-600',
}

const TX_LABEL: Record<string, string> = {
  top_up:'Top Up', inspection_payment:'Inspection Paid', escrow_lock:'Escrow Locked',
  escrow_release:'Payment Released', commission:'Commission', reward:'Reward Points',
  bidding_fee:'Bidding Fee', refund:'Refund', partial_refund:'Partial Refund', withdrawal:'Withdrawal',
}

export default function AdminWallets() {
  const [tab, setTab] = useState<Tab>('overview')
  const [wallets, setWallets] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [escrows, setEscrows] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ totalEscrow:0, totalBalance:0, commissions:0, biddingFees:0 })

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [
      { data: w },
      { data: e },
      { data: comms },
      { data: fees },
    ] = await Promise.all([
      supabase.from('wallets').select('*, users(name,role,email,phone)').order('balance',{ascending:false}),
      supabase.from('escrow').select('*, jobs(title,customer_name,worker_name,status)').order('created_at',{ascending:false}),
      supabase.from('wallet_transactions').select('amount').eq('type','commission'),
      supabase.from('wallet_transactions').select('amount').eq('type','bidding_fee'),
    ])
    if (w) setWallets(w)
    if (e) setEscrows(e)
    setSummary({
      totalEscrow: e?.filter(x=>['inspection_held','work_held'].includes(x.status)).reduce((s,r)=>s+(r.total_locked||0),0)||0,
      totalBalance: w?.reduce((s,r)=>s+(r.balance||0),0)||0,
      commissions: comms?.reduce((s,r)=>s+(r.amount||0),0)||0,
      biddingFees: fees?.reduce((s,r)=>s+(r.amount||0),0)||0,
    })
    if (tab === 'transactions') {
      const { data: t } = await supabase.from('wallet_transactions').select('*, users(name,role)').order('created_at',{ascending:false}).limit(100)
      if (t) setTransactions(t)
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredWallets = wallets.filter(w => !search || w.users?.name?.toLowerCase().includes(search.toLowerCase()) || w.users?.email?.toLowerCase().includes(search.toLowerCase()))
  const filteredTx = transactions.filter(t => !search || t.users?.name?.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()))
  const filteredEscrows = escrows.filter(e => !search || e.jobs?.title?.toLowerCase().includes(search.toLowerCase()) || e.jobs?.customer_name?.toLowerCase().includes(search.toLowerCase()))

  const ESCROW_COLOR: Record<string,string> = {
    inspection_held:'bg-blue-100 text-blue-700', work_held:'bg-purple-100 text-purple-700',
    released:'bg-green-100 text-green-700', refunded:'bg-gray-100 text-gray-600', partial_refund:'bg-orange-100 text-orange-700',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallet & Escrow Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">Full financial visibility</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <IoRefresh size={16}/> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:'Escrow Locked', value:`₨${summary.totalEscrow.toLocaleString()}`, icon:IoLockClosed, color:'text-purple-600', bg:'bg-purple-50'},
          {label:'All Wallet Balances', value:`₨${summary.totalBalance.toLocaleString()}`, icon:IoWallet, color:'text-blue-600', bg:'bg-blue-50'},
          {label:'Commissions Earned', value:`₨${summary.commissions.toLocaleString()}`, icon:IoTrendingUp, color:'text-primary', bg:'bg-green-50'},
          {label:'Bidding Fees Earned', value:`₨${summary.biddingFees.toLocaleString()}`, icon:IoTrendingUp, color:'text-orange-600', bg:'bg-orange-50'},
        ].map((s,i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
              <s.icon className={`text-lg ${s.color}`}/>
            </div>
            <p className="text-lg font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {([{key:'overview',label:'User Wallets'},{key:'transactions',label:'Transactions'},{key:'escrow',label:'Escrow Logs'}] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===t.key ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"/>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <div className="space-y-3">
          {tab==='overview' && filteredWallets.map(w => (
            <div key={w.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${w.users?.role==='worker' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
                  {w.users?.name?.[0]?.toUpperCase()||'?'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{w.users?.name||'Unknown'}</p>
                  <p className="text-xs text-gray-400">{w.users?.email}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${w.users?.role==='worker' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>{w.users?.role}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">₨{w.balance.toLocaleString()}</p>
                <p className="text-xs text-purple-600">{w.reward_points} pts</p>
              </div>
            </div>
          ))}

          {tab==='transactions' && filteredTx.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${t.direction==='credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {t.direction==='credit' ? '+' : '-'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{TX_LABEL[t.type]||t.type}</p>
                  <p className="text-xs text-gray-400">{t.users?.name} · {new Date(t.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</p>
                  {t.description && <p className="text-xs text-gray-400 truncate max-w-xs">{t.description}</p>}
                </div>
              </div>
              <p className={`font-bold text-sm ${TX_COLOR[t.type]||'text-gray-700'}`}>
                {t.direction==='credit' ? '+' : '-'}₨{t.amount.toLocaleString()}
              </p>
            </div>
          ))}

          {tab==='escrow' && filteredEscrows.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{e.jobs?.title||'Unknown Job'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{e.jobs?.customer_name} → {e.jobs?.worker_name||'No worker'}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    <span>Inspection: ₨{e.inspection_amount.toLocaleString()}</span>
                    {e.work_amount > 0 && <span>Work: ₨{e.work_amount.toLocaleString()}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">₨{e.total_locked.toLocaleString()}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${ESCROW_COLOR[e.status]||'bg-gray-100 text-gray-600'}`}>
                    {e.status.replace(/_/g,' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {((tab==='overview' && filteredWallets.length===0)||(tab==='transactions' && filteredTx.length===0)||(tab==='escrow' && filteredEscrows.length===0)) && (
            <div className="bg-white rounded-xl border border-gray-100 py-12 text-center text-gray-400">No records found</div>
          )}
        </div>
      )}
    </div>
  )
}
