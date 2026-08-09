import surfaceClasses from './surfaceClasses.json';

/**
 * Typed access to the surface classification table.
 *
 * The Sketchfab model gives every mesh exactly one material, so a material
 * name is a complete statement of what a surface is. That is the entire
 * classification mechanism — no renaming, regrouping or splitting was done to
 * the asset to support it. See `surfaceClasses.json`.
 */

const MATERIALS = surfaceClasses.materials as Record<string, string>;
const PAINTABLE_CLASS = surfaceClasses.paintableClass;

/**
 * Strip a trailing `.001`-style duplicate suffix. Blender/glTF append these to
 * per-wheel copies of an identical material; they are not distinct surfaces.
 * Requires digits, so `M_LightGlassNormal_OrangeLow.` (a bare trailing dot,
 * which is a real material name here) is left alone.
 */
export function normaliseMaterialName(name: string): string {
  return name.replace(/\.\d{3}$/, '');
}

/** The surface class for a material name, or `undefined` if unclassified. */
export function classOf(materialName: string): string | undefined {
  return MATERIALS[normaliseMaterialName(materialName)];
}

/**
 * True only for materials that carry body colour.
 *
 * Deliberately an exact-name lookup. `M_CarPaint_Trim_PlasticSmoothBlack_Max`
 * contains "CarPaint" but is the gloss-black bumper and skirt trim — a
 * substring match would paint the grille surround body colour.
 */
export function isPaintable(materialName: string): boolean {
  return classOf(materialName) === PAINTABLE_CLASS;
}
