'use client'
import React, { useEffect } from 'react'
import { registerTheme } from 'echarts'
import { useIsSSR } from '@react-aria/ssr'

import { ChartOption } from '@/components/chart-option'
import darkTheme from '@/components/charts/dark-theme'
import { PprofType } from '@/components/hooks/use-graph-data'
import { PprofGraph } from '@/components/charts/pprof-chart'
import { useWindowListener } from '@/components/window-listener'
import { useGraphPrefSnap } from '@/components/hooks/use-graph-pref-snap'
import { useParamAction } from '@/components/hooks/use-param-action'
import { ProfileInsights } from '@/components/profile-insights'
import { useGraphData } from '@/components/hooks/use-graph-data'

registerTheme('dark', darkTheme())

export const AllGraphs: React.FC = () => {
  const ssr = useIsSSR()
  useWindowListener()
  useParamAction()
  const [cpu, heap, allocs, goroutine] = [
    useGraphPrefSnap(PprofType.cpu),
    useGraphPrefSnap(PprofType.heap),
    useGraphPrefSnap(PprofType.allocs),
    useGraphPrefSnap(PprofType.goroutine),
  ]

  // Lift the hook calls to component level
  const cpuGraphData = useGraphData({ pprofType: PprofType.cpu })
  const heapGraphData = useGraphData({ pprofType: PprofType.heap })
  const allocsGraphData = useGraphData({ pprofType: PprofType.allocs })
  const goroutineGraphData = useGraphData({ pprofType: PprofType.goroutine })

  // Create a map to easily access the graph data
  const graphDataMap = {
    [PprofType.cpu]: cpuGraphData,
    [PprofType.heap]: heapGraphData,
    [PprofType.allocs]: allocsGraphData,
    [PprofType.goroutine]: goroutineGraphData,
  }

  useEffect(() => {
    if (ssr) return
  }, [ssr])

  return (
    <div className="grid grid-cols-2 gap-4 h-full w-full pb-2 overflow-hidden">
      {[cpu, heap, allocs, goroutine]
        .filter(snap => snap.prefSnap.enabled)
        .map(snap => {
          const graphData = graphDataMap[snap.pprofType]
          return (
            <div key={snap.pprofType} className="flex flex-col min-h-[300px] relative">
              <ChartOption
                className={`absolute top-2.5 z-10 ${snap.leftOffsetLarge ? 'left-32' : 'left-20'}`}
                pprofType={snap.pprofType}
              />
              <div className="flex flex-row h-full gap-4">
                <PprofGraph pprofType={snap.pprofType} className="flex-1" />
                <ProfileInsights 
                  graphData={graphData} 
                  pprofType={snap.pprofType} 
                  className="w-72 shrink-0 max-h-full overflow-y-auto" 
                />
              </div>
            </div>
          )
        })}
    </div>
  )
}
