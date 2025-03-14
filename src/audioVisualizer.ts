import { loadAudioFile } from './audioSources'
import {
    Point,
    MPoint,
    LineSeries,
    ChartXY,
    AxisTickStrategies,
    Dashboard,
    lightningChart,
    Themes,
    AxisScrollStrategies,
    FormattingRange,
    UIElementBuilders,
    UIOrigins,
    LUT,
    PalettedFill,
    emptyLine,
    NumericTickStrategy,
    ChartOptions,
    PointMarker,
    UIBackground,
    HeatmapScrollingGridSeriesIntensityValues,
    regularColorSteps,
    PointLineAreaSeries,
    emptyFill,
    UIDraggingModes,
} from '@lightningchart/lcjs'
import { Scaler, noScaler, multiplierScaler, dbScaler, freqScaler, offSetScaler } from './utils'

// // Use theme if provided
const urlParams = new URLSearchParams(window.location.search)
let theme = Themes[urlParams.get('theme') as keyof Themes] || Themes.darkGold
if (!theme.isDark) {
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
    for (let i = 0; i < arr.length; i += 1) {
        const p = arr[i]
        p.y = yScaler(buf[i])
        p.x = xScaler(i)
    }
}

/**
 * Convert ArrayBuffer to a Point array
 * @param buf Buffer to convert to point array
 * @param xScaler Scaler for the X-values
 * @param yScaler Scaler for the Y-values
 */
function ArrayBufferToPointArray(
    buf: Uint8Array,
    xScaler: (n: number) => number = noScaler,
    yScaler: (n: number) => number = noScaler,
): Point[] {
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
        analyzer: AnalyserNode
        processor: ScriptProcessorNode
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
        timeDomain: Uint8Array
        frequency: Uint8Array
        history: Uint8Array
        maxHistory: Uint8Array
    }

    /**
     * Point buffers
     */
    private _points: {
        timeDomain: Point[]
        frequency: Point[]
        history: Point[]
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
        timeDomain: ChartXY
        waveformHistory: ChartXY
        spectrum: ChartXY
        spectrogram: ChartXY
    }

    /**
     * All different series
     */
    private _series: {
        timeDomain: PointLineAreaSeries
        waveform: PointLineAreaSeries
        amplitude: PointLineAreaSeries
        history: PointLineAreaSeries
        maxAmplitude: PointLineAreaSeries
        spectrogram: HeatmapScrollingGridSeriesIntensityValues
    }

    private readonly _spectrogramDataCount = 512
    private readonly _waveformHistoryLength = 25

    constructor() {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext
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
            gain: this._audioCtx.createGain(),
        }
        // mute audio output by default
        this._audioNodes.gain.gain.setValueAtTime(0, this._audioCtx.currentTime)

        const spectrogramHistoryLength = this._spectrogramDataCount * (this._audioNodes.analyzer.fftSize / this._audioCtx.sampleRate)
        const mScaler = multiplierScaler(this._audioCtx.sampleRate / this._audioNodes.analyzer.fftSize)
        const dScaler = dbScaler(this._audioNodes.analyzer)
        // setup audio processor
        let tStart = undefined
        this._audioNodes.processor.onaudioprocess = (ev: AudioProcessingEvent) => {
            // update data from analyzer
            this._audioNodes.analyzer.getByteTimeDomainData(this._data.timeDomain)
            this._audioNodes.analyzer.getByteFrequencyData(this._data.frequency)
            // update frequency points
            updatePoints(this._points.frequency, this._data.frequency, mScaler, dScaler)
            // update history and max history data
            for (let i = 0; i < this._data.history.length; i++) {
                this._data.history[i] = Math.max(Math.max(this._data.frequency[i], this._data.history[i] - 25 / 1000), 0)
                this._data.maxHistory[i] = Math.max(Math.max(this._data.frequency[i], this._data.maxHistory[i]), 0)
            }
            // update frequency history points
            updatePoints(this._points.history, this._data.history, mScaler, dScaler)
            // update frequency max history points
            updatePoints(this._points.maxHistory, this._data.maxHistory, mScaler, dScaler)
            // update time domain points
            updatePoints(this._points.timeDomain, this._data.timeDomain, noScaler, freqScaler)

            // update time domain data
            this._series.timeDomain.clear()
            this._series.timeDomain.add(this._points.timeDomain)

            if (tStart === undefined) {
                tStart = performance.now()
            }
            const tNow = performance.now() - tStart

            // add waveform data to the waveform series
            const waveData = Array.from(this._data.timeDomain).map(freqScaler)
            this._series.waveform.appendSamples({
                yValues: waveData,
                step: 1000 / this._audioCtx.sampleRate,
            })

            const freqData = Array.from(this._data.frequency)
            const iSpectrogram = Math.floor(tNow / this._series.spectrogram.getStep().x)
            this._series.spectrogram.invalidateIntensityValues({ iSample: iSpectrogram, values: [freqData] })

            this.update()

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
            maxHistory: new Uint8Array(fBinCount),
        }

        // setup point arrays
        const mapXAxisToSampleRate = (_, i) => ({ x: (this._audioCtx.sampleRate / this._audioNodes.analyzer.fftSize) * i, y: 0 })
        this._points = {
            timeDomain: Array.from<Point>(Array(this._data.timeDomain.length)).map((_, i) => ({ x: i, y: 0 })),
            frequency: Array.from<Point>(Array(fBinCount)).map(mapXAxisToSampleRate),
            history: Array.from<Point>(Array(fBinCount)).map(mapXAxisToSampleRate),
            maxHistory: Array.from<Point>(Array(fBinCount)).map(mapXAxisToSampleRate),
        }

        // setup dashboard
        this._setupDashboard()

        const maxFreq = (this._audioCtx.sampleRate / this._audioNodes.analyzer.fftSize) * this._audioNodes.analyzer.frequencyBinCount

        // setup charts
        this._charts = {
            timeDomain: this._setupChart(
                { columnIndex: 0, columnSpan: 2, rowIndex: 0, rowSpan: 1 },
                'Time Domain',
                'Sample',
                'Amplitude',
                [-1, 1],
            ),
            waveformHistory: this._setupChart(
                { columnIndex: 0, columnSpan: 2, rowIndex: 1, rowSpan: 1 },
                'Waveform history',
                'Time (s)',
                'Amplitude',
                [-1, 1],
            ),
            spectrum: this._setupChart(
                { columnIndex: 0, columnSpan: 1, rowIndex: 2, rowSpan: 1 },
                'Spectrum',
                'Frequency (Hz)',
                'dB',
                [0, 256],
            ),
            spectrogram: this._setupChart(
                { columnIndex: 1, columnSpan: 1, rowIndex: 2, rowSpan: 1 },
                'Spectrogram',
                's',
                'Frequency (Hz)',
                [0, maxFreq / 2],
            ),
        }
        this._charts.waveformHistory
            .getDefaultAxisX()
            .setScrollStrategy(AxisScrollStrategies.progressive)
            .setInterval({ start: 0, end: 15_000, stopAxisAfter: false })
            .setTickStrategy(AxisTickStrategies.Time)

        this._charts.waveformHistory.getDefaultAxisY()

        this._charts.timeDomain.getDefaultAxisX().setInterval({ start: 0, end: this._audioNodes.analyzer.fftSize, stopAxisAfter: false })
        this._charts.spectrum.getDefaultAxisX().setInterval({
            start: 0,
            end: (this._audioCtx.sampleRate / this._audioNodes.analyzer.fftSize) * this._audioNodes.analyzer.frequencyBinCount,
            stopAxisAfter: false,
        })
        this._charts.spectrum
            .setCursor((cursor) => cursor.setTickMarkerYVisible(false))
            .getDefaultAxisY()
            .setInterval({ start: this._audioNodes.analyzer.minDecibels, end: this._audioNodes.analyzer.maxDecibels, stopAxisAfter: false })
        // frequency chart is twice as large as the other charts
        this._db.setRowHeight(2, 2)

        this._charts.timeDomain.setUserInteractions(undefined)

        this._charts.spectrogram
            .getDefaultAxisX()
            .setTickStrategy(AxisTickStrategies.Time)
            .setInterval({
                start: 0,
                end:
                    (this._waveformHistoryLength * this._audioCtx.sampleRate) /
                    (this._audioCtx.sampleRate / this._audioNodes.analyzer.frequencyBinCount),
                stopAxisAfter: false,
            })
            .setScrollStrategy(AxisScrollStrategies.progressive)

        // create series
        this._series = {
            timeDomain: this._setupSeries(this._charts.timeDomain, 'Time Domain'),
            waveform: this._setupSeries(this._charts.waveformHistory, 'Waveform History'),
            amplitude: this._setupSeries(this._charts.spectrum, 'Amplitude'),
            history: this._setupSeries(this._charts.spectrum, 'Amplitude Decay'),
            maxAmplitude: this._setupSeries(this._charts.spectrum, 'Amplitude Max'),
            spectrogram: this._setupHeatmapSeries(
                this._charts.spectrogram,
                this._spectrogramDataCount,
                fBinCount / 2,
                maxFreq / 2,
                'Spectrogram',
            ),
        }

        // setup waveform series
        this._series.waveform.setStrokeStyle((stroke) => stroke.setThickness(1))

        // history reset button
        this._charts.spectrum
            .addUIElement(UIElementBuilders.TextBox)
            .setDraggingMode(UIDraggingModes.notDraggable)
            .setText('Reset Spectrum Max')
            .setOrigin(UIOrigins.LeftTop)
            .setPosition({ x: 0.2, y: 100 })
            .addEventListener('click', () => {
                for (let i = 0; i < this._data.maxHistory.byteLength; i++) {
                    this._data.maxHistory[i] = 0
                }
                // refresh the displayed data
                this._series.maxAmplitude.clear()
                this._series.maxAmplitude.add(ArrayBufferToPointArray(this._data.maxHistory))
            })

        this._series.spectrogram.axisX.setTitle('Time (s)').setTitleFont((f) => f.setSize(13))
    }

    /**
     * Create and setup the dashboard
     */
    private _setupDashboard() {
        this._db = lightningChart({
            warnings: false,
            resourcesBaseUrl: `${window.location.origin}${window.location.pathname}resources`,
        })
            .Dashboard({
                container: 'chart',
                numberOfColumns: 2,
                numberOfRows: 3,
                theme,
            })
            .setSplitterStyle(emptyLine)
            .setBackgroundStrokeStyle(emptyLine)
    }

    /**
     * Create and setup a new chart on the dashboard
     * @param options Dashboard options
     * @param title Chart title
     * @param xAxisTitle X-Axis title
     * @param yAxisTitle Y-Axis title
     * @param yInterval Y-Axis interval
     */
    private _setupChart(
        options: ChartOptions<UIBackground>,
        title: string,
        xAxisTitle: string,
        yAxisTitle: string,
        yInterval: [number, number],
    ): ChartXY {
        const chart = this._db
            .createChartXY({
                ...options,
            })
            .setTitle(title)
            .setTitleFont((font) => font.setSize(12))
            .setPadding({ top: 2, bottom: 2, left: 2, right: 30 })
            .setCursorMode('show-all-interpolated')
        chart
            .getDefaultAxisX()
            .setTitle(xAxisTitle)
            .setTitleFont((f) => f.setSize(12))
            .setAnimationZoom(undefined)

        chart
            .getDefaultAxisY()
            .setScrollStrategy(undefined)
            .setInterval({ start: yInterval[0], end: yInterval[1], stopAxisAfter: false })
            .setTitle(yAxisTitle)
            .setTitleFont((f) => f.setSize(12))
            .setAnimationZoom(undefined)
        return chart
    }

    /**
     * Create and setup a new series on a chart
     * @param chart Chart to which the series should be added to
     * @param name Name of the series
     * @param color Color of the series line
     */
    private _setupSeries(chart: ChartXY, name: string, useDataPattern: boolean = true): PointLineAreaSeries {
        const series = chart
            .addPointLineAreaSeries({
                dataPattern: useDataPattern ? 'ProgressiveX' : null,
            })
            .setAreaFillStyle(emptyFill)
            .setPointFillStyle(emptyFill)
            .setMaxSampleCount({ mode: 'auto' })
            .setName(name)
        return series
    }
    /**
     * Create and setup a new series on a chart
     * @param chart Chart to which the series should be added to
     * @param name Name of the series
     */
    private _setupHeatmapSeries(
        chart: ChartXY,
        columnLength: number,
        columnCount: number,
        yMax: number,
        name: string,
    ): HeatmapScrollingGridSeriesIntensityValues {
        const palette = new LUT({
            steps: regularColorSteps(0, 255, theme.examples.spectrogramColorPalette),
            interpolate: true,
        })
        const series = chart
            .addHeatmapScrollingGridSeries({
                resolution: columnCount,
                scrollDimension: 'columns',
            })
            .setStart({ x: 0, y: 0 })
            .setStep({ x: this._audioCtx.sampleRate / this._audioNodes.analyzer.frequencyBinCount, y: yMax / columnCount })
            .setFillStyle(new PalettedFill({ lut: palette }))
            .setName(name)
            .setDataCleaning({
                minDataPointCount: (this._audioCtx.sampleRate / this._audioNodes.analyzer.frequencyBinCount) * this._waveformHistoryLength,
            })
            .setWireframeStyle(emptyLine)
        return series
    }

    /**
     * Update series that require manual refresh
     */
    public update() {
        this._series.amplitude.clear()
        this._series.amplitude.add(this._points.frequency)
        this._series.history.clear()
        this._series.history.add(this._points.history)
        this._series.maxAmplitude.clear()
        this._series.maxAmplitude.add(this._points.maxHistory)
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
        if (this._source) this._source.connect(this._audioNodes.analyzer)
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
