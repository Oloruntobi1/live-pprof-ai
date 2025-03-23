"use client"

import { useMemo } from "react"
import { GraphData } from "@/components/charts/data-structure"
import { PprofType } from "./use-graph-data"

export type Insight = {
  type: "info" | "warning" | "critical"
  message: string
  timestamp: number
  metric: string
  value?: number
}

export type ProfileInsights = {
  insights: Insight[]
  topConsumers: Array<{
    name: string
    value: number
    percentageOfTotal: number
  }>
  summary: string
}

const analyzeHeapData = (data: GraphData): ProfileInsights => {
  const insights: Insight[] = []
  const latest = data.dates[data.dates.length - 1]
  const latestData = Object.entries(data.lineTable).map(([_, line]) => ({
    name: line.name,
    value: line.points[line.points.length - 1]?.flat || 0
  }))

  // Calculate total heap size from all entries
  const totalHeapSize = latestData.reduce((sum, item) => sum + item.value, 0)
  
  // Get all entries except runtime internal functions
  const topConsumers = latestData
    .filter(item => !item.name.startsWith("runtime.") && item.name !== "total")
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map(item => ({
      name: item.name,
      value: item.value,
      percentageOfTotal: totalHeapSize ? (item.value / totalHeapSize) * 100 : 0
    }))

  // Basic memory growth detection
  if (data.dates.length > 1) {
    const firstTotal = Object.values(data.lineTable)
      .reduce((sum, line) => sum + (line.points[0]?.flat || 0), 0)
    const lastTotal = totalHeapSize
    const growthRate = firstTotal ? ((lastTotal - firstTotal) / firstTotal) * 100 : 0

    if (growthRate > 20) {
      insights.push({
        type: "warning",
        message: `Memory usage has grown by ${growthRate.toFixed(1)}% since monitoring began`,
        timestamp: latest.getTime(),
        metric: "heap_growth",
        value: growthRate
      })
    }
  }

  // Add total heap size insight
  if (totalHeapSize > 0) {
    const heapSizeMB = totalHeapSize / (1024 * 1024) // Convert to MB
    insights.push({
      type: "info",
      message: `Total heap size: ${heapSizeMB.toFixed(1)} MB`,
      timestamp: latest.getTime(),
      metric: "heap_size",
      value: heapSizeMB
    })
  }

  // Check for large allocations
  topConsumers.forEach(consumer => {
    if (consumer.percentageOfTotal > 10) { // Lowered threshold to catch more insights
      insights.push({
        type: "info",
        message: `${consumer.name} is using ${consumer.percentageOfTotal.toFixed(1)}% of heap space`,
        timestamp: latest.getTime(),
        metric: "heap_usage",
        value: consumer.value
      })
    }
  })

  return {
    insights,
    topConsumers,
    summary: `Analyzing ${data.dates.length} heap snapshots`
  }
}

const analyzeCPUData = (data: GraphData): ProfileInsights => {
  const insights: Insight[] = []
  const latest = data.dates[data.dates.length - 1]
  const latestData = Object.entries(data.lineTable).map(([_, line]) => ({
    name: line.name,
    value: line.points[line.points.length - 1]?.flat || 0
  }))

  // Calculate total CPU time from all entries
  const totalCPUTime = latestData.reduce((sum, item) => sum + item.value, 0)
  
  // Get all entries except internal functions, but include runtime functions that are part of user code
  const topConsumers = latestData
    .filter(item => {
      // Keep user-relevant runtime functions but filter out internal ones
      if (item.name === "total") return false
      if (item.name.startsWith("runtime.") && 
          !item.name.includes("GC") && 
          !item.name.includes("malloc") &&
          !item.name.includes("memclr")) return false
      return true
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map(item => ({
      name: item.name,
      value: item.value,
      percentageOfTotal: totalCPUTime ? (item.value / totalCPUTime) * 100 : 0
    }))

  // Add CPU time insight
  if (totalCPUTime > 0) {
    const cpuTimeMs = totalCPUTime.toFixed(2)
    insights.push({
      type: "info",
      message: `Total CPU time: ${cpuTimeMs}ms in last profile`,
      timestamp: latest.getTime(),
      metric: "cpu_time",
      value: totalCPUTime
    })
  }

  // Check for CPU intensive operations
  topConsumers.forEach(consumer => {
    if (consumer.percentageOfTotal > 5) { // Lower threshold to catch more insights
      insights.push({
        type: "info",
        message: `${consumer.name} consumed ${consumer.percentageOfTotal.toFixed(1)}% of CPU time`,
        timestamp: latest.getTime(),
        metric: "cpu_usage",
        value: consumer.value
      })
    }
  })

  // Check for high total CPU usage (over 20ms in a 1s sample = 2% CPU)
  if (totalCPUTime > 20) {
    insights.push({
      type: "warning",
      message: `High CPU usage detected: ${totalCPUTime.toFixed(1)}ms in 1s sample`,
      timestamp: latest.getTime(),
      metric: "cpu_high_usage",
      value: totalCPUTime
    })
  }

  return {
    insights,
    topConsumers,
    summary: `Analyzing ${data.dates.length} CPU samples`
  }
}

export const useProfileInsights = ({
  graphData,
  pprofType
}: {
  graphData: GraphData
  pprofType: PprofType
}): ProfileInsights => {
  return useMemo(() => {
    switch (pprofType) {
      case PprofType.heap:
        return analyzeHeapData(graphData)
      case PprofType.cpu:
        return analyzeCPUData(graphData)
      default:
        return {
          insights: [],
          topConsumers: [],
          summary: `No insights available for ${pprofType}`
        }
    }
  }, [graphData, pprofType])
} 