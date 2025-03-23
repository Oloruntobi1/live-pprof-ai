"use client"

import { useProfileInsights } from "./hooks/use-profile-insights"
import { GraphData } from "./charts/data-structure"
import { PprofType } from "./hooks/use-graph-data"
import clsx from "clsx"

type ProfileInsightsProps = {
  graphData: GraphData
  pprofType: PprofType
  className?: string
}

export const ProfileInsights = ({ graphData, pprofType, className }: ProfileInsightsProps) => {
  const { insights, topConsumers, summary } = useProfileInsights({ graphData, pprofType })

  return (
    <div className={clsx("space-y-4 p-4 rounded-lg bg-card", className)}>
      <h3 className="text-lg font-semibold">Profile Insights</h3>
      
      {/* Summary */}
      <div className="text-sm text-muted-foreground">{summary}</div>

      {/* Top Consumers */}
      {topConsumers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Top Consumers</h4>
          <div className="space-y-1">
            {topConsumers.map((consumer, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate">{consumer.name}</span>
                <span className="text-muted-foreground">{consumer.percentageOfTotal.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Alerts & Insights</h4>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={`p-2 rounded text-sm ${
                  insight.type === "critical"
                    ? "bg-destructive/10 text-destructive"
                    : insight.type === "warning"
                    ? "bg-warning/10 text-warning"
                    : "bg-info/10 text-info"
                }`}
              >
                {insight.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 