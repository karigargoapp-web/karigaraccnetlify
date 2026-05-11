import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { IoTrendingUp, IoCash, IoPricetag, IoRefresh } from 'react-icons/io5'

type Period = '7d'|'30d'|'all'

export default function AdminRevenue() {
  const [period, setPeriod] = useState<Period>('30d')
  const [stats, setStats] = useState({ commissions:0, biddingFees:0, total:0, jobsCompleted:0 })
  const [dailyRevenue, setDailyRevenue] = useState<{date:string;amount:number}[]>([])
  const [topJobs, setTopJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const getFromDate = useCallback(() => {
    if (period==='all') return null
    const d = new Date()
    d.setDate(d.getDate()-(period==='7d'?7:30))
    return d.toISOString()
  }, [period])

  const fetchRevenue = useCallback(async () => {
    setLoading(true)
    const from = getFromDate()
    let commQ = supabase.from('wallet_transactions').select('amount,created_at').eq('type','commission')
    let feeQ = supabase.from('wallet_transactions').select('amount').eq('type','bidding_fee')
    let jobQ = supabase.from('jobs').select('id,title,platform_fee,work_cost_total,inspection_charges,completed_at,customer_name,worker_name').eq('status','completed').not('platform_fee','is',null).order('platform_fee',{ascending:false}).limit(10)
    if (from) { commQ=commQ.gte('created_at',from); feeQ=feeQ.gte('created_at',from); jobQ=jobQ.gte('completed_at',from) }
    const [{ data:comms },{ data:fees },{ data:jobs }] = await Promise.all([commQ, feeQ, jobQ])
    const commissions = comms?.reduce((s,r)=>s+r.amount,0)||0
    const biddingFees = fees?.reduce((s,r)=>s+r.amount,0)||0
    setStats({ commissions, biddingFees, total:commissions+biddingFees, jobsCompleted:jobs?.length||0 })
    if (jobs) setTopJobs(jobs)
    const grouped: Record<string,number> = {}
    comms?.forEach(r => { const d=r.created_at.split('T')[0]; grouped[d]=(grouped[d]||0)+r.amount })
    const sorted = Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0])).slice(-14)
    setDailyRevenue(sorted.map(([date,amount])=>({date,amount})))
    setLoading(false)
  }, [period, getFromDate])

  useEffect(() => { fetchRevenue() }, [fetchRevenue])

  const maxBar = Math.max(...dailyRevenue.map(d=>d.amount), 1)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform earnings breakdown</p>
        </div>
        <button onClick={fetchRevenue} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <IoRefresh size={16}/> Refresh
        </button>
      </div>

      <div className="flex gap-2">
        {([{k:'7d',l:'7 Days'},{k:'30d',l:'30 Days'},{k:'all',l:'All Time'}] as const).map(p => (
          <button key={p.k} onClick={() => setPeriod(p.k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period===p.k ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {p.l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              {label:'Total Revenue', value:`₨${stats.total.toLocaleString()}`, icon:IoTrendingUp, color:'text-primary', bg:'bg-green-50'},
              {label:'Commissions (10%)', value:`₨${stats.commissions.toLocaleString()}`, icon:IoCash, color:'text-teal-600', bg:'bg-teal-50'},
              {label:'Bidding Fees (₨20)', value:`₨${stats.biddingFees.toLocaleString()}`, icon:IoPricetag, color:'text-blue-600', bg:'bg-blue-50'},
              {label:'Jobs Completed', value:stats.jobsCompleted, icon:IoTrendingUp, color:'text-purple-600', bg:'bg-purple-50'},
            ].map((s,i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                  <s.icon className={`text-lg ${s.color}`}/>
                </div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {dailyRevenue.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Daily Commission Revenue</h2>
              <div className="flex items-end gap-1.5 h-36">
                {dailyRevenue.map((d,i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-gray-400" style={{fontSize:'9px'}}>
                      {d.amount>=1000?`${(d.amount/1000).toFixed(1)}k`:d.amount}
                    </span>
                    <div className="w-full bg-primary rounded-t transition-all"
                      style={{height:`${Math.max((d.amount/maxBar)*110,4)}px`}}/>
                    <span className="text-gray-400" style={{fontSize:'9px'}}>{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topJobs.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Top Earning Jobs</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {topJobs.map(j => (
                  <div key={j.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate">{j.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{j.customer_name} → {j.worker_name}</p>
                    </div>
                    <div className="text-right ml-4 flex-shrink-0">
                      <p className="font-bold text-primary">₨{(j.platform_fee||0).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">of ₨{(j.work_cost_total||j.inspection_charges||0).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topJobs.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 py-12 text-center text-gray-400 text-sm">
              No completed jobs in this period yet
            </div>
          )}
        </>
      )}
    </div>
  )
}
