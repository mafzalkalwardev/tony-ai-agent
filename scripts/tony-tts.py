#!/usr/bin/env python3
"""Local TTS fallback — edge-tts (free neural) then pyttsx3 (Windows SAPI)."""
import asyncio
import base64
import json
import os
import sys
import tempfile


def speak_edge(text, voice="en-US-GuyNeural"):
    import edge_tts

    async def _run():
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            path = f.name
        communicate = edge_tts.Communicate(text[:5000], voice)
        await communicate.save(path)
        with open(path, "rb") as f:
            data = f.read()
        os.unlink(path)
        return data

    return asyncio.run(_run())


def speak_pyttsx3(text):
    import pyttsx3

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        path = f.name
    engine = pyttsx3.init()
    engine.setProperty("rate", 175)
    engine.save_to_file(text[:5000], path)
    engine.runAndWait()
    with open(path, "rb") as f:
        data = f.read()
    os.unlink(path)
    return data


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)

    text = (payload.get("text") or "").strip()
    if not text:
        print(json.dumps({"ok": False, "error": "text required"}))
        sys.exit(1)

    voice = payload.get("voice", "en-US-GuyNeural")
    err_edge = None

    try:
        audio = speak_edge(text, voice)
        print(json.dumps({
            "ok": True,
            "audio": base64.b64encode(audio).decode(),
            "mimeType": "audio/mpeg",
            "provider": "edge-tts",
            "voice": voice,
        }))
        return
    except ImportError:
        err_edge = "edge-tts not installed"
    except Exception as e:
        err_edge = str(e)[:300]

    try:
        audio = speak_pyttsx3(text)
        print(json.dumps({
            "ok": True,
            "audio": base64.b64encode(audio).decode(),
            "mimeType": "audio/wav",
            "provider": "pyttsx3",
        }))
        return
    except ImportError:
        print(json.dumps({
            "ok": False,
            "error": "Install edge-tts: pip install edge-tts  (or pyttsx3)",
            "edgeError": err_edge,
        }))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:500], "edgeError": err_edge}))
        sys.exit(1)


if __name__ == "__main__":
    main()
