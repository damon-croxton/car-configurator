import type { CarConfig } from './types';
import { DEFAULT_CONFIG, reconcileConfig } from './defaults';
import type { GenerationId, RoofState, RoofTypeId } from '../data/schema';

/**
 * Bi-directional URL query-string codec, e.g.
 *   ?model=ND&color=soul_red&wheels=enkei_rpf1&roof=rf_down&stance=-30
 *
 * Only values that differ from the defaults are written, so a lightly-modified
 * build produces a short, human-readable link.
 */

const num =(raw: string, fallback: number) => {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (raw: string) => raw === '1' || raw === 'true' || raw === 'yes';
const encodeBool = (value: boolean) => (value ? '1' : '0');

/** Fields that map 1:1 to a string id in the catalogues. */
const STRING_FIELDS: { key: string; field: keyof CarConfig }[] = [
  { key: 'color', field: 'paint' },
  { key: 'finish', field: 'paintFinishOverride' },
  { key: 'wheels', field: 'wheelStyle' },
  { key: 'wf', field: 'wheelFinish' },
  { key: 'caliper', field: 'caliperColor' },
  { key: 'fabric', field: 'roofFabric' },
  { key: 'lip', field: 'frontLip' },
  { key: 'skirts', field: 'sideSkirts' },
  { key: 'diff', field: 'rearDiffuser' },
  { key: 'wing', field: 'rearWing' },
  { key: 'hood', field: 'hood' },
  { key: 'exh', field: 'exhaust' },
  { key: 'bar', field: 'rollBar' },
  { key: 'int', field: 'interiorTrim' },
  { key: 'env', field: 'environment' },
  { key: 'cam', field: 'cameraPreset' },
];

const NUMBER_FIELDS: { key: string; field: keyof CarConfig; precision: number }[] = [
  { key: 'stance', field: 'rideHeight', precision: 0 },
  { key: 'camber', field: 'camber', precision: 1 },
  { key: 'track', field: 'trackOffset', precision: 0 },
  { key: 'dia', field: 'wheelDiameter', precision: 0 },
  { key: 'tint', field: 'windowTint', precision: 2 },
  { key: 'exp', field: 'exposure', precision: 2 },
  { key: 'flake', field: 'flakeIntensity', precision: 2 },
  { key: 'cc', field: 'clearcoat', precision: 2 },
  { key: 'refl', field: 'groundReflection', precision: 2 },
];

const BOOL_FIELDS: { key: string; field: keyof CarConfig }[] = [
  { key: 'hl', field: 'headlights' },
  { key: 'tl', field: 'taillights' },
  { key: 'drl', field: 'drl' },
  { key: 'bloom', field: 'bloom' },
  { key: 'ssao', field: 'ssao' },
  { key: 'shadow', field: 'contactShadow' },
  { key: 'smoked', field: 'smokedIndicators' },
  { key: 'tinthl', field: 'tintedHeadlights' },
  { key: 'spin', field: 'wheelSpin' },
  { key: 'turn', field: 'turntable' },
];

export function encodeConfigToParams(config: CarConfig): URLSearchParams {
  const params = new URLSearchParams();

  if (config.generation !== DEFAULT_CONFIG.generation) {
    params.set('model', config.generation.toUpperCase());
  }
  const roof = `${config.roofType}_${config.roofState}`;
  if (roof !== `${DEFAULT_CONFIG.roofType}_${DEFAULT_CONFIG.roofState}`) {
    params.set('roof', roof);
  }
  if (config.paintCustomHex !== DEFAULT_CONFIG.paintCustomHex) {
    params.set('hex', config.paintCustomHex.replace('#', ''));
  }

  for (const { key, field } of STRING_FIELDS) {
    const value = config[field] as string;
    if (value !== (DEFAULT_CONFIG[field] as string) && value !== '') params.set(key, value);
  }
  for (const { key, field, precision } of NUMBER_FIELDS) {
    const value = config[field] as number;
    if (value !== (DEFAULT_CONFIG[field] as number)) params.set(key, value.toFixed(precision));
  }
  for (const { key, field } of BOOL_FIELDS) {
    const value = config[field] as boolean;
    if (value !== (DEFAULT_CONFIG[field] as boolean)) params.set(key, encodeBool(value));
  }

  return params;
}

export function decodeConfigFromParams(params: URLSearchParams): CarConfig {
  const draft: CarConfig = { ...DEFAULT_CONFIG };

  const model = params.get('model');
  if (model) draft.generation = model.toLowerCase() as GenerationId;

  const roof = params.get('roof');
  if (roof) {
    const [type, state] = roof.split('_');
    if (type === 'st' || type === 'rf') draft.roofType = type as RoofTypeId;
    if (state === 'up' || state === 'down') draft.roofState = state as RoofState;
  }

  const hex = params.get('hex');
  if (hex && /^#?[0-9a-f]{6}$/i.test(hex)) draft.paintCustomHex = `#${hex.replace('#', '')}`;

  for (const { key, field } of STRING_FIELDS) {
    const raw = params.get(key);
    if (raw !== null) (draft[field] as string) = raw;
  }
  for (const { key, field } of NUMBER_FIELDS) {
    const raw = params.get(key);
    if (raw !== null) (draft[field] as number) = num(raw, DEFAULT_CONFIG[field] as number);
  }
  for (const { key, field } of BOOL_FIELDS) {
    const raw = params.get(key);
    if (raw !== null) (draft[field] as boolean) = bool(raw);
  }

  // reconcileConfig drops any id the chosen generation does not offer.
  return reconcileConfig(draft);
}

export function buildShareUrl(config: CarConfig): string {
  const params = encodeConfigToParams(config);
  const query = params.toString();
  const { origin, pathname } = window.location;
  return query ? `${origin}${pathname}?${query}` : `${origin}${pathname}`;
}

/** Replace (never push) so the back button stays useful while dragging sliders. */
export function syncUrl(config: CarConfig): void {
  const query = encodeConfigToParams(config).toString();
  const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState(null, '', next);
}

export function readConfigFromUrl(): CarConfig {
  return decodeConfigFromParams(new URLSearchParams(window.location.search));
}
