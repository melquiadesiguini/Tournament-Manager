// Reproduce una alarma de "fin de tiempo" (tono pulsante tipo sirena, ~3s)
// usando la Web Audio API. No depende de ningún archivo de audio externo.
export default function playBuzzer() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioContextClass()

    const totalDuration = 3 // segundos
    const pulseOn = 0.28
    const pulseOff = 0.12
    const cycle = pulseOn + pulseOff

    const masterGain = ctx.createGain()
    masterGain.gain.value = 0.4
    masterGain.connect(ctx.destination)

    for (let start = 0; start < totalDuration; start += cycle) {
      const startTime = ctx.currentTime + start
      const endTime = startTime + pulseOn

      const oscillator = ctx.createOscillator()
      oscillator.type = 'sawtooth'
      // Alterna el tono dentro de cada pulso: efecto de sirena/alarma
      oscillator.frequency.setValueAtTime(880, startTime)
      oscillator.frequency.setValueAtTime(660, startTime + pulseOn / 2)

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, startTime)
      gain.gain.exponentialRampToValueAtTime(1, startTime + 0.02)
      gain.gain.setValueAtTime(1, endTime - 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime)

      oscillator.connect(gain)
      gain.connect(masterGain)
      oscillator.start(startTime)
      oscillator.stop(endTime + 0.02)
    }

    setTimeout(() => ctx.close(), (totalDuration + 0.3) * 1000)
  } catch (error) {
    console.warn('No se pudo reproducir el sonido del temporizador:', error)
  }
}
