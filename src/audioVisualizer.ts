import { loadAudioFile } from "./audioSources"

export class AudioVisualizer {
    private _audioCtx: AudioContext
    private _audioNodes: {
        analyzer: AnalyserNode,
        processor: ScriptProcessorNode,
        gain: GainNode
    }
    private _source: AudioNode | undefined

    constructor() {
        this._audioCtx = new AudioContext()
        this._audioNodes = {
            analyzer: this._audioCtx.createAnalyser(),
            processor: this._audioCtx.createScriptProcessor(),
            gain: this._audioCtx.createGain()
        }
        // muted by default
        this._audioNodes.gain.gain.setValueAtTime(0, this._audioCtx.currentTime)

        // setup audio processor
        this._audioNodes.processor.onaudioprocess = (ev: AudioProcessingEvent) => {
            ev.outputBuffer.copyToChannel(ev.inputBuffer.getChannelData(0), 0)
        }

        // setup node graph
        this._audioNodes.processor.connect(this._audioNodes.analyzer)
        this._audioNodes.analyzer.connect(this._audioNodes.gain)
        this._audioNodes.gain.connect(this._audioCtx.destination)
    }

    //#region Controls
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
    public setSource(source: AudioNode) {
        if (this._source) {
            this._source.disconnect(this._audioNodes.processor)
        }
        this._source = source
        this._source.connect(this._audioNodes.processor)
    }
    //#endregion

    public getContext(): AudioContext {
        return this._audioCtx
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
