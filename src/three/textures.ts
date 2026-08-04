import * as THREE from 'three';

/**
 * Procedurally generated maps. Keeping these in code (rather than shipping
 * PNGs) means the app has zero binary texture dependencies and still gets
 * metallic flake, fabric weave and carbon twill detail.
 *
 * All textures are created once, cached, and disposed together.
 */
export class TextureFactory {
  private readonly cache = new Map<string, THREE.Texture>();

  private canvas(size: number): { ctx: CanvasRenderingContext2D; canvas: HTMLCanvasElement } {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable — cannot generate procedural textures.');
    return { ctx, canvas };
  }

  private finalize(key: string, canvas: HTMLCanvasElement, repeat: number, colorSpace?: THREE.ColorSpace) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.anisotropy = 4;
    if (colorSpace) texture.colorSpace = colorSpace;
    texture.needsUpdate = true;
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Tangent-space normal map of randomly-tilted micro-facets. Tiled densely
   * across the body it reads as metallic flake; the shader's normalScale
   * controls how strong the sparkle is per finish.
   */
  flakeNormal(): THREE.Texture {
    const key = 'flake-normal';
    const cached = this.cache.get(key);
    if (cached) return cached;

    const size = 512;
    const { ctx, canvas } = this.canvas(size);
    const image = ctx.createImageData(size, size);
    const data = image.data;

    // Flat normal everywhere, then scatter tilted flakes on top.
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }

    const flakeCount = 40000;
    for (let f = 0; f < flakeCount; f++) {
      const x = (Math.random() * size) | 0;
      const y = (Math.random() * size) | 0;
      const angle = Math.random() * Math.PI * 2;
      const tilt = 0.12 + Math.random() * 0.42;
      const nx = Math.cos(angle) * tilt;
      const ny = Math.sin(angle) * tilt;
      const nz = Math.sqrt(Math.max(0.0001, 1 - nx * nx - ny * ny));

      const idx = (y * size + x) * 4;
      data[idx] = (nx * 0.5 + 0.5) * 255;
      data[idx + 1] = (ny * 0.5 + 0.5) * 255;
      data[idx + 2] = nz * 255;
    }

    ctx.putImageData(image, 0, 0);
    return this.finalize(key, canvas, 90);
  }

  /**
   * Low-frequency waviness layered under the flake map. This is the "orange
   * peel" every real clearcoat has — without it, reflections are unnaturally
   * mirror-perfect.
   */
  orangePeelNormal(): THREE.Texture {
    const key = 'orange-peel';
    const cached = this.cache.get(key);
    if (cached) return cached;

    const size = 256;
    const { ctx, canvas } = this.canvas(size);
    const image = ctx.createImageData(size, size);
    const data = image.data;

    const height = (x: number, y: number) =>
      Math.sin(x * 0.19) * Math.cos(y * 0.23) +
      0.55 * Math.sin(x * 0.41 + 1.7) * Math.cos(y * 0.37 - 0.9) +
      0.3 * Math.sin((x + y) * 0.63);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = height(x + 1, y) - height(x - 1, y);
        const dy = height(x, y + 1) - height(x, y - 1);
        const strength = 0.06;
        const nx = -dx * strength;
        const ny = -dy * strength;
        const nz = Math.sqrt(Math.max(0.0001, 1 - nx * nx - ny * ny));
        const idx = (y * size + x) * 4;
        data[idx] = (nx * 0.5 + 0.5) * 255;
        data[idx + 1] = (ny * 0.5 + 0.5) * 255;
        data[idx + 2] = nz * 255;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    return this.finalize(key, canvas, 8);
  }

  /** Woven canvas bump for the soft-top fabric. */
  fabricBump(): THREE.Texture {
    const key = 'fabric-bump';
    const cached = this.cache.get(key);
    if (cached) return cached;

    const size = 256;
    const { ctx, canvas } = this.canvas(size);
    const image = ctx.createImageData(size, size);
    const data = image.data;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const warp = Math.sin(x * 1.05) * 0.5 + 0.5;
        const weft = Math.sin(y * 1.05) * 0.5 + 0.5;
        const weave = Math.max(warp, weft) * 0.72;
        const grain = Math.random() * 0.28;
        const value = (weave + grain) * 255;
        const idx = (y * size + x) * 4;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    return this.finalize(key, canvas, 26);
  }

  /** 2x2 twill carbon weave, used as both colour and roughness detail. */
  carbonWeave(): THREE.Texture {
    const key = 'carbon-weave';
    const cached = this.cache.get(key);
    if (cached) return cached;

    const size = 128;
    const cell = 16;
    const { ctx, canvas } = this.canvas(size);
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, size, size);

    for (let y = 0; y < size / cell; y++) {
      for (let x = 0; x < size / cell; x++) {
        const twill = (x + y) % 2 === 0;
        const gradient = ctx.createLinearGradient(
          x * cell,
          y * cell,
          x * cell + (twill ? cell : 0),
          y * cell + (twill ? 0 : cell),
        );
        gradient.addColorStop(0, '#2a2a30');
        gradient.addColorStop(0.5, '#101014');
        gradient.addColorStop(1, '#242429');
        ctx.fillStyle = gradient;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }

    return this.finalize(key, canvas, 12, THREE.SRGBColorSpace);
  }

  /** Radial brushed-metal roughness variation for rim faces. */
  brushedMetal(): THREE.Texture {
    const key = 'brushed-metal';
    const cached = this.cache.get(key);
    if (cached) return cached;

    const size = 256;
    const { ctx, canvas } = this.canvas(size);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 900; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * size * 0.7;
      const shade = Math.random() > 0.5 ? '#ffffff' : '#404040';
      ctx.strokeStyle = shade;
      ctx.lineWidth = Math.random() * 1.4;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, radius, angle, angle + 0.12 + Math.random() * 0.35);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;
    this.cache.set(key, texture);
    return texture;
  }

  dispose(): void {
    for (const texture of this.cache.values()) texture.dispose();
    this.cache.clear();
  }
}
