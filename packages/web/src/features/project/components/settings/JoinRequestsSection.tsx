import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { JoinRequest } from '@/features/project/api'
import SettingsSection from './SettingsSection'

interface JoinRequestsSectionProps {
  requests: JoinRequest[] | undefined
  /** When true, the section renders even with zero pending requests (e.g. deep-linked). */
  forceShow: boolean
  onApprove: (requestId: string) => void
  onReject: (requestId: string, reason?: string) => void
  isApproving: boolean
}

export default function JoinRequestsSection({ requests, forceShow, onApprove, onReject, isApproving }: JoinRequestsSectionProps) {
  const hasItems = !!(requests && requests.length > 0)
  if (!hasItems && !forceShow) return null

  return (
    <SettingsSection
      id="requests"
      title={
        <>
          Join Requests
          {hasItems && (
            <span className="ml-2 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
              {requests!.length}
            </span>
          )}
        </>
      }
    >
      {hasItems ? (
        <div className="space-y-2">
          {requests!.map((req) => (
            <JoinRequestRow
              key={req.id}
              request={req}
              isApproving={isApproving}
              onApprove={() => onApprove(req.id)}
              onReject={(reason) => onReject(req.id, reason)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500">No pending requests</p>
      )}
    </SettingsSection>
  )
}

function JoinRequestRow({
  request,
  isApproving,
  onApprove,
  onReject,
}: {
  request: JoinRequest
  isApproving: boolean
  onApprove: () => void
  onReject: (reason?: string) => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const submitReject = () => onReject(reason || undefined)

  return (
    <div className="flex items-start gap-3 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-700 overflow-hidden">
        {request.requester?.avatar
          ? <img src={request.requester.avatar} alt={request.requester.name} className="h-full w-full object-cover" />
          : request.requester?.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{request.requester?.name}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{request.requester?.email}</div>
        {request.message && (
          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300 italic">"{request.message}"</div>
        )}
        <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
          {new Date(request.createdAt).toLocaleDateString()}
        </div>
      </div>
      {rejecting ? (
        <div className="flex items-center gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-40 rounded border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs focus:outline-none"
            onKeyDown={(e) => e.key === 'Enter' && submitReject()}
          />
          <button onClick={submitReject} className="rounded bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600">
            Reject
          </button>
          <button onClick={() => { setRejecting(false); setReason('') }} className="text-xs text-gray-400 hover:text-gray-600">
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={onApprove}
            disabled={isApproving}
            className="rounded-lg bg-green-500 p-1.5 text-white hover:bg-green-600 disabled:opacity-50"
            title="Approve"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setRejecting(true)}
            className="rounded-lg bg-red-500 p-1.5 text-white hover:bg-red-600"
            title="Reject"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
