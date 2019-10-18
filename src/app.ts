import { lightningChart, AxisTickStrategies, emptyLine, DataPatterns, AxisScrollStrategies, SolidFill, ColorHEX, UIElementBuilders, UIOrigins, LineSeries, ChartXY, Dashboard } from "@arction/lcjs"
import { defaultStyle } from "./chartStyle"
import './styles/main.scss'

enum SrcOption {
    mic = 'mic',
    file = 'file',
    truck = 'truck'
}
const truckSrcUrl = 'Truck_driving_by-Jason_Baker-2112866529.wav'
let listen = false
let src: SrcOption = SrcOption.mic

const mediaDevices = navigator.mediaDevices
const audioCtx = new AudioContext()
const analyzer = audioCtx.createAnalyser()

const timeDomainData = new Uint8Array(analyzer.fftSize)
const frequencyData = new Uint8Array(analyzer.frequencyBinCount)
const frequencyHistoryData = Array.from<Point>(Array(analyzer.frequencyBinCount)).map((_, i) => ({ x: i, y: 0 }))
const frequencyMaxHistoryData = new Uint8Array(analyzer.frequencyBinCount)
interface Point {
    x: number,
    y: number
}

function ArrayBufferToPointArray(buf: Uint8Array, xMultiplier: number = 1): Point[] {
    return Array.from(buf).map((p, i) => ({ x: i * xMultiplier, y: p }))
}

let maxFreqHistChanged = false
let maxFreqTemp = 0

// chart

const lc = lightningChart()

const db = lc.Dashboard({
    containerId: 'chart',
    numberOfColumns: 1,
    numberOfRows: 2
})

db
    .setBackgroundFillStyle(defaultStyle.backgroundFill)
    .setBackgroundStrokeStyle(defaultStyle.backgroundStroke)

const timeDomainChart = createChart(db, 0, 'Time Domain', 'Sample', 'Value')

const timeDomainSeries = createSeries(timeDomainChart, 'Time Domain', '#fff')

const frequencyChart = createChart(db, 1, 'Frequency', 'Frequency (Hz)', 'Value')

function createSeries(chart: ChartXY, name: string, color: string): LineSeries {
    return chart.addLineSeries({
        dataPattern: DataPatterns.horizontalProgressive
    })
        .setStrokeStyle(defaultStyle.series.stroke.setFillStyle(new SolidFill({ color: ColorHEX(color) })))
        .setName(name)
}

function createChart(db: Dashboard, rI: number, title: string, xAxisTitle: string, yAxisTitle: string): ChartXY {
    const chart = db.createChartXY({
        columnIndex: 0,
        columnSpan: 1,
        rowIndex: rI,
        rowSpan: 1,
        chartXYOptions: {
            defaultAxisXTickStrategy: AxisTickStrategies.Numeric,
            defaultAxisYTickStrategy: AxisTickStrategies.Numeric,
            autoCursorBuilder: defaultStyle.autoCursor
        }
    })
        .setBackgroundFillStyle(defaultStyle.backgroundFill)
        .setBackgroundStrokeStyle(defaultStyle.backgroundStroke)
        .setTitle(title)
    chart
        .getAxes().forEach(axis => {
            axis.setTickStyle(defaultStyle.axis.tick)
        })
    chart.getDefaultAxisX()
        .setScrollStrategy(AxisScrollStrategies.progressive)
        .setTitle(xAxisTitle)
        .setTitleFillStyle(defaultStyle.titleFill)
        .setTitleFont(defaultStyle.titleFont.setSize(14))

    chart.getDefaultAxisY()
        .setScrollStrategy(undefined)
        .setInterval(0, 256)
        .setTitle(yAxisTitle)
        .setTitleFillStyle(defaultStyle.titleFill)
        .setTitleFont(defaultStyle.titleFont.setSize(14))
    return chart
}

const resetHistoryMaxButton = frequencyChart
    .addUIElement(UIElementBuilders.ButtonBox.addStyler(styler => styler
        .setButtonOffFillStyle(defaultStyle.backgroundFill)
        .setButtonOffStrokeStyle(defaultStyle.ui.border)
        .setButtonOnFillStyle(defaultStyle.ui.fill)
    ))
    .setText('Reset Frequency Max')
    .setOrigin(UIOrigins.LeftTop)
    .setPosition({ x: 0, y: 100 })
    .setFont(defaultStyle.titleFont.setSize(14))
    .setTextFillStyle(defaultStyle.titleFill)

const frequencySeries = createSeries(frequencyChart, 'Frequency', '#fff')
const historySeries = createSeries(frequencyChart, 'Frequency Short History', '#ff9511')
const maxFreqSeries = createSeries(frequencyChart, 'Frequency Max', '#ffff11')


const srcSelector = document.getElementById('src-selector') as HTMLSelectElement

async function getAudioFileUrl(): Promise<string> {
    return new Promise((resolve) => {
        const el = document.getElementById('audio-file') as HTMLInputElement
        el.addEventListener('change', () => {
            resolve(el.value)
        })
    })
}

let disconnect: () => void
const updateSource = async () => {
    const selectedOptionElement = srcSelector[srcSelector.selectedIndex] as HTMLOptionElement
    src = selectedOptionElement.value as SrcOption
    if (src === SrcOption.file) {
        document.getElementById('audio-input').style.display = 'inline-block'
    } else {
        const ai = document.getElementById('audio-input') as HTMLInputElement
        ai.style.display = 'none'
        ai.value = ''
    }
    if (disconnect) {
        disconnect()
        disconnect = null
    }
    switch (src) {
        case SrcOption.mic:
            disconnect = await listenMic()
            break
        case SrcOption.file:
            disconnect = await listenToFile(await getAudioFileUrl())
            break
        case SrcOption.truck:
            disconnect = await listenToFile(truckSrcUrl)
            break
    }
}
srcSelector.addEventListener('change', updateSource)
updateSource()
const listenElement = document.getElementById('listen') as HTMLInputElement

listenElement.addEventListener('change', () => {
    listen = listenElement.checked

    if (listen) {
        analyzer.connect(audioCtx.destination)
    } else {
        analyzer.disconnect(audioCtx.destination)
    }
})

async function listenMic(): Promise<() => void> {
    return mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            const src = audioCtx.createMediaStreamSource(stream)
            src.connect(analyzer)
            return src.disconnect.bind(src, analyzer)
        })
}

async function listenToFile(url): Promise<() => void> {
    return fetch(url)
        .then(d => d.arrayBuffer())
        .then(d => audioCtx.decodeAudioData(d))
        .then(d => {
            const src = audioCtx.createBufferSource()
            src.buffer = d
            src.connect(analyzer)
            src.start(0)
            src.loop = true
            return () => {
                src.loop = false
                src.stop()
                src.disconnect(analyzer)
            }
        })
}

timeDomainChart.getDefaultAxisX().setInterval(0, analyzer.fftSize)
frequencyChart.getDefaultAxisX().setInterval(0, audioCtx.sampleRate / analyzer.fftSize * analyzer.frequencyBinCount)

resetHistoryMaxButton.onMouseClick(() => {
    for (let i = 0; i < frequencyMaxHistoryData.byteLength; i++) {
        frequencyMaxHistoryData[i] = 0
    }
    maxFreqSeries.clear()
    maxFreqSeries.add(ArrayBufferToPointArray(frequencyMaxHistoryData))
})

let lastUpdate: number = 0
let delta: number
function update(ts: number) {
    delta = (ts - lastUpdate)
    lastUpdate = ts
    analyzer.getByteTimeDomainData(timeDomainData)
    analyzer.getByteFrequencyData(frequencyData)
    timeDomainSeries.clear()
    timeDomainSeries.add(ArrayBufferToPointArray(timeDomainData))
    frequencySeries.clear()
    frequencySeries.add(ArrayBufferToPointArray(frequencyData, audioCtx.sampleRate / analyzer.fftSize))
    for (let i = 0; i < frequencyHistoryData.length; i++) {
        frequencyHistoryData[i].y = Math.max(Math.max(frequencyData[i], frequencyHistoryData[i].y - 25 / 1000 * delta), 0)
        maxFreqTemp = Math.max(Math.max(frequencyData[i], frequencyMaxHistoryData[i]), 0)
        if (maxFreqTemp > frequencyMaxHistoryData[i]) {
            maxFreqHistChanged = true
            frequencyMaxHistoryData[i] = maxFreqTemp
        }
    }
    historySeries.clear()
    historySeries.add(frequencyHistoryData.map((p, i) => ({ x: p.x * audioCtx.sampleRate / analyzer.fftSize, y: p.y })))
    if (maxFreqHistChanged) {
        maxFreqSeries.clear()
        maxFreqSeries.add(ArrayBufferToPointArray(frequencyMaxHistoryData, audioCtx.sampleRate / analyzer.fftSize))
        maxFreqHistChanged = false
    }
    window.requestAnimationFrame(update)
}

window.requestAnimationFrame(update)

