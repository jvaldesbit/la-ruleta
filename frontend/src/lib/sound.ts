/**
 * Sonido de la mesa, sintetizado con Web Audio: ni archivos ni librerías.
 *
 * Cada efecto es un oscilador (o un poco de ruido) con su envolvente, así que
 * pesa cero en la imagen y se puede variar el tono en cada golpe para que dos
 * fichas seguidas no suenen calcadas.
 *
 * Reglas de la casa:
 * - Nada suena hasta que el usuario toca algo: el contexto se crea o se reanuda
 *   en el primer gesto, que es además lo que exigen los navegadores.
 * - Volumen bajo por defecto: esto acompaña, no anuncia.
 * - Si no hay Web Audio, no hay sonido y no pasa nada más.
 */

export type SoundName = 'chip' | 'place' | 'spin' | 'stop' | 'win' | 'lose'

const STORAGE_KEY = 'la-ruleta:sound'
const MASTER_GAIN = 0.22

type Ctx = AudioContext & { __master?: GainNode }

let ctx: Ctx | null = null
let master: GainNode | null = null
let unsupported = false
let spinNodes: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null
let lastChipAt = 0

function audioCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

export function soundSupported(): boolean {
  return !unsupported && audioCtor() !== null
}

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'off'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on')
  } catch {
    // Sin persistencia: el estado vive solo en esta sesión.
  }
  if (master !== null && ctx !== null) {
    master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime, 0.02)
  }
  if (muted) stopSpin()
}

/** Se llama en el primer gesto del usuario: antes de eso no se crea nada. */
export function primeAudio(): void {
  if (unsupported || ctx !== null) {
    void ctx?.resume()
    return
  }
  const Ctor = audioCtor()
  if (Ctor === null) {
    unsupported = true
    return
  }
  try {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = isMuted() ? 0 : MASTER_GAIN
    master.connect(ctx.destination)
    void ctx.resume()
  } catch {
    unsupported = true
    ctx = null
    master = null
  }
}

function ready(): { ctx: Ctx; master: GainNode } | null {
  if (ctx === null || master === null || isMuted()) return null
  if (ctx.state === 'suspended') void ctx.resume()
  return { ctx, master }
}

/** Golpe corto: ataque inmediato y caída rápida. Es la base de casi todo. */
function blip(
  target: { ctx: Ctx; master: GainNode },
  freq: number,
  duration: number,
  type: OscillatorType,
  peak: number,
  glideTo?: number,
): void {
  const { ctx: audio, master: out } = target
  const now = audio.currentTime
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(glideTo, now + duration)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.006)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  osc.connect(gain).connect(out)
  osc.start(now)
  osc.stop(now + duration + 0.02)
}

/** Pizca de ruido filtrado: el "clac" de la baquelita contra el tapete. */
function noiseBurst(target: { ctx: Ctx; master: GainNode }, duration: number, peak: number, hz: number): void {
  const { ctx: audio, master: out } = target
  const now = audio.currentTime
  const frames = Math.max(1, Math.floor(audio.sampleRate * duration))
  const buffer = audio.createBuffer(1, frames, audio.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }
  const src = audio.createBufferSource()
  src.buffer = buffer
  const filter = audio.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = hz
  filter.Q.value = 1.1
  const gain = audio.createGain()
  gain.gain.setValueAtTime(peak, now)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
  src.connect(filter).connect(gain).connect(out)
  src.start(now)
}

function startSpin(target: { ctx: Ctx; master: GainNode }): void {
  if (spinNodes !== null) return
  const { ctx: audio, master: out } = target
  const now = audio.currentTime
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  const lfo = audio.createOscillator()
  const lfoGain = audio.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(320, now)
  // La rueda pierde fuelle: el zumbido baja a lo largo del giro.
  osc.frequency.exponentialRampToValueAtTime(120, now + 4.2)

  // La bola pasando por los separadores: un temblor que se va espaciando.
  lfo.type = 'sawtooth'
  lfo.frequency.setValueAtTime(26, now)
  lfo.frequency.exponentialRampToValueAtTime(5, now + 4.2)
  lfoGain.gain.value = 0.05
  lfo.connect(lfoGain).connect(gain.gain)

  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.09, now + 0.25)
  gain.gain.setValueAtTime(0.09, now + 3.4)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.4)

  osc.connect(gain).connect(out)
  osc.start(now)
  lfo.start(now)
  osc.stop(now + 4.6)
  lfo.stop(now + 4.6)
  spinNodes = { osc, gain, lfo }
  window.setTimeout(() => {
    spinNodes = null
  }, 4700)
}

function stopSpin(): void {
  if (spinNodes === null || ctx === null) return
  const now = ctx.currentTime
  try {
    spinNodes.gain.gain.cancelScheduledValues(now)
    spinNodes.gain.gain.setTargetAtTime(0, now, 0.05)
    spinNodes.osc.stop(now + 0.3)
    spinNodes.lfo.stop(now + 0.3)
  } catch {
    // Ya estaba parado.
  }
  spinNodes = null
}

/** Arpegio corto ascendente o descendente, para los remates. */
function arpeggio(target: { ctx: Ctx; master: GainNode }, notes: number[], step: number, type: OscillatorType): void {
  notes.forEach((freq, index) => {
    window.setTimeout(() => {
      const live = ready()
      if (live !== null) blip(live, freq, 0.34, type, 0.16)
    }, index * step)
  })
  void target
}

export function playSound(name: SoundName): void {
  const target = ready()
  if (target === null) return

  switch (name) {
    case 'chip': {
      // Dos fichas seguidas nunca idénticas: se mueve el tono un poco.
      const now = performance.now()
      const crowded = now - lastChipAt < 70
      lastChipAt = now
      if (crowded) return
      const detune = 0.9 + Math.random() * 0.25
      noiseBurst(target, 0.05, 0.32, 1900 * detune)
      blip(target, 420 * detune, 0.08, 'triangle', 0.1, 210 * detune)
      break
    }
    case 'place': {
      // Confirmación: dos golpes de latón, como el canto sobre la mesa.
      blip(target, 520, 0.1, 'triangle', 0.13)
      window.setTimeout(() => {
        const live = ready()
        if (live !== null) blip(live, 780, 0.16, 'triangle', 0.12)
      }, 70)
      break
    }
    case 'spin':
      startSpin(target)
      break
    case 'stop':
      stopSpin()
      noiseBurst(target, 0.09, 0.3, 1200)
      blip(target, 240, 0.22, 'sine', 0.15, 120)
      break
    case 'win':
      arpeggio(target, [523.25, 659.25, 783.99, 1046.5], 85, 'triangle')
      break
    case 'lose':
      arpeggio(target, [349.23, 277.18, 220], 110, 'sine')
      break
  }
}
