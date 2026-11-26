// The CRT overlay: one hand-written WebGL 2 canvas over the screen. It reads
// html[data-crt] (set by chrome.ts) and draws only while that is "on" and the
// tab is visible. The site itself is never drawn into it.
import {
  brightnessLift,
  crtMotion,
  FRAGMENT,
  shouldDraw,
  VERTEX,
} from "../lib/crt";

const root = document.documentElement;
const canvas = document.querySelector<HTMLCanvasElement>("#crt-canvas");
const gl = canvas?.getContext("webgl2", {
  alpha: false,
  antialias: false,
  premultipliedAlpha: false,
});

function compile(type: number, source: string): WebGLShader | null {
  if (!gl) return null;
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

if (canvas && gl) {
  const program = gl.createProgram();
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (vs && fs) {
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
  }
  if (vs && fs && gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.useProgram(program);
    // The overlay can only darken, so it lifts the screen behind it first (a
    // backdrop filter, so the page itself is never redrawn or transformed).
    // Only once the program linked: without the mask on top the lift would
    // wash the page out.
    const lift = `brightness(${brightnessLift()})`;
    canvas.style.setProperty("backdrop-filter", lift);
    canvas.style.setProperty("-webkit-backdrop-filter", lift);
    start(canvas, gl, program);
  }
}

function start(
  canvas: HTMLCanvasElement,
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): void {
  const uni = (name: string) => gl.getUniformLocation(program, name);
  const uR = uni("R");
  const uT = uni("T");
  const uD = uni("D");
  const uFL = uni("FL");
  const uBD = uni("BD");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let frames = 0;
  let raf = 0;

  const resize = (): void => {
    const d = devicePixelRatio || 1;
    canvas.width = Math.max(1, (canvas.clientWidth * d) | 0);
    canvas.height = Math.max(1, (canvas.clientHeight * d) | 0);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const draw = (ms: number): void => {
    raf = 0;
    if (!active()) return;
    const motion = crtMotion(reduced.matches);
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, ms / 1000);
    gl.uniform1f(uD, devicePixelRatio || 1);
    gl.uniform1f(uFL, motion.flicker);
    gl.uniform1f(uBD, motion.band);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.dataset.frames = String(++frames);
    raf = requestAnimationFrame(draw);
  };

  function active(): boolean {
    return shouldDraw({
      on: root.dataset.crt !== "off",
      hidden: document.hidden,
    });
  }

  const sync = (): void => {
    if (active()) {
      resize();
      if (!raf) raf = requestAnimationFrame(draw);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  new MutationObserver(sync).observe(root, {
    attributes: true,
    attributeFilter: ["data-crt"],
  });
  document.addEventListener("visibilitychange", sync);
  new ResizeObserver(() => active() && resize()).observe(canvas);
  sync();
}
