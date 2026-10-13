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

if (typeof window !== "undefined") {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}
  };
  window.addEventListener("click", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });
}

/**
 * Plays a rich, longer multi-note attention chime using Web Audio API synthesis
 * Lasts approx 1.8 seconds with harmonic decay.
 */
export function playLongerChime(type: "discount" | "stock" | "general" = "general") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.28, now);
    masterGain.connect(ctx.destination);

    // Multi-tone notes configuration
    let notes: { freq: number; start: number; dur: number }[] = [];

    if (type === "stock") {
      // 4-note ascending attention chime for warehouse stock request
      // F#5 (740Hz) -> A#5 (932Hz) -> C#6 (1109Hz) -> F#6 (1480Hz)
      notes = [
        { freq: 739.99, start: 0.0, dur: 0.35 },
        { freq: 932.33, start: 0.22, dur: 0.35 },
        { freq: 1108.73, start: 0.45, dur: 0.4 },
        { freq: 1479.98, start: 0.7, dur: 1.1 },
      ];
    } else if (type === "discount") {
      // 4-note distinctive warm harmonic cascade for discount request
      // D5 (587Hz) -> F#5 (740Hz) -> A5 (880Hz) -> D6 (1175Hz)
      notes = [
        { freq: 587.33, start: 0.0, dur: 0.35 },
        { freq: 739.99, start: 0.22, dur: 0.35 },
        { freq: 880.0, start: 0.45, dur: 0.4 },
        { freq: 1174.66, start: 0.7, dur: 1.1 },
      ];
    } else {
      // General 3-note chime
      notes = [
        { freq: 523.25, start: 0.0, dur: 0.3 },
        { freq: 659.25, start: 0.22, dur: 0.3 },
        { freq: 783.99, start: 0.45, dur: 0.8 },
      ];
    }

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = "sine";
      subOsc.type = "triangle";

      osc.frequency.setValueAtTime(freq, now + start);
      subOsc.frequency.setValueAtTime(freq / 2, now + start);

      noteGain.gain.setValueAtTime(0.001, now + start);
      noteGain.gain.exponentialRampToValueAtTime(0.35, now + start + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);

      osc.connect(noteGain);
      subOsc.connect(noteGain);
      noteGain.connect(masterGain);

      osc.start(now + start);
      subOsc.start(now + start);
      osc.stop(now + start + dur + 0.05);
      subOsc.stop(now + start + dur + 0.05);
    });
  } catch (err) {
    console.warn("[notificationAudio] Failed to play longer attention chime:", err);
  }
}

/**
 * Backward compatibility short chime
 */
export function playChime(type: "discount" | "stock" | "general" = "general") {
  playLongerChime(type);
}

/**
 * Speaks text using the browser SpeechSynthesis API (TTS)
 */
export function speakTts(message: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  try {
    window.speechSynthesis.cancel(); // Stop previous pending speech
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick an English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Female") || v.name.includes("English"))
    ) || voices.find((v) => v.lang.startsWith("en"));

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onend = () => {
      onEnd?.();
    };
    utterance.onerror = () => {
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("[notificationAudio] Failed TTS speech:", err);
    onEnd?.();
  }
}

/**
 * Plays longer audio chime followed by spoken voice notification
 */
export function playNotificationAlert(
  message: string,
  type: "discount" | "stock" | "general" = "general"
) {
  playLongerChime(type);
  setTimeout(() => {
    speakTts(message);
  }, 1100);
}

export interface UrgentAlert {
  id: string;
  type: "inventory" | "discount";
  jobId?: string;
  jobNumber?: string;
  title: string;
  message: string;
  spokenText: string;
  createdAt: number;
  isMuted: boolean;
}

/**
 * URGENT ALERT LOOP MANAGER
 * Keeps playing the longer notification chime and spoken TTS voice
 * repeatedly at intervals until the stock is issued or the discount is granted.
 */
class UrgentAlertLoopManager {
  private alerts: Map<string, UrgentAlert> = new Map();
  private intervalTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(alerts: UrgentAlert[]) => void> = new Set();
  private isCurrentlyPlaying = false;

  public getAlerts(): UrgentAlert[] {
    return Array.from(this.alerts.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public subscribe(listener: (alerts: UrgentAlert[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAlerts());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const list = this.getAlerts();
    this.listeners.forEach((fn) => {
      try {
        fn(list);
      } catch (e) {
        console.error(e);
      }
    });
  }

  /**
   * Add or update an urgent pending alert (starts loop if not already running)
   */
  public addAlert(alert: Omit<UrgentAlert, "createdAt" | "isMuted"> & { isMuted?: boolean }) {
    const existing = this.alerts.get(alert.id);
    const updated: UrgentAlert = {
      ...alert,
      createdAt: existing ? existing.createdAt : Date.now(),
      isMuted: alert.isMuted ?? (existing ? existing.isMuted : false),
    };

    this.alerts.set(alert.id, updated);
    this.notifyListeners();

    // Trigger immediate sound + voice if not muted
    if (!updated.isMuted) {
      this.playCycle(updated);
    }

    // Ensure loop is running
    this.ensureLoopRunning();
  }

  /**
   * Resolve and dismiss an urgent alert (e.g. stock issued or discount approved)
   */
  public resolveAlert(id: string) {
    if (this.alerts.has(id)) {
      this.alerts.delete(id);
      this.notifyListeners();
    }
    if (this.alerts.size === 0) {
      this.stopLoop();
    }
  }

  /**
   * Resolve alerts by Job ID and optional type
   */
  public resolveAlertsByJob(jobId: string, type?: "inventory" | "discount") {
    let changed = false;
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.jobId === jobId) {
        if (!type || alert.type === type) {
          this.alerts.delete(id);
          changed = true;
        }
      }
    }
    if (changed) {
      this.notifyListeners();
    }
    if (this.alerts.size === 0) {
      this.stopLoop();
    }
  }

  /**
   * Mute or unmute a specific alert
   */
  public toggleMute(id: string) {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.isMuted = !alert.isMuted;
      this.notifyListeners();
      if (typeof window !== "undefined" && alert.isMuted) {
        window.speechSynthesis?.cancel();
      }
    }
  }

  /**
   * Silence all active alert audio loops
   */
  public silenceAll() {
    for (const alert of this.alerts.values()) {
      alert.isMuted = true;
    }
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    this.notifyListeners();
  }

  /**
   * Play a single cycle of chime + spoken voice
   */
  private playCycle(alert: UrgentAlert) {
    if (this.isCurrentlyPlaying || alert.isMuted) return;
    this.isCurrentlyPlaying = true;

    playLongerChime(alert.type === "inventory" ? "stock" : "discount");

    setTimeout(() => {
      speakTts(alert.spokenText, () => {
        this.isCurrentlyPlaying = false;
      });
    }, 1200);
  }

  /**
   * Starts periodic reminder interval (every 20 seconds) while unmuted alerts exist
   */
  private ensureLoopRunning() {
    if (this.intervalTimer) return;

    this.intervalTimer = setInterval(() => {
      const activeUnmuted = this.getAlerts().filter((a) => !a.isMuted);
      if (activeUnmuted.length === 0) {
        return;
      }

      // Play the most urgent alert
      const target = activeUnmuted[0];
      this.playCycle(target);
    }, 20000); // Repeat every 20 seconds until issued
  }

  /**
   * Stops loop and cancels any active speech
   */
  private stopLoop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isCurrentlyPlaying = false;
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
  }
}

export const urgentAlertManager = new UrgentAlertLoopManager();
