import { useMemo } from 'react'
import type { BurndownPoint } from '@/features/dashboard/api'

interface BurndownChartProps {
  data: BurndownPoint[]
}

export default function BurndownChart({ data }: BurndownChartProps) {
  const chart = useMemo(() => {
    if (data.length === 0) return null

    const counts = data.map((d) => d.openCount)
    const maxCount = Math.max(...counts, 1)
    const minCount = Math.min(...counts)

    // SVG dimensions
    const width = 600
    const height = 200
    const padLeft = 45
    const padRight = 10
    const padTop = 15
    const padBottom = 30
    const chartW = width - padLeft - padRight
    const chartH = height - padTop - padBottom

    // Scale
    const yMin = Math.max(0, minCount - 1)
    const yMax = maxCount + 1
    const yRange = yMax - yMin || 1

    const points = data.map((d, i) => {
      const x = padLeft + (i / Math.max(data.length - 1, 1)) * chartW
      const y = padTop + chartH - ((d.openCount - yMin) / yRange) * chartH
      return { x, y, date: d.date, count: d.openCount }
    })

    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ')

    // Fill area under line
    const areaPoints = [
      `${points[0].x},${padTop + chartH}`,
      ...points.map((p) => `${p.x},${p.y}`),
      `${points[points.length - 1].x},${padTop + chartH}`,
    ].join(' ')

    // Y-axis ticks (5 ticks)
    const yTicks = Array.from({ length: 5 }, (_, i) => {
      const val = yMin + (yRange * i) / 4
      const y = padTop + chartH - (((val - yMin) / yRange) * chartH)
      return { val: Math.round(val), y }
    })

    // X-axis labels (show ~6 labels)
    const step = Math.max(1, Math.floor(data.length / 6))
    const xLabels = data
      .filter((_, i) => i % step === 0 || i === data.length - 1)
      .map((d, _, arr) => {
        const idx = data.indexOf(d)
        const x = padLeft + (idx / Math.max(data.length - 1, 1)) * chartW
        const label = d.date.slice(5) // MM-DD
        return { x, label }
      })

    return { width, height, padLeft, padTop, padBottom, chartW, chartH, polylinePoints, areaPoints, points, yTicks, xLabels }
  }, [data])

  if (!chart || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No burndown data available
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {chart.yTicks.map((tick, i) => (
          <line
            key={i}
            x1={chart.padLeft}
            y1={tick.y}
            x2={chart.padLeft + chart.chartW}
            y2={tick.y}
            className="stroke-gray-100 dark:stroke-gray-700"
            stroke="currentColor"
            strokeWidth={1}
          />
        ))}

        {/* Area fill */}
        <polygon points={chart.areaPoints} fill="url(#burndownGradient)" />
        <defs>
          <linearGradient id="burndownGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Line */}
        <polyline
          points={chart.polylinePoints}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {chart.points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#3b82f6">
            <title>{`${p.date}: ${p.count} open`}</title>
          </circle>
        ))}

        {/* Y-axis labels */}
        {chart.yTicks.map((tick, i) => (
          <text
            key={i}
            x={chart.padLeft - 8}
            y={tick.y + 4}
            textAnchor="end"
            className="fill-gray-400 dark:fill-gray-500"
            fontSize={10}
          >
            {tick.val}
          </text>
        ))}

        {/* X-axis labels */}
        {chart.xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={chart.height - 5}
            textAnchor="middle"
            className="fill-gray-400 dark:fill-gray-500"
            fontSize={10}
          >
            {label.label}
          </text>
        ))}

        {/* Axes */}
        <line
          x1={chart.padLeft}
          y1={chart.padTop}
          x2={chart.padLeft}
          y2={chart.padTop + chart.chartH}
          className="stroke-gray-200 dark:stroke-gray-600"
          stroke="currentColor"
          strokeWidth={1}
        />
        <line
          x1={chart.padLeft}
          y1={chart.padTop + chart.chartH}
          x2={chart.padLeft + chart.chartW}
          y2={chart.padTop + chart.chartH}
          className="stroke-gray-200 dark:stroke-gray-600"
          stroke="currentColor"
          strokeWidth={1}
        />
      </svg>
    </div>
  )
}
