#!/usr/bin/env python3
"""Desktop automation bridge — pyautogui, keyboard, mouse for TONY."""
import json
import sys

def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)

    action = payload.get("action", "")
    try:
        import pyautogui
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.15
    except ImportError:
        print(json.dumps({
            "ok": False,
            "error": "pyautogui not installed — run: pip install pyautogui pyperclip",
        }))
        sys.exit(1)

    try:
        if action == "click":
            x, y = payload.get("x"), payload.get("y")
            if x is not None and y is not None:
                pyautogui.click(x, y)
            else:
                pyautogui.click()
            print(json.dumps({"ok": True, "action": "click", "x": x, "y": y}))

        elif action == "type":
            text = payload.get("text", "")
            interval = payload.get("interval", 0.02)
            pyautogui.write(text, interval=interval) if text.isascii() else _type_unicode(text)
            print(json.dumps({"ok": True, "action": "type", "len": len(text)}))

        elif action == "hotkey":
            keys = payload.get("keys", [])
            pyautogui.hotkey(*keys)
            print(json.dumps({"ok": True, "action": "hotkey", "keys": keys}))

        elif action == "screenshot":
            import base64
            import io
            import os
            from datetime import datetime
            img = pyautogui.screenshot()
            data_dir = os.environ.get("TONY_DATA_DIR", "./data")
            shot_dir = os.path.join(data_dir, "screenshots")
            os.makedirs(shot_dir, exist_ok=True)
            fname = f"screenshot-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}.png"
            fpath = os.path.join(shot_dir, fname)
            img.save(fpath, format="PNG")
            size = img.size
            print(json.dumps({
                "ok": True,
                "action": "screenshot",
                "path": fpath.replace("\\", "/"),
                "width": size[0],
                "height": size[1],
                "note": "Screenshot saved to disk; image data not sent to LLM context",
            }))

        elif action == "move":
            pyautogui.moveTo(payload.get("x", 0), payload.get("y", 0), duration=payload.get("duration", 0.2))
            print(json.dumps({"ok": True, "action": "move"}))

        elif action == "position":
            pos = pyautogui.position()
            size = pyautogui.size()
            print(json.dumps({"ok": True, "x": pos.x, "y": pos.y, "screenWidth": size.width, "screenHeight": size.height}))

        else:
            print(json.dumps({"ok": False, "error": f"Unknown action: {action}. Use: click, type, hotkey, screenshot, move, position"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:500]}))
        sys.exit(1)


def _type_unicode(text):
    import pyperclip
    pyperclip.copy(text)
    import pyautogui
    pyautogui.hotkey("ctrl", "v")


if __name__ == "__main__":
    main()
