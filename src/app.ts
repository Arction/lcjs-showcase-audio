import {
    lightningChart,
    AxisTickStrategies,
    DataPatterns,
    AxisScrollStrategies,
    SolidFill,
    ColorHEX,
    UIElementBuilders,
    UIOrigins,
    LineSeries,
    ChartXY,
    Dashboard,
    DashboardBasicOptions,
    FormattingRange,
    AutoCursorModes,
    Themes,
    Point,
    MPoint
} from "@arction/lcjs"
import { defaultStyle } from "./chartStyle"
import './styles/main.scss'
import { SrcOption, setupSourceLabels, sourceAudioFiles, loadAudioFile } from "./audioSources"
import { setupPlayPause } from "./controls"
import { noScaler, multiplierScaler, dbScaler, freqScaler, offSetScaler, Scaler } from "./utils"
import { AudioVisualizer } from "./audioVisualizer"

let src: SrcOption = SrcOption.mic

setupSourceLabels()

const audioVisualizer = new AudioVisualizer()

setupPlayPause(audioVisualizer.play.bind(audioVisualizer), audioVisualizer.pause.bind(audioVisualizer))

const audioCtx = new AudioContext()
const analyzer = audioCtx.createAnalyser()

// handle cases where the audio context was created in suspended state
const resumeElement = document.getElementById('resume')
if (audioCtx.state === 'suspended') {
    resumeElement.addEventListener('click', () => {
        audioVisualizer.play()
            .then(() => {
                resumeElement.hidden = true
            })
    })
    resumeElement.hidden = false
}

const frequencyData = new Uint8Array(analyzer.frequencyBinCount)
const frequencyDataPoints = Array.from<Point>(Array(analyzer.frequencyBinCount)).map((_, i) => ({ x: (audioCtx.sampleRate / analyzer.fftSize * i), y: 0 }))
const frequencyHistoryData = new Uint8Array(analyzer.frequencyBinCount)
const frequencyHistoryDataPoints = Array.from<Point>(Array(analyzer.frequencyBinCount)).map((_, i) => ({ x: (audioCtx.sampleRate / analyzer.fftSize * i), y: 0 }))
const frequencyMaxHistoryData = new Uint8Array(analyzer.frequencyBinCount)
const frequencyMaxHistoryDataPoints = Array.from<Point>(Array(analyzer.frequencyBinCount)).map((_, i) => ({ x: (audioCtx.sampleRate / analyzer.fftSize * i), y: 0 }))


function ArrayBufferToPointArray(buf: Uint8Array, xScaler: (n: number) => number = noScaler, yScaler: (n: number) => number = noScaler): Point[] {
    return Array.from(buf).map((p, i) => ({ x: xScaler(i), y: yScaler(p) }))
}

const lc = lightningChart()

const db = lc.Dashboard({
    containerId: 'chart',
    numberOfColumns: 1,
    numberOfRows: 4,
    theme: Themes.dark
})

db
    .setBackgroundFillStyle(defaultStyle.backgroundFill)
    .setBackgroundStrokeStyle(defaultStyle.backgroundStroke)
    .setSplitterStyle(defaultStyle.splitterStyle)

const timeDomainChart = createChart(db, { columnIndex: 0, columnSpan: 1, rowIndex: 0, rowSpan: 1 }, 'Time Domain', 'Sample', 'Amplitude', [-1, 1])
const waveformHistoryChart = createChart(db, { columnIndex: 0, columnSpan: 1, rowIndex: 1, rowSpan: 1 }, 'Waveform history', 'Time (s)', 'Amplitude', [-1, 1])

const timeDomainSeries = createSeries(timeDomainChart, 'Time Domain', '#fff')
timeDomainChart.setAutoCursorMode(AutoCursorModes.disabled)
timeDomainChart.setMouseInteractions(false)
timeDomainSeries.setMouseInteractions(false)

const frequencyChart = createChart(db, { columnIndex: 0, columnSpan: 1, rowIndex: 2, rowSpan: 2 }, 'Spectrum', 'Frequency (Hz)', 'dB', [0, 256])

function createSeries(chart: ChartXY, name: string, color: string): LineSeries {
    return chart.addLineSeries({
        dataPattern: DataPatterns.horizontalProgressive
    })
        .setStrokeStyle(defaultStyle.series.stroke.setFillStyle(new SolidFill({ color: ColorHEX(color) })))
        .setName(name)
        .setCursorInterpolationEnabled(false)
}

function createChart(db: Dashboard, co: DashboardBasicOptions, title: string, xAxisTitle: string, yAxisTitle: string, yInterval: [number, number]): ChartXY {
    const chart = db.createChartXY({
        ...co,
        chartXYOptions: {
            // hack
            defaultAxisXTickStrategy: Object.assign({}, AxisTickStrategies.Numeric),
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
        .setInterval(yInterval[0], yInterval[1])
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
const frequencySeries2 = createSeries(frequencyChart, 'Frequency', '#0fff')
frequencySeries.setMouseInteractions(false)
frequencySeries.setCursorEnabled(false)
frequencySeries2.add(frequencyDataPoints)
const waveformSeries = createSeries(waveformHistoryChart, 'Waveform', '#fff')
waveformSeries.setMouseInteractions(false)
const historySeries = createSeries(frequencyChart, 'Frequency Short History', '#ff9511')
historySeries.setMouseInteractions(false)
historySeries.setCursorEnabled(false)
const maxFreqSeries = createSeries(frequencyChart, 'Frequency Max', '#ffff11')
maxFreqSeries.setMouseInteractions(false)
maxFreqSeries.setCursorEnabled(false)
const maxFreqSeries2 = createSeries(frequencyChart, 'Frequency Max', '#00ffff11')
maxFreqSeries2.add(frequencyMaxHistoryDataPoints)

waveformHistoryChart
    .getDefaultAxisX()
    .setInterval(0, audioCtx.sampleRate * 10)

// hack
waveformHistoryChart.getDefaultAxisX().tickStrategy.formatValue = (value: number, range: FormattingRange): string => {
    return (value / audioCtx.sampleRate).toFixed(2)
}

waveformSeries
    .setMaxPointCount(1000 * 1000)
    .setCursorInterpolationEnabled(false)

function updatePoints(arr: MPoint[], buf: Uint8Array, xScaler: Scaler = noScaler, yScaler: Scaler = noScaler): void {
    arr.forEach((p, i) => {
        p.y = yScaler(buf[i])
        p.x = xScaler(i)
    })
}
const timeDomainData = new Uint8Array(analyzer.fftSize)
const timeDomainPoints = Array.from<Point>(Array(timeDomainData.byteLength)).map((_, i) => ({ x: i, y: 0 }))
const processor = audioCtx.createScriptProcessor(analyzer.fftSize, 1, 1)
let lastTime = 0
processor.onaudioprocess = (audioProcessingEvent: AudioProcessingEvent) => {
    analyzer.getByteTimeDomainData(timeDomainData)
    analyzer.getByteFrequencyData(frequencyData)
    updatePoints(frequencyDataPoints, frequencyData, multiplierScaler(audioCtx.sampleRate / analyzer.fftSize), dbScaler(analyzer))
    updatePoints(frequencyHistoryDataPoints, frequencyHistoryData, multiplierScaler(audioCtx.sampleRate / analyzer.fftSize), dbScaler(analyzer))
    for (let i = 0; i < frequencyHistoryData.length; i++) {
        frequencyHistoryData[i] = Math.max(Math.max(frequencyData[i], frequencyHistoryData[i] - 25 / 1000), 0)
        frequencyMaxHistoryData[i] = Math.max(Math.max(frequencyData[i], frequencyMaxHistoryData[i]), 0)
    }
    updatePoints(frequencyMaxHistoryDataPoints, frequencyMaxHistoryData, multiplierScaler(audioCtx.sampleRate / analyzer.fftSize), dbScaler(analyzer))
    updatePoints(timeDomainPoints, timeDomainData, noScaler, freqScaler)
    timeDomainSeries.clear()
    timeDomainSeries.add(timeDomainPoints)
    const waveData = ArrayBufferToPointArray(timeDomainData, offSetScaler(lastTime), freqScaler)
    waveformSeries.add(waveData)
    lastTime += waveData.length
    audioProcessingEvent.outputBuffer.copyToChannel(audioProcessingEvent.inputBuffer.getChannelData(0), 0)
}

const gain = audioCtx.createGain()
gain.gain.setValueAtTime(0, audioCtx.currentTime)

// source -> processor -> analyzer -> gain -> destination

// processor.connect(analyzer)
// analyzer.connect(gain)
// gain.connect(audioCtx.destination)

const srcSelector = document.getElementById('src-selector') as HTMLSelectElement

async function getAudioFileUrl(): Promise<string> {
    return new Promise((resolve) => {
        const el = document.getElementById('audio-file') as HTMLInputElement
        el.addEventListener('change', () => {
            resolve(el.value)
        })
    })
}

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
    await audioVisualizer.pause()
    switch (src) {
        case SrcOption.mic:
            await listenMic()
            break
        case SrcOption.file:
            await listenToFileURL(await getAudioFileUrl())
            break
        case SrcOption.truck:
            await listenToFileURL(sourceAudioFiles.truck)
            break
        case SrcOption.f500_1000_1000:
            await listenToFileURL(sourceAudioFiles.f500_1000_1000)
            break
    }
    await audioVisualizer.play()
}
srcSelector.addEventListener('change', updateSource)
updateSource()
const listenElement = document.getElementById('listen') as HTMLInputElement

const updateListenState = () => {
    if (listenElement.checked) {
        audioVisualizer.setGain(1)
    } else {
        audioVisualizer.setGain(0)
    }
}

listenElement.addEventListener('change', updateListenState)

/**
 * Listen to microphone
 */
async function listenMic(): Promise<void> {
    const src = await audioVisualizer.createMicSource()
    audioVisualizer.setSource(src)
}

/**
 * Listen to a file from a url
 * @param url URL of the file
 */
async function listenToFileURL(url): Promise<void> {
    const src = await audioVisualizer.createUrlSource(url)
    audioVisualizer.setSource(src)
}

timeDomainChart.getDefaultAxisX().setInterval(0, analyzer.fftSize)
frequencyChart.getDefaultAxisX().setInterval(0, audioCtx.sampleRate / analyzer.fftSize * analyzer.frequencyBinCount)
frequencyChart.getDefaultAxisY().setInterval(analyzer.minDecibels, analyzer.maxDecibels)

resetHistoryMaxButton.onMouseClick(() => {
    for (let i = 0; i < frequencyMaxHistoryData.byteLength; i++) {
        frequencyMaxHistoryData[i] = 0
    }
    maxFreqSeries.clear()
    maxFreqSeries.add(ArrayBufferToPointArray(frequencyMaxHistoryData))
})

function update() {
    frequencySeries.clear()
    frequencySeries.add(frequencyDataPoints)
    historySeries.clear()
    historySeries.add(frequencyHistoryDataPoints)
    maxFreqSeries.clear()
    maxFreqSeries.add(frequencyMaxHistoryDataPoints)
    window.requestAnimationFrame(update)
}

window.requestAnimationFrame(update)

