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
    ColorHEX
} from "@arction/lcjs"
import {
    Scaler,
    noScaler,
    multiplierScaler,
    dbScaler,
    freqScaler,
    offSetScaler
} from "./utils"

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
        frequency: ChartXY
    }

    /**
     * All different series
     */
    private _series: {
        timeDomain: LineSeries,
        waveform: LineSeries,
        frequency: {
            display: LineSeries,
            cursor: LineSeries
        },
        history: LineSeries,
        maxFrequency: {
            display: LineSeries,
            cursor: LineSeries
        }
    }
    /**
     * The 'time' of the last waveform data input point
     */
    private _lastTime: number = 0

    constructor() {
        // setup the audio context
        this._audioCtx = new AudioContext()
        this._audioNodes = {
            analyzer: this._audioCtx.createAnalyser(),
            // the script processor node is deprecated node so it will be removed in future
            // it has been replaced with audio worklet but those have really bad browser support currently
            processor: this._audioCtx.createScriptProcessor(undefined, 1, 1),
            gain: this._audioCtx.createGain()
        }
        // mute audio output by default
        this._audioNodes.gain.gain.setValueAtTime(0, this._audioCtx.currentTime)

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

            // add waveform data to the waveform series
            const waveData = ArrayBufferToPointArray(this._data.timeDomain, offSetScaler(this._lastTime), freqScaler)
            this._series.waveform.add(waveData)
            this._lastTime += waveData.length

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

        // setup charts
        this._charts = {
            timeDomain: this._setupChart({ columnIndex: 0, columnSpan: 1, rowIndex: 0, rowSpan: 1 }, 'Time Domain', 'Sample', 'Amplitude', [-1, 1]),
            waveformHistory: this._setupChart({ columnIndex: 0, columnSpan: 1, rowIndex: 1, rowSpan: 1 }, 'Waveform history', 'Time (s)', 'Amplitude', [-1, 1]),
            frequency: this._setupChart({ columnIndex: 0, columnSpan: 1, rowIndex: 2, rowSpan: 2 }, 'Spectrum', 'Frequency Hz)', 'dB', [0, 256])
        }
        this._charts.waveformHistory
            .getDefaultAxisX()
            .setScrollStrategy(AxisScrollStrategies.progressive)
            .setInterval(0, this._audioCtx.sampleRate * 10)
        this._charts.timeDomain.getDefaultAxisX().setInterval(0, this._audioNodes.analyzer.fftSize)
        this._charts.frequency.getDefaultAxisX().setInterval(0, this._audioCtx.sampleRate / this._audioNodes.analyzer.fftSize * this._audioNodes.analyzer.frequencyBinCount)
        this._charts.frequency.getDefaultAxisY().setInterval(this._audioNodes.analyzer.minDecibels, this._audioNodes.analyzer.maxDecibels)

        // replace the default axis tick strategy formatter formatValue function
        this._charts.waveformHistory.getDefaultAxisX().tickStrategy.formatValue = (value: number, range: FormattingRange): string => {
            return (value / this._audioCtx.sampleRate).toFixed(2)
        }

        // create series
        this._series = {
            timeDomain: this._setupSeries(this._charts.timeDomain, 'Time Domain', '#fff'),
            waveform: this._setupSeries(this._charts.waveformHistory, 'Waveform History', '#fff'),
            frequency: {
                display: this._setupSeries(this._charts.frequency, 'Frequency', '#0d0'),
                cursor: this._setupSeries(this._charts.frequency, 'Frequency', '#0000')
            },
            history: this._setupSeries(this._charts.frequency, 'Frequency Decay', '#0aa'),
            maxFrequency: {
                display: this._setupSeries(this._charts.frequency, 'Frequency Max', '#aa0'),
                cursor: this._setupSeries(this._charts.frequency, 'Frequency Max', '#0000')
            }
        }

        // setup waveform series
        this._series.waveform
            .setMouseInteractions(false)
            .setMaxPointCount(1000 * 1000)
            .setCursorInterpolationEnabled(false)

        // setup frequency series
        this._series.frequency.display
            .setMouseInteractions(false)
            .setCursorEnabled(false)
        this._series.frequency.cursor
            .add(this._points.frequency)

        // setup max frequency series
        this._series.maxFrequency.display
            .setMouseInteractions(false)
            .setCursorEnabled(false)
        this._series.maxFrequency.cursor
            .add(this._points.maxHistory)

        // history reset button
        this._charts.frequency.addUIElement(
            UIElementBuilders.ButtonBox
        )
            .setText('Reset Frequency Max')
            .setOrigin(UIOrigins.LeftTop)
            .setPosition({ x: 1, y: 99 })
            .onMouseClick(() => {
                for (let i = 0; i < this._data.maxHistory.byteLength; i++) {
                    this._data.maxHistory[i] = 0
                }
                // refresh the displayed data
                this._series.maxFrequency.display.clear()
                this._series.maxFrequency.display.add(ArrayBufferToPointArray(this._data.maxHistory))
            })
    }

    /**
     * Create and setup the dashboard
     */
    private _setupDashboard() {
        this._db = lightningChart().Dashboard({
            containerId: 'chart',
            numberOfColumns: 1,
            numberOfRows: 4,
            theme: Themes.dark
        })
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
        chart
            .getAxes().forEach(axis => {
            })
        chart.getDefaultAxisX()
            .setTitle(xAxisTitle)

        chart.getDefaultAxisY()
            .setScrollStrategy(undefined)
            .setInterval(yInterval[0], yInterval[1])
            .setTitle(yAxisTitle)
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
            dataPattern: DataPatterns.horizontalProgressive
        })
        series
            .setStrokeStyle((style: SolidLine) => style.setFillStyle((fill: SolidFill) => fill.setColor(ColorHEX(color))))
            .setName(name)
            .setCursorInterpolationEnabled(false)
        return series
    }

    /**
     * Update series that require manual refresh
     */
    public update() {
        this._series.frequency.display.clear()
        this._series.frequency.display.add(this._points.frequency)
        this._series.history.clear()
        this._series.history.add(this._points.history)
        this._series.maxFrequency.display.clear()
        this._series.maxFrequency.display.add(this._points.maxHistory)
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
