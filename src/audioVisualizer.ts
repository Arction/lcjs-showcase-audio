import { loadAudioFile } from "./audioSources"
import {
    Point,
    MPoint,
    LineSeries,
    ChartXY,
    DashboardBasicOptions,
    AxisTickStrategies,
    Dashboard,
    lightningChart,
    Themes,
    DataPatterns,
    AxisScrollStrategies,
    FormattingRange,
    UIElementBuilders,
    UIOrigins,
    SolidLine,
    SolidFill,
    ColorHEX,
    VisibleTicks,
    IntensityGridSeries,
    ColorRGBA,
    LUT,
    PalettedFill,
    Axis,
    emptyLine,
    emptyTick,
    emptyFill,
} from "@arction/lcjs"
import {
    Scaler,
    noScaler,
    multiplierScaler,
    dbScaler,
    freqScaler,
    offSetScaler
} from "./utils"

// // Use theme if provided
const urlParams = new URLSearchParams(window.location.search);
let theme = Themes.dark
if (urlParams.get('theme') == 'light'){
    theme = Themes.light
    document.body.style.backgroundColor = '#fff'
    document.querySelector('label').style.color = '#000'
}


/**
 * Update points in a given array with new values
 * @param arr Array of points to update
 * @param buf Input data buffer
 * @param xScaler Scaler for the X-values
 * @param yScaler Scaler for the Y-values
 */
function updatePoints(arr: MPoint[], buf: Uint8Array, xScaler: Scaler = noScaler, yScaler: Scaler = noScaler): void {
    arr.forEach((p, i) => {
        p.y = yScaler(buf[i])
        p.x = xScaler(i)
    })
}

/**
 * Convert ArrayBuffer to a Point array
 * @param buf Buffer to convert to point array
 * @param xScaler Scaler for the X-values
 * @param yScaler Scaler for the Y-values
 */
function ArrayBufferToPointArray(buf: Uint8Array, xScaler: (n: number) => number = noScaler, yScaler: (n: number) => number = noScaler): Point[] {
    return Array.from(buf).map((p, i) => ({ x: xScaler(i), y: yScaler(p) }))
}

/**
 * Audio Visualizer
 * 
 * Visualizes given Audio source
 */
export class AudioVisualizer {
    /**
     * Current audio context
     */
    private _audioCtx: AudioContext
    /**
     * All used audio nodes in the audio graph
     */
    private _audioNodes: {
        analyzer: AnalyserNode,
        processor: ScriptProcessorNode,
        gain: GainNode
    }
    /**
     * Current audio source
     */
    private _source: AudioNode | undefined

    /**
     * Data buffers
     */
    private _data: {
        timeDomain: Uint8Array,
        frequency: Uint8Array,
        history: Uint8Array,
        maxHistory: Uint8Array
    }

    /**
     * Point buffers
     */
    private _points: {
        timeDomain: Point[],
        frequency: Point[],
        history: Point[],
        maxHistory: Point[]
    }

    /**
     * Base dashboard, hosts all charts
     */
    private _db: Dashboard

    /**
     * All different charts
     */
    private _charts: {
        timeDomain: ChartXY,
        waveformHistory: ChartXY,
        spectrum: ChartXY,
        spectrogram: ChartXY
    }

    /**
     * All different series
     */
    private _series: {
        timeDomain: LineSeries,
        waveform: LineSeries,
        amplitude: {
            display: LineSeries,
            cursor: LineSeries
        },
        history: LineSeries,
        maxAmplitude: {
            display: LineSeries,
            cursor: LineSeries
        },
        spectrogram: IntensityGridSeries
        spectrogramAxis: Axis
    }

    /**
     * The 'time' of the last waveform data input point
     */
    private _lastTime: number = 0

    constructor() {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        // setup the audio context
        try {
            this._audioCtx = new AudioContext()
        } catch (e) {
            // AudioContext is not supported.
            document.getElementById('ie-error').hidden = false
            throw e
        }
        this._audioCtx.createScriptProcessor = this._audioCtx.createScriptProcessor || (this._audioCtx as any).createJavaScriptNode
        this._audioNodes = {
            analyzer: this._audioCtx.createAnalyser(),
            // the script processor node is deprecated node so it will be removed in future
            // it has been replaced with audio worklet but those have really bad browser support currently
            processor: this._audioCtx.createScriptProcessor(2048, 1, 1),
            gain: this._audioCtx.createGain()
        }
        // mute audio output by default
        this._audioNodes.gain.gain.setValueAtTime(0, this._audioCtx.currentTime)

        const spectrogramHistoryLength = 1024 * (this._audioNodes.analyzer.fftSize / this._audioCtx.sampleRate)
        // setup audio processor
        this._audioNodes.processor.onaudioprocess = (ev: AudioProcessingEvent) => {
            // update data from analyzer
            this._audioNodes.analyzer.getByteTimeDomainData(this._data.timeDomain)
            this._audioNodes.analyzer.getByteFrequencyData(this._data.frequency)
            const mScaler = multiplierScaler(this._audioCtx.sampleRate / this._audioNodes.analyzer.fftSize)
            const dScaler = dbScaler(this._audioNodes.analyzer)
            // update frequency points
            updatePoints(
                this._points.frequency,
                this._data.frequency,
                mScaler,
                dScaler
            )
            // update history and max history data
            for (let i = 0; i < this._data.history.length; i++) {
                this._data.history[i] = Math.max(Math.max(this._data.frequency[i], this._data.history[i] - 25 / 1000), 0)
                this._data.maxHistory[i] = Math.max(Math.max(this._data.frequency[i], this._data.maxHistory[i]), 0)
            }
            // update frequency history points
            updatePoints(
                this._points.history,
                this._data.history,
                mScaler,
                dScaler
            )
            // update frequency max history points
            updatePoints(
                this._points.maxHistory,
                this._data.maxHistory,
                mScaler,
                dScaler
            )
            // update time domain points
            updatePoints(
                this._points.timeDomain,
                this._data.timeDomain,
                noScaler,
                freqScaler
            )

            // update time domain data
            this._series.timeDomain.clear()
            this._series.timeDomain.add(this._points.timeDomain)

            // // add waveform data to the waveform series
            const waveData = ArrayBufferToPointArray(this._data.timeDomain, offSetScaler(this._lastTime), freqScaler)
            this._series.waveform.add(waveData)
            this._lastTime += waveData.length

            const freqData = Array.from(this._data.frequency)
            this._series.spectrogram.addColumn(1, 'value', [freqData])
            const lastTimeInS = this._lastTime / this._audioCtx.sampleRate
            this._series.spectrogramAxis.setInterval(lastTimeInS - spectrogramHistoryLength, lastTimeInS)

            // output the audio
            ev.outputBuffer.copyToChannel(ev.inputBuffer.getChannelData(0), 0)
        }

        // setup node graph
        this._audioNodes.analyzer.connect(this._audioNodes.processor)
        this._audioNodes.processor.connect(this._audioNodes.gain)
        this._audioNodes.gain.connect(this._audioCtx.destination)

        // setup buffers
        const fBinCount = this._audioNodes.analyzer.frequencyBinCount
        this._data = {
            timeDomain: new Uint8Array(this._audioNodes.analyzer.fftSize),
            frequency: new Uint8Array(fBinCount),
            history: new Uint8Array(fBinCount),
            maxHistory: new Uint8Array(fBinCount)
        }

        // setup point arrays
        const mapXAxisToSampleRate = (_, i) => ({ x: (this._audioCtx.sampleRate / this._audioNodes.analyzer.fftSize * i), y: 0 })
        this._points = {
            timeDomain: Array.from<Point>(Array(this._data.timeDomain.length)).map((_, i) => ({ x: i, y: 0 })),
            frequency: Array.from<Point>(Array(fBinCount)).map(mapXAxisToSampleRate),
            history: Array.from<Point>(Array(fBinCount)).map(mapXAxisToSampleRate),
            maxHistory: Array.from<Point>(Array(fBinCount)).map(mapXAxisToSampleRate)
        }

        // setup dashboard
        this._setupDashboard()

        const maxFreq = this._audioCtx.sampleRate / this._audioNodes.analyzer.fftSize * this._audioNodes.analyzer.frequencyBinCount

        // setup charts
        this._charts = {
            timeDomain: this._setupChart({ columnIndex: 0, columnSpan: 2, rowIndex: 0, rowSpan: 1 }, 'Time Domain', 'Sample', 'Amplitude', [-1, 1]),
            waveformHistory: this._setupChart({ columnIndex: 0, columnSpan: 2, rowIndex: 1, rowSpan: 1 }, 'Waveform history', 'Time (s)', 'Amplitude', [-1, 1]),
            spectrum: this._setupChart({ columnIndex: 0, columnSpan: 1, rowIndex: 2, rowSpan: 1 }, 'Spectrum', 'Frequency (Hz)', 'dB', [0, 256]),
            spectrogram: this._setupChart({ columnIndex: 1, columnSpan: 1, rowIndex: 2, rowSpan: 1 }, 'Spectrogram', 's', 'Frequency (Hz)', [0, maxFreq / 2])
        }
        this._charts.waveformHistory
            .getDefaultAxisX()
            .setScrollStrategy(AxisScrollStrategies.progressive)
            .setInterval(0, this._audioCtx.sampleRate * 10)
        this._charts.waveformHistory
            .getDefaultAxisY()
            .setMouseInteractions(false)
        this._charts.waveformHistory
            .getDefaultAxisY()
            .setChartInteractionZoomByDrag(false)
            .setChartInteractionFitByDrag(false)
            .setChartInteractionZoomByWheel(false)

        this._charts.timeDomain.getDefaultAxisX().setInterval(0, this._audioNodes.analyzer.fftSize)
        this._charts.spectrum.getDefaultAxisX().setInterval(0, this._audioCtx.sampleRate / this._audioNodes.analyzer.fftSize * this._audioNodes.analyzer.frequencyBinCount)
        this._charts.spectrum.getDefaultAxisY().setInterval(this._audioNodes.analyzer.minDecibels, this._audioNodes.analyzer.maxDecibels)
        // frequency chart is twice as large as the other charts
        this._db.setRowHeight(2, 2)

        this._charts.timeDomain
            .setMouseInteractions(false)
        this._charts.timeDomain
            .getDefaultAxisX()
            .setMouseInteractions(false)
        this._charts.timeDomain
            .getDefaultAxisY()
            .setMouseInteractions(false)

        // replace the default axis tick strategy formatter formatValue function
        this._charts.waveformHistory.getDefaultAxisX().tickStrategy.formatValue = (value: number, range: FormattingRange): string => {
            return (value / this._audioCtx.sampleRate).toFixed(2)
        }

        this._charts.spectrogram
            .getDefaultAxisX()
            // Hide the default axis
            .setNibStyle(emptyLine)
            .setTickStyle(emptyTick)
            .setStrokeStyle(emptyLine)
            .setTitleMargin(1)
            .setTitleFillStyle(emptyFill)
            // Set interval for the spectrogram
            .setInterval(0, 1024)

        // create series
        let seriesColor = '#fff'
        if (theme == Themes.light)
            seriesColor = '#0A7AAD'
        this._series = {
            timeDomain: this._setupSeries(this._charts.timeDomain, 'Time Domain', seriesColor),
            waveform: this._setupSeries(this._charts.waveformHistory, 'Waveform History', seriesColor),
            amplitude: {
                display: this._setupSeries(this._charts.spectrum, 'Amplitude', '#0d0'),
                cursor: this._setupSeries(this._charts.spectrum, 'Amplitude', '#0000')
            },
            history: this._setupSeries(this._charts.spectrum, 'Amplitude Decay', '#0aa'),
            maxAmplitude: {
                display: this._setupSeries(this._charts.spectrum, 'Amplitude Max', '#aa0'),
                cursor: this._setupSeries(this._charts.spectrum, 'Amplitude Max', '#0000')
            },
            spectrogram: this._setupIntensitySeries(this._charts.spectrogram, 1024, fBinCount / 2, maxFreq / 2, 'Spectrogram'),
            spectrogramAxis: this._charts.spectrogram.addAxisX()
        }

        // setup time-domain series
        this._series.timeDomain
            .setMouseInteractions(false)
            .setCursorEnabled(false)

        // setup waveform series
        this._series.waveform
            .setMouseInteractions(false)
            .setMaxPointCount(1000 * 1000)
            .setCursorInterpolationEnabled(false)
            .setResultTableFormatter((tableBuilder, series, x, y) => tableBuilder
                .addRow(series.getName())
                .addRow('Time', series.axisX.formatValue(x), 's')
                .addRow('Amplitude', series.axisY.formatValue(y))
            )


        // setup frequency series
        this._series.amplitude.display
            .setMouseInteractions(false)
            .setCursorEnabled(false)
        this._series.amplitude.cursor
            .add(this._points.frequency)
            .setResultTableFormatter((tableBuilder, series, x, y) => tableBuilder
                .addRow(series.getName())
                .addRow(series.axisX.formatValue(x), 'Hz')
                .addRow(series.axisY.formatValue(y), 'dB')
            )

        // setup max frequency series
        this._series.maxAmplitude.display
            .setMouseInteractions(false)
            .setCursorEnabled(false)
        this._series.maxAmplitude.cursor
            .add(this._points.maxHistory)
            .setResultTableFormatter((tableBuilder, series, x, y) => tableBuilder
                .addRow(series.getName())
                .addRow(series.axisX.formatValue(x), 'Hz')
                .addRow(series.axisY.formatValue(y), 'dB')
            )


        // history reset button
        this._charts.spectrum.addUIElement(
            UIElementBuilders.ButtonBox
        )
            .setText('Reset Spectrum Max')
            .setOrigin(UIOrigins.LeftTop)
            .setPosition({ x: 0.2, y: 100 })
            .onMouseClick(() => {
                for (let i = 0; i < this._data.maxHistory.byteLength; i++) {
                    this._data.maxHistory[i] = 0
                }
                // refresh the displayed data
                this._series.maxAmplitude.display.clear()
                this._series.maxAmplitude.display.add(ArrayBufferToPointArray(this._data.maxHistory))
            })

        this._series.spectrogramAxis
            .setMouseInteractions(false)
            .setTitle('Time (s)')
            .setTitleFont(f => f.setSize(13))
            .setTitleMargin(-5)
            .setTickStyle((t: VisibleTicks) => t
                .setTickPadding(0)
                .setLabelPadding(-5)
                .setLabelFont(f => f.setSize(12))
            )
    }

    /**
     * Create and setup the dashboard
     */
    private _setupDashboard() {
        this._db = lightningChart()
            .Dashboard({
                containerId: 'chart',
                numberOfColumns: 2,
                numberOfRows: 3,
                theme
            })
            .setSplitterStyle((style: SolidLine) => style.setThickness(5))
            if (theme == Themes.dark)
                this._db.setBackgroundStrokeStyle((s: SolidLine) => s.setThickness(0))
    }

    /**
     * Create and setup a new chart on the dashboard
     * @param options Dashboard options
     * @param title Chart title
     * @param xAxisTitle X-Axis title
     * @param yAxisTitle Y-Axis title
     * @param yInterval Y-Axis interval
     */
    private _setupChart(options: DashboardBasicOptions, title: string, xAxisTitle: string, yAxisTitle: string, yInterval: [number, number]): ChartXY {
        const chart = this._db.createChartXY({
            ...options,
            chartXYOptions: {
                // hack
                defaultAxisXTickStrategy: Object.assign({}, AxisTickStrategies.Numeric),
                defaultAxisYTickStrategy: AxisTickStrategies.Numeric,
            }
        })
            .setTitle(title)
            .setPadding({ top: 2, left: 1, right: 6, bottom: 2 })
            .setTitleMarginTop(2)
        chart.getDefaultAxisX()
            .setTitle(xAxisTitle)
            .setTitleFont(f => f.setSize(13))
            .setTitleMargin(-5)
            .setTickStyle((t: VisibleTicks) => t
                .setTickPadding(0)
                .setLabelPadding(-5)
                .setLabelFont(f => f.setSize(12))
            )
            .setAnimationZoom(undefined)

        chart.getDefaultAxisY()
            .setScrollStrategy(undefined)
            .setInterval(yInterval[0], yInterval[1])
            .setTitle(yAxisTitle)
            .setTitleFont(f => f.setSize(13))
            .setTitleMargin(0)
            .setTickStyle((t: VisibleTicks) => t
                .setLabelFont(f => f.setSize(12))
            )
            .setAnimationZoom(undefined)
        return chart
    }

    /**
     * Create and setup a new series on a chart
     * @param chart Chart to which the series should be added to
     * @param name Name of the series
     * @param color Color of the series line
     */
    private _setupSeries(chart: ChartXY, name: string, color: string = '#fff'): LineSeries {
        const series = chart.addLineSeries({
            dataPattern: DataPatterns.horizontalProgressive,
        })
            .setStrokeStyle((style: SolidLine) => style.setFillStyle((fill: SolidFill) => fill.setColor(ColorHEX(color))))
            .setName(name)
            .setCursorInterpolationEnabled(false)
        return series
    }
    /**
     * Create and setup a new series on a chart
     * @param chart Chart to which the series should be added to
     * @param name Name of the series
     */
    private _setupIntensitySeries(chart: ChartXY, columnLength: number, columnCount: number, yMax: number, name: string): IntensityGridSeries {
        const palette = new LUT({
            steps: [
                { value: 0, color: ColorRGBA(0, 0, 0) },
                { value: 255 * .3, color: ColorRGBA(0, 255, 0) },
                { value: 255 * .6, color: ColorRGBA(255, 255, 0) },
                { value: 255, color: ColorRGBA(255, 0, 0) }
            ],
            interpolate: true
        })
        const series = chart.addHeatmapSeries({
            columns: columnLength,
            rows: columnCount,
            start: { x: 0, y: 0 },
            end: { x: 1024, y: yMax },
            pixelate: false,
        })
            .setFillStyle(new PalettedFill({ lut: palette }))
            .setName(name)
        return series
    }

    /**
     * Update series that require manual refresh
     */
    public update() {
        this._series.amplitude.display.clear()
        this._series.amplitude.display.add(this._points.frequency)
        this._series.history.clear()
        this._series.history.add(this._points.history)
        this._series.maxAmplitude.display.clear()
        this._series.maxAmplitude.display.add(this._points.maxHistory)
    }

    /**
     * Play audio
     */
    public play() {
        return this._audioCtx.resume()
    }

    /**
     * Pause audio
     */
    public pause() {
        return this._audioCtx.suspend()
    }

    /**
     * Set gain
     * @param gain Gain value
     */
    public setGain(gain: number) {
        this._audioNodes.gain.gain.setValueAtTime(gain, this._audioCtx.currentTime)
    }

    /**
     * Set audio visualizer source
     * @param source Source
     */
    public setSource(source?: AudioNode) {
        if (this._source) {
            this._source.disconnect(this._audioNodes.analyzer)
        }
        this._source = source
        if (this._source)
            this._source.connect(this._audioNodes.analyzer)
    }

    /**
     * Get the audio context of the visualizer
     */
    public getContext(): AudioContext {
        return this._audioCtx
    }

    /**
     * Get the audio context state
     */
    public getState(): AudioContextState {
        return this._audioCtx.state
    }

    /**
     * Create audio source from a url
     * @param url Url of the audio source
     */
    public async createUrlSource(url: string): Promise<AudioNode> {
        const buff = await loadAudioFile(url, this._audioCtx)

        const buffSrc = this._audioCtx.createBufferSource()
        buffSrc.buffer = buff
        buffSrc.start(0)
        buffSrc.loop = true
        return buffSrc
    }

    /**
     * Create microphone audio source
     */
    public async createMicSource(): Promise<AudioNode> {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        return this._audioCtx.createMediaStreamSource(stream)
    }
}
