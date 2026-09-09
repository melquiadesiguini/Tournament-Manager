// Reproduce una alarma de "fin de tiempo" estilo timbre eléctrico de escuela
// (tono con vibrato rápido, ~3s) usando la Web Audio API.
// No depende de ningún archivo de audio externo.
export default function playBuzzer() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    const ctx = new AudioContextClass()
    const now = ctx.currentTime
    const duration = 3 // segundos

    // Envolvente general: entrada y salida suaves para evitar "clicks"
    const envelopeGain = ctx.createGain()
    envelopeGain.gain.setValueAtTime(0.0001, now)
    envelopeGain.gain.exponentialRampToValueAtTime(0.6, now + 0.05)
    envelopeGain.gain.setValueAtTime(0.6, now + duration - 0.15)
    envelopeGain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    envelopeGain.connect(ctx.destination)

    // Ganancia del tono principal, modulada por el vibrato (efecto "brrrring")
    const carrierGain = ctx.createGain()
    carrierGain.gain.value = 0.5
    carrierGain.connect(envelopeGain)

    // Tono principal del timbre + un armónico para darle cuerpo metálico
    const carrier = ctx.createOscillator()
    carrier.type = 'square'
    carrier.frequency.value = 440
    carrier.connect(carrierGain)

    const harmonic = ctx.createOscillator()
    harmonic.type = 'square'
    harmonic.frequency.value = 880
    const harmonicGain = ctx.createGain()
    harmonicGain.gain.value = 0.35
    harmonic.connect(harmonicGain)
    harmonicGain.connect(carrierGain)

    // Vibrato rápido (LFO) que modula la ganancia del tono principal
    const lfo = ctx.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = 26
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 0.5
    lfo.connect(lfoDepth)
    lfoDepth.connect(carrierGain.gain)

    carrier.start(now)
    harmonic.start(now)
    lfo.start(now)
    carrier.stop(now + duration + 0.05)
    harmonic.stop(now + duration + 0.05)
    lfo.stop(now + duration + 0.05)

    setTimeout(() => ctx.close(), (duration + 0.4) * 1000)
  } catch (error) {
    console.warn('No se pudo reproducir el sonido del temporizador:', error)
  }
}
