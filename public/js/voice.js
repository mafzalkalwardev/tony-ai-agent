/**
 * TONY Voice — browser mic/speaker UI wired to Deepgram + ElevenLabs API.
 * Falls back to Web Speech API when cloud keys missing.
 */
(() => {
  const Voice = {
    recording: false,
    voiceOut: true,
    alwaysListen: false,
    alwaysListening: false,
    voiceGate: null,
    pausedForSpeech: false,
    minConfidence: 0.55,
    noiseCancel: true,
    continuousRec: null,
    chunkRecorder: null,
    processingTranscript: false,
    lastProcessedAt: 0,
    mediaRecorder: null,
    chunks: [],
    stream: null,
    recognition: null,
    useBrowserStt: false,
    useBrowserTts: false,
    deepgramOk: false,
    elevenLabsOk: false,
  };

  function $(s) {
    return document.querySelector(s);
  }

  function setVoiceState(state, detail = '') {
    const bar = $('#voiceBar');
    const status = $('#voiceStatus');
    if (!bar) return;
    bar.dataset.state = state;
    if (status) status.textContent = detail || state;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function stripForSpeech(text) {
    return text
      .replace(/[#*_`[\]()]/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 2000);
  }

  async function refreshVoiceHealth() {
    try {
      const h = await fetch('/health').then((r) => r.json());
      Voice.deepgramOk = h.mind?.voice?.stt?.configured;
      Voice.elevenLabsOk = h.mind?.voice?.tts?.configured;
      Voice.alwaysListen = h.companion?.alwaysListen !== false;
      Voice.minConfidence = h.voice?.minConfidence ?? 0.55;
      Voice.noiseCancel = h.voice?.noiseCancellation !== false;
      Voice.useBrowserStt = !Voice.deepgramOk && 'webkitSpeechRecognition' in window;
      Voice.useBrowserTts = !Voice.elevenLabsOk && 'speechSynthesis' in window;

      const mic = $('#micBtn');
      const spk = $('#speakerBtn');
      const label = document.querySelector('.voice-label span');
      if (mic) {
        mic.title = Voice.alwaysListening
          ? 'Always listening — click to pause'
          : Voice.alwaysListen
            ? 'Starting always-on listen…'
            : 'Tap to speak';
      }
      if (label) {
        label.textContent = Voice.alwaysListening
          ? 'Noise-filtered · speak clearly · fan sounds ignored'
          : Voice.alwaysListen
            ? 'Auto-listen enabled · granting mic…'
            : 'Tap mic or hold Space to speak';
      }
      if (!Voice.alwaysListening) {
        setVoiceState(
          'ready',
          Voice.alwaysListen
            ? 'Auto-listen on boot'
            : Voice.deepgramOk && Voice.elevenLabsOk
              ? 'Voice ready · Deepgram + ElevenLabs'
              : 'Voice ready · mixed mode'
        );
      }
    } catch {
      setVoiceState('offline', 'Gateway offline');
    }
  }

  function speechLang() {
    const lang = document.querySelector('.pill.active')?.dataset.lang;
    if (lang === 'ur') return 'ur-PK';
    if (lang === 'hi') return 'hi-IN';
    return 'en-US';
  }

  function shouldProcessTranscript(text, confidence) {
    const t = String(text || '').trim();
    if (t.length < 3) return false;
    if (Voice.processingTranscript) return false;
    if (window.tonyVoiceNoise?.isLikelyNoiseTranscript(t, confidence, Voice.minConfidence)) {
      return false;
    }
    const now = Date.now();
    if (now - Voice.lastProcessedAt < 1800 && t.length < 20) return false;
    return true;
  }

  async function transcribeBlob(blob, mime) {
    const b64 = await blobToBase64(blob);
    return window.tonyApi('/api/voice/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioBase64: b64, mimeType: blob.type || mime }),
    });
  }

  async function handleAlwaysTranscript(transcript, confidence) {
    if (!shouldProcessTranscript(transcript, confidence)) return;
    Voice.lastProcessedAt = Date.now();
    Voice.processingTranscript = true;
    try {
      await processTranscript(transcript);
    } finally {
      Voice.processingTranscript = false;
      if (Voice.alwaysListening) setVoiceState('listening', 'Always listening… speak anytime');
    }
  }

  function startBrowserContinuousListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = speechLang();

    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      if (last.isFinal) {
        const conf = last[0].confidence;
        handleAlwaysTranscript(last[0].transcript, conf);
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed') {
        setVoiceState('error', 'Mic permission denied — allow microphone in browser');
        Voice.alwaysListening = false;
      }
    };

    rec.onend = () => {
      if (Voice.alwaysListening) {
        try {
          rec.start();
        } catch {
          setTimeout(() => Voice.alwaysListening && startBrowserContinuousListen(), 500);
        }
      }
    };

    rec.start();
    Voice.continuousRec = rec;
    Voice.alwaysListening = true;
    $('#micBtn')?.classList.add('active');
    $('#voiceBar')?.classList.add('always-on');
    setVoiceState('listening', `Always listening, ${window.tonyUserName?.() || 'sir'}… just speak`);
    return true;
  }

  async function startVadListen() {
    const Gate = window.tonyVoiceNoise?.VoiceGate;
    if (!Gate) return startDeepgramChunkListenLegacy();

    try {
      Voice.voiceGate = new Gate({
        speechMult: 3.2,
        highPassHz: 180,
        minRms: 0.014,
      });

      await Voice.voiceGate.start(async (blob, mime) => {
        if (Voice.processingTranscript || Voice.pausedForSpeech || !Voice.deepgramOk) return;
        try {
          const stt = await transcribeBlob(blob, mime);
          if (stt.ok && stt.transcript?.trim() && !stt.filtered) {
            await handleAlwaysTranscript(stt.transcript, stt.confidence);
          }
        } catch {
          /* skip noisy chunk */
        }
      });

      Voice.alwaysListening = true;
      $('#micBtn')?.classList.add('active');
      $('#voiceBar')?.classList.add('always-on');
      setVoiceState(
        'listening',
        `Noise-filtered listen — ${window.tonyUserName?.() || 'sir'}, speak clearly`
      );
      return true;
    } catch {
      setVoiceState('error', 'Mic permission required for always-on listen');
      return false;
    }
  }

  async function startDeepgramChunkListenLegacy() {
    try {
      Voice.stream = await navigator.mediaDevices.getUserMedia(
        window.tonyVoiceNoise?.MIC_CONSTRAINTS || { audio: { noiseSuppression: true, echoCancellation: true } }
      );
    } catch {
      setVoiceState('error', 'Mic permission required for always-on listen');
      return false;
    }

    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';

    function startChunk() {
      if (!Voice.alwaysListening || !Voice.stream) return;
      const chunks = [];
      const rec = new MediaRecorder(Voice.stream, { mimeType: mime });
      Voice.chunkRecorder = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        if (!Voice.alwaysListening) return;
        const blob = new Blob(chunks, { type: mime });
        if (blob.size > 800 && !Voice.processingTranscript && window.tonyApi) {
          try {
            const stt = await transcribeBlob(blob, mime);
            if (stt.ok && stt.transcript?.trim() && !stt.filtered) {
              await handleAlwaysTranscript(stt.transcript, stt.confidence);
            }
          } catch {
            /* ignore chunk errors */
          }
        }
        if (Voice.alwaysListening) startChunk();
      };
      rec.start();
      setTimeout(() => {
        if (rec.state === 'recording') rec.stop();
      }, 3500);
    }

    Voice.alwaysListening = true;
    $('#micBtn')?.classList.add('active');
    $('#voiceBar')?.classList.add('always-on');
    setVoiceState('listening', `Always listening, ${window.tonyUserName?.() || 'sir'}… just speak`);
    startChunk();
    return true;
  }

  async function startDeepgramChunkListen() {
    if (Voice.deepgramOk && Voice.noiseCancel && window.tonyVoiceNoise?.VoiceGate) {
      return startVadListen();
    }
    return startDeepgramChunkListenLegacy();
  }

  async function startAlwaysListen() {
    if (Voice.alwaysListening || !window.tonyApi) return;

    if (Voice.noiseCancel && window.tonyVoiceNoise?.VoiceGate) {
      await startVadListen(!Voice.deepgramOk && Voice.useBrowserStt);
      return;
    }

    if (Voice.useBrowserStt || !Voice.deepgramOk) {
      if (startBrowserContinuousListen()) return;
    }
    await startDeepgramChunkListenLegacy();
  }

  function stopAlwaysListen() {
    Voice.alwaysListening = false;
    Voice.voiceGate?.stop();
    Voice.voiceGate = null;
    Voice.continuousRec?.stop();
    Voice.continuousRec = null;
    if (Voice.chunkRecorder?.state === 'recording') Voice.chunkRecorder.stop();
    Voice.chunkRecorder = null;
    if (Voice.stream) {
      Voice.stream.getTracks().forEach((t) => t.stop());
      Voice.stream = null;
    }
    $('#micBtn')?.classList.remove('active');
    $('#voiceBar')?.classList.remove('always-on');
    setVoiceState('ready', 'Listening paused — tap mic to resume');
  }

  function toggleAlwaysListen() {
    if (Voice.alwaysListening) stopAlwaysListen();
    else startAlwaysListen();
  }

  async function playBase64Audio(base64, mimeType = 'audio/mpeg') {
    const audio = new Audio(`data:${mimeType};base64,${base64}`);
    setVoiceState('speaking', 'TONY is speaking…');
    $('#speakerBtn')?.classList.add('active');
    await new Promise((resolve, reject) => {
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play().catch(reject);
    });
    $('#speakerBtn')?.classList.toggle('active', Voice.voiceOut);
    setVoiceState('ready', Voice.voiceOut ? 'Voice output ON' : 'Voice ready');
  }

  function browserSpeak(text) {
    return new Promise((resolve) => {
      if (!Voice.useBrowserTts || !Voice.voiceOut) return resolve();
      const u = new SpeechSynthesisUtterance(stripForSpeech(text));
      u.rate = 1;
      u.pitch = 1;
      setVoiceState('speaking', 'TONY is speaking…');
      u.onend = () => {
        setVoiceState('ready', 'Voice ready');
        resolve();
      };
      speechSynthesis.speak(u);
    });
  }

  async function speakResponse(text) {
    if (!Voice.voiceOut || !text) return;
    const clean = stripForSpeech(text);
    if (!clean) return;

    Voice.pausedForSpeech = true;
    Voice.voiceGate?.setPaused(true);

    try {
      if (Voice.elevenLabsOk && window.tonyApi) {
        try {
          const res = await window.tonyApi('/api/voice/speak', {
            method: 'POST',
            body: JSON.stringify({ text: clean }),
          });
          if (res.ok && res.audio) {
            await playBase64Audio(res.audio, res.mimeType || 'audio/mpeg');
            return;
          }
        } catch {
          /* fall through */
        }
      }
      await browserSpeak(clean);
    } finally {
      Voice.pausedForSpeech = false;
      Voice.voiceGate?.setPaused(false);
      if (Voice.alwaysListening) {
        setVoiceState('listening', 'Noise-filtered listen — speak anytime');
      }
    }
  }

  async function startBrowserRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) throw new Error('Browser speech recognition not supported');

    return new Promise((resolve, reject) => {
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = document.querySelector('.pill.active')?.dataset.lang === 'ur' ? 'ur-PK'
        : document.querySelector('.pill.active')?.dataset.lang === 'hi' ? 'hi-IN'
        : 'en-US';

      rec.onresult = (e) => {
        const t = Array.from(e.results).map((r) => r[0].transcript).join('');
        if (e.results[e.results.length - 1].isFinal) resolve(t);
      };
      rec.onerror = (e) => reject(new Error(e.error || 'Recognition failed'));
      rec.onend = () => {};
      rec.start();
      Voice.recognition = rec;
    });
  }

  async function stopRecordingAndSend() {
    if (!Voice.mediaRecorder || Voice.mediaRecorder.state === 'inactive') return null;

    return new Promise((resolve) => {
      Voice.mediaRecorder.onstop = async () => {
        const blob = new Blob(Voice.chunks, { type: Voice.mediaRecorder.mimeType || 'audio/webm' });
        Voice.chunks = [];
        if (Voice.stream) Voice.stream.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };
      Voice.mediaRecorder.stop();
    });
  }

  async function startRecording() {
    const constraints = window.tonyVoiceNoise?.MIC_CONSTRAINTS || {
      audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
    };
    Voice.stream = await navigator.mediaDevices.getUserMedia(constraints);
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    Voice.mediaRecorder = new MediaRecorder(Voice.stream, { mimeType: mime });
    Voice.chunks = [];
    Voice.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) Voice.chunks.push(e.data);
    };
    Voice.mediaRecorder.start();
    Voice.recording = true;
    setVoiceState('listening', 'Listening… speak now');
    $('#micBtn')?.classList.add('active');
  }

  async function handleVoiceInput() {
    if (!window.tonyApi) {
      alert('Connect with API token first');
      return;
    }

    try {
      let transcript = '';

      if (Voice.deepgramOk) {
        if (!Voice.recording) {
          await startRecording();
          return;
        }
        const blob = await stopRecordingAndSend();
        Voice.recording = false;
        $('#micBtn')?.classList.remove('active');
        if (!blob || blob.size < 100) {
          setVoiceState('ready', 'No audio captured');
          return;
        }
        setVoiceState('processing', 'Transcribing with Deepgram…');
        const stt = await transcribeBlob(blob, blob.type || 'audio/webm');
        if (!stt.ok) throw new Error(stt.error || 'Transcription failed');
        if (!stt.transcript?.trim() || stt.filtered) {
          setVoiceState('ready', 'Only background noise heard — try again');
          return;
        }
        transcript = stt.transcript;
      } else if (Voice.useBrowserStt) {
        setVoiceState('listening', 'Listening… speak now');
        $('#micBtn')?.classList.add('active');
        transcript = await startBrowserRecognition();
        $('#micBtn')?.classList.remove('active');
      } else {
        throw new Error('Add DEEPGRAM_API_KEY to .env or use Chrome for browser speech');
      }

      if (!transcript?.trim()) {
        setVoiceState('ready', 'Could not hear you — try again');
        return;
      }

      await processTranscript(transcript);
    } catch (e) {
      Voice.recording = false;
      $('#micBtn')?.classList.remove('active');
      const msg = e.message || 'Voice failed';
      setVoiceState('error', msg);
      if (/token|Unauthorized|HTML|gateway/i.test(msg)) {
        setVoiceState('error', 'Auth/gateway issue — check TONY_API_TOKEN in .env');
      }
      window.tonyAddMessage?.('assistant', `Voice error: ${msg}`);
    }
  }

  async function processTranscript(transcript) {
    window.tonyAddMessage?.('user', `🎤 ${transcript}`);

    if (/wake\s*up,?\s*tony|utho\s*tony|jaag\s*ja\s*tony/i.test(transcript)) {
      setVoiceState('thinking', 'TONY is waking up…');
      const wake = await window.tonyApi('/api/companion/wake', {
        method: 'POST',
        body: JSON.stringify({ message: transcript, sessionId: window.tonySessionId?.() }),
      });
      if (wake.sessionId) localStorage.setItem('tony_session_id', wake.sessionId);
      window.tonyAddMessage?.('assistant', wake.response);
      if (Voice.voiceOut) await speakResponse(wake.response);
      setVoiceState('ready', 'TONY is online');
      return;
    }

    setVoiceState('thinking', 'TONY is thinking…');

    const useWorkflow =
      transcript.length > 100 ||
      /\b(build|website|deploy|workflow|push to github|integrate|automate|open|click|type|screenshot|desktop|goal loop)\b/i.test(transcript);

    const result = useWorkflow
      ? await window.tonyApi('/api/workflows/run', {
          method: 'POST',
          body: JSON.stringify({
            task: (window.tonyLangPrefix?.() || '') + transcript,
            mode: 'auto',
            speak: false,
            sessionId: window.tonySessionId?.(),
          }),
        })
      : await window.tonyApi('/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            message: (window.tonyLangPrefix?.() || '') + transcript,
            sessionId: window.tonySessionId?.(),
          }),
        });

    if (result.sessionId) {
      localStorage.setItem('tony_session_id', result.sessionId);
    }

    window.tonyAddMessage?.(
      'assistant',
      result.response || '(no response)',
      result.toolResults?.map((t) => t.tool),
      window.tonyResolveAttachments?.(result)
    );

    if (Voice.voiceOut) await speakResponse(result.response);
    setVoiceState('ready', 'Voice ready');
  }

  function initVoice() {
    refreshVoiceHealth().then(() => {
      if (Voice.alwaysListen) startAlwaysListen();
    });
    setInterval(refreshVoiceHealth, 30000);

    $('#micBtn')?.addEventListener('click', () => {
      if (Voice.alwaysListen) toggleAlwaysListen();
      else handleVoiceInput();
    });

    $('#speakerBtn')?.addEventListener('click', () => {
      Voice.voiceOut = !Voice.voiceOut;
      $('#speakerBtn')?.classList.toggle('active', Voice.voiceOut);
      setVoiceState('ready', Voice.voiceOut ? 'Voice output ON' : 'Voice output OFF');
    });

    $('#speakerBtn')?.classList.add('active');

    // Push-to-talk: hold space (Deepgram mode only)
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || e.target.id === 'chatInput') return;
      if (!Voice.deepgramOk || Voice.recording) return;
      e.preventDefault();
      startRecording().catch(() => {});
    });
    document.addEventListener('keyup', (e) => {
      if (e.code !== 'Space' || e.target.id === 'chatInput') return;
      if (!Voice.recording) return;
      e.preventDefault();
      handleVoiceInput();
    });
  }

  window.tonyVoice = {
    speakResponse,
    refreshVoiceHealth,
    initVoice,
    startAlwaysListen,
    stopAlwaysListen,
    Voice,
  };
})();
