# StandVault tools for 3ds Max 2026

These tools let the StandVault app send a stand straight into the scene you have open in 3ds Max, with its textures.
They never change or re-save the scenes they come from.

## Install (once)

1. Open 3ds Max 2026.
2. In Windows Explorer, open `C:\Users\USER\25oct26\standvault\max-tools`.
3. Drag **install.ms** onto a 3ds Max viewport.
4. A message says *StandVault is installed*. "Send to Max" works straight away.
5. Restart 3ds Max once: a **StandVault** menu appears in the main menu bar, next to the other menus.

From then on the tools load every time 3ds Max starts. Updates to the files in `max-tools` are picked up automatically
(restart 3ds Max, or choose *StandVault > Start listener*).

## The StandVault menu

| Item | What it does |
|---|---|
| Open StandVault | Opens the app in your browser (it must be running: `npm run dev`) |
| Save to Library… | Saves the selected objects as a zone or object in the library (below) |
| Start listener / Stop listener | Lets the app send stands into this 3ds Max (on by default) |
| Place: where it was saved | The stand lands exactly where it was in its own scene (default) |
| Place: at the origin | The stand's bottom centre goes to 0,0,0 |
| Place: at the selected object | The stand's bottom centre goes to the object you have selected |

## Sending a stand

1. In 3ds Max, open (or start) the scene you are working on. Set your project folder (*File > Project > Set Active Project*) - the textures go into its `maps` folder.
2. In the app, open a stand, check the version you want is ticked under **Versions**, and click **Send to Max**.
3. In 3ds Max a message tells you how many objects came in, how many textures were copied and where.

What happens:
- The chosen version is merged on its own layer, named after the stand's Asset ID (or `SV_<title>` before it is approved).
- Materials already in your scene are never replaced; same-named incoming materials are renamed.
- Every texture that can be found is copied to `<project>\maps\<Asset ID>\` and the stand's materials, IES lights and proxies are pointed at the copies. Textures already copied are reused, two different files with the same name are kept apart, and nothing is overwritten.
- If no project folder is set, 3ds Max asks once per session where to put the textures.
- Stands inside a .zip/.rar are unpacked once into `D:\StandVault_Library\cache\archives` and merged from there.
- "Used in" goes up by one and the scene is logged.

Warnings you may see:
- **V-Ray isn't installed** - this PC has Corona only. The geometry comes in; V-Ray materials load as missing. Open or convert such stands on a PC with V-Ray.
- **Renderer differs** from your scene - convert the materials (e.g. with the Corona Converter).
- **Saved by a newer 3ds Max** - the file can't be opened in 3ds Max 2026; nothing is merged.

## Saving a zone or object to the library (Save to Library)

1. Open any scene, for example an old stand. Select the objects that make up the piece (a majlis, a reception counter, a planter).
2. *StandVault > Save to Library…*
3. Choose **Zone / space** or **Object**, the **type**, the **theme**, type a short **description** ("low seating curved") and optional tags.
   The Asset ID appears live, checked against the naming rules, e.g. `ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012`.
4. Click **Save to Library**. A message confirms: *Saved ZN_… - 14 textures collected, 0 missing.*

What happens:
- A package folder is made: `D:\StandVault_Library\Zones\Majlis\<Asset ID>\` with `<Asset ID>.max`, `maps\` (every texture it uses) and `asset.json`.
- In the saved file only: all objects on one layer named the Asset ID, grouped under that name, renamed `ZN0012_Sofa_01`, `ZN0012_CushionBack_02`…, pivot at the bottom centre, standing at 0,0,0, materials pointing at the package maps.
- **Your scene is put back exactly as it was.** To do that it uses *Edit > Hold / Fetch* (3ds Max 2026 crashes when saving part of a scene that has State Sets), so the scene you last stored with Edit > Hold and the undo history are replaced.
- A 512 px preview renders in the background (about a minute) and appears in the app under **Library > Zones / Objects**.
- From the app the asset can be sent into any scene with **Send to Max**, like a stand.

## If "Send to Max" says 3ds Max isn't listening

- Is 3ds Max open? Then choose *StandVault > Start listener* (or drag `install.ms` in again if the menu is missing).
- Only one stand can be sent at a time; wait for the first to finish.

## How it works (for maintenance)

- `install.ms` writes `StandVault_startup.ms` into the user startup scripts folder; it loads `standvault.ms` from this folder.
- `standvault.ms` - menu (3ds Max 2025+ menu system), placement modes, and `sv_mergeAsset` (merge, layer, placement, repath).
- `standvault_max.py` - the listener: 127.0.0.1:5175, token in `%LOCALAPPDATA%\StandVault\max-listener.json`, jobs run on Max's main thread.
- The app's server (`app/server/max.js`) picks the version, unpacks archives, copies textures, then asks the listener to merge.
