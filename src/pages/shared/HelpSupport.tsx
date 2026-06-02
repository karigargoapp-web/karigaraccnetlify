import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoArrowBack, IoMail, IoCall, IoChatbubbleEllipses, IoChevronDown, IoChevronUp, IoClose, IoCheckmarkCircle } from 'react-icons/io5'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

interface FAQ {
  question: string
  answer: string
}

export default function HelpSupport() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [showContactForm, setShowContactForm] = useState(false)
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  const customerFaqs: FAQ[] = [
    { question: "How do I post a job?", answer: "Tap Post a Job on your dashboard. Add a title, describe the problem, record a voice note, and upload at least one photo. Workers in your city will start bidding shortly." },
    { question: "How does the bidding process work?", answer: "Workers bid their inspection charge only (maximum Rs500). This covers visiting, assessing, and diagnosing the problem. The actual work cost is agreed after on-site inspection." },
    { question: "What is inspection-first pricing?", answer: "When you accept a bid, the inspection fee is locked in escrow. The worker visits and inspects, then proposes a work cost. You decide whether to proceed or end at inspection. You are always in control." },
    { question: "What do I pay and when?", answer: "Step 1: Accept a bid, inspection fee locked from your wallet (e.g. Rs300). Step 2: Worker proposes work cost (e.g. Rs2,000). Step 3: You accept, Rs2,000 locked. Step 4: Work done, you mark complete, worker gets paid. You never pay more than what you approve." },
    { question: "Are there any hidden charges?", answer: "No. You only pay the inspection fee and the work cost you approved. Platform fees are deducted from the worker side. You are never charged extra." },
    { question: "What are Reward Points and how do I use them?", answer: "You earn 2% of the total job value as reward points on every completed job. A Rs2,000 job earns Rs40 in reward points. You can apply them as a discount on future inspection fees or total job cost. If your job costs Rs200 and you apply Rs10 in reward points, you pay Rs190. The remaining Rs10 is covered by KarigarGo." },
    { question: "Can I cancel a job?", answer: "Yes. You can cancel any job that has not started work yet (before In Progress). If you cancel after accepting a bid, the locked inspection fee is fully refunded to your wallet. Go to the job page and tap Cancel Job." },
    { question: "What if I am not satisfied with the work?", answer: "Do not mark the job as complete if you are not satisfied. Raise a dispute from the active job screen. Our support team will review and resolve it fairly." },
    { question: "How do I track the worker?", answer: "Once a bid is accepted, the worker live location is shared automatically. You can see them on the map in real-time from your active job screen." },
    { question: "What payment methods are supported?", answer: "Payments are wallet-based. Top up your KarigarGo wallet and all transactions happen within the app. JazzCash and EasyPaisa top-up integrations are coming soon." },
  ]

  const workerFaqs: FAQ[] = [
    { question: "How do I start getting jobs?", answer: "After your account is approved by admin, open your dashboard. You will see pending jobs in your city. Tap a job to view details and place your bid. Make sure your wallet has at least Rs20." },
    { question: "What is the bidding fee?", answer: "A Rs20 bidding fee is charged when the customer accepts your work cost and the job officially starts. It is NOT charged when you place a bid, only when the customer approves your proposed work cost." },
    { question: "What is the Rs100 signup bonus?", answer: "Every new worker receives Rs100 in their wallet on signup. This covers your first 5 bidding fees (Rs20 each), so you can start bidding immediately without topping up." },
    { question: "What is the inspection charge?", answer: "When bidding, you set your inspection charge for visiting the customer and assessing the job. Maximum is Rs500. This amount is paid by the customer when they accept your bid." },
    { question: "How does the work cost work?", answer: "After inspection, the customer may ask you to proceed. You propose a total work cost. If they approve, Rs20 bidding fee is deducted from your wallet and the job starts. If they decline, the job ends and you keep the inspection fee." },
    { question: "What does KarigarGo charge as commission?", answer: "KarigarGo deducts a 10% platform commission from your earnings on job completion. The customer never sees this charge. If the work cost is Rs2,000, you receive Rs1,800 and Rs200 goes to the platform." },
    { question: "What are Reward Points and how do I use them?", answer: "You earn 2% of the total job value as reward points on every completed job. A Rs2,000 job earns Rs40 in reward points. You can apply them as a discount on your bidding fee. If your bidding fee is Rs20 and you apply Rs10 in reward points, you pay Rs10. The remaining Rs10 is covered by KarigarGo." },
    { question: "Full payment example", answer: "Customer approves Rs2,000 work cost. You pay Rs20 bidding fee. On completion, 10% commission (Rs200) is deducted. You receive Rs1,800. You also earn Rs40 reward points (2% of Rs2,000). Inspection fee (e.g. Rs300) is fully yours on top of this." },
    { question: "When do I get paid?", answer: "Payment is released to your wallet immediately when the customer marks the job as complete. Withdraw via JazzCash or EasyPaisa from the Wallet screen." },
    { question: "What if the customer raises a dispute?", answer: "The job will be paused and our admin team will review. They may resolve by continuing the job, issuing partial payment, or cancelling. Always use in-app chat to communicate clearly and avoid disputes." },
    { question: "Why was my account not approved?", answer: "Your account may be rejected if CNIC images are unclear or documents are missing. Check the rejection reason in the app and contact support to resubmit." },
    { question: "Is my location always shared?", answer: "Your live location is shared with the customer automatically from when a bid is accepted until the job is completed. This helps the customer track your arrival and builds trust." },
  ]

    const faqs = user?.role === 'worker' ? workerFaqs : customerFaqs

  const handleSubmit = () => {
    setShowConfirmation(true)
    setTimeout(() => {
      setShowContactForm(false)
      setMessage('')
      setSubject('')
      setShowConfirmation(false)
    }, 2000)
  }

  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-6">
        <div className="flex flex-col items-center animate-fade-in">
          <div className="w-24 h-24 rounded-full bg-[#e8f5e9] flex items-center justify-center mb-6">
            <IoCheckmarkCircle size={48} className="text-primary" />
          </div>
          <h2 className="text-xl font-medium text-text-primary mb-2">Message Sent!</h2>
          <p className="text-sm text-text-muted text-center">We\'ll get back to you within 24 hours</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Header */}
      <div className="bg-primary px-6 pt-10 pb-6 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => nav(user?.role === 'customer' ? '/customer/profile' : '/worker/profile')}>
            <IoArrowBack size={24} className="text-white" />
          </button>
          <h1 className="text-white text-xl font-medium">Help & Support</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-6 overflow-y-auto pb-8">
        {!showContactForm ? (
          <>
            {/* Contact Options */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-medium text-text-primary mb-4">Contact Us</h2>

              <div className="space-y-3">
                {/* Email */}
                <div className="flex items-center gap-3 p-3 bg-surface rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#e8f5e9] flex items-center justify-center">
                    <IoMail size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Email</p>
                    <p className="text-sm font-medium text-primary">support@karigargo.pk</p>
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3 p-3 bg-surface rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#e3f2fd] flex items-center justify-center">
                    <IoCall size={20} className="text-[#1976d2]" />
                  </div>
                  <div>
                    <p className="text-xs text-text-muted">Phone</p>
                    <p className="text-sm font-medium text-primary">0300-1234567</p>
                  </div>
                </div>

                {/* Message Support */}
                <button
                  onClick={() => setShowContactForm(true)}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-xl mt-2"
                >
                  <IoChatbubbleEllipses size={20} />
                  <span className="font-medium">Send Message</span>
                </button>
              </div>
            </div>

            {/* FAQs */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-lg font-medium text-text-primary mb-1">Frequently Asked Questions</h2>
              <p className="text-xs text-text-muted mb-4">{user?.role === 'worker' ? 'Worker guide — charges, payments & rewards' : 'Customer guide — how KarigarGo works'}</p>

              <div className="space-y-2">
                {faqs.map((faq, index) => (
                  <div key={index} className="border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                      className="w-full flex items-center justify-between p-4 bg-surface text-left"
                    >
                      <span className="text-sm font-medium text-text-primary flex-1 pr-2">{faq.question}</span>
                      {expandedFaq === index ? (
                        <IoChevronUp size={20} className="text-text-muted shrink-0" />
                      ) : (
                        <IoChevronDown size={20} className="text-text-muted shrink-0" />
                      )}
                    </button>
                    {expandedFaq === index && (
                      <div className="p-4 bg-white border-t border-border">
                        <p className="text-sm text-text-secondary leading-relaxed">{faq.answer}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Working Hours */}
            <div className="bg-[#e3f2fd] rounded-2xl p-5">
              <h2 className="text-base font-medium text-[#1565c0] mb-2">Support Hours</h2>
              <p className="text-sm text-[#1976d2] leading-relaxed">
                Monday - Saturday: 9:00 AM - 6:00 PM<br />
                Sunday: 10:00 AM - 4:00 PM
              </p>
            </div>
          </>
        ) : (
          /* Contact Form */
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-text-primary">Contact Support</h2>
              <button onClick={() => setShowContactForm(false)}>
                <IoClose size={24} className="text-text-muted" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-primary block mb-2">Subject</label>
                <input
                  type="text"
                  placeholder="What do you need help with?"
                  value={subject}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^a-zA-Z\s.,!?'-]/g, '')
                    setSubject(cleaned)
                  }}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary block mb-2">Message</label>
                <textarea
                  placeholder="Describe your issue or question..."
                  value={message}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^a-zA-Z\s.,!?'-]/g, '')
                    setMessage(cleaned)
                  }}
                  rows={6}
                  className="w-full resize-none"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={!subject.trim() || !message.trim()}
                className="w-full bg-primary text-white py-3.5 rounded-xl font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Send Message
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
