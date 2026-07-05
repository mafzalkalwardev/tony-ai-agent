/**
 * TONY Voice — browser mic/speaker UI wired to Deepgram + ElevenLabs API.
 * Falls back to Web Speech API when cloud keys missing.
 */
(() => {
  const Voice = {
    recording: false,
    voiceOut: true,
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
      Voice.useBrowserStt = !Voice.deepgramOk && 'webkitSpeechRecognition' in window;
      Voice.useBrowserTts = !Voice.elevenLabsOk && 'speechSynthesis' in window;

      const mic = $('#micBtn');
      const spk = $('#speakerBtn');
      if (mic) mic.title = Voice.deepgramOk ? 'Deepgram STT' : Voice.useBrowserStt ? 'Browser STT' : 'Mic (configure DEEPGRAM_API_KEY)';
      if (spk) spk.title = Voice.elevenLabsOk ? 'ElevenLabs TTS' : Voice.useBrowserTts ? 'Browser TTS' : 'Speaker (configure ELEVENLABS_API_KEY)';

      setVoiceState('ready', Voice.deepgramOk && Voice.elevenLabsOk ? 'Voice ready · Deepgram + ElevenLabs' : 'Voice ready · mixed mode');
    } catch {
      setVoiceState('offline', 'Gateway offline');
    }
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
    Voice.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        const b64 = await blobToBase64(blob);
        const stt = await window.tonyApi('/api/voice/transcribe', {
          method: 'POST',
          body: JSON.stringify({ audioBase64: b64, mimeType: blob.type || 'audio/webm' }),
        });
        if (!stt.ok) throw new Error(stt.error || 'Transcription failed');
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
      setVoiceState('error', e.message);
      window.tonyAddMessage?.('assistant', `Voice error: ${e.message}`);
    }
  }

  async function processTranscript(transcript) {
    window.tonyAddMessage?.('user', `🎤 ${transcript}`);
    setVoiceState('thinking', 'TONY is thinking…');

    const useWorkflow =
      transcript.length > 100 ||
      /\b(build|website|deploy|workflow|push to github|integrate|automate|goal loop)\b/i.test(transcript);

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
      result.toolResults?.map((t) => t.tool)
    );

    if (Voice.voiceOut) await speakResponse(result.response);
    setVoiceState('ready', 'Voice ready');
  }

  function initVoice() {
    refreshVoiceHealth();
    setInterval(refreshVoiceHealth, 30000);

    $('#micBtn')?.addEventListener('click', handleVoiceInput);

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

  window.tonyVoice = { speakResponse, refreshVoiceHealth, initVoice, Voice };
})();
