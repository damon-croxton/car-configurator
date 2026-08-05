# Car models

Drop authored GLB/GLTF files here using the filenames declared in
`src/data/carData.json` (`generations[].assetUrl`), e.g. `mx5_nd.glb`.

The app probes for the file at boot. If it is missing or fails to parse, the
procedural fallback model in `src/three/proceduralMx5.ts` renders instead and
the viewport shows a `PROCEDURAL MESH` badge — every configurator control keeps
working either way.

An authored asset must expose the node names documented in
`src/three/nodeNames.ts`:

```
MX5_Root
└── Suspension_Node          ride height is applied here
    ├── Body_Main            painted shell
    ├── Body_Trim
    ├── Roof_ST_Up / Roof_ST_Down / Roof_RF_Up / Roof_RF_Down
    ├── Glass_Windshield / Glass_Windows
    ├── Interior_Main / Interior_Seats / Interior_SteeringWheel
    ├── Lights_Head / Lights_DRL / Lights_Tail / Lights_Indicator
    └── Aerodynamics_FrontLip / _SideSkirts / _RearDiffuser / _RearWing
        / _Hood / _Exhaust / _RollBar
            └── one child per catalogue variant, named by
                `aeroParts[slot][].node` in carData.json
Wheel_FL / Wheel_FR / Wheel_RL / Wheel_RR   (siblings of Suspension_Node)
└── Rim / Tire / Brake_Caliper / Brake_Disc
```

## How a model arrives

Not committed — see `src/data/assetManifest.json` and `npm run assets`.

The app **composes** rather than chooses: `CarModel` always builds the
procedural car first, then replaces only the contract nodes an authored GLB
actually supplies (see `ADOPTABLE_NODES` in `src/three/carModel.ts`). A model
providing just a body, glass and wheels is therefore useful immediately — every
roof state and aero variant it lacks keeps working procedurally.

Pipeline:

```bash
# 1. Conform a raw download to the contract (headless, no GUI needed)
blender --background --python scripts/blender/conform_mx5.py -- \
        --input raw/mx5_source.glb --output public/assets/models/mx5_nd.glb

# 2. Check it against the contract before wiring it in
node scripts/validate-asset.mjs public/assets/models/mx5_nd.glb
```

The name mapping from source objects to contract nodes lives in
`raw/<name>.map.json` — that split is a human judgement, best made interactively
in Blender; the script exists to make it reproducible.

Anything third-party must be recorded in `ATTRIBUTION.md` and given `licence`,
`source` and `credit` fields in the manifest, which is what renders the in-app
credits panel.
