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
