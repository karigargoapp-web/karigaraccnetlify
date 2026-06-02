import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoShareSocial, IoHome, IoCard, IoDownload, IoStar, IoCheckmarkCircle } from 'react-icons/io5'
import { jsPDF } from 'jspdf'
import { supabase } from '../../lib/supabase'
import type { Job, Review } from '../../types'

export default function CustomerReceipt() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [customerReview, setCustomerReview] = useState<Review | null>(null)

  useEffect(() => {
    if (!jobId) return
    Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('reviews').select('*').eq('job_id', jobId).eq('direction', 'customer_to_worker').maybeSingle(),
    ]).then(([jobRes, reviewRes]) => {
      if (jobRes.data) setJob(jobRes.data as Job)
      if (reviewRes.data) setCustomerReview(reviewRes.data as Review)
    })
  }, [jobId])

  if (!job) return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-sm text-text-muted">Loading...</div>

  const inspectionFee = job.inspection_charges || 0
  const workCost = job.work_cost || 0
  const total = inspectionFee + workCost
  const platformFee = job.platform_fee || Math.round(total * 0.1)
  const workerReceives = total - platformFee

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const margin = 20
    const contentW = pageW - margin * 2
    let y = 20

    doc.setFillColor(34, 139, 87)
    doc.rect(0, 0, pageW, 38, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('KarigarGo', margin, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Payment Receipt', margin, 24)
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 31)
    y = 50

    doc.setTextColor(100, 100, 100)
    doc.setFontSize(8)
    doc.text(`Receipt ID: ${job.id}`, margin, y)
    y += 10

    const drawSection = (title: string) => {
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y, contentW, 8, 'F')
      doc.setTextColor(34, 139, 87)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(title, margin + 3, y + 5.5)
      y += 12
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(50, 50, 50)
    }

    const drawRow = (label: string, value: string, bold = false) => {
      doc.setFontSize(9)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(label, margin + 2, y)
      doc.setTextColor(30, 30, 30)
      doc.text(value, pageW - margin - 2, y, { align: 'right' })
      y += 7
    }

    const drawDivider = () => {
      doc.setDrawColor(220, 220, 220)
      doc.line(margin, y, pageW - margin, y)
      y += 5
    }

    drawSection('Job Details')
    drawRow('Service', job.title)
    drawRow('Category', job.category)
    drawRow('Worker', job.worker_name || '—')
    drawRow('Date', new Date(job.completed_at || job.updated_at).toLocaleDateString())
    drawRow('Location', job.location)
    y += 3

    drawSection('Payment Breakdown')
    drawRow('Inspection Charges', `PKR ${inspectionFee.toLocaleString()}`)
    if (workCost > 0) drawRow('Work Cost', `PKR ${workCost.toLocaleString()}`)
    drawDivider()
    drawRow('Customer Paid', `PKR ${total.toLocaleString()}`, true)
    drawRow('Platform Commission (10%)', `- PKR ${platformFee.toLocaleString()}`)
    drawRow('Worker Receives', `PKR ${workerReceives.toLocaleString()}`, true)
    y += 3
    drawRow('Payment Method', 'KarigarGo Wallet')
    y += 10

    doc.setDrawColor(200, 200, 200)
    doc.line(margin, y, pageW - margin, y)
    y += 6
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(8)
    doc.text('Thank you for using KarigarGo. This is a computer-generated receipt.', pageW / 2, y, { align: 'center' })
    doc.save(`KarigarGo_Receipt_${job.id.slice(0, 8)}.pdf`)
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: `KarigarGo Receipt — ${job.title}`, text: `Job: ${job.title}\nTotal: PKR ${total}` })
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => nav(-1)}><IoArrowBack size={24} className="text-white" /></button>
          <h1 className="text-white text-xl font-medium">Payment Receipt</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">

        {/* Success banner */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
          <IoCheckmarkCircle size={28} className="text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Job Completed!</p>
            <p className="text-xs text-green-700">Payment has been processed from your wallet.</p>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-base font-semibold text-text-primary mb-4">Payment Summary</p>

          <div className="space-y-2.5 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Worker</span>
              <span className="text-text-primary font-medium">{job.worker_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Service</span>
              <span className="text-text-primary font-medium text-right max-w-[60%]">{job.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Date</span>
              <span className="text-text-primary">{new Date(job.completed_at || job.updated_at).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Inspection Charges</span>
              <span className="text-text-primary">₨{inspectionFee.toLocaleString()}</span>
            </div>
            {workCost > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Work Cost</span>
                <span className="text-text-primary">₨{workCost.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold border-t border-border pt-2.5">
              <span>Customer Paid</span>
              <span className="text-primary text-base">₨{total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-red-500">
              <span>Platform Commission (10%)</span>
              <span>− ₨{platformFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-text-secondary">Worker Receives</span>
              <span className="text-green-600">₨{workerReceives.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <IoCard size={20} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">KarigarGo Wallet</p>
            <p className="text-xs text-text-muted">Paid from wallet balance</p>
          </div>
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">✓</span>
          </div>
        </div>

        {/* CTAs */}
        {!customerReview && (
          <button
            onClick={() => nav(`/customer/review/${jobId}`)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-2xl text-sm font-semibold shadow-sm"
          >
            <IoStar size={16} /> Rate Worker
          </button>
        )}
        {customerReview && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-medium text-green-800">⭐ You've already rated this worker</p>
          </div>
        )}

        <button onClick={handleDownloadPdf} className="w-full flex items-center justify-center gap-2 border border-border bg-white text-text-primary py-3.5 rounded-2xl text-sm font-medium shadow-sm">
          <IoDownload size={16} /> Download Receipt
        </button>
        <button onClick={handleShare} className="w-full flex items-center justify-center gap-2 border border-border bg-white text-text-primary py-3.5 rounded-2xl text-sm font-medium shadow-sm">
          <IoShareSocial size={16} /> Share Receipt
        </button>
        <button onClick={() => nav('/customer/home')} className="w-full flex items-center justify-center gap-2 border border-border bg-white text-text-secondary py-3.5 rounded-2xl text-sm font-medium shadow-sm">
          <IoHome size={16} /> Back to Home
        </button>
      </div>
    </div>
  )
}
