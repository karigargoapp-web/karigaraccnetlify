import { IoWarning } from 'react-icons/io5'
import type { Dispute } from '../types'

export default function DisputeBanner({ dispute }: { dispute: Dispute | null }) {
  const isCancellation = dispute?.type === 'cancellation'
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <IoWarning size={18} className="text-red-500" />
        <p className="text-sm font-semibold text-red-800">
          {isCancellation ? 'Cancellation Request Pending' : 'Dispute In Progress'}
        </p>
      </div>
      <p className="text-xs text-red-700">
        {isCancellation
          ? 'This job is paused and funds are held in escrow while our team reviews the cancellation request.'
          : 'This job is paused and funds are held in escrow while our team reviews the dispute.'}
      </p>
      {dispute?.reason && (
        <div className="mt-2 p-3 bg-white/60 rounded-lg">
          <p className="text-xs font-medium text-red-600 mb-1">Reason:</p>
          <p className="text-sm text-red-800">{dispute.reason}</p>
        </div>
      )}
    </div>
  )
}
