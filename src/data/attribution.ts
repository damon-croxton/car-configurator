import manifest from './assetManifest.json';

export interface AssetCredit {
  credit: string;
  licence: string;
  source: string;
}

/**
 * Third-party asset credits, derived from the same manifest the fetcher reads.
 *
 * Keeping one source of truth means a new asset cannot be added to the build
 * without its licence and credit coming along — which matters most for CC-BY
 * material, where attribution is a condition of use rather than a courtesy.
 */
export const ASSET_CREDITS: AssetCredit[] = Array.from(
  new Map(
    (manifest.assets as { credit?: string; licence?: string; source?: string }[])
      .filter((asset) => asset.credit && asset.licence && asset.source)
      .map((asset) => [
        asset.credit as string,
        {
          credit: asset.credit as string,
          licence: asset.licence as string,
          source: asset.source as string,
        },
      ]),
  ).values(),
);

/** Distinct licences in play, for a one-line summary. */
export const ASSET_LICENCES: string[] = Array.from(
  new Set(ASSET_CREDITS.map((entry) => entry.licence)),
).sort();
