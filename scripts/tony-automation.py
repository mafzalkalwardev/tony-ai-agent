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

        elif action == "scroll":
            clicks = int(payload.get("clicks", payload.get("amount", -3)))
            x, y = payload.get("x"), payload.get("y")
            if x is not None and y is not None:
                pyautogui.scroll(clicks, x=x, y=y)
            else:
                pyautogui.scroll(clicks)
            print(json.dumps({"ok": True, "action": "scroll", "clicks": clicks}))

        elif action == "drag":
            pyautogui.moveTo(payload.get("x", 0), payload.get("y", 0))
            pyautogui.dragTo(
                payload.get("x2", 0),
                payload.get("y2", 0),
                duration=payload.get("duration", 0.35),
                button=payload.get("button", "left"),
            )
            print(json.dumps({"ok": True, "action": "drag"}))

        elif action == "doubleclick":
            x, y = payload.get("x"), payload.get("y")
            if x is not None and y is not None:
                pyautogui.doubleClick(x, y)
            else:
                pyautogui.doubleClick()
            print(json.dumps({"ok": True, "action": "doubleclick", "x": x, "y": y}))

        elif action == "press":
            key = payload.get("key") or (payload.get("keys") or ["enter"])[0]
            pyautogui.press(key)
            print(json.dumps({"ok": True, "action": "press", "key": key}))

        elif action == "sequence":
            import time
            steps = payload.get("steps") or []
            results = []
            for step in steps[:40]:
                step_action = step.get("action")
                if not step_action:
                    continue
                if step_action == "click":
                    if step.get("x") is not None:
                        pyautogui.click(step.get("x"), step.get("y"))
                    else:
                        pyautogui.click()
                elif step_action == "type":
                    text = step.get("text", "")
                    if text.isascii():
                        pyautogui.write(text, interval=step.get("interval", 0.02))
                    else:
                        _type_unicode(text)
                elif step_action == "hotkey":
                    pyautogui.hotkey(*(step.get("keys") or []))
                elif step_action == "press":
                    pyautogui.press(step.get("key", "enter"))
                elif step_action == "scroll":
                    pyautogui.scroll(int(step.get("clicks", -3)))
                elif step_action == "move":
                    pyautogui.moveTo(step.get("x", 0), step.get("y", 0), duration=step.get("duration", 0.2))
                elif step_action == "wait":
                    time.sleep(float(step.get("seconds", 0.5)))
                else:
                    results.append({"ok": False, "action": step_action, "error": "unsupported in sequence"})
                    continue
                results.append({"ok": True, "action": step_action})
            print(json.dumps({"ok": True, "action": "sequence", "steps": len(results), "results": results}))

        else:
            print(json.dumps({
                "ok": False,
                "error": "Unknown action. Use: click, type, hotkey, screenshot, move, position, scroll, drag, doubleclick, press, sequence",
            }))
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
