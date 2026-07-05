/**
 * Noise cancellation + voice activity detection for always-on listen.
 * - Browser noiseSuppression / echoCancellation / autoGainControl
 * - High-pass filter (~180 Hz) cuts fan rumble
 * - Adaptive noise floor calibration
 * - Records only when speech energy detected
 */
(() => {
  const MIC_CONSTRAINTS = {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  };

  const NOISE_WORDS = /^(uh+|um+|hmm+|hm+|ah+|oh+|mm+|mhm+|la+|na+|yeah+\.?|okay+\.?)$/i;
  const WAKE_OR_CMD = /wake\s*up|tony|build|open|run|hey|stop|yes|no|help|automate/i;

  function isLikelyNoiseTranscript(text, confidence, minConfidence = 0.55) {
    const t = String(text || '').trim();
    if (!t) return true;
    if (confidence != null && confidence < minConfidence) return true;
    if (NOISE_WORDS.test(t)) return true;
    if (/^[\W\d]+$/.test(t)) return true;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length === 1 && t.length < 5 && !WAKE_OR_CMD.test(t)) return true;
    if (words.length <= 2 && t.length < 8 && !WAKE_OR_CMD.test(t)) return true;
    return false;
  }

  class VoiceGate {
    constructor(opts = {}) {
      this.speechMult = opts.speechMult ?? 3.2;
      this.minSpeechMs = opts.minSpeechMs ?? 350;
      this.silenceMs = opts.silenceMs ?? 900;
      this.highPassHz = opts.highPassHz ?? 180;
      this.calibrationMs = opts.calibrationMs ?? 2200;
      this.minRms = opts.minRms ?? 0.014;
      this.running = false;
      this.paused = false;
      this.recording = false;
      this.calibrating = true;
      this.noiseFloor = 0.008;
      this.onSegment = null;
    }

    async start(onSpeechSegment) {
      this.onSegment = onSpeechSegment;
      this.running = true;
      this.calibrating = true;
      this.calibrationSamples = [];
      this.calibrationStarted = Date.now();

      this.stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.source = this.ctx.createMediaStreamSource(this.stream);

      this.highpass = this.ctx.createBiquadFilter();
      this.highpass.type = 'highpass';
      this.highpass.frequency.value = this.highPassHz;
      this.highpass.Q.value = 0.7;

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.82;

      this.dest = this.ctx.createMediaStreamDestination();

      this.source.connect(this.highpass);
      this.highpass.connect(this.analyser);
      this.highpass.connect(this.dest);

      this.monitor();
      return true;
    }

    getRms() {
      const data = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
      return Math.sqrt(sum / data.length);
    }

    threshold() {
      return Math.max(this.noiseFloor * this.speechMult, this.minRms);
    }

    monitor() {
      if (!this.running) return;

      if (!this.paused) {
        const rms = this.getRms();

        if (this.calibrating) {
          this.calibrationSamples.push(rms);
          if (Date.now() - this.calibrationStarted > this.calibrationMs) {
            const sorted = [...this.calibrationSamples].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length * 0.55)] || 0.008;
            this.noiseFloor = Math.max(median, 0.004);
            this.calibrating = false;
          }
        } else {
          const speech = rms > this.threshold();

          if (speech) {
            this.lastSpeechAt = Date.now();
            if (!this.recording) {
              if (!this.speechStartedAt) this.speechStartedAt = Date.now();
              else if (Date.now() - this.speechStartedAt > 140) this.beginRecording();
            }
          } else if (this.recording) {
            if (Date.now() - (this.lastSpeechAt || 0) > this.silenceMs) this.endRecording();
          } else {
            this.speechStartedAt = null;
          }
        }
      }

      requestAnimationFrame(() => this.monitor());
    }

    beginRecording() {
      if (this.recording || this.calibrating || this.paused) return;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      this.chunks = [];
      this.recordStartedAt = Date.now();
      this.recorder = new MediaRecorder(this.dest.stream, { mimeType: mime, audioBitsPerSecond: 64000 });
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mime });
        const duration = Date.now() - (this.recordStartedAt || 0);
        if (duration >= this.minSpeechMs && blob.size > 600 && this.onSegment) {
          this.onSegment(blob, mime);
        }
        this.recording = false;
        this.speechStartedAt = null;
      };
      this.recorder.start();
      this.recording = true;
    }

    endRecording() {
      if (this.recorder?.state === 'recording') this.recorder.stop();
    }

    setPaused(paused) {
      this.paused = paused;
      if (paused && this.recorder?.state === 'recording') this.endRecording();
      this.speechStartedAt = null;
    }

    stop() {
      this.running = false;
      if (this.recorder?.state === 'recording') this.recorder.stop();
      this.stream?.getTracks().forEach((t) => t.stop());
      if (this.ctx?.state !== 'closed') this.ctx.close().catch(() => {});
      this.stream = null;
      this.ctx = null;
    }
  }

  window.tonyVoiceNoise = { VoiceGate, MIC_CONSTRAINTS, isLikelyNoiseTranscript };
})();
