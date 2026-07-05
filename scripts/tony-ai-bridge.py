#!/usr/bin/env python3
"""Headless bridge: Node TONY agent → tony-ai AssistantBrain (when installed)."""
import json
import sys
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "Usage: tony-ai-bridge.py <tony-ai-root>"}))
        sys.exit(1)

    root = Path(sys.argv[1])
    if not (root / "run_tony.py").exists():
        print(json.dumps({"ok": False, "error": f"Not a tony-ai repo: {root}"}))
        sys.exit(1)

    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    command = payload.get("command", "health")
    sys.path.insert(0, str(root))

    if command == "health":
        version = (root / "VERSION").read_text(encoding="utf-8").strip() if (root / "VERSION").exists() else "unknown"
        has_tony = (root / "tony").is_dir()
        print(json.dumps({"ok": True, "version": version, "tony_package": has_tony, "path": str(root)}))
        return

    if command == "command":
        text = (payload.get("text") or "").strip()
        if not text:
            print(json.dumps({"ok": False, "error": "text required"}))
            sys.exit(1)
        try:
            from tony.core.brain import AssistantBrain  # type: ignore
            brain = AssistantBrain()
            result = brain.handle(text)
            print(json.dumps({"ok": True, "response": str(result), "source": "tony-ai AssistantBrain"}))
        except ImportError:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": "tony package not importable — pip install -r requirements.txt in tony-ai",
                        "fallback": "Use Node TONY agent tools (shell, git via agent)",
                    }
                )
            )
            sys.exit(1)
        except Exception as e:
            print(json.dumps({"ok": False, "error": str(e)[:500]}))
            sys.exit(1)
        return

    print(json.dumps({"ok": False, "error": f"Unknown command: {command}"}))
    sys.exit(1)


if __name__ == "__main__":
    main()
