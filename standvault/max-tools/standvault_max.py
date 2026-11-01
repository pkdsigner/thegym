"""StandVault listener inside 3ds Max 2026.

Receives "Send to Max" jobs from the StandVault server and runs them on 3ds Max's main thread (the HTTP server
runs on a background thread; a Qt timer on the main thread picks the jobs up). Listens on 127.0.0.1 only, and
only answers requests carrying the token it writes to %LOCALAPPDATA%\\StandVault\\max-listener.json, which the
StandVault server reads - so web pages in a browser cannot send it anything.
Started by standvault.ms; also usable as standvault_max.start() / stop() from the Python listener.
"""
import json
import os
import queue
import secrets
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from pymxs import runtime as rt
from PySide6.QtCore import QTimer

PORT = 5175
INFO_FILE = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "StandVault", "max-listener.json")

_jobs = queue.Queue()
# Kept on sys so it survives importlib.reload (Start listener reloads this file to pick up updates).
_state = sys.__dict__.setdefault("_standvault_listener", {"server": None, "timer": None, "maps_root": None})


def _on_main(fn, timeout=3600):
    """Runs fn on 3ds Max's main thread and waits for its result."""
    done = threading.Event()
    box = {}

    def task():
        try:
            box["value"] = fn()
        except Exception as e:  # report it to the app instead of crashing the listener
            box["error"] = f"{e}"
        finally:
            done.set()

    _jobs.put(task)
    if not done.wait(timeout):
        raise TimeoutError("3ds Max did not finish in time.")
    if "error" in box:
        raise RuntimeError(box["error"])
    return box["value"]


def _pump():
    while True:
        try:
            task = _jobs.get_nowait()
        except queue.Empty:
            return
        task()


def _maps_root():
    """Where the stand's textures go: the 3ds Max project folder, or a folder the user picks once per session."""
    project = str(rt.pathConfig.getCurrentProjectFolder() or "")
    default = os.path.normcase(os.path.join(os.path.expanduser("~"), "Documents", "3ds Max 2026"))
    if project and os.path.isdir(project) and os.path.normcase(os.path.normpath(project)) != default:
        return project
    if not _state["maps_root"]:
        chosen = rt.getSavePath(caption="StandVault: choose the project folder for the textures (a 'maps' folder is made inside it)")
        if not chosen:
            raise RuntimeError("No folder was chosen for the textures. Set a project folder in 3ds Max or choose one when asked.")
        _state["maps_root"] = str(chosen)
    return _state["maps_root"]


def _status():
    scene = os.path.join(str(rt.maxFilePath), str(rt.maxFileName)) if str(rt.maxFileName) else None
    renderers = [str(c) for c in rt.RendererClass.classes]
    return {
        "ok": True,
        "maxVersion": int(rt.maxVersion()[0]),
        "scene": scene,
        "renderer": str(rt.classOf(rt.renderers.current)),
        "renderers": renderers,
        "placement": str(rt.SV_placement),
        "mapsRoot": _maps_root(),
    }


def _merge(job):
    result = rt.sv_mergeAsset(job["maxPath"], job["layer"], list(job["originals"]), list(job["targets"]), str(rt.SV_placement))
    merged, changed, message = int(result[0]), int(result[1]), str(result[2])
    if message:
        raise RuntimeError(message)
    rt.redrawViews()
    lines = [
        f"{job['layer']}",
        "",
        f"{merged} objects merged on layer \"{job['layer']}\".",
        f"{job.get('copied', 0)} textures copied, {job.get('reused', 0)} already there, {job.get('missing', 0)} missing.",
        f"Textures: {job.get('mapsDir')}",
    ]
    if job.get("warnings"):
        lines += [""] + list(job["warnings"])
    # Shown after the reply, so the app's "Sending…" doesn't wait for this box to be closed.
    QTimer.singleShot(50, lambda: rt.messageBox("\n".join(lines), title="StandVault"))
    return {"merged": merged, "repathed": changed}


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _reply(self, code, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _allowed(self):
        # Browsers always send an Origin header; the StandVault server never does.
        return self.headers.get("X-StandVault-Token") == self.server.token and not self.headers.get("Origin")

    def do_GET(self):
        if not self._allowed():
            return self._reply(403, {"error": "Not allowed"})
        if self.path == "/status":
            try:
                return self._reply(200, _on_main(_status))
            except Exception as e:
                return self._reply(500, {"error": str(e)})
        self._reply(404, {"error": "Unknown request"})

    def do_POST(self):
        if not self._allowed():
            return self._reply(403, {"error": "Not allowed"})
        if self.path == "/merge":
            try:
                job = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                return self._reply(200, _on_main(lambda: _merge(job)))
            except Exception as e:
                return self._reply(500, {"error": str(e)})
        self._reply(404, {"error": "Unknown request"})


def start():
    if _state["server"]:
        stop()  # restart, so a reloaded file takes over

    server = ThreadingHTTPServer(("127.0.0.1", PORT), _Handler)
    server.token = secrets.token_hex(16)
    threading.Thread(target=server.serve_forever, daemon=True, name="StandVaultListener").start()
    timer = QTimer()
    timer.timeout.connect(_pump)
    timer.start(150)
    _state.update(server=server, timer=timer)
    os.makedirs(os.path.dirname(INFO_FILE), exist_ok=True)
    with open(INFO_FILE, "w", encoding="utf-8") as f:
        json.dump({"port": PORT, "token": server.token, "pid": os.getpid()}, f)
    print(f"StandVault: listening on 127.0.0.1:{PORT}")


def stop():
    server, timer = _state["server"], _state["timer"]
    if timer:
        timer.stop()
    if server:
        server.shutdown()
        server.server_close()
    _state.update(server=None, timer=None)
    try:
        os.remove(INFO_FILE)
    except OSError:
        pass
