export type IssueDetailTab = 'details' | 'activity'

interface IssueDetailTabsProps {
  active: IssueDetailTab
  onChange: (tab: IssueDetailTab) => void
  detailsBadge?: number
  activityCount?: number
}

const TABS: IssueDetailTab[] = ['details', 'activity']

export default function IssueDetailTabs({ active, onChange, detailsBadge, activityCount }: IssueDetailTabsProps) {
  return (
    <div className="sticky top-0 z-10 flex gap-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 pt-4">
      {TABS.map((tab) => {
        const label =
          tab === 'details'
            ? `Details${detailsBadge ? ` · ${detailsBadge}` : ''}`
            : `Activity${activityCount !== undefined ? ` (${activityCount})` : ''}`
        const activeClass =
          active === tab
            ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        return (
          <button key={tab} onClick={() => onChange(tab)} className={`pb-2 text-sm font-medium capitalize transition-colors ${activeClass}`}>
            {label}
          </button>
        )
      })}
    </div>
  )
}
