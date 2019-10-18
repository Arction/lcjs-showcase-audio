import { lightningChart, SolidLine } from "@arction/lcjs"

const chart = lightningChart().ChartXY()

chart.setTitle('Getting Started')

const lineSeries = chart.addLineSeries()

lineSeries.setStrokeStyle((style: SolidLine) => style.setThickness(5))

lineSeries.add([
    { x: 0, y: 0 },
    { x: 1, y: 7 },
    { x: 2, y: 3 },
    { x: 3, y: 10 },
])
