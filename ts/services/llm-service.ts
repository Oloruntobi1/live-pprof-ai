import { GraphData } from "@/components/charts/data-structure"
import { PprofType } from "@/components/hooks/use-graph-data"

interface Point {
  flat?: number
  cum?: number
}

interface ProfilePoint {
  flat: number
  cum: number
}

interface FunctionData {
  name: string
  flat: number
  cumulative: number
  growth: number
  samples: number
  trend: number[]
  isRuntime: boolean
  stackTrace: string[]
  peakValue: number
}

interface PackageGroup {
  name: string
  totalFlat: number
  totalCum: number
  functions: FunctionData[]
}

export interface LLMInsight {
  type: "info" | "warning" | "critical"
  message: string
  timestamp: number
  metric: string
  value?: number
  recommendation?: string
  codeSuggestion?: string
}

export interface LLMAnalysis {
  insights: LLMInsight[]
  summary: string
  recommendations: string[]
  codeSuggestions: string[]
}

export class LLMService {
  private static instance: LLMService
  private ollamaUrl: string = "http://localhost:11434"

  private constructor() {}

  static getInstance(): LLMService {
    if (!LLMService.instance) {
      LLMService.instance = new LLMService()
    }
    return LLMService.instance
  }

  setOllamaUrl(url: string) {
    this.ollamaUrl = url
  }

  private convertToProfilePoint(point: Point | undefined): ProfilePoint {
    return {
      flat: point?.flat ?? 0,
      cum: point?.cum ?? 0
    }
  }

  async analyzeProfile(graphData: GraphData, pprofType: PprofType): Promise<LLMAnalysis> {
    // Prepare detailed profile data
    const latest = graphData.dates[graphData.dates.length - 1]
    const timeRange = {
      start: graphData.dates[0],
      end: latest,
      duration: (latest.getTime() - graphData.dates[0].getTime()) / 1000
    }

    // Get all function data with their complete paths and metrics
    const functionData: FunctionData[] = Object.entries(graphData.lineTable).map(([_, line]) => {
      const points = line.points
      const current = this.convertToProfilePoint(points[points.length - 1])
      const initial = this.convertToProfilePoint(points[0])
      const growth = initial.flat > 0 ? ((current.flat - initial.flat) / initial.flat) * 100 : 0

      return {
        name: line.name,
        flat: current.flat,
        cumulative: current.cum,
        growth,
        samples: points.length,
        trend: points.map(p => p?.flat ?? 0),
        isRuntime: line.name.startsWith("runtime."),
        stackTrace: line.name.split('/'),
        peakValue: Math.max(...points.map(p => p?.flat ?? 0))
      }
    })

    // Calculate system-wide metrics
    const totalCurrent = functionData.reduce((sum, fn) => sum + fn.flat, 0)
    const totalPeak = functionData.reduce((sum, fn) => sum + fn.peakValue, 0)
    const runtimeOverhead = functionData
      .filter(fn => fn.isRuntime)
      .reduce((sum, fn) => sum + fn.flat, 0)

    // Group related functions
    const functionGroups = this.groupRelatedFunctions(functionData)

    // Prepare the prompt with detailed analysis context
    const prompt = this.generateDetailedPrompt(
      pprofType,
      functionData,
      functionGroups,
      {
        totalCurrent,
        totalPeak,
        runtimeOverhead,
        timeRange
      }
    )

    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "codellama",
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 2000
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`)
      }

      const result = await response.json()
      return this.parseLLMResponse(result.response)
    } catch (error) {
      console.error("Error analyzing profile with Ollama:", error)
      return {
        insights: [],
        summary: "Error analyzing profile data",
        recommendations: [],
        codeSuggestions: []
      }
    }
  }

  private groupRelatedFunctions(functionData: FunctionData[]): PackageGroup[] {
    const groups: { [key: string]: PackageGroup } = {}
    
    functionData.forEach(fn => {
      const parts = fn.name.split('/')
      const mainPackage = parts[0]
      
      if (!groups[mainPackage]) {
        groups[mainPackage] = {
          name: mainPackage,
          totalFlat: 0,
          totalCum: 0,
          functions: []
        }
      }
      
      groups[mainPackage].totalFlat += fn.flat
      groups[mainPackage].totalCum += fn.cumulative
      groups[mainPackage].functions.push(fn)
    })

    return Object.values(groups)
      .sort((a, b) => b.totalFlat - a.totalFlat)
  }

  private generateDetailedPrompt(
    pprofType: PprofType,
    functionData: FunctionData[],
    functionGroups: PackageGroup[],
    metrics: {
      totalCurrent: number,
      totalPeak: number,
      runtimeOverhead: number,
      timeRange: { start: Date, end: Date, duration: number }
    }
  ): string {
    const topFunctions = functionData
      .sort((a, b) => b.flat - a.flat)
      .slice(0, 10)

    const hotPaths = functionData
      .filter(fn => fn.growth > 20 || fn.flat > metrics.totalCurrent * 0.1)
      .sort((a, b) => b.flat - a.flat)

    return `You are a performance analysis expert specializing in Go applications. Your task is to analyze the following ${pprofType} profile data and provide a detailed analysis.

PROFILE OVERVIEW:
Type: ${pprofType}
Duration: ${metrics.timeRange.duration}s
Total Current: ${metrics.totalCurrent}
Peak Usage: ${metrics.totalPeak}
Runtime Overhead: ${metrics.runtimeOverhead} (${((metrics.runtimeOverhead / metrics.totalCurrent) * 100).toFixed(1)}%)

TOP CONSUMERS (with full paths):
${topFunctions.map(fn => 
  `- ${fn.name}
   Flat: ${fn.flat}
   Cumulative: ${fn.cumulative}
   Growth: ${fn.growth.toFixed(1)}%
   Stack: ${fn.stackTrace.join(' -> ')}`
).join('\n')}

HOT PATHS (high growth or usage):
${hotPaths.map(fn => 
  `- ${fn.name} (${fn.growth.toFixed(1)}% growth, ${((fn.flat / metrics.totalCurrent) * 100).toFixed(1)}% of total)`
).join('\n')}

PACKAGE GROUPS:
${functionGroups.slice(0, 5).map(group => 
  `- ${group.name}
   Total Impact: ${((group.totalFlat / metrics.totalCurrent) * 100).toFixed(1)}%
   Functions: ${group.functions.length}`
).join('\n')}

Analyze this data and provide your response in the following EXACT format (keep the section headers exactly as shown):

=== INSIGHTS ===
[List each insight on a new line, prefix critical issues with [CRITICAL] and warnings with [WARNING]]
- Insight 1
- Insight 2
...

=== RECOMMENDATIONS ===
[List each recommendation on a new line]
- Recommendation 1
- Recommendation 2
...

=== CODE_SUGGESTIONS ===
[List each code suggestion on a new line, include specific function names and paths]
- Code suggestion 1
- Code suggestion 2
...

=== SUMMARY ===
[Write a concise paragraph summarizing the key findings and most important optimization opportunities]`
  }

  private parseLLMResponse(response: string): LLMAnalysis {
    // First, try to find sections using the === markers
    const insights: LLMInsight[] = []
    const recommendations: string[] = []
    const codeSuggestions: string[] = []
    let summary = "No summary available"

    try {
      // Try to extract sections using === markers
      const insightsMatch = response.match(/=== INSIGHTS ===\n([\s\S]*?)(?===|$)/)
      const recommendationsMatch = response.match(/=== RECOMMENDATIONS ===\n([\s\S]*?)(?===|$)/)
      const codeSuggestionsMatch = response.match(/=== CODE_SUGGESTIONS ===\n([\s\S]*?)(?===|$)/)
      const summaryMatch = response.match(/=== SUMMARY ===\n([\s\S]*?)(?===|$)/)

      if (insightsMatch?.[1]) {
        insights.push(...this.parseInsights(insightsMatch[1].trim()))
      }

      if (recommendationsMatch?.[1]) {
        recommendations.push(...recommendationsMatch[1].trim().split('\n')
          .map(line => line.trim())
          .filter(line => line && line.startsWith('-'))
          .map(line => line.substring(1).trim()))
      }

      if (codeSuggestionsMatch?.[1]) {
        codeSuggestions.push(...codeSuggestionsMatch[1].trim().split('\n')
          .map(line => line.trim())
          .filter(line => line && line.startsWith('-'))
          .map(line => line.substring(1).trim()))
      }

      if (summaryMatch?.[1]) {
        summary = summaryMatch[1].trim()
      }

      // If no sections found with === markers, try the old format
      if (!insightsMatch && !recommendationsMatch && !codeSuggestionsMatch && !summaryMatch) {
        const sections = response.split('\n\n')
        sections.forEach(section => {
          if (section.toLowerCase().includes('insight')) {
            insights.push(...this.parseInsights(section.replace(/insights:?/i, '').trim()))
          } else if (section.toLowerCase().includes('recommend')) {
            recommendations.push(...section.replace(/recommendations:?/i, '').trim()
              .split('\n')
              .map(line => line.trim())
              .filter(line => line && (line.startsWith('-') || line.startsWith('*')))
              .map(line => line.replace(/^[-*]/, '').trim()))
          } else if (section.toLowerCase().includes('code')) {
            codeSuggestions.push(...section.replace(/code[_\s]suggestions:?/i, '').trim()
              .split('\n')
              .map(line => line.trim())
              .filter(line => line && (line.startsWith('-') || line.startsWith('*')))
              .map(line => line.replace(/^[-*]/, '').trim()))
          } else if (section.toLowerCase().includes('summary')) {
            summary = section.replace(/summary:?/i, '').trim()
          }
        })
      }
    } catch (error) {
      console.error('Error parsing LLM response:', error)
      // Keep the default empty values
    }

    // If we still don't have a summary but have other content, generate one
    if (summary === "No summary available" && (insights.length > 0 || recommendations.length > 0)) {
      summary = `Analysis found ${insights.length} insights and ${recommendations.length} recommendations. `
      if (insights.length > 0) {
        summary += `Key insight: ${insights[0].message}`
      }
    }

    return {
      insights,
      summary,
      recommendations,
      codeSuggestions
    }
  }

  private parseInsights(insightsText: string): LLMInsight[] {
    return insightsText.split('\n')
      .map(line => line.trim())
      .filter(line => line && (line.startsWith('-') || line.startsWith('*') || line.startsWith('[')))
      .map(line => {
        const cleanLine = line.replace(/^[-*]/, '').trim()
        const type = cleanLine.toLowerCase().includes('[critical]') ? 'critical' :
                    cleanLine.toLowerCase().includes('[warning]') ? 'warning' : 'info'
        return {
          type,
          message: cleanLine.replace(/\[(critical|warning)\]/i, '').trim(),
          timestamp: Date.now(),
          metric: 'llm_insight'
        }
      })
  }
} 