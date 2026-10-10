// Audio synthesizer and Text-To-Speech (TTS) notification utility for Workman Services ERP

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a pleasant synthesizer chime for alerts
 */
export function playChime(type: "discount" | "stock" | "general" = "general") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    if (type === "discount") {
      // Warm rising chime (D5 -> A5)
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.18);
      osc2.frequency.setValueAtTime(293.66, now);
      osc2.frequency.exponentialRampToValueAtTime(440.0, now + 0.18);
    } else if (type === "stock") {
      // Crisp attention chime (E5 -> B5)
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(987.77, now + 0.16);
      osc2.frequency.setValueAtTime(329.63, now);
      osc2.frequency.exponentialRampToValueAtTime(493.88, now + 0.16);
    } else {
      // General alert chime
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.2);
    }

    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn("[notificationAudio] Failed to play audio chime:", err);
  }
}

/**
 * Speaks text using the browser SpeechSynthesis API (TTS)
 */
export function speakTts(message: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel(); // Stop any pending speech
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("[notificationAudio] Failed TTS speech:", err);
  }
}

/**
 * Triggers audio chime + spoken voice notification
 */
export function playNotificationAlert(
  message: string,
  type: "discount" | "stock" | "general" = "general"
) {
  playChime(type);
  setTimeout(() => {
    speakTts(message);
  }, 250);
}
