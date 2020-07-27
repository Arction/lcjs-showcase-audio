import './styles/main.scss'
import { SrcOption, setupSourceLabels, sourceAudioFiles } from "./audioSources"
import { setupPlayPause } from "./controls"
import { AudioVisualizer } from "./audioVisualizer"

// show error if iOS
if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
    (document.getElementById('ios-error') as HTMLDivElement).hidden = false
}
// hide link when in iframe
function inIframe () {
    try {
        return window.self !== window.top
    } catch (e) {
        return true
    }
}
if (inIframe()){
    document.getElementById('github-link').style.display = 'none'
}
/**
 * Current Audio source
 */
let src: SrcOption = SrcOption.mic

// setup the source selector
setupSourceLabels()

// create a new instance of the AudioVisualizer class, this handles all of the actual visualization work
const audioVisualizer = new AudioVisualizer()

// attach the play and pause buttons to the audioVisualizer play and pause methods
setupPlayPause(audioVisualizer.play.bind(audioVisualizer), audioVisualizer.pause.bind(audioVisualizer))

const srcSelector = document.getElementById('src-selector') as HTMLSelectElement
const audioFileUrlPlay = document.getElementById('load-url') as HTMLButtonElement
const audioFileUrl = document.getElementById('audio-file') as HTMLInputElement

/**
 * Audio file from url play
 */
audioFileUrlPlay.addEventListener('click', async () => {
    await listenToFileURL(audioFileUrl.value)
    await audioVisualizer.play()
})

/**
 * Update the current visualizer source
 */
const updateSource = async () => {
    const selectedOptionElement = srcSelector[srcSelector.selectedIndex] as HTMLOptionElement
    src = selectedOptionElement.value as SrcOption
    if (src === SrcOption.file) {
        document.getElementById('audio-input').style.display = 'flex'
    } else {
        const ai = document.getElementById('audio-input') as HTMLInputElement
        ai.style.display = 'none'
        ai.value = ''
    }
    await audioVisualizer.pause()
    switch (src) {
        case SrcOption.mic:
            await listenMic()
            await audioVisualizer.play()
            break
        case SrcOption.file:
            audioVisualizer.setSource(undefined)
            break
        case SrcOption.truck:
            await listenToFileURL(sourceAudioFiles.truck)
            await audioVisualizer.play()
            break
        case SrcOption.f500_1000_1000:
            await listenToFileURL(sourceAudioFiles.f500_1000_1000)
            await audioVisualizer.play()
            break
        case SrcOption.symbhony_no_5:
            await listenToFileURL(sourceAudioFiles.symbhony_no_5)
            await audioVisualizer.play()
            break
    }
}
srcSelector.addEventListener('change', updateSource)
updateSource()
const listenElement = document.getElementById('listen') as HTMLInputElement

/**
 * Mute/unmute audio output based on the selection state
 */
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

/**
 * Update with a requestAnimationFrame loop
 */
function update() {
    audioVisualizer.update()
    window.requestAnimationFrame(update)
}

window.requestAnimationFrame(update)

// hide the play button if it's not needed
audioVisualizer.getContext().addEventListener('statechange', () => {
    if (!resumeElement.hidden && audioVisualizer.getState() !== 'suspended') {
        resumeElement.hidden = true
    }
})

// handle cases where the audio context was created in suspended state
const resumeElement = document.getElementById('resume')
resumeElement.addEventListener('click', () => {
    audioVisualizer.play()
})
if (audioVisualizer.getState() === 'suspended') {
    resumeElement.hidden = false
}
