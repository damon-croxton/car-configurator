import React, { useMemo, useState } from 'react';
import { Car, Droplet, CircleDot, Wind, Sun } from 'lucide-react';
import type { CarConfig } from '../config/types';
import { RANGES } from '../config/defaults';
import { describeStance } from '../config/summary';
import {
  aeroOptionsFor,
  carData,
  getGeneration,
  getPaintColor,
  getRoofType,
  materialsData,
  roofOptionsFor,
  wheelOptionsFor,
  type AeroSlotId,
} from '../data/schema';
import { modForOption, optionalMods } from '../data/mods';
import { IconOptionGrid, OptionGrid, Section, SegmentedControl, SliderRow, SwatchGrid, ToggleRow } from './ui/Controls';

// No leading slash: mod .glb paths follow the same convention (see
// ModLoader.instance()) so they resolve relative to the page itself rather
// than the domain root — with vite.config.ts's base: './', a root-relative
// path 404s the moment the app is served from a subpath, e.g. GitHub Pages'
// <user>.github.io/<repo>/ rather than the domain root.
const WHEEL_ICON = (id: string) => `assets/icons/wheels/${id}.png`;

type TabId = 'model' | 'paint' | 'wheels' | 'aero' | 'atmosphere';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'model', label: 'Model', icon: Car },
  { id: 'paint', label: 'Paint', icon: Droplet },
  { id: 'wheels', label: 'Wheels', icon: CircleDot },
  { id: 'aero', label: 'Aero', icon: Wind },
  { id: 'atmosphere', label: 'Scene', icon: Sun },
];

interface ControlPanelProps {
  config: CarConfig;
  onChange: (patch: Partial<CarConfig>) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ config, onChange }) => {
  const [tab, setTab] = useState<TabId>('model');
  const generation = useMemo(() => getGeneration(config.generation), [config.generation]);

  return (
    <div className="flex h-full w-full flex-col border-l border-slate-800 bg-slate-900/95 backdrop-blur-xl lg:w-[22rem]">
      <nav className="grid shrink-0 grid-cols-5 border-b border-slate-800">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                active
                  ? 'border-b-2 border-red-500 text-red-400'
                  : 'border-b-2 border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {tab === 'model' && <ModelTab config={config} onChange={onChange} />}
        {tab === 'paint' && <PaintTab config={config} onChange={onChange} />}
        {tab === 'wheels' && <WheelsTab config={config} onChange={onChange} />}
        {tab === 'aero' && <AeroTab config={config} onChange={onChange} />}
        {tab === 'atmosphere' && <AtmosphereTab config={config} onChange={onChange} />}
      </div>

      <footer className="shrink-0 border-t border-slate-800 px-4 py-2.5 text-[10px] text-slate-500">
        {generation.code} · {generation.specs.engine} · {generation.specs.power} hp
      </footer>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const ModelTab: React.FC<ControlPanelProps> = ({ config, onChange }) => {
  const generation = getGeneration(config.generation);
  const roofs = roofOptionsFor(generation);
  const roof = getRoofType(config.roofType);

  return (
    <>
      <Section title="Generation" hint="ND shipping · others in progress">
        <OptionGrid
          columns={2}
          value={config.generation}
          onChange={(id) => onChange({ generation: id as CarConfig['generation'] })}
          options={carData.generations.map((entry) => ({
            id: entry.id,
            label: entry.code,
            sublabel: entry.available ? entry.years : 'Coming soon',
            disabled: !entry.available,
          }))}
        />
        <p className="pt-1 text-[11px] leading-relaxed text-slate-500">{generation.tagline}</p>
      </Section>

      <Section title="Roof type">
        <OptionGrid
          columns={2}
          value={config.roofType}
          onChange={(id) => onChange({ roofType: id as CarConfig['roofType'] })}
          options={roofs.map((entry) => ({ id: entry.id, label: entry.shortName, sublabel: entry.name }))}
        />
        <p className="pt-1 text-[11px] leading-relaxed text-slate-500">{roof.description}</p>
      </Section>

      <Section title="Roof position">
        <SegmentedControl
          value={config.roofState}
          onChange={(id) => onChange({ roofState: id as CarConfig['roofState'] })}
          options={[
            { id: 'up', label: 'Up' },
            { id: 'down', label: 'Down' },
          ]}
        />
      </Section>

      {roof.supportsFabricColor && (
        <Section title="Roof fabric">
          <SwatchGrid
            value={config.roofFabric}
            onChange={(id) => onChange({ roofFabric: id })}
            swatches={materialsData.roofFabricColors}
          />
        </Section>
      )}

      <Section title="Interior">
        <OptionGrid
          columns={2}
          value={config.interiorTrim}
          onChange={(id) => onChange({ interiorTrim: id })}
          options={carData.interiorTrims.map((trim) => ({ id: trim.id, label: trim.name }))}
        />
      </Section>

      <Section title="Glass">
        <SliderRow
          label="Window tint"
          value={config.windowTint}
          min={RANGES.windowTint[0]}
          max={RANGES.windowTint[1]}
          step={0.01}
          format={(value) => (value < 0.02 ? 'Clear' : `${Math.round((1 - value) * 100)}% VLT`)}
          onChange={(windowTint) => onChange({ windowTint })}
        />
      </Section>
    </>
  );
};

/* ------------------------------------------------------------------ */

const PaintTab: React.FC<ControlPanelProps> = ({ config, onChange }) => {
  const paint = getPaintColor(config.paint);

  return (
    <>
      <Section title="OEM factory colours" hint={paint.code ? `Code ${paint.code}` : undefined}>
        <SwatchGrid
          value={config.paint}
          onChange={(id) => onChange({ paint: id, paintFinishOverride: '' })}
          swatches={materialsData.oemColors.map((color) => ({
            id: color.id,
            name: color.name,
            hex: color.hex,
            caption: color.finish,
          }))}
        />
      </Section>

      <Section title="Wraps & aftermarket">
        <SwatchGrid
          value={config.paint}
          onChange={(id) => onChange({ paint: id, paintFinishOverride: '' })}
          swatches={materialsData.wrapColors.map((color) => ({
            id: color.id,
            name: color.name,
            hex: color.userColor ? config.paintCustomHex : color.hex,
            caption: color.finish,
          }))}
        />
      </Section>

      <div className="rounded-lg border border-slate-700/70 bg-slate-800/40 px-3 py-2.5">
        <p className="text-xs font-medium text-slate-200">{paint.name}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {paint.premium > 0 ? `+${paint.premium.toLocaleString()} premium` : 'No cost option'}
        </p>
      </div>

      {paint.userColor && (
        <Section title="Custom colour">
          <label className="flex items-center gap-3 rounded-lg border border-slate-700/70 bg-slate-800/40 px-3 py-2">
            <input
              type="color"
              value={config.paintCustomHex}
              onChange={(event) => onChange({ paintCustomHex: event.target.value })}
              className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent"
            />
            <span className="font-mono text-xs uppercase text-slate-300">{config.paintCustomHex}</span>
          </label>
        </Section>
      )}

      <Section title="Finish type" hint="Overrides the colour's default">
        <OptionGrid
          columns={3}
          value={config.paintFinishOverride || paint.finish}
          onChange={(id) => onChange({ paintFinishOverride: id === paint.finish ? '' : id })}
          options={materialsData.paintFinishes.map((finish) => ({ id: finish.id, label: finish.name }))}
        />
      </Section>

      <Section title="Clearcoat">
        <div className="space-y-3">
          <SliderRow
            label="Clearcoat gloss"
            value={config.clearcoat}
            min={RANGES.clearcoat[0]}
            max={RANGES.clearcoat[1]}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(clearcoat) => onChange({ clearcoat })}
          />
          <SliderRow
            label="Metallic flake"
            value={config.flakeIntensity}
            min={RANGES.flakeIntensity[0]}
            max={RANGES.flakeIntensity[1]}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(flakeIntensity) => onChange({ flakeIntensity })}
          />
        </div>
      </Section>

      <Section title="Brake calipers">
        <SwatchGrid
          value={config.caliperColor}
          onChange={(id) => onChange({ caliperColor: id })}
          swatches={materialsData.caliperColors}
        />
      </Section>
    </>
  );
};

/* ------------------------------------------------------------------ */

const WheelsTab: React.FC<ControlPanelProps> = ({ config, onChange }) => {
  const generation = getGeneration(config.generation);
  const wheels = wheelOptionsFor(generation);
  const nearestStance = carData.stancePresets.reduce((best, preset) =>
    Math.abs(preset.drop - config.rideHeight) < Math.abs(best.drop - config.rideHeight) ? preset : best,
  );
  const sourcedWheels = optionalMods(generation.id).filter((m) => m.attachTo === 'wheel');
  // Meister and the Gramlights were renamed into the real MOD_Rim/MOD_SatinBlack
  // contract, so the Wheel finish picker recolours them exactly like any other
  // wheel — they belong with the recolourable styles, not the pack grid, where
  // materialContractExempt marks the ones whose baked texture the picker can't
  // touch (see mods.ts).
  const recolourableSourced = sourcedWheels.filter((m) => !m.materialContractExempt);
  const packWheels = sourcedWheels.filter((m) => m.materialContractExempt);

  // Radio-like by construction, not by hoping incompatibleWith resolves it:
  // these are alternative wheels, not independent toggles, and declaring them
  // mutually incompatibleWith each other in the catalogue (so a stray
  // ?mods= override still behaves) means turning two on at once cancels both
  // out to nothing rather than one winning. Clearing the others here first
  // means that state is never reachable from the panel at all.
  const toggleSourcedWheel = (id: string, on: boolean) =>
    onChange({
      extraMods: on
        ? [...config.extraMods.filter((entry) => !sourcedWheels.some((m) => m.id === entry)), id]
        : config.extraMods.filter((entry) => entry !== id),
    });

  const sourcedActive = sourcedWheels.find((m) => config.extraMods.includes(m.id));
  const rimStyleValue = recolourableSourced.some((m) => m.id === sourcedActive?.id)
    ? (sourcedActive?.id ?? '')
    : config.wheelStyle;

  const selectRimStyle = (id: string) => {
    if (recolourableSourced.some((m) => m.id === id)) {
      toggleSourcedWheel(id, true);
    } else {
      onChange({ wheelStyle: id, extraMods: config.extraMods.filter((e) => !sourcedWheels.some((m) => m.id === e)) });
    }
  };

  return (
    <>
      <Section title="Wheel size">
        <SegmentedControl
          value={String(config.wheelDiameter)}
          onChange={(id) => onChange({ wheelDiameter: Number.parseInt(id, 10) })}
          options={generation.wheelDiameters.map((diameter) => ({
            id: String(diameter),
            label: `${diameter}"`,
          }))}
        />
      </Section>

      <Section title="Ride height">
        <SliderRow
          label="Drop"
          value={config.rideHeight}
          min={RANGES.rideHeight[0]}
          max={RANGES.rideHeight[1]}
          step={1}
          format={(value) => `${value > 0 ? '+' : ''}${value} mm`}
          onChange={(rideHeight) => onChange({ rideHeight })}
        />
      </Section>

      <Section title="Stance presets" hint={describeStance(config)}>
        <OptionGrid
          columns={2}
          value={nearestStance.id}
          onChange={(id) => {
            const preset = carData.stancePresets.find((entry) => entry.id === id);
            if (preset) {
              onChange({ rideHeight: preset.drop, camber: preset.camber, trackOffset: preset.spacer });
            }
          }}
          options={carData.stancePresets.map((preset) => ({
            id: preset.id,
            label: preset.name,
            sublabel: `${preset.drop} mm`,
          }))}
        />
      </Section>

      <Section title="Fine tuning">
        <div className="space-y-3">
          <SliderRow
            label="Camber"
            value={config.camber}
            min={RANGES.camber[0]}
            max={RANGES.camber[1]}
            step={0.1}
            format={(value) => `${value.toFixed(1)}°`}
            onChange={(camber) => onChange({ camber })}
          />
          <SliderRow
            label="Track offset (spacers)"
            value={config.trackOffset}
            min={RANGES.trackOffset[0]}
            max={RANGES.trackOffset[1]}
            step={1}
            format={(value) => `${value} mm`}
            onChange={(trackOffset) => onChange({ trackOffset })}
          />
          <SliderRow
            label="Tyre width"
            value={config.tyreWidth}
            min={RANGES.tyreWidth[0]}
            max={RANGES.tyreWidth[1]}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(tyreWidth) => onChange({ tyreWidth })}
          />
          <SliderRow
            label="Tyre sidewall"
            value={config.tyreSidewall}
            min={RANGES.tyreSidewall[0]}
            max={RANGES.tyreSidewall[1]}
            step={0.01}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(tyreSidewall) => onChange({ tyreSidewall })}
          />
        </div>
      </Section>

      <Section title="Rim style" hint="recolourable below">
        <IconOptionGrid
          value={rimStyleValue}
          onChange={selectRimStyle}
          options={[
            ...recolourableSourced.map((mod) => ({ id: mod.id, label: mod.displayName, icon: WHEEL_ICON(mod.id) })),
            ...wheels.map((wheel) => ({
              id: wheel.id,
              label: `${wheel.brand} ${wheel.name}`,
              icon: WHEEL_ICON(wheel.id),
            })),
          ]}
        />
      </Section>

      <Section title="Wheel finish">
        <SwatchGrid
          value={config.wheelFinish}
          onChange={(id) => onChange({ wheelFinish: id })}
          swatches={materialsData.wheelFinishes}
        />
      </Section>

      {packWheels.length > 0 && (
        <Section title="Wheel pack" hint="not recolourable — overrides rim style">
          <p className="mb-2 rounded-lg border border-slate-700/60 bg-slate-800/30 px-3 py-2 text-[10px] leading-relaxed text-slate-400">
            30 real scanned/modelled wheels, not built from primitives — their
            own finish is baked in, so the swatches above don't apply. Tap one
            to fit it in place of the rim style above; tap it again to go back.
          </p>
          <IconOptionGrid
            columns={5}
            allowDeselect
            value={packWheels.some((m) => m.id === sourcedActive?.id) ? (sourcedActive?.id ?? '') : ''}
            onChange={(id) => (id ? toggleSourcedWheel(id, true) : sourcedActive && toggleSourcedWheel(sourcedActive.id, false))}
            options={packWheels.map((mod) => ({
              id: mod.id,
              label: mod.displayName,
              icon: WHEEL_ICON(mod.id),
            }))}
          />
        </Section>
      )}

      <Section title="Motion">
        <ToggleRow
          label="Spin wheels"
          hint="Rolling animation for video capture"
          checked={config.wheelSpin}
          onChange={(wheelSpin) => onChange({ wheelSpin })}
        />
      </Section>
    </>
  );
};

/* ------------------------------------------------------------------ */

const AERO_SECTIONS: { slot: AeroSlotId; title: string; columns: 1 | 2 }[] = [
  { slot: 'frontLip', title: 'Front bumper / lip', columns: 1 },
  { slot: 'hood', title: 'Hood', columns: 1 },
  { slot: 'sideSkirts', title: 'Side skirts', columns: 1 },
  { slot: 'rearDiffuser', title: 'Rear diffuser', columns: 1 },
  { slot: 'rearWing', title: 'Rear wing / spoiler', columns: 2 },
  { slot: 'exhaust', title: 'Exhaust', columns: 2 },
  { slot: 'rollBar', title: 'Roll bar', columns: 1 },
];

const AeroTab: React.FC<ControlPanelProps> = ({ config, onChange }) => {
  const generation = getGeneration(config.generation);
  // Wheel-attached extras get their own section on the Wheels tab, next to
  // the rim style picker they actually override.
  const extras = optionalMods(generation.id).filter((m) => m.attachTo === 'body');

  const toggleExtra = (id: string, on: boolean) =>
    onChange({
      extraMods: on
        ? [...config.extraMods, id]
        : config.extraMods.filter((entry) => entry !== id),
    });

  return (
    <>
      <p className="rounded-lg border border-slate-700/60 bg-slate-800/30 px-3 py-2 text-[10px] leading-relaxed text-slate-400">
        Options marked <span className="font-semibold text-emerald-300">3D</span> have a modelled
        part and change the car. The rest still drive the spec sheet and pricing.
      </p>

      {AERO_SECTIONS.map(({ slot, title, columns }) => (
        <Section key={slot} title={title}>
          <OptionGrid
            columns={columns}
            value={config[slot] as string}
            onChange={(id) => onChange({ [slot]: id } as Partial<CarConfig>)}
            options={aeroOptionsFor(generation, slot).map((part) => ({
              id: part.id,
              label: part.name,
              badge: modForOption(generation.id, slot, part.id) ? '3D' : undefined,
              sublabel:
                part.downforce > 0 || part.weight !== 0
                  ? `${part.downforce > 0 ? `+${part.downforce} kg downforce · ` : ''}${
                      part.weight > 0 ? '+' : ''
                    }${part.weight} kg`
                  : undefined,
            }))}
          />
        </Section>
      ))}

      <Section title="Additional parts" hint={extras.length > 0 ? `${extras.length} modelled` : undefined}>
        <div className="space-y-2">
          {extras.map((mod) => (
            <ToggleRow
              key={mod.id}
              label={mod.displayName}
              hint={mod.uiHint}
              checked={config.extraMods.includes(mod.id)}
              onChange={(on) => toggleExtra(mod.id, on)}
            />
          ))}
          <ToggleRow
            label="Brake discs & calipers"
            hint="Every wheel mod ships these, but they currently sit proud of the wheel face — off until that's fixed."
            checked={config.wheelBrakes}
            onChange={(wheelBrakes) => onChange({ wheelBrakes })}
          />
        </div>
      </Section>

      <Section title="Light mods">
        <div className="space-y-2">
          <ToggleRow
            label="Smoked indicators"
            checked={config.smokedIndicators}
            onChange={(smokedIndicators) => onChange({ smokedIndicators })}
          />
          <ToggleRow
            label="Tinted headlight housings"
            checked={config.tintedHeadlights}
            onChange={(tintedHeadlights) => onChange({ tintedHeadlights })}
          />
        </div>
      </Section>
    </>
  );
};

/* ------------------------------------------------------------------ */

const AtmosphereTab: React.FC<ControlPanelProps> = ({ config, onChange }) => (
  <>
    <Section title="Environment">
      <OptionGrid
        columns={1}
        value={config.environment}
        onChange={(id) => onChange({ environment: id })}
        options={materialsData.environments.map((environment) => ({
          id: environment.id,
          label: environment.name,
          sublabel: environment.hint,
        }))}
      />
    </Section>

    <Section title="Vehicle lighting">
      <div className="space-y-2">
        <ToggleRow label="Headlights" checked={config.headlights} onChange={(headlights) => onChange({ headlights })} />
        <ToggleRow label="Daytime running lights" checked={config.drl} onChange={(drl) => onChange({ drl })} />
        <ToggleRow label="Tail lights" checked={config.taillights} onChange={(taillights) => onChange({ taillights })} />
      </div>
    </Section>

    <Section title="Render settings">
      <div className="space-y-3">
        <SliderRow
          label="Exposure"
          value={config.exposure}
          min={RANGES.exposure[0]}
          max={RANGES.exposure[1]}
          step={0.01}
          format={(value) => `${value.toFixed(2)}×`}
          onChange={(exposure) => onChange({ exposure })}
        />
        <SliderRow
          label="Floor reflection"
          value={config.groundReflection}
          min={RANGES.groundReflection[0]}
          max={RANGES.groundReflection[1]}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(groundReflection) => onChange({ groundReflection })}
        />
      </div>
    </Section>

    <Section title="Post-processing">
      <div className="space-y-2">
        <ToggleRow label="Bloom" hint="Glow on emissive lights" checked={config.bloom} onChange={(bloom) => onChange({ bloom })} />
        <ToggleRow
          label="Ambient occlusion"
          hint="Costlier — off by default"
          checked={config.ssao}
          onChange={(ssao) => onChange({ ssao })}
        />
        <ToggleRow
          label="Contact shadow"
          hint="Soft grounded shadow under the car"
          checked={config.contactShadow}
          onChange={(contactShadow) => onChange({ contactShadow })}
        />
        <ToggleRow
          label="Turntable"
          hint="Slow auto-rotate"
          checked={config.turntable}
          onChange={(turntable) => onChange({ turntable })}
        />
      </div>
    </Section>
  </>
);
