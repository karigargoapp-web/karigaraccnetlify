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

  const faqs: FAQ[] = [
    {
      question: 'How do I post a job?',
      answer: 'Click the "Post a Job" button on your dashboard, fill in the job details including title, description, budget, and preferred date. Workers will start bidding on your job.',
    },
    {
      question: 'How does the bidding process work?',
      answer: 'Once you post a job, nearby workers will submit their bids with their proposed price and timeline. You can review their profiles, ratings, and choose the best worker for your job.',
    },
    {
      question: 'What payment methods are accepted?',
      answer: 'Currently, we support cash payment to workers upon job completion. Online payment methods are coming soon.',
    },
    {
      question: 'How can I track my job?',
      answer: 'Once you accept a bid, you can track the worker\'s location in real-time and receive updates about job progress.',
    },
    {
      question: 'What if I\'m not satisfied with the work?',
      answer: 'You can rate and review the worker after job completion. If you face any issues, contact our support team immediately.',
    },
    {
      question: 'How do I become a verified worker?',
      answer: 'Upload your CNIC and skill certificates in your profile. Our team will verify your documents within 24-48 hours.',
    },
  ]

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
          <p className="text-sm text-text-muted text-center">We'll get back to you within 24 hours</p>
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
              <h2 className="text-lg font-medium text-text-primary mb-4">Frequently Asked Questions</h2>

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
