/**
 * Sound + voice alert engine for Workman Services ERP.
 *
 * All cues are synthesized with the Web Audio API — no audio files.
 * A single shared AudioContext is created lazily and resumed on the first
 * user gesture (pointerdown / keydown), which is what browsers require
 * before audio or speech may play. Until that gesture happens, cues and
 * speech are silently skipped while visual toasts still show.
 *
 * Master switch: localStorage key `wms_sound_alerts` ("true" / "false"),
 * default ON. When muted, every cue and all TTS are suppressed — visual
 * notifications are never affected.
 */

export type ToastCueTone = "success" | "error" | "warning" | "info" | "notification";

const STORAGE_KEY = "wms_sound_alerts";

let sharedContext: AudioContext | null = null;
let gestureUnlocked = false;
let enabledCache: boolean | null = null;
const enabledListeners = new Set<(enabled: boolean) => void>();

export function isSoundEnabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  if (typeof window === "undefined") return true;
  try {
    enabledCache = window.localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    enabledCache = true;
  }
  return enabledCache;
}

export function setSoundEnabled(enabled: boolean): void {
  enabledCache = enabled;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // Storage unavailable (private mode) — the in-memory value still applies.
    }
    if (!enabled && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }
  enabledListeners.forEach((fn) => {
    try {
      fn(enabled);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeSoundEnabled(fn: (enabled: boolean) => void): () => void {
  enabledListeners.add(fn);
  return () => {
    enabledListeners.delete(fn);
  };
}

/** True once the user has interacted with the page (audio/TTS unlocked). */
export function hasAudioUnlocked(): boolean {
  return gestureUnlocked;
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedContext) {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      sharedContext = new AudioContextClass();
    }
    if (sharedContext.state === "suspended") {
      sharedContext.resume().catch(() => {});
    }
    return sharedContext;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  const unlock = () => {
    gestureUnlocked = true;
    ensureContext();
    // Warm up the voice list so the first spoken alert is not delayed.
    try {
      window.speechSynthesis?.getVoices();
    } catch {
      // ignore
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
}

interface ToneSpec {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

function playTones(tones: ToneSpec[], masterGainValue: number): void {
  if (!isSoundEnabled()) return;
  const ctx = ensureContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(masterGainValue, now);
    master.connect(ctx.destination);
    tones.forEach(({ freq, start, duration, type = "sine", gain = 1 }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      noteGain.gain.setValueAtTime(0.0001, now + start);
      noteGain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + start + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(noteGain);
      noteGain.connect(master);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    });
  } catch {
    // Audio not permitted yet — the visual toast still shows.
  }
}

/** Short pleasant two-tone rising chime (D5 → A5). */
export function playSuccessCue(): void {
  playTones(
    [
      { freq: 587.33, start: 0, duration: 0.16, gain: 0.5 },
      { freq: 880.0, start: 0.11, duration: 0.3, gain: 0.5 },
    ],
    0.16
  );
}

/** Low, soft descending buzz — noticeable but not harsh. */
export function playErrorCue(): void {
  playTones(
    [
      { freq: 196.0, start: 0, duration: 0.2, type: "triangle", gain: 0.7 },
      { freq: 146.83, start: 0.16, duration: 0.3, type: "triangle", gain: 0.7 },
    ],
    0.18
  );
}

/** Warm double-pulse warning tone. */
export function playWarningCue(): void {
  playTones(
    [
      { freq: 622.25, start: 0, duration: 0.14, gain: 0.55 },
      { freq: 622.25, start: 0.2, duration: 0.22, gain: 0.55 },
    ],
    0.16
  );
}

/** Gentle single ping. */
export function playInfoCue(): void {
  playTones([{ freq: 659.25, start: 0, duration: 0.22, gain: 0.45 }], 0.14);
}

/** Three-note harmonic chime (C5 → E5 → G5) for general notifications. */
export function playNotificationCue(): void {
  playTones(
    [
      { freq: 523.25, start: 0, duration: 0.14, gain: 0.5 },
      { freq: 659.25, start: 0.09, duration: 0.16, gain: 0.5 },
      { freq: 783.99, start: 0.18, duration: 0.3, gain: 0.5 },
    ],
    0.15
  );
}

/** Dispatch a cue matching a toast tone. Used by the toast system. */
export function playToastCue(tone: ToastCueTone = "info"): void {
  switch (tone) {
    case "success":
      playSuccessCue();
      break;
    case "error":
      playErrorCue();
      break;
    case "warning":
      playWarningCue();
      break;
    case "notification":
      playNotificationCue();
      break;
    default:
      playInfoCue();
  }
}

/**
 * LOUD attention cue for incoming requests that need a human decision:
 * a three-tone siren-style sweep repeated twice at high volume.
 */
export function playAlertCue(): void {
  const sweep: ToneSpec[] = [
    { freq: 783.99, start: 0, duration: 0.22, type: "square", gain: 0.32 },
    { freq: 1046.5, start: 0.22, duration: 0.22, type: "square", gain: 0.32 },
    { freq: 1318.51, start: 0.44, duration: 0.3, type: "square", gain: 0.32 },
    { freq: 783.99, start: 0.86, duration: 0.22, type: "square", gain: 0.32 },
    { freq: 1046.5, start: 1.08, duration: 0.22, type: "square", gain: 0.32 },
    { freq: 1318.51, start: 1.3, duration: 0.42, type: "square", gain: 0.32 },
  ];
  playTones(sweep, 0.5);
}

/**
 * Speak an alert aloud at full volume. Only fires when sound is enabled
 * AND the browser has seen a user gesture (autoplay policy); otherwise it
 * is a no-op and the visual toast carries the message.
 */
export function speakAlert(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!isSoundEnabled() || !gestureUnlocked) return;
  const clean = String(text ?? "").trim();
  if (!clean) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const englishVoice =
      voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("English"))
      ) || voices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) utterance.voice = englishVoice;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech unavailable — sound cue + toast still fired.
  }
}
