// Tiny Web Audio synth for game SFX. No external assets required.
let ctx: AudioContext | null = null;
let muted = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setMuted(v: boolean) {
  muted = v;
  if (typeof window !== "undefined") localStorage.setItem("bb_muted", v ? "1" : "0");
}
export function isMuted() {
  if (typeof window !== "undefined") return localStorage.getItem("bb_muted") === "1";
  return muted;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.15, freqEnd?: number) {
  if (isMuted()) return;
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + duration + 0.02);
}

export const sfx = {
  pick: () => tone(420, 0.08, "triangle", 0.12),
  place: () => tone(520, 0.1, "triangle", 0.18, 720),
  invalid: () => tone(180, 0.15, "sawtooth", 0.1, 100),
  clear: (combo: number) => {
    const base = 600 + combo * 80;
    tone(base, 0.12, "square", 0.12, base * 1.6);
    setTimeout(() => tone(base * 1.5, 0.12, "square", 0.1, base * 2.2), 80);
    setTimeout(() => tone(base * 2, 0.18, "triangle", 0.14, base * 3), 160);
  },
  combo: (n: number) => {
    for (let i = 0; i < n; i++) {
      setTimeout(() => tone(700 + i * 120, 0.1, "square", 0.1, 1200 + i * 200), i * 60);
    }
  },
  gameOver: () => {
    tone(400, 0.2, "sawtooth", 0.15, 100);
    setTimeout(() => tone(250, 0.3, "sawtooth", 0.15, 80), 180);
    setTimeout(() => tone(150, 0.5, "sawtooth", 0.15, 60), 400);
  },
};
