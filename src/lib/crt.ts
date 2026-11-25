/** Pure rules and shader source for the CRT overlay (drawn by src/scripts/crt.ts). */

export function shouldDraw(state: { on: boolean; hidden: boolean }): boolean {
  return state.on && !state.hidden;
}

/** Scale factors for the two strobing effects; reduced motion turns both off. */
export function crtMotion(reduced: boolean): { flicker: number; band: number } {
  return reduced ? { flicker: 0, band: 0 } : { flicker: 1, band: 1 };
}

export const VERTEX = `#version 300 es
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0.,1.);}`;

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
  float scan=1.-.24*(1.-s)*(1.-s);
  float c=mod(floor(p.x),3.);
  vec3 m=c<1.?vec3(1.,.84,.84):c<2.?vec3(.84,1.,.84):vec3(.84,.84,1.);
  float v=mix(.9,1.,pow(16.*uv.x*uv.y*(1.-uv.x)*(1.-uv.y),.35));
  float band=1.-.05*BD*exp(-pow((fract(T*.07)*1.4-.2-(1.-uv.y))*9.,2.));
  float fl=1.-FL*(.012-.012*sin(T*97.)*sin(T*13.));
  o=vec4(m*scan*v*band*fl,1.);
}`;
