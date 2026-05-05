import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoLocation, IoCalendar, IoPerson, IoStar, IoDownload, IoCash, IoCheckmarkCircle } from 'react-icons/io5'
import { jsPDF } from 'jspdf'
import { supabase } from '../../lib/supabase'
import type { Job, Review } from '../../types'

export default function CustomerJobSummary() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [workerReview, setWorkerReview] = useState<Review | null>(null)
  const [customerReview, setCustomerReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!jobId) return
    Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).maybeSingle(),
      supabase.from('reviews').select('*').eq('job_id', jobId).eq('direction', 'customer_to_worker').maybeSingle(),
      supabase.from('reviews').select('*').eq('job_id', jobId).eq('direction', 'worker_to_customer').maybeSingle(),
    ]).then(([jobRes, customerReviewRes, workerReviewRes]) => {
      console.log('[CustomerJobSummary] jobRes:', jobRes)
      console.log('[CustomerJobSummary] customerReviewRes:', customerReviewRes)
      console.log('[CustomerJobSummary] workerReviewRes:', workerReviewRes)
      if (jobRes.data) setJob(jobRes.data as Job)
      const hasCustomerReview = customerReviewRes.data && Object.keys(customerReviewRes.data).length > 0
      const hasWorkerReview = workerReviewRes.data && Object.keys(workerReviewRes.data).length > 0
      console.log('[CustomerJobSummary] hasCustomerReview:', hasCustomerReview)
      console.log('[CustomerJobSummary] hasWorkerReview:', hasWorkerReview)
      setCustomerReview(hasCustomerReview ? (customerReviewRes.data as Review) : null)
      setWorkerReview(hasWorkerReview ? (workerReviewRes.data as Review) : null)
      setLoading(false)
    })
  }, [jobId])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-text-muted">Loading...</div>
  if (!job) return <div className="min-h-screen flex items-center justify-center text-sm text-text-muted">Job not found</div>

  const inspectionFee = job.inspection_charges || 0
  const workCost = job.work_cost || 0
  const total = inspectionFee + workCost
  const platformFee = job.platform_fee || Math.round(total * 0.1)
  const grandTotal = total + platformFee

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentW = pageW - margin * 2
    let y = 20

    // Header bar
    doc.setFillColor(34, 139, 87)
    doc.rect(0, 0, pageW, 38, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('KarigarGo', margin, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Job Receipt', margin, 24)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 31)
    y = 50

    const sec = (t: string) => {
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y, contentW, 8, 'F')
      doc.setTextColor(34, 139, 87)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(t, margin + 3, y + 5.5)
      y += 12
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(50, 50, 50)
    }
    const row = (l: string, v: string, bold = false) => {
      doc.setFontSize(9)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(l, margin + 2, y)
      doc.setTextColor(30, 30, 30)
      doc.text(v, pageW - margin - 2, y, { align: 'right' })
      y += 7
    }

    sec('Job Details')
    row('Service', job.title)
    row('Worker', job.worker_name || '—')
    row('Location', job.location)
    row('Category', job.category)
    row('Completed', new Date(job.completed_at || job.updated_at).toLocaleDateString())
    y += 3

    sec('Payment Breakdown')
    row('Inspection Charges', `PKR ${inspectionFee.toLocaleString()}`)
    if (workCost > 0) row('Work Cost', `PKR ${workCost.toLocaleString()}`)
    row('Subtotal', `PKR ${total.toLocaleString()}`)
    row('Platform Fee (10%)', `PKR ${platformFee.toLocaleString()}`)
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y, pageW - margin, y)
    y += 5
    row('Total Amount', `PKR ${grandTotal.toLocaleString()}`, true)
    y += 8

    if (customerReview) {
      sec('Your Review')
      row('Rating', `${customerReview.rating} / 5`)
      if (customerReview.comment) {
        doc.setFontSize(9)
        doc.setTextColor(60, 60, 60)
        const lines = doc.splitTextToSize(`"${customerReview.comment}"`, contentW - 4)
        doc.text(lines, margin + 2, y)
        y += lines.length * 6 + 4
      }
    }

    if (workerReview) {
      sec('Worker Review')
      row('Rating', `${workerReview.rating} / 5`)
      if (workerReview.comment) {
        doc.setFontSize(9)
        doc.setTextColor(60, 60, 60)
        const lines = doc.splitTextToSize(`"${workerReview.comment}"`, contentW - 4)
        doc.text(lines, margin + 2, y)
        y += lines.length * 6 + 4
      }
    }

    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageW - margin, y)
    y += 6
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.text('KarigarGo — Thank you for using our service!', pageW / 2, y, { align: 'center' })
    doc.save(`KarigarGo_Receipt_${job.id.slice(0, 8)}.pdf`)
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)}><IoArrowBack size={22} className="text-white" /></button>
          <div>
            <h1 className="text-lg font-semibold text-white">Job Summary</h1>
            <p className="text-white/70 text-sm">{job.title}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Completion Status */}
        <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-100 rounded-2xl py-3">
          <IoCheckmarkCircle className="text-green-600" size={20} />
          <p className="text-sm font-semibold text-green-700">Job Completed</p>
          <p className="text-xs text-green-500">{new Date(job.completed_at || job.updated_at).toLocaleDateString()}</p>
        </div>

        {/* Job Details */}
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold text-text-primary mb-1">Job Details</p>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <IoPerson size={13} className="text-primary shrink-0" />
            <span>Worker: <span className="font-medium text-text-primary">{job.worker_name || '—'}</span></span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <IoLocation size={13} className="text-primary shrink-0" />
            <span>{job.location}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <IoCalendar size={13} className="text-primary shrink-0" />
            <span>{job.category}</span>
          </div>
          {job.description && (
            <p className="text-xs text-text-secondary leading-relaxed pt-1">{job.description}</p>
          )}
        </div>

        {/* Payment Breakdown */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-text-primary mb-3">Payment Breakdown</p>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">Inspection Charges</span>
              <span className="font-medium">PKR {inspectionFee.toLocaleString()}</span>
            </div>
            {workCost > 0 && (
              <div className="flex justify-between">
                <span className="text-text-muted">Work Cost</span>
                <span className="font-medium">PKR {workCost.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-text-muted">Platform Fee (10%)</span>
              <span className="font-medium text-red-500">PKR {platformFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-semibold text-text-primary">Total Amount</span>
              <span className="font-bold text-primary text-sm">PKR {grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Your Review (if submitted) */}
        {customerReview && (
          <div className="card p-4">
            <p className="text-sm font-semibold text-text-primary mb-2">Your Review</p>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <IoStar key={i} size={14} className={i <= customerReview.rating ? 'text-yellow-400' : 'text-gray-200'} />
              ))}
              <span className="text-xs text-text-muted ml-1">{customerReview.rating}/5</span>
            </div>
            {customerReview.comment && (
              <p className="text-xs text-text-secondary italic">"{customerReview.comment}"</p>
            )}
          </div>
        )}

        {/* Worker Review (if submitted) */}
        {workerReview && (
          <div className="card p-4 bg-blue-50 border-blue-100">
            <p className="text-sm font-semibold text-text-primary mb-2">Worker's Review of You</p>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <IoStar key={i} size={14} className={i <= workerReview.rating ? 'text-yellow-400' : 'text-gray-200'} />
              ))}
              <span className="text-xs text-text-muted ml-1">{workerReview.rating}/5</span>
            </div>
            {workerReview.comment && (
              <p className="text-xs text-text-secondary italic">"{workerReview.comment}"</p>
            )}
          </div>
        )}

        {/* Rate Worker Button - Always show unless review exists */}
        {!customerReview && !loading && (
          <button
            onClick={() => nav(`/customer/review/${jobId}`)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-2xl text-sm font-medium shadow-sm animate-pulse"
          >
            <IoStar size={16} /> Rate Worker
          </button>
        )}
        {customerReview && (
          <div className="card p-4 bg-green-50 border-green-200">
            <p className="text-sm text-green-700 text-center">✅ You have rated this worker</p>
          </div>
        )}

        {/* Download Receipt */}
        <button
          onClick={handleDownloadPdf}
          className="w-full flex items-center justify-center gap-2 border border-border bg-white text-text-primary py-3.5 rounded-2xl text-sm font-medium shadow-sm"
        >
          <IoDownload size={16} /> Download Receipt
        </button>
      </div>
    </div>
  )
}
