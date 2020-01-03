export const setupPlayPause = (onPlay, onPause) => {
    const play = document.getElementById('play')
    play.addEventListener('click', async () => {
        await onPlay()
        pause.hidden = false
        play.hidden = true
    })

    const pause = document.getElementById('pause')
    pause.addEventListener('click', async () => {
        await onPause()
        pause.hidden = true
        play.hidden = false
    })
}
