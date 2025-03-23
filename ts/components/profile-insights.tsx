"use client"

import { FC, useEffect, useState } from 'react'
import { useProfileInsights } from "./hooks/use-profile-insights"
import { GraphData } from "./charts/data-structure"
import { PprofType } from "./hooks/use-graph-data"
import clsx from "clsx"
import { LLMService, LLMAnalysis } from '@/services/llm-service'
import { Button } from '@nextui-org/button'
import { Spinner } from '@nextui-org/spinner'

interface ProfileInsightsProps {
  graphData: GraphData
  pprofType: PprofType
  className?: string
}

export const ProfileInsights: FC<ProfileInsightsProps> = ({ graphData, pprofType, className }) => {
  const { insights, topConsumers, summary } = useProfileInsights({ graphData, pprofType })
  const [llmAnalysis, setLLMAnalysis] = useState<LLMAnalysis | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLLMAnalysis = async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const analysis = await LLMService.getInstance().analyzeProfile(graphData, pprofType)
      setLLMAnalysis(analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze profile')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className={clsx("space-y-4 p-4 rounded-lg bg-card", className)}>
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Profile Insights</h3>
        <Button
          size="sm"
          color="primary"
          onClick={handleLLMAnalysis}
          isLoading={isAnalyzing}
          isDisabled={isAnalyzing}
        >
          {isAnalyzing ? <Spinner size="sm" /> : "Analyze with AI"}
        </Button>
      </div>
      
      {/* Summary */}
      <div className="text-sm text-muted-foreground">
        {llmAnalysis?.summary || summary}
      </div>

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

      {/* AI Recommendations */}
      {llmAnalysis && llmAnalysis.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">AI Recommendations</h4>
          <div className="space-y-2">
            {llmAnalysis.recommendations.map((rec, i) => (
              <div key={i} className="p-2 rounded text-sm bg-primary/10 text-primary">
                {rec}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Suggestions */}
      {llmAnalysis && llmAnalysis.codeSuggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Code Suggestions</h4>
          <div className="space-y-2">
            {llmAnalysis.codeSuggestions.map((suggestion, i) => (
              <div key={i} className="p-2 rounded text-sm bg-secondary/10 text-secondary">
                {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {(insights.length > 0 || (llmAnalysis && llmAnalysis.insights.length > 0)) && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Alerts & Insights</h4>
          <div className="space-y-2">
            {[...insights, ...(llmAnalysis?.insights || [])].map((insight, i) => (
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

      {/* Error Message */}
      {error && (
        <div className="p-2 rounded text-sm bg-destructive/10 text-destructive">
          {error}
        </div>
      )}
    </div>
  )
} 