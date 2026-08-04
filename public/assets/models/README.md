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
