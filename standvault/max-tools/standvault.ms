-- StandVault tools for 3ds Max 2026: the StandVault menu, "Send to Max" placement modes, and the listener
-- that receives stands from the StandVault app. Loaded at every start of 3ds Max by StandVault_startup.ms,
-- which install.ms writes into the user startup scripts folder.
-- This script never saves or changes the scenes it merges from; it only adds to the scene you have open.

global SV_ROOT                 -- this folder, set by StandVault_startup.ms / install.ms
global SV_placement            -- "asSaved" | "origin" | "selected": where a sent stand lands
if SV_placement == undefined do SV_placement = "asSaved"

-- ---- Merging a stand and pointing its textures at the copies the server made ----

-- Properties that hold a file path on bitmaps (Standard, V-Ray, Corona), photometric/IES lights and proxies.
global SV_PATH_PROPS = #(#filename, #HDRIMapName, #webFile, #ies_file, #iesFile)

-- Repoints one map/light/proxy. byFull: lower-case original path -> new path. byName: file name -> new path
-- ("" when two different files in this stand share a name, so a name alone isn't enough).
fn sv_fixPaths obj byFull byName = (
	local changed = 0
	for p in SV_PATH_PROPS where isProperty obj p do (
		local v = getProperty obj p
		if isKindOf v String and v != "" do (
			local target = undefined
			local key = toLower v
			if hasDictValue byFull key then target = getDictValue byFull key
			else (
				local nameKey = toLower (filenameFromPath v)
				if hasDictValue byName nameKey do target = getDictValue byName nameKey
			)
			if target != undefined and target != "" and target != v do (
				setProperty obj p target
				changed += 1
			)
		)
	)
	changed
)

-- Walks a material and every sub-material and sub-map, whatever renderer they belong to.
fn sv_fixMaterial m byFull byName seen = (
	if m == undefined or findItem seen m > 0 do return 0
	append seen m
	local changed = sv_fixPaths m byFull byName
	if superClassOf m == material do
		for i = 1 to getNumSubMtls m do changed += sv_fixMaterial (getSubMtl m i) byFull byName seen
	for i = 1 to getNumSubTexmaps m do changed += sv_fixMaterial (getSubTexmap m i) byFull byName seen
	changed
)

-- Merges maxPath into the open scene on layer layerName, places it, and repaths its files.
-- originals/targets: parallel arrays of the paths as saved in the stand and the copies to use instead.
-- Returns #(objects merged, paths changed, error message or "").
fn sv_mergeAsset maxPath layerName originals targets placement = (
	if not doesFileExist maxPath do return #(0, 0, "The scene file is not there: " + maxPath)
	local dest = undefined
	if placement == "selected" then (
		if selection.count == 0 do return #(0, 0, "Placement is \"at the selected object\" but nothing is selected.")
		dest = selection[1].pos
	) else if placement == "origin" do dest = [0, 0, 0]

	local merged = #()
	-- renameMtlDups: never replace materials already in your scene; missing plugins/files are logged, not asked about
	local ok = mergeMAXFile maxPath #mergeDups #renameMtlDups #neverReparent #noRedraw quiet:true mergedNodes:&merged \
		missingExtFilesAction:#logmsg missingXRefsAction:#logmsg missingDLLsAction:#logmsg
	if not ok or merged.count == 0 do return #(0, 0, "3ds Max could not merge " + maxPath)

	local layer = LayerManager.getLayerFromName layerName
	if layer == undefined do layer = LayerManager.newLayerFromName layerName
	for n in merged do layer.addNode n

	if dest != undefined do (
		-- Bottom centre of everything merged goes to the destination; only top-level objects move.
		local lo = [1e9, 1e9, 1e9]
		local hi = [-1e9, -1e9, -1e9]
		for n in merged where not isKindOf n Camera and not isKindOf n Light do (
			lo = [amin lo.x n.min.x, amin lo.y n.min.y, amin lo.z n.min.z]
			hi = [amax hi.x n.max.x, amax hi.y n.max.y, amax hi.z n.max.z]
		)
		if lo.x < 1e9 do (
			local offset = dest - [(lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z]
			for n in merged where n.parent == undefined or findItem merged n.parent == 0 do move n offset
		)
	)

	local byFull = Dictionary #string
	local byName = Dictionary #string
	for i = 1 to originals.count do (
		putDictValue byFull (toLower originals[i]) targets[i]
		local nameKey = toLower (filenameFromPath originals[i])
		if hasDictValue byName nameKey and (getDictValue byName nameKey) != targets[i] then putDictValue byName nameKey ""
		else putDictValue byName nameKey targets[i]
	)
	local changed = 0
	local seen = #()
	for n in merged do (
		changed += sv_fixPaths n byFull byName
		if n.baseObject != undefined do changed += sv_fixPaths n.baseObject byFull byName
		if n.material != undefined do changed += sv_fixMaterial n.material byFull byName seen
	)
	select merged
	#(merged.count, changed, "")
)

-- ---- Save to Library: a renamed, grouped, relinked copy of the selection saved as a package ----

fn sv_addPaths obj found = (
	for p in SV_PATH_PROPS where isProperty obj p do (
		local v = getProperty obj p
		if isKindOf v String and v != "" and findItem found v == 0 do append found v
	)
)
fn sv_materialPaths m found seen = (
	if m == undefined or findItem seen m > 0 do return ok
	append seen m
	sv_addPaths m found
	if superClassOf m == material do for i = 1 to getNumSubMtls m do sv_materialPaths (getSubMtl m i) found seen
	for i = 1 to getNumSubTexmaps m do sv_materialPaths (getSubTexmap m i) found seen
)
-- Every file path the nodes use (textures, IES files, proxies), as saved in the scene.
fn sv_collectFiles nodes = (
	local found = #()
	local seen = #()
	for n in nodes do (
		sv_addPaths n found
		if n.baseObject != undefined do sv_addPaths n.baseObject found
		if n.material != undefined do sv_materialPaths n.material found seen
	)
	found
)

-- "Sofa_Left003" -> "SofaLeft"; a name with nothing usable -> "Part"
fn sv_partName nm = (
	local words = filterString nm " _-.()[]#"
	local out = ""
	for w in words do (
		local letters = ""
		for i = 1 to w.count where findString "0123456789" w[i] == undefined do letters += w[i]
		if letters.count > 0 do out += (toUpper letters[1]) + (substring letters 2 -1)
	)
	if out == "" then "Part" else out
)

-- Saves the selected objects as a package file. 3ds Max's partial save (saveNodes) crashes in 3ds Max 2026
-- when a scene has State Sets, so this uses Edit > Hold / Fetch instead: hold the whole scene, keep only the
-- asset, tidy it, save it (a normal full save, with useNewFile:false so your scene keeps its file name), then
-- fetch your scene back exactly as it was. (This replaces the scene stored by Edit > Hold, and the undo history.)
-- In the saved file: textures pointed at the package maps, objects named <ShortID>_<Part>_<##>, one layer and
-- one group named the Asset ID, pivot at the bottom centre moved to the origin.
-- Returns #(objects saved, paths changed, error message or "").
fn sv_saveSelection nodes assetId shortId maxPath originals targets = (
	if nodes.count == 0 do return #(0, 0, "Select the objects to save first.")
	local result = #(0, 0, "")
	holdMaxFile()
	try (
		with undo off with redraw off (
			local keep = for n in nodes where isValidNode n collect n
			delete (for o in objects where findItem keep o == 0 collect o)
			for o in (objects as array) where isValidNode o and isGroupHead o and not isGroupMember o do explodeGroup o
			local parts = for o in objects where isValidNode o collect o

			local byFull = Dictionary #string
			local byName = Dictionary #string
			for i = 1 to originals.count do (
				putDictValue byFull (toLower originals[i]) targets[i]
				local nameKey = toLower (filenameFromPath originals[i])
				if hasDictValue byName nameKey and (getDictValue byName nameKey) != targets[i] then putDictValue byName nameKey ""
				else putDictValue byName nameKey targets[i]
			)
			local changed = 0
			local seen = #()
			for c in parts do (
				changed += sv_fixPaths c byFull byName
				if c.baseObject != undefined do changed += sv_fixPaths c.baseObject byFull byName
				if c.material != undefined do changed += sv_fixMaterial c.material byFull byName seen
			)

			local counts = Dictionary #string
			for c in parts do (
				local part = sv_partName c.name
				local n = if hasDictValue counts part then (getDictValue counts part) + 1 else 1
				putDictValue counts part n
				c.name = shortId + "_" + part + "_" + (formattedPrint n format:"02d")
			)

			local layer = LayerManager.getLayerFromName assetId
			if layer == undefined do layer = LayerManager.newLayerFromName assetId
			for c in parts do layer.addNode c
			local g = group (for c in parts where c.parent == undefined collect c) name:assetId
			layer.addNode g
			g.pivot = [(g.min.x + g.max.x) / 2, (g.min.y + g.max.y) / 2, g.min.z]
			g.pos = [0, 0, 0]
			layer.current = true
			for i = LayerManager.count - 1 to 1 by -1 do (
				local l = LayerManager.getLayer i
				local inLayer = #()
				l.nodes &inLayer
				if inLayer.count == 0 and l.name != assetId do LayerManager.deleteLayerByName l.name
			)

			local saved = saveMaxFile maxPath useNewFile:false quiet:true
			result = #(parts.count, changed, if saved and doesFileExist maxPath then "" else "3ds Max could not save " + maxPath)
		)
	) catch (result = #(0, 0, getCurrentException()))
	fetchMaxFile quiet:true
	redrawViews()
	result
)

-- ---- The listener (Python, runs inside Max) ----

-- Runs Python with this folder on sys.path. Forward slashes: a path ending in "\" would break the Python string.
fn sv_python code = (
	local root = substituteString (trimRight SV_ROOT "\\/") "\\" "/"
	python.Execute ("import sys\nif '" + root + "' not in sys.path: sys.path.append('" + root + "')\n" + code)
)

-- True when the listener is running (it writes its token file when it starts).
fn sv_listening = doesFileExist ((systemTools.getEnvVariable "LOCALAPPDATA") + "\\StandVault\\max-listener.json")

fn sv_startListener quiet:false = (
	local err = undefined
	try (sv_python "import importlib, standvault_max\nimportlib.reload(standvault_max)\nstandvault_max.start()") catch (err = getCurrentException())
	if err != undefined or not sv_listening() then
		messageBox ("The StandVault listener could not start:\n\n" + (if err != undefined then err else "no error was reported") + \
			"\n\nPlease send a screenshot of this message.") title:"StandVault"
	else if not quiet do messageBox "The StandVault listener is on.\nYou can now use \"Send to Max\" in the StandVault app." title:"StandVault"
)
fn sv_stopListener = (
	sv_python "import standvault_max\nstandvault_max.stop()"
	messageBox "The StandVault listener is off." title:"StandVault"
)

-- ---- Menu items ----

macroScript SV_StartListener category:"StandVault" buttonText:"Start listener" tooltip:"Let the StandVault app send stands into this 3ds Max"
( on execute do sv_startListener() )

macroScript SV_StopListener category:"StandVault" buttonText:"Stop listener"
( on execute do sv_stopListener() )

macroScript SV_PlaceAsSaved category:"StandVault" buttonText:"Place: where it was saved"
( on isChecked return SV_placement == "asSaved"
  on execute do SV_placement = "asSaved" )

macroScript SV_PlaceOrigin category:"StandVault" buttonText:"Place: at the origin"
( on isChecked return SV_placement == "origin"
  on execute do SV_placement = "origin" )

macroScript SV_PlaceSelected category:"StandVault" buttonText:"Place: at the selected object"
( on isChecked return SV_placement == "selected"
  on execute do SV_placement = "selected" )

macroScript SV_OpenApp category:"StandVault" buttonText:"Open StandVault"
( on execute do shellLaunch "http://localhost:5173" "" )

macroScript SV_SaveToLibrary category:"StandVault" buttonText:"Save to Library…" tooltip:"Save the selected objects as a zone or object in the StandVault library"
( on execute do sv_python "import importlib, standvault_harvest\nimportlib.reload(standvault_harvest)\nstandvault_harvest.show()" )

-- The StandVault menu in the main menu bar (3ds Max 2025+ menu system; built when 3ds Max starts).
fn sv_buildMenu = (
	local menuMgr = callbacks.notificationParam()
	local mainMenuBar = menuMgr.mainMenuBar
	local sv = mainMenuBar.CreateSubMenu "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e21" "StandVault"
	local macros = 647394 -- action table of macroScripts
	sv.CreateAction "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e22" macros "SV_OpenApp`StandVault"
	sv.CreateAction "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e30" macros "SV_SaveToLibrary`StandVault"
	sv.CreateSeparator "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e23"
	sv.CreateAction "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e24" macros "SV_StartListener`StandVault"
	sv.CreateAction "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e25" macros "SV_StopListener`StandVault"
	sv.CreateSeparator "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e26"
	sv.CreateAction "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e27" macros "SV_PlaceAsSaved`StandVault"
	sv.CreateAction "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e28" macros "SV_PlaceOrigin`StandVault"
	sv.CreateAction "5f1d3c2a-7b8e-4c1a-9e2f-3a6b8c0d1e29" macros "SV_PlaceSelected`StandVault"
)
callbacks.removeScripts id:#standVaultMenu
callbacks.addScript #cuiRegisterMenus sv_buildMenu id:#standVaultMenu

-- Start listening straight away (not in batch mode, where there is no app to listen to).
if not GetQuietMode() do sv_startListener quiet:true
