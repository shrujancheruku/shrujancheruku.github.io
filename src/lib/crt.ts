/** Pure rules and shader source for the CRT overlay (drawn by src/scripts/crt.ts). */

/** The two dimmer colours of the RGB mask; the third channel of each stripe stays at 1. */
export const MASK_TINT = 0.84;
/** How far the dimmest scanline sits below the brightest. */
export const SCAN_DEPTH = 0.24;

export function shouldDraw(state: { on: boolean; hidden: boolean }): boolean {
  return state.on && !state.hidden;
}

/** Scale factors for the two strobing effects; reduced motion turns both off. */
export function crtMotion(reduced: boolean): { flicker: number; band: number } {
  return reduced ? { flicker: 0, band: 0 } : { flicker: 1, band: 1 };
}

/** The scanline factor at height `y` (in device pixels): 1 - D · (1 - s)², period 3 px. */
export function scanline(y: number): number {
  const s = 0.5 + 0.5 * Math.cos((y * Math.PI * 2) / 3);
  return 1 - SCAN_DEPTH * (1 - s) * (1 - s);
}

/** The scanline factor averaged over one period. */
export function scanlineAverage(): number {
  return 1 - SCAN_DEPTH * (3 / 8);
}

/** The RGB mask averaged over its three columns: (1 + t + t) / 3. */
export function maskAverage(): number {
  return (1 + 2 * MASK_TINT) / 3;
}

/**
 * The brightness the page needs under the overlay so that the multiply
 * averages back to 1: the overlay can only darken, so the content is lifted by
 * the inverse of the mask and scanline averages. The vignette, band and flicker
 * keep their own small dimming.
 */
export function brightnessLift(): number {
  return 1 / (maskAverage() * scanlineAverage());
}

export const VERTEX = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;

const tint = MASK_TINT;

/** Scanlines, RGB mask, soft vignette (corners floor at 90%), rolling band, flicker. */
export const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 R;
uniform float T, D, FL, BD;
out vec4 o;
void main(){
  vec2 uv=gl_FragCoord.xy/R;
  vec2 p=gl_FragCoord.xy/D;
  float s=.5+.5*cos(p.y*6.2831853/3.);
  float scan=1.-${SCAN_DEPTH}*(1.-s)*(1.-s);
  float c=mod(floor(p.x),3.);
  vec3 m=c<1.?vec3(1.,${tint},${tint}):c<2.?vec3(${tint},1.,${tint}):vec3(${tint},${tint},1.);
  float v=mix(.9,1.,pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y),.35));
  float band=1.-.05*BD*exp(-pow((fract(T*.07)*1.4-.2-(1.-uv.y))*9.,2.));
  float fl=1.-FL*(.012-.012*sin(T*97.)*sin(T*13.));
  o=vec4(m*scan*v*band*fl,1.);
}`;
