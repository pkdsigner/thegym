-- Renders a library asset's preview: 512 px, 3/4 view from the front right, plain light-grey studio light.
-- Run by the StandVault server in a headless 3ds Max:
--   3dsmaxbatch.exe render-preview.ms -sceneFile <asset>.max -mxsString out:<package>\preview.jpg
-- Works on the package file only; nothing is saved.
(
	local out = maxOps.mxsCmdLineArgs[#out]
	-- Frame only what shows in the render (helpers, non-renderable or hidden objects would throw the framing off).
	local shapes = for o in geometry where o.renderable and not o.isHidden and not isGroupHead o collect o
	if out != undefined and shapes.count > 0 do (
		local lo = [1e9, 1e9, 1e9]
		local hi = [-1e9, -1e9, -1e9]
		for o in shapes do (
			lo = [amin lo.x o.min.x, amin lo.y o.min.y, amin lo.z o.min.z]
			hi = [amax hi.x o.max.x, amax hi.y o.max.y, amax hi.z o.max.z]
		)
		local centre = (lo + hi) / 2
		local radius = (distance lo hi) / 2
		local fov = 35.0
		-- Far enough for a sphere around the asset to fit the lens, plus a little margin.
		local dist = radius / (sin (fov / 2)) * 1.05
		local cam = Targetcamera fov:fov pos:(centre + (normalize [1, -1.35, 0.85]) * dist) target:(Targetobject pos:centre)

		-- Even studio light: a light-grey environment, no scene lights needed.
		backgroundColor = color 228 228 228
		useEnvironmentMap = false
		local corona = undefined
		for r in RendererClass.classes where matchPattern (r as string) pattern:"Corona" do corona = r
		if corona != undefined then (
			renderers.current = corona()
			renderers.current.progressive_timeLimit = 25000 -- ms
			renderers.current.progressive_passLimit = 40
		) else renderers.current = Default_Scanline_Renderer()

		render camera:cam outputSize:[512, 512] outputFile:out vfb:false quiet:true
	)
)
