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
  roofLining?: { hideWithRoof: string[]; cutAboveY: number | null };
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
