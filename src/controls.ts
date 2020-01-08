/**
 * Setup play and pause event listeners
 * @param onPlay Function to run when 'Play' button is pressed
 * @param onPause Function to run when 'Pause' button is pressed
 */
export const setupPlayPause = (onPlay, onPause) => {
    const play = document.getElementById('play')
    play.addEventListener('click', async () => {
        await onPlay()
        play.hidden = true
        pause.hidden = false
    })

    const pause = document.getElementById('pause')
    pause.addEventListener('click', async () => {
        await onPause()
        pause.hidden = true
        play.hidden = false
    })
}
