import { useAuth } from '../../hooks/useAuth'
import { IoShieldCheckmark, IoTime, IoClose, IoLogOut } from 'react-icons/io5'

export default function PendingApproval() {
  const { user, signOut } = useAuth()

  const isRejected = user?.approval_status === 'rejected'

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isRejected ? 'bg-red-100' : 'bg-amber-100'}`}>
          {isRejected
            ? <IoClose className="text-red-500 text-4xl" />
            : <IoTime className="text-amber-500 text-4xl" />
          }
        </div>

        <h1 className="text-xl font-bold text-text-primary mb-2">
          {isRejected ? 'Account Not Approved' : 'Awaiting Admin Approval'}
        </h1>

        <p className="text-sm text-text-secondary mb-6 leading-relaxed">
          {isRejected
            ? `Your account was not approved. Reason: ${user?.rejection_reason || 'Please contact support.'}`
            : 'Your account is under review. Admin will verify your CNIC and profile details. You will be notified once approved.'
          }
        </p>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border mb-6 text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${user?.verified ? 'bg-green-100' : 'bg-gray-100'}`}>
              <IoShieldCheckmark className={user?.verified ? 'text-green-500' : 'text-gray-400'} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Email Verified</p>
              <p className="text-xs text-text-muted">{user?.verified ? 'Done' : 'Pending'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${user?.approval_status === 'approved' ? 'bg-green-100' : 'bg-amber-100'}`}>
              <IoTime className={user?.approval_status === 'approved' ? 'text-green-500' : 'text-amber-500'} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">Admin Approval</p>
              <p className="text-xs text-text-muted capitalize">{user?.approval_status}</p>
            </div>
          </div>
        </div>

        {!isRejected && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
            <p className="text-xs text-primary font-medium">What happens next?</p>
            <p className="text-xs text-text-secondary mt-1">Admin reviews your CNIC and profile. This usually takes a few hours. You'll receive a notification once approved.</p>
          </div>
        )}

        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 w-full border border-border bg-white text-text-secondary py-3 rounded-xl text-sm font-medium"
        >
          <IoLogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  )
}
