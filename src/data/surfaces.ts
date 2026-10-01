import surfaceClasses from './surfaceClasses.json';

/**
 * Typed access to the per-model surface classification tables.
 *
 * Both assets give every mesh exactly one material, so a material name is a
 * complete statement of what a surface is. What differs is how the names got
 * there: the ND's are self-describing (`M_CarPaintNormal_Max`), while the NA's
 * are meaningless (`Material_71`) and its table was built by inspecting which
 * objects use each material. Same mechanism, different way of populating it.
 *
 * See `surfaceClasses.json`.
 */

export interface SurfaceTable {
  /** True when the table is meant to cover every material in the asset. */
  complete: boolean;
  /** The one class body colour applies to. */
  paintableClass: string;
  materials: Record<string, string>;
  /** Cabin loose parts that are really roof lining — see surfaceClasses.json. */
  /** Cabin surfaces split from shared materials so they colour separately. */
  cabinParts?: {
    seats?: CabinPartSpec;
    wheel?: CabinPartSpec;
    /** Which per-part controls the panel offers for this car. */
    controls?: string[];
  };
  roofLining?: {
    hideWithRoof: string[];
    cutAboveY: number | null;
    /** Roof faces inside a part that also contains fixed windscreen/pillar trim.
     * Offsets refer to triangles in the original mesh's index buffer. */
    splitWithRoof?: { key: string; triangleOffsets: number[] }[];
  };
}

export interface CabinPartSpec {
  /** Whole meshes, by glTF node name (the mesh or any ancestor). */
  nodes?: string[];
  /** Loose parts of these nodes' meshes whose world box lies inside `region`. */
  fromNodes?: string[];
  /** App-space millimetres; x is measured from the centreline (|x|). */
  region?: { absX: [number, number]; y: [number, number]; z: [number, number] };
}

const MODELS = surfaceClasses.models as unknown as Record<string, SurfaceTable>;

/**
 * The shared mod material table, merged over whichever car is loaded.
 *
 * Mods are not part of either asset but are recoloured by the same mechanism,
 * so they classify the same way. Naming a mod's paint material `MOD_BodyPaint`
 * puts it in `body_paint`, and the existing paint picker then drives it with no
 * new code — which is the whole reason mods route through this table rather
 * than carrying their own colour plumbing.
 */
const MOD_MATERIALS = (surfaceClasses as { mods?: { materials?: Record<string, string> } }).mods
  ?.materials ?? {};

/** The table for a model id, or an empty one so an unknown model is inert. */
export function tableFor(modelId: string): SurfaceTable {
  const model = MODELS[modelId];
  if (!model) {
    return { complete: false, paintableClass: 'body_paint', materials: { ...MOD_MATERIALS } };
  }
  return { ...model, materials: { ...model.materials, ...MOD_MATERIALS } };
}

/**
 * Strip a trailing `.001`-style duplicate suffix. Blender/glTF append these to
 * per-wheel copies of an identical material; they are not distinct surfaces.
 * Requires digits, so `M_LightGlassNormal_OrangeLow.` (a bare trailing dot,
 * which is a real material name in the ND) is left alone.
 */
export function normaliseMaterialName(name: string): string {
  return name.replace(/\.\d{3}$/, '');
}

/** The surface class for a material name, or `undefined` if unclassified. */
export function classOf(table: SurfaceTable, materialName: string): string | undefined {
  return table.materials[normaliseMaterialName(materialName)];
}

/**
 * True only for materials that carry body colour.
 *
 * Deliberately an exact-name lookup. The ND's
 * `M_CarPaint_Trim_PlasticSmoothBlack_Max` contains "CarPaint" but is the
 * gloss-black bumper and skirt trim — a substring match would paint the grille
 * surround body colour.
 */
export function isPaintable(table: SurfaceTable, materialName: string): boolean {
  return classOf(table, materialName) === table.paintableClass;
}

/**
 * Whether a car's own asset has any surface of this class — mods excluded.
 * The panel uses it to offer a control only where it changes something: the
 * NA's table has no lens classes, so its light controls would be inert.
 */
export function modelHasClass(modelId: string | undefined, surfaceClass: string): boolean {
  const model = modelId ? MODELS[modelId] : undefined;
  return Boolean(model && Object.values(model.materials).includes(surfaceClass));
}

/** The per-part cabin controls a car offers (seats, wheel, accent, insert). */
export function cabinControls(modelId: string | undefined): string[] {
  const model = modelId ? MODELS[modelId] : undefined;
  return model?.cabinParts?.controls ?? [];
}
