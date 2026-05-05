import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoChatbubble } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job } from '../../types'

interface LastMessage {
  job_id: string
  text: string
  created_at: string
  is_customer: boolean
}

interface ConvJob extends Job {
  lastMessage?: LastMessage
  unreadCount: number
}

export default function WorkerMessages() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [convs, setConvs] = useState<ConvJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const { data: jobsData } = await supabase
        .from('jobs')
        .select(
          'id, title, status, customer_name, customer_id, customer_photo, worker_id, updated_at'
        )
        .eq('worker_id', user.id)
        .order('updated_at', { ascending: false })

      if (!jobsData || jobsData.length === 0) {
        setLoading(false)
        return
      }

      const jobIds = jobsData.map(j => j.id)

      const { data: allMsgs } = await supabase
        .from('messages')
        .select('job_id, text, created_at, is_customer')
        .in('job_id', jobIds)
        .order('created_at', { ascending: false })

      const { data: unreadMsgs } = await supabase
        .from('messages')
        .select('job_id')
        .in('job_id', jobIds)
        .eq('read', false)
        .eq('is_customer', true)

      const lastMsgMap: Record<string, LastMessage> = {}
      allMsgs?.forEach(m => {
        if (!lastMsgMap[m.job_id]) lastMsgMap[m.job_id] = m as LastMessage
      })

      const unreadMap: Record<string, number> = {}
      unreadMsgs?.forEach(m => {
        unreadMap[m.job_id] = (unreadMap[m.job_id] || 0) + 1
      })

      const result: ConvJob[] = jobsData
        .filter(j => lastMsgMap[j.id])
        .map(j => ({
          ...(j as unknown as Job),
          lastMessage: lastMsgMap[j.id],
          unreadCount: unreadMap[j.id] || 0,
        }))

      setConvs(result)
      setLoading(false)
    }
    load()
  }, [user])

  const timeAgo = (dt: string) => {
    const diff = Date.now() - new Date(dt).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }

  const statusColor = (s: string) => {
    if (s === 'completed') return 'bg-success/10 text-success'
    if (s === 'pending') return 'bg-warning/10 text-warning'
    return 'bg-primary/10 text-primary'
  }

  const statusLabel = (s: string) => {
    if (s === 'bidAccepted') return 'In Progress'
    if (s === 'inspectionDone') return 'Inspected'
    if (s === 'workCostProposed') return 'Cost Pending'
    if (s === 'workCostAccepted') return 'Approved'
    if (s === 'completed') return 'Done'
    return s
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center gap-3">
        <button onClick={() => nav(-1)}>
          <IoArrowBack size={22} className="text-white" />
        </button>
        <h1 className="text-lg font-semibold text-white">Messages</h1>
      </div>

      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-text-muted">
            Loading...
          </div>
        ) : convs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-3">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <IoChatbubble size={32} className="text-primary" />
            </div>
            <p className="text-sm font-medium text-text-primary">No conversations yet</p>
            <p className="text-xs text-text-muted text-center">
              Accept a job to start chatting with customers.
            </p>
          </div>
        ) : (
          convs.map(conv => (
            <button
              key={conv.id}
              onClick={() => nav(`/chat/${conv.id}`)}
              className="w-full card p-4 mb-3 flex items-center gap-3 text-left active:scale-[0.98] transition"
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center overflow-hidden">
                  {conv.customer_photo ? (
                    <img src={conv.customer_photo} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-primary">
                      {conv.customer_name?.[0] || 'C'}
                    </span>
                  )}
                </div>
                {conv.unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-[10px] text-white font-bold">
                      {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary truncate">{conv.title}</p>
                  {conv.lastMessage && (
                    <span className="text-[11px] text-text-muted shrink-0">
                      {timeAgo(conv.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary truncate mt-0.5">
                  {conv.customer_name}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p
                    className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-text-primary font-medium' : 'text-text-muted'}`}
                  >
                    {conv.lastMessage
                      ? `${!conv.lastMessage.is_customer ? 'You: ' : ''}${conv.lastMessage.text}`
                      : 'No messages yet'}
                  </p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-2 ${statusColor(conv.status)}`}
                  >
                    {statusLabel(conv.status)}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
