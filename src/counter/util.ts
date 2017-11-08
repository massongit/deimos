import { RouteState } from './module'
import { data, Line, Station } from './data'
interface NextPops {
  stations: string[]
  lines: string[]
}
const nullNextPops: NextPops = {
  stations: [],
  lines: []
}
export enum RouteNodeType {
  STATION,
  LINE,
  DUPLICATED
}
export interface TextRouteNode {
  type: RouteNodeType
  value: Line | Station
  line: Line | null
  station: Station | null
}
enum Direction {
  UP, // 上りを表す　キロ数が減る
  DOWN
}
interface RouteEdge {
  line: Line
  direction: Direction
  startIndex: number
  endIndex: number
  start: Station
  end: Station
}
class Route {
  stations: Station[]
  edges: RouteEdge[]
  constructor() {
    this.stations = []
    this.edges = []
  }

  ngStations(lineId: number, stationId: number): number[] {
    // 路線(lineId)をstationId駅を起点として利用するときに，乗車済みでその路線で直接行けない駅はどれ?
    // stationIdsで返します．
    const stationIndex = data.lines[lineId].stationIds.indexOf(stationId)
    if (stationIndex === -1) {
      return []
    }
    return this.edges
      .filter(e => e.line.id === lineId)
      .map(e => {
        if (stationIndex <= e.startIndex && stationIndex <= e.endIndex) {
          return e.line.stationIds.slice(Math.min(e.startIndex, e.endIndex))
        } else {
          return e.line.stationIds.slice(
            0,
            Math.max(e.startIndex, e.endIndex) + 1
          )
        }
      })
      .reduce((a, b) => a.concat(b), [])
  }
}
const nextPopsLine = (lineIndex: number, route: Route): NextPops => {
  const rail = data.lines[lineIndex]
  if (rail === undefined) {
    return nullNextPops
  }
  const srcStation = route.stations[route.stations.length - 1]
  const ngStations = route.ngStations(lineIndex, srcStation.id)
  const stations = rail.stations
  let lineTemp = {}
  rail.dupLineStationIds
    .filter(id => !ngStations.includes(id))
    .forEach(id =>
      data.stations[id].lineIds.forEach(lineId => (lineTemp[lineId] = 1))
    )
  const lines = Object.keys(lineTemp).map(lineId => data.lineNames[+lineId])
  return {
    stations: stations,
    lines: lines
  }
}
const nextPopsStation = (stationId: number, route: Route): NextPops => {
  let station = data.stations[stationId]
  if (station === undefined) {
    return nullNextPops
  }
  let stationTemp: { [key: number]: number[] } = {}

  station.lineIds.forEach(lineId => {
    const ngStations = route.ngStations(lineId, stationId)
    data.lines[lineId].stationIds.forEach(st => {
      if (ngStations.includes(st)) {
        return
      }
      if (stationTemp[st] === undefined) {
        stationTemp[st] = []
      }
      stationTemp[st].push(lineId)
    })
  })

  const lines = station.lineIds.map(id => data.lineNames[id])

  const stations = Object.keys(stationTemp).map(id=>data.stationNames[id])
  return {
    stations: stations,
    lines: lines
  }
}
const unique = function() {
  let seen = {}
  return function(element: string) {
    return !(element in seen) && (seen[element] = 1)
  }
}

export const textFunction = (state: RouteState, text: string): RouteState => {
  const words = text
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
  let next: NextPops = {
    stations: data.stationNames,
    lines: data.lineNames
  }

  let textRoute: TextRouteNode[] = []
  let route: Route = new Route()
  let sourceStation: Station | null = null
  for (let i = 0; i < words.length; ++i) {
    let word = words[i]
    if (word === '') {
      break
    }
    const suffix = word.slice(-1) || ''
    if ('SsＳｓLlＬｌ'.indexOf(suffix) > -1) {
      word = word.slice(0, -1)
    }
    const stationFlag = next.stations.includes(word)
    const lineFlag = next.lines.includes(word)
    const stationIndex = stationFlag ? data.stationNames.indexOf(word) : -1
    const lineIndex = lineFlag ? data.lineNames.indexOf(word) : -1
    let type: RouteNodeType | null = stationFlag
      ? lineFlag ? RouteNodeType.DUPLICATED : RouteNodeType.STATION
      : lineFlag ? RouteNodeType.LINE : null
    if (type === RouteNodeType.DUPLICATED) {
      type =
        'SsＳｓ'.indexOf(suffix) > -1
          ? RouteNodeType.STATION
          : 'LlＬｌ'.indexOf(suffix) > -1 ? RouteNodeType.LINE : type
    }
    if (sourceStation === null && type !== null) {
      if (textRoute.length === 0) {
        if (type === RouteNodeType.STATION) {
          sourceStation = data.stations[stationIndex]
        }
      } else {
        if (textRoute[0].type === RouteNodeType.LINE) {
          sourceStation = data.stations[stationIndex]
        } else if (type === RouteNodeType.STATION) {
          textRoute[0].type = RouteNodeType.LINE
          sourceStation = data.stations[stationIndex]
        } else if (
          type === RouteNodeType.LINE ||
          type === RouteNodeType.DUPLICATED
        ) {
          textRoute[0].type = RouteNodeType.STATION
          sourceStation = data.stations[textRoute[0].value.id] // route[0].value で取れるのにinterfaceが邪魔
        }
      }
      if (sourceStation !== null) {
        route.stations[0] = sourceStation
      }
    }

    if (type === RouteNodeType.STATION) {
      textRoute.push({
        type: RouteNodeType.STATION,
        value: data.stations[stationIndex],
        station: data.stations[stationIndex],
        line: null
      })
    } else if (type === RouteNodeType.LINE) {
      textRoute.push({
        type: RouteNodeType.LINE,
        value: data.lines[lineIndex],
        station: null,
        line: data.lines[lineIndex]
      })
    } else if (type === RouteNodeType.DUPLICATED) {
      textRoute.push({
        type: RouteNodeType.DUPLICATED,
        value: data.stations[stationIndex],
        station: data.stations[stationIndex],
        line: data.lines[lineIndex]
      })
    }
    // ☓DUPの判定処理を書く　DUPはめんどくさいので一旦滅ぼす

    if (type === RouteNodeType.STATION) {
      route.stations.push(data.stations[stationIndex])
      while (
        route.stations.length > 1 &&
        route.stations[route.stations.length - 1].id ===
          route.stations[route.stations.length - 2].id
      ) {
        route.stations.pop()
      }
      // 駅　路線　駅
      // 駅　駅
      // 駅　路線　路線
      console.log(route.stations)
      if (route.stations.length >= 2) {
        if (textRoute[textRoute.length - 2].type === RouteNodeType.LINE) {
          // 駅　路線　駅　となる場合
          // nextの現在のアルゴリズムに置いてその路線は直前の駅である保証がある
          const line = textRoute[textRoute.length - 2].line!
          const startStationId = route.stations[route.stations.length - 2].id
          const endStationId = route.stations[route.stations.length - 1].id
          const start = data.stations[startStationId]
          const end = data.stations[endStationId]
          const startLineStationId = line.stationIds.indexOf(startStationId)
          const endLineStationId = line.stationIds.indexOf(endStationId)
          const direction =
            startLineStationId > endLineStationId
              ? Direction.UP
              : Direction.DOWN
          route.edges.push({
            line: line,
            start: start,
            end: end,
            startIndex: startLineStationId,
            endIndex: endLineStationId,
            direction: direction
          })
        } else if (
          textRoute[textRoute.length - 2].type === RouteNodeType.STATION
        ) {
          const startStationId = route.stations[route.stations.length - 2].id
          const endStationId = route.stations[route.stations.length - 1].id
          const start = data.stations[startStationId]
          const end = data.stations[endStationId]
          const lines = start.lineIds.filter(id => end.lineIds.includes(id))
          const line: Line = data.lines[lines[0]]
          const startLineStationId = line.stationIds.indexOf(startStationId)
          const endLineStationId = line.stationIds.indexOf(endStationId)
          const direction =
            startLineStationId > endLineStationId
              ? Direction.UP
              : Direction.DOWN
          route.edges.push({
            line: line,
            start: start,
            end: end,
            startIndex: startLineStationId,
            endIndex: endLineStationId,
            direction: direction
          })
        }
      }
    }

    if (stationFlag || lineFlag) {
      const nextFromStation = nextPopsStation(stationIndex, route)
      const nextFromLine = nextPopsLine(lineIndex, route)
      next.lines =
        sourceStation === null || type === RouteNodeType.DUPLICATED
          ? nextFromStation.lines.concat(nextFromLine.lines).filter(unique())
          : []
      next.stations = nextFromStation.stations
        .concat(nextFromLine.stations)
        .filter(unique())
    }
    if (stationFlag) {
      for (
        let ii = 0,
          j = next.stations.length,
          k = data.stationNames[stationIndex];
        ii < j;
        ++ii
      ) {
        if (next.stations[ii] === k) {
          next.stations.splice(ii, 1)
          break
        }
      }
    }
  }
  state.completionLine = next.lines
  state.completionStation = next.stations
  state.via = textRoute.map(e => e.value.name)
  state.source = sourceStation !== null ? sourceStation.name : ''
  state.text = text
  return state
}
