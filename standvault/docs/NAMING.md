# StandVault naming rules

Every asset in the library has one **Asset ID**. The same ID is used for its folder, its .max file, its layer and its group, so you can always find an asset from anything you see in 3ds Max.

The allowed codes (levels, types, themes) live in [`config/taxonomy.json`](../config/taxonomy.json). Add new types or themes there; the rules below don't change.

## Asset ID

```
Stands:          ST_<Width>x<Depth>_<Show><Year>_<Client>_<####>
Zones, objects:  <LEVEL>_<Type>_<Theme>_<Descriptor>_<####>
```

| Part | What it is | Rules |
|---|---|---|
| LEVEL | `ST` Full Stand, `ZN` Zone / Space, `OB` Object | Always 2 capital letters |
| Type | What the zone or object is: `Majlis`, `Reception`, `Planter`, `Chair`... | From taxonomy.json. Zones and objects only |
| Theme | `Futuristic`, `ArabicTraditional`, `Contemporary`, `Funky`... | From taxonomy.json. In the name for zones and objects; **a search tag for stands** |
| Descriptor | Your short description | CamelCase, letters and numbers only, starts with a capital, under 40 characters |
| #### | Running number | 4 digits, unique per level, starts at 0001. Assigned automatically when you save to the library |

Underscores go **only** between parts. No spaces, no hyphens, no other symbols.

### Full stands

```
ST_<Width>x<Depth>_<Show><Year>_<Client>_<####>
```

Stands are named by **size first**, so when a brief says "a 10 x 10 stand" you can go straight to that size.

| Part | Rules | Example |
|---|---|---|
| Size | Width x depth in metres, small `x`. A half metre is written with `p`: 4.5 x 3 is `4p5x3` | `10x10`, `20x30`, `4p5x3` |
| Show + year | One CamelCase word ending with the year. A missing year is allowed for old files but gives a warning | `GITEX2025`, `ArabHealth2024` |
| Client | CamelCase | `DEWA`, `UnitedImaging` |

The theme, open sides (inline, corner, peninsula, island), tags and notes are stored with the stand and are searchable, but are not part of its name.

### Examples

| Level | Asset ID |
|---|---|
| Stand | `ST_10x10_GITEX2025_DEWA_0007` |
| Stand | `ST_12x8_ADIPEC2024_ADNOC_0003` |
| Zone | `ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012` |
| Zone | `ZN_Reception_Contemporary_MarbleCurvedCounter_0031` |
| Zone | `ZN_Pod_Futuristic_GlowingMeetingCapsule_0044` |
| Zone | `ZN_ProductDisplay_Minimal_FloatingPlinthTrio_0058` |
| Object | `OB_Planter_Contemporary_RoundConcrete_0210` |
| Object | `OB_Vegetation_Natural_OliveTreeLarge_0118` |
| Object | `OB_People_Mixed_StandingGroupOf3_0450` |
| Object | `OB_Lighting_Luxury_BrassPendantCluster_0302` |

## Inside each asset's .max file

| Thing | Name | Example |
|---|---|---|
| Layer | Exactly the Asset ID; all the asset's objects are on it | `ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012` |
| Group | Exactly the Asset ID | `ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012` |
| Objects | `<ShortID>_<Part>_<##>` | `ZN0012_Sofa_01`, `ZN0012_CushionBack_02` |

The **Short ID** is the level plus the number: `ZN_Majlis_..._0012` becomes `ZN0012`. It keeps object names short in the Scene Explorer while still telling you which asset they belong to.

## Folders

```
<Library>/
  Stands/<AssetID>/
  Zones/<ZoneType>/<AssetID>/
  Objects/<ObjectType>/<AssetID>/
```

Each asset folder contains:

```
<AssetID>.max     the asset on its own
maps/             every texture it uses
preview.jpg       thumbnail
asset.json        all its details (level, type, theme, renderer, source file, tags...)
```

When an asset is sent into a project, its textures are copied to `<Project>/maps/<AssetID>/`, so two different files that are both called `wood.jpg` never overwrite each other.

## Original project files

Original stand scenes are **never renamed or re-saved**. Names are applied to the library copy when you harvest an asset with "Save to Library".

## Checking a name

```
npm run check-name -- "ZN_Majlis_Arabic Traditional_Low seating curved_12"
```

The checker explains what's wrong and suggests a fix (here: `ZN_Majlis_ArabicTraditional_LowSeatingCurved_0012`). The same rules run in the web app and the 3ds Max "Save to Library" dialog.
