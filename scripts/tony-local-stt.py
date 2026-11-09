#!/usr/bin/env python3
"""Optional local STT using faster-whisper. Outputs JSON to stdout."""

from __future__ import annotations

import argparse
import json
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="TONY local faster-whisper STT")
    parser.add_argument("audio")
    parser.add_argument("--language", default=None)
    parser.add_argument("--model", default="base")
    args = parser.parse_args()

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "faster-whisper not installed. pip install faster-whisper",
                }
            )
        )
        return 1

    try:
        model = WhisperModel(args.model, device="cpu", compute_type="int8")
        segments, info = model.transcribe(
            args.audio,
            language=args.language,
            vad_filter=True,
            beam_size=5,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        print(
            json.dumps(
                {
                    "ok": bool(text),
                    "text": text,
                    "language": getattr(info, "language", args.language or "auto"),
                }
            )
        )
        return 0 if text else 2
    except Exception as exc:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
