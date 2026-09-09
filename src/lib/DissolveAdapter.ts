import { EquirectangularAdapter } from '@photo-sphere-viewer/core'
import type {
  AdapterConstructor,
  EquirectangularAdapterConfig,
  PanoData,
  Viewer,
} from '@photo-sphere-viewer/core'
import { DISSOLVE_FRAGMENT } from './dissolveShader'

// `three` is not resolvable from app code under pnpm's strict linking (it lives
// only in .pnpm/ and inside @photo-sphere-viewer/core), and `EquirectangularMesh`
// /`EquirectangularTextureData` are not exported. Derive both from the base class
// rather than importing either.
type Mesh = ReturnType<EquirectangularAdapter['createMesh']>
type TextureData = Parameters<EquirectangularAdapter['setTexture']>[1]
type Uniforms = Record<string, { value: number }>

const uniformsOf = (mesh: Mesh): Uniforms =>
  (mesh.material as unknown as { uniforms: Uniforms }).uniforms

export interface DissolveAdapterConfig {
  /** noise frequency; higher = smaller patches @default 9 */
  scale?: number
  /** half-width of the soft band, in noise units @default 0.16 */
  edge?: number
  /** textures at or below this width get the placeholder blur @default 512 */
  blurUpTo?: number
  /** blur radius in texels for those @default 1.2 */
  blurTexels?: number
  /** 'fade' restores stock behaviour — the kill switch @default 'dissolve' */
  effect?: 'dissolve' | 'fade'
  /** shaping applied on top of PSV's fixed inOutCubic @default p => p ** 0.85 */
  shape?: (p: number) => number
  /** passed through to the base adapter */
  useXmpData?: boolean
}

const DEFAULTS = {
  scale: 9,
  edge: 0.16,
  blurUpTo: 512,
  blurTexels: 1.2,
  effect: 'dissolve' as 'dissolve' | 'fade',
  // < 1 front-loads the sweep: the picture becomes recognisable early and the
  // last wisps finish after, rather than most of it arriving at the very end.
  shape: (p: number) => Math.pow(p, 0.85),
}

/**
 * An equirectangular adapter whose cross-fade is a pixel-by-pixel noise
 * dissolve instead of a uniform opacity ramp.
 *
 * It hijacks machinery Photo Sphere Viewer already has: `Renderer.transition`
 * builds a second mesh, sets its opacity to 0, and ticks
 * `adapter.setTextureOpacity(newMesh, p)` from 0 to 1. We reinterpret that `p`
 * as a dissolve progress uniform, so PSV's own animation drives the reveal and
 * none of its transition code needs changing.
 *
 * `effect` must stay `'fade'` in the transition options — it is the only branch
 * that calls `setTextureOpacity` at all. `'black'`/`'white'` snap opacity to 1
 * halfway through and drive `toneMappingExposure` instead.
 */
export class DissolveAdapter extends EquirectangularAdapter {
  // NOT `config`: the base declares that private, and TS rejects the redeclare.
  private readonly opts: typeof DEFAULTS

  static withConfig(
    cfg: DissolveAdapterConfig = {},
  ): [AdapterConstructor, DissolveAdapterConfig] {
    // The base's withConfig returns [EquirectangularAdapter, config] literally,
    // so a subclass that doesn't override it silently gets the stock adapter.
    return [DissolveAdapter as unknown as AdapterConstructor, cfg]
  }

  constructor(viewer: Viewer, cfg: DissolveAdapterConfig = {}) {
    const { useXmpData, ...mine } = cfg
    // shader:true is mandatory — it is the branch that builds a ShaderMaterial.
    // Only forward keys the base knows: it runs every option through
    // getConfigParser, which logWarns on anything unrecognised.
    const base: EquirectangularAdapterConfig = { shader: true }
    if (useXmpData !== undefined) base.useXmpData = useXmpData
    super(viewer, base)
    this.opts = { ...DEFAULTS, ...mine }
  }

  createMesh(panoData: PanoData): Mesh {
    // Patch the material the base builds rather than constructing our own: that
    // inherits map/opacity/radius/uvOffset/uvScale and the vertex shader, so the
    // cropped-panorama handling and its antialiased edge cannot regress.
    const mesh = super.createMesh(panoData)
    const mat = mesh.material as unknown as {
      fragmentShader: string
      uniforms: Uniforms
      needsUpdate: boolean
    }
    mat.fragmentShader = DISSOLVE_FRAGMENT
    mat.uniforms.dissolve = { value: 1 } // resident meshes are fully revealed
    mat.uniforms.edge = { value: Math.max(this.opts.edge, 1e-4) }
    mat.uniforms.scale = { value: this.opts.scale }
    // Per-mesh seed: a fixed pattern becomes recognisable within about three
    // rounds, which kills the organic read entirely.
    mat.uniforms.seed = { value: Math.random() * 97 }
    mat.uniforms.blurUv = { value: 0 }
    mat.needsUpdate = true
    return mesh
  }

  setTexture(mesh: Mesh, textureData: TextureData): void {
    super.setTexture(mesh, textureData)
    // Auto-blur the tiny stage-1 placeholder: no config plumbing, no extra
    // request, and it switches itself off when the full-res texture arrives.
    const img = textureData.texture.image as
      | { width?: number; height?: number }
      | undefined
    const w = img?.width ?? 0
    const h = img?.height ?? 0
    uniformsOf(mesh).blurUv.value =
      w > 0 && h > 0 && w <= this.opts.blurUpTo ? this.opts.blurTexels / h : 0
  }

  setTextureOpacity(mesh: Mesh, opacity: number): void {
    const u = uniformsOf(mesh)
    if (this.opts.effect === 'fade') {
      u.opacity.value = opacity
      u.dissolve.value = 1
      return
    }
    u.opacity.value = 1
    // PSV hands us an inOutCubic-eased value and its easing is hard-coded, so
    // this is the only place the dissolve's timing curve can be shaped.
    u.dissolve.value =
      opacity <= 0 ? 0 : opacity >= 1 ? 1 : this.opts.shape(opacity)
  }
}
