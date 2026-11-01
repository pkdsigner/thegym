"""StandVault "Save to Library" in 3ds Max 2026: saves the selected objects as a zone or object package.

The dialog asks for level, type, theme, a short description and tags, and shows the Asset ID the StandVault
server would give it (checked with the shared naming rules). Saving: the server reserves the number and the
package folder, the textures are copied into its maps folder, standvault.ms saves the tidied copy, and the
server writes asset.json and renders the preview in the background. The open scene is put back as it was.
Opened from StandVault > Save to Library.
"""
import json
import os
import shutil
import urllib.error
import urllib.request

from pymxs import runtime as rt
from PySide6 import QtCore, QtWidgets
from qtmax import GetQMaxMainWindow

SERVER = "http://127.0.0.1:5174/api"
_dialog = None  # kept so Qt doesn't close it


def _api(method, path, body=None, timeout=20):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(SERVER + path, data=data, method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            message = json.loads(e.read()).get("error")
        except Exception:
            message = None
        raise RuntimeError(message or f"StandVault server error {e.code}")
    except urllib.error.URLError:
        raise RuntimeError("The StandVault app isn't running. Start it (npm run dev in the standvault folder), then try again.")


def _spaced(code):
    out = ""
    for i, ch in enumerate(code):
        if i and ch.isupper() and (code[i - 1].islower() or (i + 1 < len(code) and code[i + 1].islower())):
            out += " "
        out += ch
    return out


def _renderer():
    name = str(rt.classOf(rt.renderers.current))
    return "Corona" if "corona" in name.lower() else "VRay" if "v_ray" in name.lower() or "vray" in name.lower() else "Other"


class HarvestDialog(QtWidgets.QDialog):
    def __init__(self, taxonomy, parent=None):
        super().__init__(parent)
        self.tax = taxonomy
        self.check = None
        self.setWindowTitle("StandVault - Save to Library")
        self.setMinimumWidth(460)

        self.level = QtWidgets.QComboBox()
        self.level.addItem("Zone / space", "ZN")
        self.level.addItem("Object", "OB")
        self.type = QtWidgets.QComboBox()
        self.theme = QtWidgets.QComboBox()
        for t in taxonomy["themes"]:
            self.theme.addItem(_spaced(t), t)
        self.descriptor = QtWidgets.QLineEdit()
        self.descriptor.setPlaceholderText("e.g. low seating curved")
        self.tags = QtWidgets.QLineEdit()
        self.tags.setPlaceholderText("optional, comma separated: sadu, gold")

        form = QtWidgets.QFormLayout()
        form.addRow("Level", self.level)
        form.addRow("Type", self.type)
        form.addRow("Theme", self.theme)
        form.addRow("Description", self.descriptor)
        form.addRow("Tags", self.tags)

        self.asset_id = QtWidgets.QLabel("…")
        self.asset_id.setTextInteractionFlags(QtCore.Qt.TextSelectableByMouse)
        font = self.asset_id.font()
        font.setBold(True)
        self.asset_id.setFont(font)
        self.message = QtWidgets.QLabel("")
        self.message.setWordWrap(True)
        count = len(list(rt.selection))
        self.info = QtWidgets.QLabel(
            f"{count} objects selected. A tidied copy is saved into the library; your scene is put back exactly as it "
            "was afterwards (this uses Edit > Hold, so the last Hold and the undo history are replaced)."
        )
        self.info.setWordWrap(True)

        self.save_button = QtWidgets.QPushButton("Save to Library")
        self.save_button.setDefault(True)
        self.save_button.setEnabled(False)
        cancel = QtWidgets.QPushButton("Cancel")
        buttons = QtWidgets.QHBoxLayout()
        buttons.addStretch(1)
        buttons.addWidget(cancel)
        buttons.addWidget(self.save_button)

        layout = QtWidgets.QVBoxLayout(self)
        layout.addLayout(form)
        layout.addSpacing(6)
        layout.addWidget(QtWidgets.QLabel("Asset ID"))
        layout.addWidget(self.asset_id)
        layout.addWidget(self.message)
        layout.addSpacing(6)
        layout.addWidget(self.info)
        layout.addLayout(buttons)

        self.timer = QtCore.QTimer(self)
        self.timer.setSingleShot(True)
        self.timer.setInterval(250)
        self.timer.timeout.connect(self.update_name)
        self.level.currentIndexChanged.connect(self.fill_types)
        for w in (self.type, self.theme, self.level):
            w.currentIndexChanged.connect(self.timer.start)
        self.descriptor.textChanged.connect(self.timer.start)
        cancel.clicked.connect(self.reject)
        self.save_button.clicked.connect(self.save)
        self.fill_types()

    def details(self):
        return {
            "level": self.level.currentData(),
            "type": self.type.currentData(),
            "theme": self.theme.currentData(),
            "descriptor": self.descriptor.text().strip(),
            "tags": [t.strip() for t in self.tags.text().split(",") if t.strip()],
        }

    def fill_types(self):
        self.type.blockSignals(True)
        self.type.clear()
        for t in self.tax["zoneTypes" if self.level.currentData() == "ZN" else "objectTypes"]:
            self.type.addItem(_spaced(t), t)
        self.type.blockSignals(False)
        self.timer.start()

    def update_name(self):
        try:
            self.check = _api("POST", "/library/name", self.details())
        except RuntimeError as e:
            self.check = None
            self.asset_id.setText("-")
            self.message.setText(str(e))
            self.save_button.setEnabled(False)
            return
        self.asset_id.setText(self.check.get("id") or "-")
        notes = list(self.check.get("errors", [])) + list(self.check.get("warnings", []))
        self.message.setText("\n".join(notes) if notes else "The name follows the StandVault naming rules.")
        self.save_button.setEnabled(bool(self.check.get("valid")) and len(list(rt.selection)) > 0)

    def save(self):
        nodes = list(rt.selection)
        if not nodes:
            rt.messageBox("Select the objects to save first.", title="StandVault")
            return
        self.save_button.setEnabled(False)
        scene = os.path.join(str(rt.maxFilePath), str(rt.maxFileName)) if str(rt.maxFileName) else None
        try:
            reserved = _api("POST", "/library/reserve", {**self.details(), "sourceScene": scene, "renderer": _renderer()})
        except RuntimeError as e:
            rt.messageBox(str(e), title="StandVault")
            self.save_button.setEnabled(True)
            return
        asset_id = reserved["assetId"]
        try:
            # Copy every file the selection uses into the package maps folder (same-name files kept apart).
            paths = [str(p) for p in rt.sv_collectFiles(nodes)]
            originals, targets, used = [], [], {}
            missing = 0
            for p in paths:
                source = p if os.path.isfile(p) else str(rt.mapPaths.getFullFilePath(os.path.basename(p)) or "")
                if not source or not os.path.isfile(source):
                    missing += 1
                    continue
                name = os.path.basename(source)
                stem, ext = os.path.splitext(name)
                i = 2
                while name.lower() in used and used[name.lower()] != source.lower():
                    name = f"{stem}_{i}{ext}"
                    i += 1
                used[name.lower()] = source.lower()
                target = os.path.join(reserved["mapsDir"], name)
                if not os.path.exists(target):
                    shutil.copy2(source, target)
                originals.append(p)
                targets.append(target)

            result = rt.sv_saveSelection(nodes, asset_id, reserved["shortId"], reserved["maxPath"], originals, targets)
            objects, error = int(result[0]), str(result[2])
            if error:
                raise RuntimeError(error)
            _api("POST", f"/library/assets/{asset_id}/done", {"objects": objects, "texturesTotal": len(paths), "texturesMissing": missing})
        except Exception as e:
            try:
                _api("POST", f"/library/assets/{asset_id}/failed")
            except Exception:
                pass
            rt.messageBox(f"Saving {asset_id} failed:\n\n{e}", title="StandVault")
            self.save_button.setEnabled(True)
            return
        self.accept()
        rt.messageBox(
            f"Saved {asset_id}\n\n{objects} objects - {len(targets)} textures collected, {missing} missing.\n"
            "The preview renders in the background and appears in the StandVault app in about a minute.",
            title="StandVault",
        )


def show():
    global _dialog
    if not list(rt.selection):
        rt.messageBox("Select the objects you want to save first (for example a majlis or a reception counter).", title="StandVault")
        return
    try:
        taxonomy = _api("GET", "/config")["taxonomy"]
    except RuntimeError as e:
        rt.messageBox(str(e), title="StandVault")
        return
    _dialog = HarvestDialog(taxonomy, GetQMaxMainWindow())
    _dialog.show()
