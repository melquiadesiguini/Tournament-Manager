// Reproduce un timbre de "fin de tiempo" (3 pitidos cortos) usando la Web Audio API.
// No depende de ningún archivo de audio externo.
export default function playBuzzer() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioContextClass()
    const beepStarts = [0, 0.25, 0.5]
    const beepDuration = 0.18

    beepStarts.forEach((start) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()

      oscillator.type = 'square'
      oscillator.frequency.value = 880

      const startTime = ctx.currentTime + start
      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + beepDuration)

      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(startTime)
      oscillator.stop(startTime + beepDuration + 0.02)
    })

    const totalDuration = beepStarts[beepStarts.length - 1] + beepDuration + 0.3
    setTimeout(() => ctx.close(), totalDuration * 1000)
  } catch (error) {
    console.warn('No se pudo reproducir el sonido del temporizador:', error)
  }
}
