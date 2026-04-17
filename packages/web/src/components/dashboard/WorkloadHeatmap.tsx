import { cn } from '@/lib/utils'
import type { TeamDashboard } from '@/api/dashboard'

interface WorkloadHeatmapProps {
  heatmap: TeamDashboard['heatmap']
}

function getCellColor(count: number): string {
  if (count === 0) return 'bg-gray-100'
  if (count <= 2) return 'bg-emerald-200'
  if (count <= 5) return 'bg-emerald-400'
  if (count <= 10) return 'bg-emerald-600 text-white'
  return 'bg-emerald-800 text-white'
}

export default function WorkloadHeatmap({ heatmap }: WorkloadHeatmapProps) {
  const { projects, rows } = heatmap

  if (projects.length === 0) return null

  // Filter out rows where all cells are 0
  const activeRows = rows.filter((r) => r.cells.some((c) => c.activeCount > 0))

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Workload Heatmap</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white pb-2 pr-4 text-left font-medium text-gray-500">Member</th>
              {projects.map((p) => (
                <th key={p.id} className="pb-2 px-1 text-center font-medium text-gray-500 whitespace-nowrap">
                  {p.key}
                </th>
              ))}
              <th className="pb-2 px-2 text-center font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => {
              const total = row.cells.reduce((s, c) => s + c.activeCount, 0)
              return (
                <tr key={row.userId} className="border-t border-gray-100">
                  <td className="sticky left-0 z-10 bg-white py-1.5 pr-4 font-medium text-gray-700 whitespace-nowrap">
                    {row.userName}
                  </td>
                  {row.cells.map((cell) => (
                    <td key={cell.projectId} className="px-1 py-1.5 text-center">
                      {cell.activeCount > 0 ? (
                        <span className={cn('inline-block min-w-[28px] rounded px-1.5 py-0.5 text-[10px] font-semibold', getCellColor(cell.activeCount))}>
                          {cell.activeCount}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-semibold text-gray-700">{total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* Legend */}
      <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-500">
        <span>Less</span>
        {[0, 2, 5, 10, 15].map((n) => (
          <span key={n} className={cn('inline-block h-3 w-3 rounded-sm', getCellColor(n))} />
        ))}
        <span>More</span>
      </div>
    </div>
  )
}
