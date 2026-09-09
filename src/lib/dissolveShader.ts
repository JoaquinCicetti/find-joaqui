/**
 * Fragment shader for {@link DissolveAdapter}.
 *
 * This is Photo Sphere Viewer 5.14.3's `equirectangular.fragment.glsl` with two
 * additions. The ray-cast sphere sampling and the `edgeAlpha` antialiasing for
 * cropped panoramas are preserved verbatim — the dissolve multiplies *into*
 * their alpha rather than replacing it, so a cropped pano still dissolves in
 * with its antialiased boundary intact.
 *
 * The dissolve threshold is evaluated on `dir`, the ray-cast unit direction,
 * not on `(u, v)`. That matters: a unit vector is continuous across the ±180°
 * seam and at both poles, so the pattern is seam-safe for free and stays glued
 * to the image while the viewer pans, instead of swimming in screen space.
 */
export const DISSOLVE_FRAGMENT = /* glsl */ `
varying vec3 vWorldPos;
uniform sampler2D map;
uniform float opacity;
uniform vec2 uvOffset;
uniform vec2 uvScale;
uniform float radius;

// --- dissolve ---
uniform float dissolve;  // 0 = nothing revealed, 1 = fully revealed
uniform float edge;      // half-width of the soft band, in noise units
uniform float scale;     // noise frequency: higher = smaller patches
uniform float seed;      // per-mesh, so no two reveals share a pattern
uniform float blurUv;    // > 0 => blur the texture by this radius in V units

const float PI = 3.1415926535897932384626433832795;

// Analytic edge antialiasing across one screen-space pixel at the
// cropped-region boundary on a single axis (replaces the MSAA the standard
// adapter gets from rasterizing arc-restricted geometry).
float edgeAlpha(float coord) {
    float dist = min(coord, 1.0 - coord);
    return clamp(dist / fwidth(coord) + 0.5, 0.0, 1.0);
}

// Cheap 3D hash -> [0,1). No transcendentals, so no precision cliff on mobile.
float hash13(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Trilinear value noise with smoothstep interpolation: 8 hashes.
float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash13(i),                       hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
            mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
        mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
            mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
        f.z);
}

// Two octaves, weights summing to 1 so the result stays in [0,1] with no
// normalisation pass. The big patches carry the shape; the second octave frays
// their borders so the advancing front never reads as a contour line.
float fbm(vec3 p) {
    return vnoise(p) * 0.65 + vnoise(p * 2.37 + 19.7) * 0.35;
}

void main() {
    // Ray-cast the true sphere from the camera through the (interpolated, on
    // the polygon chord) world position, and use the exit-point direction for
    // sampling. This makes the result independent of mesh tessellation even
    // when the camera is offset from the sphere center (e.g. fisheye config).
    vec3 rayDir = vWorldPos - cameraPosition;
    float a = dot(rayDir, rayDir);
    float b = dot(cameraPosition, rayDir);
    float c = dot(cameraPosition, cameraPosition) - radius * radius;
    float t = (-b + sqrt(max(b * b - a * c, 0.0))) / a;
    vec3 dir = (cameraPosition + t * rayDir) / radius;

    float u = atan(-dir.x, dir.z) / (2.0 * PI) + 0.5;
    float v = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
    vec2 uv = (vec2(u, v) - uvOffset) / uvScale;

    float alpha = 1.0;
    if (uvScale.x < 1.0) alpha = min(alpha, edgeAlpha(uv.x));
    if (uvScale.y < 1.0) alpha = min(alpha, edgeAlpha(uv.y));

    // Sample BEFORE any discard, so 'map' stays unconditionally live and the
    // driver uploads the texture during PSV's warm-up render rather than on the
    // first visible frame of the dissolve.
    vec4 texel;
    if (blurUv > 0.0) {
        // 5-tap cross. Equirectangular is 2:1, so a U step is half a V step.
        vec2 r = vec2(blurUv * 0.5, blurUv);
        texel  = texture2D(map, uv) * 0.4;
        texel += texture2D(map, uv + vec2(r.x, 0.0)) * 0.15;
        texel += texture2D(map, uv - vec2(r.x, 0.0)) * 0.15;
        texel += texture2D(map, uv + vec2(0.0, r.y)) * 0.15;
        texel += texture2D(map, uv - vec2(0.0, r.y)) * 0.15;
    } else {
        texel = texture2D(map, uv);
    }

    // Uniform branch: coherent across the whole draw call, so the resident mesh
    // (dissolve == 1.0, i.e. every frame that is not a transition) pays nothing.
    if (dissolve < 1.0) {
        float n = fbm(dir * scale + seed * vec3(19.1, 7.3, 13.7));
        // Sweep the threshold across [0,1] *including* the band, so dissolve=0
        // reveals nothing at all and dissolve=1 reveals everything.
        float sweep = mix(-edge, 1.0 + edge, dissolve);
        float rise = smoothstep(n - edge, n + edge, sweep);
        rise = rise * rise * (3.0 - 2.0 * rise); // ease each pixel's own rise
        alpha *= rise;
    }

    if (alpha <= 0.0) discard;

    gl_FragColor = texel;
    gl_FragColor.a *= opacity * alpha;
}
`
