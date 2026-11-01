-- StandVault installer for 3ds Max 2026.
-- Drag this file into a 3ds Max viewport. It writes one small startup script that loads the StandVault tools
-- from this folder every time 3ds Max starts, and starts them now. Run it again any time; it only rewrites
-- that startup script. To uninstall, delete StandVault_startup.ms from the folder named in the message.
(
	local root = getFilenamePath (getSourceFileName())
	if not doesFileExist (root + "standvault.ms") then
		messageBox ("Can't find standvault.ms next to this installer:\n" + root) title:"StandVault"
	else (
		local startupFile = (getDir #userStartupScripts) + "\\StandVault_startup.ms"
		local f = createFile startupFile
		format "-- Loads the StandVault tools (written by %install.ms)\nglobal SV_ROOT = @\"%\"\nfilein (SV_ROOT + \"standvault.ms\")\n" root root to:f
		close f
		global SV_ROOT = root
		filein (root + "standvault.ms")
		messageBox ("StandVault is installed.\n\n" + \
			(if sv_listening() then "- The listener is on: \"Send to Max\" in the StandVault app works now.\n" else "- The listener is NOT running yet (see the other message).\n") + \
			"- Restart 3ds Max once to see the StandVault menu.\n\n" + \
			"Startup script: " + startupFile) title:"StandVault"
	)
)
