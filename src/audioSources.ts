/**
 * Available source options
 */
export enum SrcOption {
    mic = 'mic',
    file = 'file',
    truck = 'truck',
    f500_1000_1000 = 'f500_1000_1000',
    symbhony_no_5 = 'symbhony_no_5',
}

/**
 * Labels for different source options
 */
const srcLabels: { [key in keyof typeof SrcOption]: string } = {
    truck: 'Truck Driving',
    mic: 'Microphone',
    file: 'Load Audio File from URL',
    f500_1000_1000: '500Hz, 1kHz and 10kHz signals',
    symbhony_no_5: 'Symphony no. 5 in Cm, Op. 67 - IV. Allegro',
}

/**
 * Default audio source files
 */
export const sourceAudioFiles = {
    truck: 'Truck_driving_by-Jason_Baker-2112866529.wav',
    symbhony_no_5: 'Symphony no. 5 in Cm, Op. 67 - IV. Allegro.mp3',
    f500_1000_1000: '500_1000_10000.wav',
}

/**
 * Cache of loaded audio files
 */
const loadedFiles: { [key: string]: AudioBuffer } = {}

/**
 * Load audio file from url
 * @param url URL of the audio file
 * @param audioCtx AudioContext
 */
export const loadAudioFile = async (url: string, audioCtx: AudioContext): Promise<AudioBuffer> => {
    // if the file is already cached
    if (loadedFiles[url]) {
        return loadedFiles[url]
    }
    // file not cached yet
    const request = await fetch(url)
    const buffer = await request.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(buffer)

    loadedFiles[url] = audioBuffer
    return audioBuffer
}

/**
 * Create the options for different audio sources
 */
export const setupSourceLabels = () => {
    const selector = document.getElementById('src-selector')
    Object.keys(srcLabels).forEach((key) => {
        const option = document.createElement('option')
        option.value = key
        option.text = srcLabels[key]
        if (key === SrcOption.truck) option.selected = true
        selector.appendChild(option)
    })
}
