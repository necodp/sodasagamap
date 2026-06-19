(function () {
  "use strict";

  const DEG = Math.PI / 180;

  // ---- Tunable levers ----------------------------------------------------
  const REVEAL_MS = 400;          // level-up island rise duration (ms)
  const REVEAL_OVERSHOOT = 1.45;  // easeOutBack strength → the little bounce at the top
  const LABEL_POP_MS = 300;       // pin-number animate-in after the island settles
  const OCTO_DIVE_DEPTH = 0.72;   // how far a tapped octopus ducks under (was 1.55)
  const OCTO_DIVE_MS = 2100;      // octopus dive total duration (ms)
  const SHIP_SCALE = 1.0;         // overall end-of-map ship size lever

  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutBack(t, s) { const c1 = (s == null ? 1.70158 : s); const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function hexToRgba(hex, alpha = 1) {
    const raw = hex.replace("#", "");
    const value = Number.parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
    return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255, alpha];
  }

  function mixColor(a, b, amount) {
    const ca = typeof a === "string" ? hexToRgba(a) : a;
    const cb = typeof b === "string" ? hexToRgba(b) : b;
    return [
      lerp(ca[0], cb[0], amount),
      lerp(ca[1], cb[1], amount),
      lerp(ca[2], cb[2], amount),
      lerp(ca.length > 3 ? ca[3] : 1, cb.length > 3 ? cb[3] : 1, amount)
    ];
  }

  function brighten(color, amount) { return mixColor(color, [1, 1, 1, 1], amount); }
  function darken(color, amount) { return mixColor(color, [0.13, 0.06, 0.20, 1], amount); }
  function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function normalize(v) {
    const len = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / len, v[1] / len, v[2] / len];
  }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) / (near - far);
    out[15] = 0;
    return out;
  }

  function lookAt(out, eye, center, up) {
    const z = normalize(subtract(eye, center));
    const x = normalize(cross(up, z));
    const y = cross(z, x);

    out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
    out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
    out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
    out[12] = -dot(x, eye); out[13] = -dot(y, eye); out[14] = -dot(z, eye); out[15] = 1;
    return out;
  }

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  // Model matrix for a floating octopus: translate + uniform scale + a small
  // sway tilt about z. Column-major, matching multiply()/perspective().
  function composeOctopusMatrix(out, tx, ty, tz, tiltZ, s) {
    const c = Math.cos(tiltZ);
    const sn = Math.sin(tiltZ);
    out[0] = c * s; out[1] = sn * s; out[2] = 0; out[3] = 0;
    out[4] = -sn * s; out[5] = c * s; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = s; out[11] = 0;
    out[12] = tx; out[13] = ty; out[14] = tz; out[15] = 1;
    return out;
  }

  function multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    return out;
  }

  function projectPoint(matrix, point, width, height) {
    const x = point[0], y = point[1], z = point[2];
    const clipX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    const clipY = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    const clipZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    const clipW = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
    if (clipW <= 0.0001) return null;
    const nx = clipX / clipW;
    const ny = clipY / clipW;
    const nz = clipZ / clipW;
    return {
      x: (nx * 0.5 + 0.5) * width,
      y: (1 - (ny * 0.5 + 0.5)) * height,
      z: nz,
      w: clipW,
      visible: nx > -1.25 && nx < 1.25 && ny > -1.25 && ny < 1.25 && nz > -1.25 && nz < 1.25
    };
  }

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || "Unable to compile WebGL shader");
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();
    gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Unable to link WebGL program");
    }
    return program;
  }

  function getWebGlContext(canvas) {
    const contextOptions = [
      { alpha: true, antialias: true, premultipliedAlpha: false, powerPreference: "default", failIfMajorPerformanceCaveat: false },
      { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: "default", failIfMajorPerformanceCaveat: false },
      { alpha: true, antialias: false },
      undefined
    ];
    const contextNames = ["webgl", "experimental-webgl"];
    for (const name of contextNames) {
      for (const options of contextOptions) {
        try {
          const gl = options ? canvas.getContext(name, options) : canvas.getContext(name);
          if (gl && !(typeof gl.isContextLost === "function" && gl.isContextLost())) return gl;
        } catch (error) {
          // Try the next, less demanding context request.
        }
      }
    }
    return null;
  }

  class GeometryBuilder {
    constructor() {
      this.opaque = [];
      this.transparent = [];
      this.underwater = [];
      this.forceTarget = null;   // when set, all geometry routes here (submerged islands)
    }

    pushVertex(target, p, n, c, uv) {
      target.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], c.length > 3 ? c[3] : 1, uv ? uv[0] : 0, uv ? uv[1] : 0);
    }

    triangle(target, a, b, c, normal, color, uvA, uvB, uvC) {
      this.pushVertex(target, a, normal, color, uvA);
      this.pushVertex(target, b, normal, color, uvB);
      this.pushVertex(target, c, normal, color, uvC);
    }

    addEllipse(cx, z, y, rx, rz, color) {
      const target = this.forceTarget || (color[3] < 1 ? this.transparent : this.opaque);
      const center = [cx, y, z];
      const normal = [0, 1, 0];
      const segments = 42;
      for (let i = 0; i < segments; i += 1) {
        const a0 = (i / segments) * Math.PI * 2;
        const a1 = ((i + 1) / segments) * Math.PI * 2;
        const p0 = [cx + Math.cos(a0) * rx, y, z + Math.sin(a0) * rz];
        const p1 = [cx + Math.cos(a1) * rx, y, z + Math.sin(a1) * rz];
        this.triangle(target, center, p1, p0, normal, color);
      }
    }

    addHexPrism(cx, z, rx, rz, yTop, yBottom, topColor, tierColor, dividerColor, bottomColor, skipSideIndexes = null) {
      const target = this.forceTarget || (topColor[3] < 1 ? this.transparent : this.opaque);

      // --- Rounded-hex perimeter (soft, pillowy corners) ---
      // Each of the six sharp corners is replaced by a small quadratic arc, so the
      // silhouette is a soft hexagon. Straight runs between the arcs keep the six
      // "sides" (and the shared-side skipping that connects the trail) intact.
      const cornerSegs = 3;
      const t = 0.30;                         // how far along each edge the corner arc reaches (0..0.5)
      const corners = [];
      for (let i = 0; i < 6; i += 1) {
        const a = 30 * DEG + i * 60 * DEG;
        corners.push([cx + Math.cos(a) * rx, z + Math.sin(a) * rz]);
      }
      const bez = (p0, p1, p2, s) => {
        const u = 1 - s;
        return [u * u * p0[0] + 2 * u * s * p1[0] + s * s * p2[0], u * u * p0[1] + 2 * u * s * p1[1] + s * s * p2[1]];
      };
      const perim = [];                        // { x, z, sideAfter }
      for (let i = 0; i < 6; i += 1) {
        const c = corners[i];
        const prev = corners[(i + 5) % 6];
        const next = corners[(i + 1) % 6];
        const inc = [c[0] + t * (prev[0] - c[0]), c[1] + t * (prev[1] - c[1])];
        const out = [c[0] + t * (next[0] - c[0]), c[1] + t * (next[1] - c[1])];
        for (let s = 0; s <= cornerSegs; s += 1) {
          const p = bez(inc, c, out, s / cornerSegs);
          perim.push({ x: p[0], z: p[1], sideAfter: -1 });
        }
        perim[perim.length - 1].sideAfter = i;  // the straight segment after this point is side i
      }
      const N = perim.length;

      // Cumulative perimeter distance -> waffle U coordinate (wraps around the wall).
      const cumU = new Array(N);
      let acc = 0;
      for (let k = 0; k < N; k += 1) {
        cumU[k] = acc;
        const nk = (k + 1) % N;
        acc += Math.hypot(perim[nk].x - perim[k].x, perim[nk].z - perim[k].z);
      }
      const perimTotal = acc;

      const bevelH = Math.min(0.14, (yTop - yBottom) * 0.34);
      const wallTopY = yTop - bevelH;
      const insetScale = 0.84;                 // top face pulled in so the bevel can roll over it
      const insetX = (px) => cx + (px - cx) * insetScale;
      const insetZ = (pz) => z + (pz - z) * insetScale;
      const radialNormal = (px, pz) => normalize([(px - cx) / rx, 0.10, (pz - z) / rz]);

      // Flat top face (fanned from the centre), slightly inset.
      const centerTop = [cx, yTop, z];
      for (let k = 0; k < N; k += 1) {
        const nk = (k + 1) % N;
        const a = [insetX(perim[k].x), yTop, insetZ(perim[k].z)];
        const b = [insetX(perim[nk].x), yTop, insetZ(perim[nk].z)];
        this.triangle(target, centerTop, b, a, [0, 1, 0], topColor);
      }

      // Rounded top edge: a bevel ring rolling the inset top out and down to the
      // wall. Normals sweep from up (top row) to outward (bottom row) for a soft
      // roundover. Stays the top colour; the shader keeps it solid (no waffle).
      for (let k = 0; k < N; k += 1) {
        const nk = (k + 1) % N;
        const aTop = [insetX(perim[k].x), yTop, insetZ(perim[k].z)];
        const bTop = [insetX(perim[nk].x), yTop, insetZ(perim[nk].z)];
        const aBot = [perim[k].x, wallTopY, perim[k].z];
        const bBot = [perim[nk].x, wallTopY, perim[nk].z];
        const nUpA = normalize([(perim[k].x - cx) / rx * 0.45, 1.0, (perim[k].z - z) / rz * 0.45]);
        const nUpB = normalize([(perim[nk].x - cx) / rx * 0.45, 1.0, (perim[nk].z - z) / rz * 0.45]);
        const nOutA = normalize([(perim[k].x - cx) / rx, 0.65, (perim[k].z - z) / rz]);
        const nOutB = normalize([(perim[nk].x - cx) / rx, 0.65, (perim[nk].z - z) / rz]);
        this.pushVertex(target, aTop, nUpA, topColor);
        this.pushVertex(target, bTop, nUpB, topColor);
        this.pushVertex(target, bBot, nOutB, topColor);
        this.pushVertex(target, aTop, nUpA, topColor);
        this.pushVertex(target, bBot, nOutB, topColor);
        this.pushVertex(target, aBot, nOutA, topColor);
      }

      // Walls, built as three stacked tiers to match the reference cake:
      //   upper tier (level / highlight / purple)  ->  divider band  ->  lower
      //   sponge tier (orange / dark purple). Straight runs use a flat face
      //   normal and are skipped on shared sides; corner arcs use smooth radial
      //   normals. UV.x wraps the perimeter, UV.y is height below the wall top
      //   (so the shader can gate the sponge speckle to the lower tier).
      const wallH = wallTopY - yBottom;
      const yTierDiv = wallTopY - wallH * 0.28;     // upper tier / divider boundary
      const yDivBot = yTierDiv - wallH * 0.09;      // divider / sponge boundary
      const bands = [
        [wallTopY, yTierDiv, tierColor],
        [yTierDiv, yDivBot, dividerColor],
        [yDivBot, yBottom, bottomColor]
      ];
      for (let k = 0; k < N; k += 1) {
        const nk = (k + 1) % N;
        const sideIdx = perim[k].sideAfter;
        if (sideIdx >= 0 && skipSideIndexes && skipSideIndexes.has(sideIdx)) continue;
        let nA;
        let nB;
        if (sideIdx >= 0) {
          const midX = (perim[k].x + perim[nk].x) / 2 - cx;
          const midZ = (perim[k].z + perim[nk].z) / 2 - z;
          const fn = normalize([midX / rx, 0.08, midZ / rz]);
          nA = fn;
          nB = fn;
        } else {
          nA = radialNormal(perim[k].x, perim[k].z);
          nB = radialNormal(perim[nk].x, perim[nk].z);
        }
        const uK = cumU[k];
        const uNk = nk === 0 ? perimTotal : cumU[nk];
        for (let bi = 0; bi < bands.length; bi += 1) {
          const yA = bands[bi][0];
          const yB = bands[bi][1];
          const col = bands[bi][2];
          const vA = wallTopY - yA;
          const vB = wallTopY - yB;
          const topL = [perim[k].x, yA, perim[k].z];
          const topR = [perim[nk].x, yA, perim[nk].z];
          const botR = [perim[nk].x, yB, perim[nk].z];
          const botL = [perim[k].x, yB, perim[k].z];
          this.pushVertex(target, topL, nA, col, [uK, vA]);
          this.pushVertex(target, topR, nB, col, [uNk, vA]);
          this.pushVertex(target, botR, nB, col, [uNk, vB]);
          this.pushVertex(target, topL, nA, col, [uK, vA]);
          this.pushVertex(target, botR, nB, col, [uNk, vB]);
          this.pushVertex(target, botL, nA, col, [uK, vB]);
        }
      }
    }

    addCurrentHalo(cx, z, rx, rz) {
      const color = [1, 1, 1, 0.35];
      const target = this.transparent;
      const y = 0.16;
      const outer = [];
      const inner = [];
      const segments = 64;
      for (let i = 0; i < segments; i += 1) {
        const a = (i / segments) * Math.PI * 2;
        outer.push([cx + Math.cos(a) * rx * 1.42, y, z + Math.sin(a) * rz * 1.42]);
        inner.push([cx + Math.cos(a) * rx * 1.14, y, z + Math.sin(a) * rz * 1.14]);
      }
      for (let i = 0; i < segments; i += 1) {
        const next = (i + 1) % segments;
        this.triangle(target, outer[i], outer[next], inner[next], [0, 1, 0], color);
        this.triangle(target, outer[i], inner[next], inner[i], [0, 1, 0], color);
      }
    }
  }

  class SodaHome3DMap {
    constructor(options) {
      this.canvas = options.canvas;
      this.viewport = options.viewport;
      this.labelLayer = options.labelLayer;
      this.levels = options.levels || [];
      this.currentLevel = options.currentLevel || 1;
      this.palette = options.palette || [];
      this.dpr = 1;
      this.width = 1;
      this.height = 1;
      this.cameraZ = 0;
      this.targetZ = 0;
      this.dragging = false;
      this.lastPointerY = 0;
      this.labels = new Map();
      this.startTime = performance.now();
      this.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      // Active (played) islands dip their base just below the water plane so a
      // clean waterline reads on them. Submerged islands stay exactly as tuned.
      this.activeDrop = 0.28;
      this.waterSettings = {
        // Geometry displacement scale. Deliberately small so wave crests stay
        // below the island bases; the cartoon read comes from normals + foam,
        // not from large vertical motion.
        waveHeight: this.reduceMotion ? 0.012 : 0.075,

        // --- Cel-shaded cartoon water look (ported from cartoon-water.js) ---
        bigElev: 0.22, bigFreqX: 0.50, bigFreqZ: 0.42, bigSpeed: 0.20,
        smallElev: 0.16, smallFreq: 0.32, smallSpeed: 0.12,
        smallIters: this.reduceMotion ? 1 : 3,
        normalEps: 0.16,
        bands: 4, fresnelPower: 3.0, shininess: 80.0,
        foamThreshold: 0.34, foamSoftness: 0.05,
        colorOffset: 0.28, colorMultiplier: 1.3,
        depthColor: '#2c0a5c', surfaceColor: '#a35fff', foamColor: '#f1e8ff',
        deepFade: 0.72, deepWater: '#140636',
        sunDir: [0.55, 0.75, 0.35], sunColor: '#fff2e6'
      };
      this.fallbackStage = null;
      this.matrices = {
        projection: new Float32Array(16),
        view: new Float32Array(16),
        viewProjection: new Float32Array(16)
      };

      this.minZ = Math.min(...this.levels.map((l) => l.z)) - 1.4;
      this.maxZ = Math.max(...this.levels.map((l) => l.z)) + 1.8;
      const current = this.levels.find((l) => l.id === this.currentLevel) || this.levels[0];
      this.cameraZ = current ? current.z + 0.8 : 0;
      this.targetZ = this.cameraZ;

      this.gl = getWebGlContext(this.canvas);

      if (!this.gl) {
        this.showFallback();
        return;
      }

      try {
        this.setupGl();
        this.createLabels();
        this.rebuildGeometry();
        this.setupOctopi();
        this.setupShip();
        this.bindEvents();
        this.resize();
        this.tick = this.tick.bind(this);
        this.frameId = requestAnimationFrame(this.tick);
      } catch (error) {
        console.error("3D map failed to initialize", error);
        this.gl = null;
        this.showFallback();
      }
    }

    showFallback() {
      if (!this.viewport || this.viewport.querySelector(".css-map-fallback")) return;
      this.viewport.classList.add("is-webgl-unavailable");
      if (this.canvas) this.canvas.style.display = "none";
      if (this.labelLayer) this.labelLayer.innerHTML = "";

      const stageHeight = Math.max(1640, 420 + this.levels.length * 70);
      const minZ = Math.min(...this.levels.map((level) => level.z));
      const maxZ = Math.max(...this.levels.map((level) => level.z));
      const usableHeight = stageHeight - 270;
      const track = document.createElement("div");
      track.className = "css-map-fallback__track";
      track.style.height = `${stageHeight}px`;

      this.levels.forEach((level) => {
        // z is mirrored (level 1 = high z), so invert here to keep level 1 at
        // the bottom of the fallback list and future levels climbing upward.
        const progress = 1 - (level.z - minZ) / Math.max(0.001, maxZ - minZ);
        const node = document.createElement("div");
        node.className = `css-fallback-island is-${this.statusFor(level.id)}`;
        node.dataset.level = String(level.id);
        node.style.left = `calc(50% + ${(level.x * 62).toFixed(1)}px)`;
        node.style.top = `${(stageHeight - 145 - progress * usableHeight).toFixed(1)}px`;
        node.style.setProperty("--fallback-scale", (level.s || 1).toFixed(2));
        const label = document.createElement("span");
        label.textContent = String(level.id);
        node.appendChild(label);
        track.appendChild(node);
      });

      const fallback = document.createElement("div");
      fallback.className = "css-map-fallback";
      fallback.appendChild(track);
      this.viewport.appendChild(fallback);
      this.fallbackStage = fallback;
      requestAnimationFrame(() => this.scrollFallbackToLevel(this.currentLevel, true));
    }

    updateFallbackStatus() {
      if (!this.viewport) return;
      this.levels.forEach((level) => {
        const node = this.viewport.querySelector(`.css-fallback-island[data-level="${level.id}"]`);
        if (!node) return;
        node.className = `css-fallback-island is-${this.statusFor(level.id)}`;
      });
    }

    scrollFallbackToLevel(levelId, immediate = false) {
      if (!this.viewport) return;
      const node = this.viewport.querySelector(`.css-fallback-island[data-level="${levelId}"]`);
      if (!node) return;
      const target = Math.max(0, node.offsetTop - this.viewport.clientHeight * 0.50);
      if (immediate || !this.viewport.scrollTo) this.viewport.scrollTop = target;
      else this.viewport.scrollTo({ top: target, behavior: "smooth" });
    }

    setupGl() {
      const gl = this.gl;
      const vertexSource = `
        precision highp float;
        attribute vec3 a_position;
        attribute vec3 a_normal;
        attribute vec4 a_color;
        attribute vec2 a_uv;
        uniform mat4 u_matrix;
        uniform mat4 u_model;
        varying vec3 v_normal;
        varying vec4 v_color;
        varying vec3 v_world;
        varying vec2 v_uv;
        void main() {
          vec4 world = u_model * vec4(a_position, 1.0);
          gl_Position = u_matrix * world;
          v_normal = mat3(u_model) * a_normal;
          v_color = a_color;
          v_world = world.xyz;
          v_uv = a_uv;
        }
      `;
      const fragmentSource = `
        precision mediump float;
        varying vec3 v_normal;
        varying vec4 v_color;
        varying vec3 v_world;
        varying vec2 v_uv;
        uniform vec3 u_lightDir;
        uniform float u_cameraZ;
        uniform vec3 u_mistColor;
        uniform float u_fogStart;
        uniform float u_fogStrength;
        uniform float u_waterY;
        uniform vec3 u_deepColor;
        uniform float u_spongeScale;
        uniform float u_tierBottom;
        uniform float u_time;
        uniform float u_foamBand;
        uniform vec3  u_foamColor;
        float h21(vec2 p) {
          p = fract(p * vec2(123.34, 345.45));
          p += dot(p, p + 34.345);
          return fract(p.x * p.y);
        }
        // Scattered organic ovals (sponge-cake / waffle-biscuit holes): one
        // randomly placed, randomly sized oval per grid cell, sampled across the
        // neighbouring cells so blobs of varied size overlap naturally.
        float sponge(vec2 uv) {
          vec2 cell = floor(uv);
          vec2 f = fract(uv);
          float best = 0.0;
          for (int dy = -1; dy <= 1; dy += 1) {
            for (int dx = -1; dx <= 1; dx += 1) {
              vec2 o = vec2(float(dx), float(dy));
              vec2 cc = cell + o;
              vec2 center = vec2(h21(cc), h21(cc + 19.1));
              vec2 rad = vec2(0.30 + 0.20 * h21(cc + 3.7), 0.15 + 0.12 * h21(cc + 7.3));
              vec2 d = (f - o - center) / rad;
              best = max(best, 1.0 - smoothstep(0.55, 1.0, length(d)));
            }
          }
          return best;
        }
        void main() {
          vec3 normal = normalize(v_normal);
          float diffuse = max(dot(normal, normalize(u_lightDir)), 0.0);
          float topLift = max(dot(normal, vec3(0.0, 1.0, 0.0)), 0.0) * 0.10;
          float shade = 0.58 + diffuse * 0.42 + topLift;
          vec3 color = v_color.rgb * shade;

          // Sponge speckle on the lower tier only: scattered light ovals like a
          // sponge-cake / waffle-biscuit base. 'wallness' keeps it off the flat
          // top, 'tier' keeps it below the divider. It lightens whatever the base
          // tier colour is, so it reads as bright ovals on orange and as faint
          // ovals on the dark-purple sunken islands.
          float wallness = 1.0 - smoothstep(0.30, 0.68, normal.y);
          float tier = smoothstep(u_tierBottom - 0.015, u_tierBottom + 0.02, v_uv.y);
          float mask = wallness * tier;
          if (mask > 0.002) {
            float spk = sponge(v_uv * u_spongeScale);
            vec3 lit = clamp(color * 1.34 + 0.05, 0.0, 1.0);
            color = mix(color, lit, spk * mask * 0.62);
          }

          // Underwater murk (below the surface only): tint toward the soda depths
          // and darken with depth, so submerged islands read crisp near the
          // surface and murkier/darker the deeper they sit. An extra dark "wet"
          // band right under the surface makes the waterline contact obvious.
          float sub = clamp((u_waterY - v_world.y) / 2.6, 0.0, 1.0);
          float below = step(0.0008, sub);
          color = mix(color, u_deepColor, sub * (0.5 + 0.45 * sub));
          color *= (1.0 - 0.55 * sub * sub);
          float wet = (1.0 - smoothstep(0.0, 0.11, sub)) * below;
          color *= (1.0 - 0.24 * wet);

          // Caustic shimmer on the shallow submerged parts: fakes refraction /
          // underwater light play without a blur pass. Strongest just below the
          // surface, fading into the depths.
          float caustic = sin(v_world.x * 5.0 + u_time * 1.3) * sin(v_world.z * 4.6 - u_time * 1.05);
          caustic = 0.5 + 0.5 * caustic;
          color *= (1.0 + 0.12 * caustic * below * (1.0 - sub));

          // Soft foam line exactly where the water meets the geometry (active
          // island bases + octopuses). A subtle ripple makes it shimmer like the
          // wavy surface; 'wallness' keeps it off the flat tops. Low detail.
          float rip = 0.02 * sin(v_world.x * 7.0 + u_time * 1.7) * sin(v_world.z * 6.2 + u_time * 1.25);
          float foamLine = (1.0 - smoothstep(0.0, u_foamBand, abs((v_world.y - u_waterY) - rip))) * wallness;
          color = mix(color, u_foamColor, foamLine * 0.5);

          // Distance mist (above-water islands only).
          float recede = clamp((u_cameraZ + 4.5 - v_world.z) / 25.0, 0.0, 1.0);
          float fog = smoothstep(u_fogStart, 1.0, recede) * u_fogStrength * (1.0 - smoothstep(0.0, 0.15, sub));
          color = mix(color, u_mistColor, fog);

          gl_FragColor = vec4(color, v_color.a);
        }
      `;

      const waterVertexSource = `
        precision highp float;
        attribute vec3 a_position;
        uniform mat4 u_matrix;
        uniform float u_time;
        uniform float u_waveHeight;   // geometry displacement scale (kept low so crests stay below island bases)

        uniform float u_bigElev;
        uniform vec2  u_bigFreq;
        uniform float u_bigSpeed;
        uniform float u_smallElev;
        uniform float u_smallFreq;
        uniform float u_smallSpeed;
        uniform float u_smallIters;
        uniform float u_normalEps;

        varying float v_elevation;
        varying vec3  v_worldNormal;
        varying vec3  v_worldPos;

        // ---- Ashima simplex noise (3D) ----
        vec4 permute(vec4 x){ return mod(((x * 34.0) + 1.0) * x, 289.0); }
        vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v){
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i  = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + 1.0 * C.xxx;
          vec3 x2 = x0 - i2 + 2.0 * C.xxx;
          vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
          i = mod(i, 289.0);
          vec4 p = permute(permute(permute(
                    i.z + vec4(0.0, i1.z, i2.z, 1.0))
                  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 1.0/7.0;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }

        // Height field in world XZ: broad rolling swell + stacked simplex turbulence.
        float getElevation(vec2 p) {
          float elevation =
              sin(p.x * u_bigFreq.x + u_time * u_bigSpeed) *
              sin(p.y * u_bigFreq.y + u_time * u_bigSpeed) *
              u_bigElev;

          for (int i = 1; i <= 4; i++) {
            float fi   = float(i);
            float mask = step(fi, u_smallIters);          // only sum active octaves
            elevation -= abs(
              snoise(vec3(p * u_smallFreq * fi, u_time * u_smallSpeed))
              * u_smallElev / fi
            ) * mask;
          }
          return elevation;
        }

        void main() {
          vec3 pos = a_position;          // already world-space; y sits at the soda-sea base
          vec2 p   = pos.xz;

          float elevation = getElevation(p);

          // Physical displacement is damped (u_waveHeight) so crests never poke
          // through the island bases. The cartoon read lives in the normals/foam,
          // which are derived from the full-amplitude field below.
          pos.y += elevation * u_waveHeight;

          // Surface normal from the full-amplitude height field (finite differences).
          float e  = u_normalEps;
          float hX = getElevation(p + vec2(e, 0.0));
          float hZ = getElevation(p + vec2(0.0, e));
          float Hx = (hX - elevation) / e;
          float Hz = (hZ - elevation) / e;
          vec3  n  = normalize(vec3(-Hx, 1.0, -Hz));

          v_elevation   = elevation;
          v_worldPos    = pos;
          v_worldNormal = n;

          gl_Position = u_matrix * vec4(pos, 1.0);
        }
      `;
      const waterFragmentSource = `
        precision mediump float;
        varying float v_elevation;
        varying vec3  v_worldNormal;
        varying vec3  v_worldPos;

        uniform vec3  u_depthColor;
        uniform vec3  u_surfaceColor;
        uniform vec3  u_foamColor;
        uniform float u_colorOffset;
        uniform float u_colorMultiplier;

        uniform vec3  u_sunDir;
        uniform vec3  u_sunColor;
        uniform float u_bands;
        uniform float u_fresnelPower;
        uniform float u_shininess;
        uniform float u_foamThreshold;
        uniform float u_foamSoftness;
        uniform vec3  u_cameraPos;
        uniform float u_deepFade;
        uniform vec3  u_deepWater;

        void main() {
          vec3 N = normalize(v_worldNormal);
          vec3 L = normalize(u_sunDir);
          vec3 V = normalize(u_cameraPos - v_worldPos);

          // Base colour: a touch deeper in the troughs, brighter on the crests.
          float mixStrength = clamp((v_elevation + u_colorOffset) * u_colorMultiplier, 0.0, 1.0);
          vec3  baseColor   = mix(u_depthColor, u_surfaceColor, mixStrength);

          // Smooth wrap-lit diffuse — soft and glassy, no hard cartoon bands.
          float diff  = dot(N, L) * 0.5 + 0.5;
          float shade = mix(0.62, 1.12, smoothstep(0.0, 1.0, diff));
          vec3  color = baseColor * shade;
          color      *= mix(vec3(1.0), u_sunColor, 0.12 * diff);

          // Soft fresnel rim — glassy at grazing angles.
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), u_fresnelPower);
          color = mix(color, u_surfaceColor * 1.22, fresnel * 0.38);

          // Soft, broad specular highlight (no hard cartoon step).
          vec3  H    = normalize(L + V);
          float spec = pow(max(dot(N, H), 0.0), u_shininess);
          color += u_sunColor * spec * 0.5;

          // Depth: the map recedes into deeper, darker water. Distance stands in
          // for depth here, and together with the translucent layering over the
          // dark seabed it reads as "deeper = darker".
          float dist   = length(u_cameraPos - v_worldPos);
          float depthT = clamp((dist - 8.0) / 26.0, 0.0, 1.0);
          color = mix(color, u_deepWater, depthT * u_deepFade);

          // Gentle foam on the very highest crests only — low detail.
          float foam = smoothstep(u_foamThreshold, u_foamThreshold + u_foamSoftness, v_elevation);
          color = mix(color, u_foamColor, foam * 0.65);

          // Translucent so the submerged islands and seabed show through; a hair
          // more opaque far away so the deep distance stays dense.
          float alpha = mix(0.5, 0.6, depthT);
          alpha = mix(alpha, 0.9, foam);
          gl_FragColor = vec4(color, alpha);
        }
      `;

      const fallbackWaterVertexSource = `
        precision highp float;
        attribute vec3 a_position;
        uniform mat4 u_matrix;
        varying vec3 v_world;
        void main() {
          v_world = a_position;
          gl_Position = u_matrix * vec4(a_position, 1.0);
        }
      `;
      const fallbackWaterFragmentSource = `
        precision mediump float;
        varying vec3 v_world;
        uniform float u_cameraZ;
        uniform float u_time;
        void main() {
          float recede = clamp((u_cameraZ + 4.5 - v_world.z) / 25.0, 0.0, 1.0);
          float ripple = sin(v_world.z * 3.2 + v_world.x * 0.65 + u_time * 0.18) * 0.5 + 0.5;
          vec3 deepPurple = vec3(0.4745, 0.2118, 0.7216);
          vec3 softViolet = vec3(0.7137, 0.3529, 0.8275);
          vec3 scatterPink = vec3(1.0000, 0.4314, 0.7804);
          vec3 color = mix(deepPurple, softViolet, recede * 0.30);
          color = mix(color, scatterPink, recede * 0.10 + ripple * 0.035);
          gl_FragColor = vec4(color, 0.6);
        }
      `;

      this.program = createProgram(gl, vertexSource, fragmentSource);
      this.locations = {
        position: gl.getAttribLocation(this.program, "a_position"),
        normal: gl.getAttribLocation(this.program, "a_normal"),
        color: gl.getAttribLocation(this.program, "a_color"),
        uv: gl.getAttribLocation(this.program, "a_uv"),
        matrix: gl.getUniformLocation(this.program, "u_matrix"),
        model: gl.getUniformLocation(this.program, "u_model"),
        lightDir: gl.getUniformLocation(this.program, "u_lightDir"),
        cameraZ: gl.getUniformLocation(this.program, "u_cameraZ"),
        mistColor: gl.getUniformLocation(this.program, "u_mistColor"),
        fogStart: gl.getUniformLocation(this.program, "u_fogStart"),
        fogStrength: gl.getUniformLocation(this.program, "u_fogStrength"),
        waterY: gl.getUniformLocation(this.program, "u_waterY"),
        deepColor: gl.getUniformLocation(this.program, "u_deepColor"),
        spongeScale: gl.getUniformLocation(this.program, "u_spongeScale"),
        tierBottom: gl.getUniformLocation(this.program, "u_tierBottom"),
        time: gl.getUniformLocation(this.program, "u_time"),
        foamBand: gl.getUniformLocation(this.program, "u_foamBand"),
        foamColor: gl.getUniformLocation(this.program, "u_foamColor")
      };

      try {
        this.waterProgram = createProgram(gl, waterVertexSource, waterFragmentSource);
        this.waterSettings.usesVertexTurbulence = true;
      } catch (error) {
        console.warn("Turbulent water shader unavailable; using simple purple water fallback.", error);
        this.waterSettings.waveHeight = 0;
        this.waterSettings.usesVertexTurbulence = false;
        this.waterProgram = createProgram(gl, fallbackWaterVertexSource, fallbackWaterFragmentSource);
      }
      this.waterLocations = {
        position: gl.getAttribLocation(this.waterProgram, "a_position"),
        matrix: gl.getUniformLocation(this.waterProgram, "u_matrix"),
        cameraZ: gl.getUniformLocation(this.waterProgram, "u_cameraZ"),
        time: gl.getUniformLocation(this.waterProgram, "u_time"),
        waveHeight: gl.getUniformLocation(this.waterProgram, "u_waveHeight"),
        cameraPos: gl.getUniformLocation(this.waterProgram, "u_cameraPos"),
        bigElev: gl.getUniformLocation(this.waterProgram, "u_bigElev"),
        bigFreq: gl.getUniformLocation(this.waterProgram, "u_bigFreq"),
        bigSpeed: gl.getUniformLocation(this.waterProgram, "u_bigSpeed"),
        smallElev: gl.getUniformLocation(this.waterProgram, "u_smallElev"),
        smallFreq: gl.getUniformLocation(this.waterProgram, "u_smallFreq"),
        smallSpeed: gl.getUniformLocation(this.waterProgram, "u_smallSpeed"),
        smallIters: gl.getUniformLocation(this.waterProgram, "u_smallIters"),
        normalEps: gl.getUniformLocation(this.waterProgram, "u_normalEps"),
        depthColor: gl.getUniformLocation(this.waterProgram, "u_depthColor"),
        surfaceColor: gl.getUniformLocation(this.waterProgram, "u_surfaceColor"),
        foamColor: gl.getUniformLocation(this.waterProgram, "u_foamColor"),
        colorOffset: gl.getUniformLocation(this.waterProgram, "u_colorOffset"),
        colorMultiplier: gl.getUniformLocation(this.waterProgram, "u_colorMultiplier"),
        sunDir: gl.getUniformLocation(this.waterProgram, "u_sunDir"),
        sunColor: gl.getUniformLocation(this.waterProgram, "u_sunColor"),
        bands: gl.getUniformLocation(this.waterProgram, "u_bands"),
        deepFade: gl.getUniformLocation(this.waterProgram, "u_deepFade"),
        deepWater: gl.getUniformLocation(this.waterProgram, "u_deepWater"),
        fresnelPower: gl.getUniformLocation(this.waterProgram, "u_fresnelPower"),
        shininess: gl.getUniformLocation(this.waterProgram, "u_shininess"),
        foamThreshold: gl.getUniformLocation(this.waterProgram, "u_foamThreshold"),
        foamSoftness: gl.getUniformLocation(this.waterProgram, "u_foamSoftness")
      };
      this.applyWaterUniforms();

      this.opaqueBuffer = gl.createBuffer();
      this.transparentBuffer = gl.createBuffer();
      this.underwaterBuffer = gl.createBuffer();
      this.underwaterCount = 0;
      this.waterBuffer = gl.createBuffer();
      this.waterCount = 0;
      this.revealBuffer = gl.createBuffer();
      this.revealCount = 0;
      this.reveal = null;
      this.revealRise = 0;
      this.labelPop = null;
      this.rebuildWaterGeometry();

      gl.useProgram(this.program);
      gl.uniform3f(this.locations.lightDir, -0.38, 0.94, 0.42);
      if (this.locations.mistColor) {
        const mist = hexToRgba(this.mistColor || '#f0e6f4');
        gl.uniform3f(this.locations.mistColor, mist[0], mist[1], mist[2]);
      }
      if (this.locations.fogStart) gl.uniform1f(this.locations.fogStart, this.fogStart != null ? this.fogStart : 0.40);
      if (this.locations.fogStrength) gl.uniform1f(this.locations.fogStrength, this.fogStrength != null ? this.fogStrength : 0.82);
      if (this.locations.waterY) gl.uniform1f(this.locations.waterY, -0.80);
      if (this.locations.deepColor) {
        const deep = hexToRgba("#34146e");   // rich soda-depth purple
        gl.uniform3f(this.locations.deepColor, deep[0], deep[1], deep[2]);
      }
      if (this.locations.spongeScale) gl.uniform1f(this.locations.spongeScale, 7.5);
      if (this.locations.tierBottom) gl.uniform1f(this.locations.tierBottom, 0.237);
      if (this.locations.foamBand) gl.uniform1f(this.locations.foamBand, 0.055);
      if (this.locations.foamColor) {
        const fm = hexToRgba("#eef0ff");   // soft white-lilac waterline foam
        gl.uniform3f(this.locations.foamColor, fm[0], fm[1], fm[2]);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    rebuildWaterGeometry() {
      if (!this.gl) return;
      const vertices = [];
      const y = -0.80;
      const xMin = -32.0;
      const xMax = 32.0;
      const zMin = this.minZ - 36;
      const zMax = this.maxZ + 10;
      const xSegments = 44;
      const zSegments = 132;

      for (let zi = 0; zi < zSegments; zi += 1) {
        const z0 = lerp(zMin, zMax, zi / zSegments);
        const z1 = lerp(zMin, zMax, (zi + 1) / zSegments);
        for (let xi = 0; xi < xSegments; xi += 1) {
          const x0 = lerp(xMin, xMax, xi / xSegments);
          const x1 = lerp(xMin, xMax, (xi + 1) / xSegments);
          vertices.push(
            x0, y, z0,
            x1, y, z0,
            x1, y, z1,
            x0, y, z0,
            x1, y, z1,
            x0, y, z1
          );
        }
      }

      this.waterCount = vertices.length / 3;
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.waterBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STATIC_DRAW);
    }

    createLabels() {
      this.labelLayer.innerHTML = "";
      this.currentGlow = document.createElement("div");
      this.currentGlow.className = "map-current-glow";
      this.currentGlow.setAttribute("aria-hidden", "true");
      this.labelLayer.appendChild(this.currentGlow);

      this.levels.forEach((level) => {
        const label = document.createElement("div");
        label.className = "map-level-label";
        label.textContent = String(level.id);
        label.setAttribute("aria-hidden", "true");
        this.labelLayer.appendChild(label);
        this.labels.set(level.id, label);
      });
      this.updateLabelsStatus();
    }

    bindEvents() {
      this.resizeHandler = () => this.resize();
      window.addEventListener("resize", this.resizeHandler);

      this.viewport.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        this.dragging = true;
        this.lastPointerY = event.clientY;
        this.pointerStart = { x: event.clientX, y: event.clientY, t: performance.now() };
        if (this.viewport.setPointerCapture) this.viewport.setPointerCapture(event.pointerId);
      });

      this.viewport.addEventListener("pointermove", (event) => {
        if (!this.dragging) return;
        const delta = event.clientY - this.lastPointerY;
        this.lastPointerY = event.clientY;
        this.targetZ = clamp(this.targetZ + delta * 0.032, this.minZ, this.maxZ);
      });

      const endDrag = (event) => {
        this.dragging = false;
        if (event && this.pointerStart) {
          const dx = event.clientX - this.pointerStart.x;
          const dy = event.clientY - this.pointerStart.y;
          if (Math.hypot(dx, dy) < 9 && performance.now() - this.pointerStart.t < 360) {
            this.handleOctopusTap(event.clientX, event.clientY);
          }
        }
        this.pointerStart = null;
        if (event && this.viewport.hasPointerCapture && this.viewport.hasPointerCapture(event.pointerId)) {
          this.viewport.releasePointerCapture(event.pointerId);
        }
      };
      this.viewport.addEventListener("pointerup", endDrag);
      this.viewport.addEventListener("pointercancel", endDrag);
      this.viewport.addEventListener("lostpointercapture", () => { this.dragging = false; });

      this.viewport.addEventListener("wheel", (event) => {
        event.preventDefault();
        this.targetZ = clamp(this.targetZ + event.deltaY * 0.014, this.minZ, this.maxZ);
      }, { passive: false });
    }

    setCurrentLevel(levelId) {
      if (this.currentLevel === levelId) return;
      const prev = this.currentLevel;
      this.currentLevel = levelId;
      this.updateLabelsStatus();
      this.updateFallbackStatus();
      // Advancing to a new level: play the reveal (the new island rises from the
      // depths to the surface). Other changes (jump back, reduced motion) snap.
      if (levelId > prev && this.gl && !this.reduceMotion) {
        this.startReveal(levelId, prev);
      } else {
        this.reveal = null;
        this.revealCount = 0;
        this.labelPop = null;
        this.rebuildGeometry();
      }
    }

    // Prepare the level-up reveal: rebuild the main geometry WITHOUT the new
    // level (so it isn't drawn twice), and stage that island in its own buffer
    // at the surface. A per-frame Y offset (revealRise) starts it underwater and
    // eases it up; the rise itself only begins once the camera has arrived.
    startReveal(levelId, prev) {
      const level = this.levels.find((l) => l.id === levelId);
      if (!level) { this.rebuildGeometry(); return; }
      const nOld = Math.max(1, levelId - prev);
      const sinkOld = clamp(0.95 + (nOld - 1) * 0.42, 0.95, 2.4);
      const fromOffset = -(sinkOld - this.activeDrop);   // depth it sat at while locked
      this.reveal = { id: levelId, start: null, dur: REVEAL_MS, fromOffset };
      this.revealRise = fromOffset;
      this.labelPop = null;
      this.buildRevealIsland(level);
      this.rebuildGeometry(levelId);
    }

    buildRevealIsland(level) {
      if (!this.gl) return;
      const builder = new GeometryBuilder();
      const scale = level.s || 1;
      const rx = 0.82 * scale;
      const rz = 0.66 * scale;
      let topColor = hexToRgba("#8af6ff");
      let tierColor = hexToRgba("#37d4e6");
      const dividerColor = hexToRgba("#8a3b46");
      const bottomColor = hexToRgba("#f5901c");
      if (level.diff) {
        const dh = level.diff === "hard" ? "#2aa8ff" : level.diff === "super" ? "#ffd23f" : "#ff4d4d";
        topColor = hexToRgba(dh);
        tierColor = hexToRgba(dh);
      }
      const dy = -this.activeDrop;
      builder.addHexPrism(level.x, level.z, rx * 1.12, rz * 1.10, 0.16 + dy, -0.62 + dy, topColor, tierColor, dividerColor, bottomColor, null);
      const arr = builder.opaque;
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.revealBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(arr), this.gl.STATIC_DRAW);
      this.revealCount = arr.length / 12;
    }

    scrollToLevel(levelId, immediate = false) {
      const level = this.levels.find((l) => l.id === levelId);
      if (!level) return;
      if (!this.gl) {
        this.scrollFallbackToLevel(levelId, immediate);
        return;
      }
      this.targetZ = clamp(level.z + 0.8, this.minZ, this.maxZ);
      if (immediate) this.cameraZ = this.targetZ;
    }

    statusFor(levelId) {
      if (levelId < this.currentLevel) return "completed";
      if (levelId === this.currentLevel) return "current";
      return "locked";
    }

    updateLabelsStatus() {
      this.levels.forEach((level) => {
        const label = this.labels.get(level.id);
        if (!label) return;
        const status = this.statusFor(level.id);
        label.className = `map-level-label is-${status}`;
      });
    }

    sharedSideIndex(from, to) {
      const angle = Math.atan2(to.z - from.z, to.x - from.x);
      const directions = [
        { side: 0, angle: 60 * DEG },
        { side: 1, angle: 120 * DEG },
        { side: 2, angle: 180 * DEG },
        { side: 3, angle: -120 * DEG },
        { side: 4, angle: -60 * DEG },
        { side: 5, angle: 0 }
      ];
      let best = directions[0];
      let bestDistance = Infinity;
      directions.forEach((candidate) => {
        const delta = Math.atan2(Math.sin(angle - candidate.angle), Math.cos(angle - candidate.angle));
        const distance = Math.abs(delta);
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      });
      return best.side;
    }

    getSharedSidesByLevel(orderedLevels) {
      const opposite = [3, 4, 5, 0, 1, 2];
      const sharedSides = new Map();
      const addSharedSide = (levelId, side) => {
        if (!sharedSides.has(levelId)) sharedSides.set(levelId, new Set());
        sharedSides.get(levelId).add(side);
      };

      for (let i = 0; i < orderedLevels.length - 1; i += 1) {
        const current = orderedLevels[i];
        const next = orderedLevels[i + 1];
        // Only connect (skip a shared wall) when the two tiles actually touch.
        // Across a cluster gap they sit too far apart, so both keep all sides.
        const dist = Math.hypot(next.x - current.x, next.z - current.z);
        if (dist > 1.5) continue;
        const side = this.sharedSideIndex(current, next);
        addSharedSide(current.id, side);
        addSharedSide(next.id, opposite[side]);
      }

      return sharedSides;
    }

    submersionFor(level) {
      // Completed + current sit on the surface. Upcoming (locked) levels sink
      // gradually — each one deeper and fainter than the last — so they read as
      // future levels receding into the depths, still visible through the sea.
      if (this.statusFor(level.id) !== "locked") {
        return { sink: 0, fade: 0, alpha: 1, underwater: false };
      }
      const n = level.id - this.currentLevel;            // 1 = the very next level
      const fade = clamp((n - 1) / 7, 0, 1);
      const sink = clamp(0.95 + (n - 1) * 0.42, 0.95, 2.4);
      const alpha = lerp(0.66, 0.18, fade);
      return { sink, fade, alpha, underwater: true };
    }

    rebuildGeometry(skipId) {
      if (!this.gl) return;
      const builder = new GeometryBuilder();
      const sorted = this.levels.slice().sort((a, b) => b.z - a.z);
      const ordered = this.levels.slice().sort((a, b) => a.id - b.id);
      const sharedSidesByLevel = this.getSharedSidesByLevel(ordered);
      // Deep-sea floor: an opaque plane far below the surface so the translucent
      // water always has solid depths behind it (never the sky). The island
      // shader renders it as the darkest soda depths.
      const floorY = -3.6;
      const fX = 32;
      const fZmin = this.minZ - 36;
      const fZmax = this.maxZ + 10;
      const floorColor = [0.12, 0.04, 0.26, 1];
      builder.triangle(builder.opaque, [-fX, floorY, fZmin], [fX, floorY, fZmin], [fX, floorY, fZmax], [0, 1, 0], floorColor);
      builder.triangle(builder.opaque, [-fX, floorY, fZmin], [fX, floorY, fZmax], [-fX, floorY, fZmax], [0, 1, 0], floorColor);

      sorted.forEach((level) => {
        if (skipId != null && level.id === skipId) return;
        const status = this.statusFor(level.id);
        const palette = this.palette[(level.id - 1) % this.palette.length];
        const scale = level.s || 1;
        const rx = 0.82 * scale;
        const rz = 0.66 * scale;
        const sub = this.submersionFor(level);
        const dy = sub.underwater ? -sub.sink : -this.activeDrop;

        // Two-tier "cake" palette from the references:
        //   top tier (face + upper wall)  /  divider band  /  sponge base.
        // Active islands keep each level's colour on the top tier over a maroon
        // divider and an orange sponge base. The current level gets a distinct
        // highlight top. Sunken (future) islands use the purple reference ramp,
        // which the shader then darkens further with depth.
        let topColor;
        let tierColor;
        let dividerColor;
        let bottomColor;
        if (sub.underwater) {
          topColor = hexToRgba("#7401e2");
          tierColor = hexToRgba("#4a0294");
          dividerColor = hexToRgba("#0b0023");
          bottomColor = hexToRgba("#34076e");
        } else if (status === "current") {
          topColor = hexToRgba("#8af6ff");
          tierColor = hexToRgba("#37d4e6");
          dividerColor = hexToRgba("#8a3b46");
          bottomColor = hexToRgba("#f5901c");
        } else {
          topColor = brighten(hexToRgba(palette.top), 0.06);
          tierColor = hexToRgba(palette.side);
          dividerColor = hexToRgba("#8a3b46");
          bottomColor = hexToRgba("#f5901c");
        }

        // Hard / super / ultra levels wear their octopus colour on the top tier
        // (top face + upper wall), so the played trail shows which levels bite.
        if (!sub.underwater && level.diff) {
          const dh = level.diff === "hard" ? "#2aa8ff" : level.diff === "super" ? "#ffd23f" : "#ff4d4d";
          topColor = hexToRgba(dh);
          tierColor = hexToRgba(dh);
        }

        // No contact shadow: active islands now dip into the water, so the
        // waterline itself grounds them instead of a painted ellipse.
        builder.addHexPrism(level.x, level.z, rx * 1.12, rz * 1.10, 0.16 + dy, -0.62 + dy, topColor, tierColor, dividerColor, bottomColor, sharedSidesByLevel.get(level.id));
      });

      this.opaqueCount = builder.opaque.length / 12;
      this.transparentCount = builder.transparent.length / 12;
      this.underwaterCount = builder.underwater.length / 12;
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.opaqueBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(builder.opaque), this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.transparentBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(builder.transparent), this.gl.STATIC_DRAW);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.underwaterBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(builder.underwater), this.gl.STATIC_DRAW);
    }

    resize() {
      if (!this.gl) return;
      const rect = this.canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * this.dpr));
      const height = Math.max(1, Math.round(rect.height * this.dpr));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.width = rect.width;
      this.height = rect.height;
      this.gl.viewport(0, 0, width, height);
    }

    updateCamera() {
      this.cameraZ = lerp(this.cameraZ, this.targetZ, this.dragging ? 0.28 : 0.09);
      const aspect = this.canvas.width / Math.max(1, this.canvas.height);
      // Wider camera so the connected island path breathes a bit more inside the fixed UI.
      perspective(this.matrices.projection, 54 * DEG, aspect, 0.1, 90);

      const eye = [0, 7.80, this.cameraZ + 10.20];
      const center = [0, -0.33, this.cameraZ - 3.45];
      this.eye = eye;
      lookAt(this.matrices.view, eye, center, [0, 1, 0]);
      multiply(this.matrices.viewProjection, this.matrices.projection, this.matrices.view);
    }

    bindGeometry(buffer) {
      const gl = this.gl;
      const stride = 12 * 4;
      const waterPosition = this.waterLocations.position;
      const islandAttributes = [this.locations.position, this.locations.normal, this.locations.color, this.locations.uv];
      if (waterPosition >= 0 && !islandAttributes.includes(waterPosition)) {
        gl.disableVertexAttribArray(waterPosition);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(this.locations.position);
      gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(this.locations.normal);
      gl.vertexAttribPointer(this.locations.normal, 3, gl.FLOAT, false, stride, 3 * 4);
      gl.enableVertexAttribArray(this.locations.color);
      gl.vertexAttribPointer(this.locations.color, 4, gl.FLOAT, false, stride, 6 * 4);
      if (this.locations.uv >= 0) {
        gl.enableVertexAttribArray(this.locations.uv);
        gl.vertexAttribPointer(this.locations.uv, 2, gl.FLOAT, false, stride, 10 * 4);
      }
    }

    applyWaterUniforms() {
      const gl = this.gl;
      const L = this.waterLocations;
      const w = this.waterSettings;
      if (!gl || !L) return;
      gl.useProgram(this.waterProgram);
      const setF = (loc, v) => { if (loc) gl.uniform1f(loc, v); };
      const setC = (loc, hex) => { if (loc) { const c = hexToRgba(hex); gl.uniform3f(loc, c[0], c[1], c[2]); } };
      setF(L.bigElev, w.bigElev);
      if (L.bigFreq) gl.uniform2f(L.bigFreq, w.bigFreqX, w.bigFreqZ);
      setF(L.bigSpeed, w.bigSpeed);
      setF(L.smallElev, w.smallElev);
      setF(L.smallFreq, w.smallFreq);
      setF(L.smallSpeed, w.smallSpeed);
      setF(L.smallIters, w.smallIters);
      setF(L.normalEps, w.normalEps);
      setC(L.depthColor, w.depthColor);
      setC(L.surfaceColor, w.surfaceColor);
      setC(L.foamColor, w.foamColor);
      setF(L.colorOffset, w.colorOffset);
      setF(L.colorMultiplier, w.colorMultiplier);
      if (L.sunDir) gl.uniform3f(L.sunDir, w.sunDir[0], w.sunDir[1], w.sunDir[2]);
      setC(L.sunColor, w.sunColor);
      setF(L.bands, w.bands);
      setF(L.fresnelPower, w.fresnelPower);
      setF(L.shininess, w.shininess);
      setF(L.foamThreshold, w.foamThreshold);
      setF(L.foamSoftness, w.foamSoftness);
      setF(L.deepFade, w.deepFade);
      setC(L.deepWater, w.deepWater);
    }

    drawWater() {
      const gl = this.gl;
      const time = this.reduceMotion ? 0 : (performance.now() - this.startTime) * 0.001;
      gl.useProgram(this.waterProgram);
      gl.uniformMatrix4fv(this.waterLocations.matrix, false, this.matrices.viewProjection);
      gl.uniform1f(this.waterLocations.cameraZ, this.cameraZ);
      if (this.waterLocations.time) gl.uniform1f(this.waterLocations.time, time);
      if (this.waterLocations.waveHeight) gl.uniform1f(this.waterLocations.waveHeight, this.waterSettings.waveHeight);
      if (this.waterLocations.cameraPos && this.eye) {
        gl.uniform3f(this.waterLocations.cameraPos, this.eye[0], this.eye[1], this.eye[2]);
      }
      const waterPosition = this.waterLocations.position;
      if (waterPosition < 0) return;
      [this.locations.position, this.locations.normal, this.locations.color, this.locations.uv].forEach((location) => {
        if (location >= 0 && location !== waterPosition) gl.disableVertexAttribArray(location);
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, this.waterBuffer);
      gl.enableVertexAttribArray(waterPosition);
      gl.vertexAttribPointer(waterPosition, 3, gl.FLOAT, false, 0, 0);
      gl.depthMask(false);
      if (this.waterCount) gl.drawArrays(gl.TRIANGLES, 0, this.waterCount);
      gl.depthMask(true);
    }

    octoPush(arr, p, n, c) {
      const nn = normalize(n);
      arr.push(p[0], p[1], p[2], nn[0], nn[1], nn[2], c[0], c[1], c[2], c.length > 3 ? c[3] : 1, 0, 0);
    }

    octoSphere(arr, cx, cy, cz, rx, ry, rz, color, latN, lonN) {
      const vAt = (t, p) => { const st = Math.sin(t); return [cx + rx * st * Math.cos(p), cy + ry * Math.cos(t), cz + rz * st * Math.sin(p)]; };
      const nAt = (t, p) => { const st = Math.sin(t); return [st * Math.cos(p) / rx, Math.cos(t) / ry, st * Math.sin(p) / rz]; };
      for (let i = 0; i < latN; i += 1) {
        const t0 = (i / latN) * Math.PI;
        const t1 = ((i + 1) / latN) * Math.PI;
        for (let j = 0; j < lonN; j += 1) {
          const p0 = (j / lonN) * 2 * Math.PI;
          const p1 = ((j + 1) / lonN) * 2 * Math.PI;
          const A = vAt(t0, p0); const B = vAt(t1, p0); const C = vAt(t1, p1); const D = vAt(t0, p1);
          const nA = nAt(t0, p0); const nB = nAt(t1, p0); const nC = nAt(t1, p1); const nD = nAt(t0, p1);
          this.octoPush(arr, A, nA, color); this.octoPush(arr, B, nB, color); this.octoPush(arr, C, nC, color);
          this.octoPush(arr, A, nA, color); this.octoPush(arr, C, nC, color); this.octoPush(arr, D, nD, color);
        }
      }
    }

    octoTentacle(arr, base, tip, baseR, tipR, color, segs) {
      const axn = normalize([tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]]);
      const up = Math.abs(axn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const u = normalize(cross(axn, up));
      const w = normalize(cross(axn, u));
      const ring = (cen, r, a) => [cen[0] + r * (Math.cos(a) * u[0] + Math.sin(a) * w[0]), cen[1] + r * (Math.cos(a) * u[1] + Math.sin(a) * w[1]), cen[2] + r * (Math.cos(a) * u[2] + Math.sin(a) * w[2])];
      const nrm = (a) => normalize([Math.cos(a) * u[0] + Math.sin(a) * w[0], Math.cos(a) * u[1] + Math.sin(a) * w[1], Math.cos(a) * u[2] + Math.sin(a) * w[2]]);
      for (let j = 0; j < segs; j += 1) {
        const a0 = (j / segs) * 2 * Math.PI;
        const a1 = ((j + 1) / segs) * 2 * Math.PI;
        const B0 = ring(base, baseR, a0); const B1 = ring(base, baseR, a1);
        const T0 = ring(tip, tipR, a0); const T1 = ring(tip, tipR, a1);
        const n0 = nrm(a0); const n1 = nrm(a1);
        this.octoPush(arr, B0, n0, color); this.octoPush(arr, T0, n0, color); this.octoPush(arr, T1, n1, color);
        this.octoPush(arr, B0, n0, color); this.octoPush(arr, T1, n1, color); this.octoPush(arr, B1, n1, color);
      }
    }

    buildOctopusColor(arr, body) {
      const white = [0.98, 0.98, 1.0, 1];
      const dark = [0.05, 0.05, 0.10, 1];
      // mantle / head
      this.octoSphere(arr, 0, 0.02, 0, 0.42, 0.40, 0.42, body, 9, 14);
      // big googly eyes (white) on the upper front (+z), facing the camera, with pupils
      this.octoSphere(arr, -0.17, 0.10, 0.30, 0.17, 0.17, 0.16, white, 7, 10);
      this.octoSphere(arr, 0.17, 0.10, 0.30, 0.17, 0.17, 0.16, white, 7, 10);
      this.octoSphere(arr, -0.17, 0.08, 0.45, 0.075, 0.085, 0.06, dark, 6, 8);
      this.octoSphere(arr, 0.17, 0.08, 0.45, 0.075, 0.085, 0.06, dark, 6, 8);
      // a few tapered tentacles splaying out from the base
      const tcol = darken(body, 0.10);
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * 2 * Math.PI + 0.4;
        const base = [Math.cos(a) * 0.20, -0.28, Math.sin(a) * 0.20];
        const tip = [Math.cos(a) * 0.40, -0.86, Math.sin(a) * 0.40];
        this.octoTentacle(arr, base, tip, 0.10, 0.02, tcol, 6);
      }
    }

    setupOctopi() {
      if (!this.gl) return;
      const arr = [];
      const ranges = [];
      const colors = [hexToRgba("#2aa8ff"), hexToRgba("#ffd23f"), hexToRgba("#ff4d4d")]; // hard, super, ultra
      colors.forEach((col) => {
        const first = arr.length / 12;
        this.buildOctopusColor(arr, col);
        ranges.push({ first, count: arr.length / 12 - first });
      });
      this.octoBuffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.octoBuffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(arr), this.gl.STATIC_DRAW);
      this.octoRanges = ranges;
      this.octoModel = new Float32Array(16);
      this.octopi = [];
      this.levels.forEach((level) => {
        if (!level.diff) return;
        const ci = level.diff === "hard" ? 0 : level.diff === "super" ? 1 : 2;
        this.octopi.push({ id: level.id, x: level.x, z: level.z, ci, phase: (level.id * 1.37) % (Math.PI * 2) });
      });
    }

    // ---- End-of-map celebratory ship (a stylized galleon) -----------------
    shipPush(arr, p, n, c) {
      const nn = normalize(n);
      arr.push(p[0], p[1], p[2], nn[0], nn[1], nn[2], c[0], c[1], c[2], c.length > 3 ? c[3] : 1, 0, 0);
    }
    shipQuad(arr, a, b, c, d, color) {
      const n = normalize(cross(subtract(b, a), subtract(d, a)));
      this.shipPush(arr, a, n, color); this.shipPush(arr, b, n, color); this.shipPush(arr, c, n, color);
      this.shipPush(arr, a, n, color); this.shipPush(arr, c, n, color); this.shipPush(arr, d, n, color);
    }
    shipBox(arr, x0, y0, z0, x1, y1, z1, color) {
      const top = brighten(color, 0.12), bot = darken(color, 0.20), bk = darken(color, 0.08);
      this.shipQuad(arr, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
      this.shipQuad(arr, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], bot);
      this.shipQuad(arr, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color);
      this.shipQuad(arr, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], bk);
      this.shipQuad(arr, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color);
      this.shipQuad(arr, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color);
    }
    shipTube(arr, a, b, r, color, segs) {
      segs = segs || 8;
      const axn = normalize(subtract(b, a));
      const up = Math.abs(axn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const u = normalize(cross(axn, up)), w = normalize(cross(axn, u));
      const ring = (cen, aa) => [cen[0] + r * (Math.cos(aa) * u[0] + Math.sin(aa) * w[0]), cen[1] + r * (Math.cos(aa) * u[1] + Math.sin(aa) * w[1]), cen[2] + r * (Math.cos(aa) * u[2] + Math.sin(aa) * w[2])];
      const nrm = (aa) => normalize([Math.cos(aa) * u[0] + Math.sin(aa) * w[0], Math.cos(aa) * u[1] + Math.sin(aa) * w[1], Math.cos(aa) * u[2] + Math.sin(aa) * w[2]]);
      for (let j = 0; j < segs; j += 1) {
        const a0 = (j / segs) * 2 * Math.PI, a1 = ((j + 1) / segs) * 2 * Math.PI;
        const A = ring(a, a0), B = ring(a, a1), C = ring(b, a1), D = ring(b, a0);
        const n0 = nrm(a0), n1 = nrm(a1);
        this.shipPush(arr, A, n0, color); this.shipPush(arr, B, n1, color); this.shipPush(arr, C, n1, color);
        this.shipPush(arr, A, n0, color); this.shipPush(arr, C, n1, color); this.shipPush(arr, D, n0, color);
      }
    }
    // A billowed square sail in the X-Y plane, bellying toward +z (the camera).
    shipSail(arr, xL, xR, yTop, yBot, belly, color) {
      const gx = 5, gy = 5;
      const shade = darken(color, 0.05);
      const P = (i, j) => {
        const u = i / gx, v = j / gy;
        const x = lerp(xL, xR, u), y = lerp(yTop, yBot, v);
        const z = belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.18 + 0.82 * v));
        return [x, y, z];
      };
      for (let i = 0; i < gx; i += 1) for (let j = 0; j < gy; j += 1) {
        this.shipQuad(arr, P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1), j % 2 === 0 ? color : shade);
      }
    }

    buildShip(arr, flagArr) {
      const hull = hexToRgba("#8a5a30");
      const hullDark = hexToRgba("#6f4623");
      const deck = hexToRgba("#b07d45");
      const rail = hexToRgba("#5c3a1e");
      const mast = hexToRgba("#7a4f28");
      const spar = hexToRgba("#6f4624");
      const sail = hexToRgba("#f3ead1");
      const win = hexToRgba("#241a10");
      const xb = -1.15, xs = 1.05, xMid = (xb + xs) / 2, halfLen = (xs - xb) / 2;
      const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
      const hw = (x) => {
        const t = (x - xb) / (xs - xb);
        const bow = ss(0.0, 0.16, t);             // pinch to a prow at the bow
        const stern = 1 - 0.32 * ss(0.80, 1.0, t); // slight taper to the transom
        return 0.42 * bow * stern + 0.03;
      };
      const yb = (x) => -0.34 + 0.34 * Math.pow((x - xMid) / halfLen, 2);   // keel: dips mid, rises at ends
      const yt = (x) => 0.24 + 0.17 * Math.pow((x - xMid) / halfLen, 2);    // sheer: rises at bow + stern

      // Hull: lofted cross-sections, the sides split into planks (alternating browns).
      const N = 18, planks = 4;
      for (let i = 0; i < N; i += 1) {
        const x0 = lerp(xb, xs, i / N), x1 = lerp(xb, xs, (i + 1) / N);
        const w0 = hw(x0), w1 = hw(x1), b0 = yb(x0), b1 = yb(x1), t0 = yt(x0), t1 = yt(x1);
        for (let s = 0; s < 2; s += 1) {
          const zs = s === 0 ? 1 : -1;
          for (let k = 0; k < planks; k += 1) {
            const ya0 = lerp(b0, t0, k / planks), ya1 = lerp(b0, t0, (k + 1) / planks);
            const yc0 = lerp(b1, t1, k / planks), yc1 = lerp(b1, t1, (k + 1) / planks);
            const col = k % 2 === 0 ? hull : hullDark;
            this.shipQuad(arr, [x0, ya0, w0 * zs], [x1, yc0, w1 * zs], [x1, yc1, w1 * zs], [x0, ya1, w0 * zs], col);
          }
        }
        // keel underside
        this.shipQuad(arr, [x0, b0, -w0], [x1, b1, -w1], [x1, b1, w1], [x0, b0, w0], hullDark);
        // deck surface (closes the top)
        this.shipQuad(arr, [x0, t0, -w0], [x1, t1, -w1], [x1, t1, w1], [x0, t0, w0], deck);
        // top rail trim, both sides
        this.shipQuad(arr, [x0, t0, w0], [x1, t1, w1], [x1, t1 + 0.04, w1], [x0, t0 + 0.04, w0], rail);
        this.shipQuad(arr, [x0, t0, -w0], [x1, t1, -w1], [x1, t1 + 0.04, -w1], [x0, t0 + 0.04, -w0], rail);
      }
      // transom (stern cap) + bow cap
      this.shipQuad(arr, [xs, yb(xs), -hw(xs)], [xs, yb(xs), hw(xs)], [xs, yt(xs), hw(xs)], [xs, yt(xs), -hw(xs)], hullDark);

      // Raised stern castle with three windows on the broadside (+z).
      const cz = hw(0.78) - 0.01;
      this.shipBox(arr, 0.52, yt(0.7) - 0.02, -cz, 0.98, 0.6, cz, hull);
      for (let wI = 0; wI < 3; wI += 1) {
        const wx = 0.6 + wI * 0.16;
        this.shipQuad(arr, [wx, 0.30, cz + 0.005], [wx + 0.1, 0.30, cz + 0.005], [wx + 0.1, 0.45, cz + 0.005], [wx, 0.45, cz + 0.005], win);
      }

      // Masts (deck-stepped vertical poles).
      this.shipTube(arr, [-0.5, 0.18, 0], [-0.5, 1.62, 0], 0.035, mast, 8);   // foremast
      this.shipTube(arr, [0.1, 0.2, 0], [0.1, 2.05, 0], 0.044, mast, 9);      // mainmast
      this.shipTube(arr, [0.74, 0.58, 0], [0.74, 1.66, 0], 0.034, mast, 8);   // mizzen (on the castle)
      // Bowsprit (angled spar off the bow).
      this.shipTube(arr, [-1.0, 0.32, 0], [-1.72, 0.66, 0], 0.03, spar, 7);

      // Yards (horizontal spars) + the cream sails hanging beneath them.
      const yard = (xc, half, y, r) => this.shipTube(arr, [xc - half, y, 0], [xc + half, y, 0], r || 0.022, spar, 6);
      // mainmast: two stacked square sails
      yard(0.1, 0.46, 1.55, 0.024); this.shipSail(arr, -0.34, 0.54, 1.5, 1.02, 0.19, sail);
      yard(0.1, 0.34, 1.96, 0.02);  this.shipSail(arr, -0.22, 0.42, 1.92, 1.6, 0.15, sail);
      // foremast: one square sail
      yard(-0.5, 0.34, 1.42, 0.02); this.shipSail(arr, -0.82, -0.18, 1.38, 0.96, 0.16, sail);
      // mizzen: one sail
      yard(0.74, 0.28, 1.58, 0.02); this.shipSail(arr, 0.48, 1.0, 1.54, 1.12, 0.14, sail);
      // bowsprit jib (a small triangular head-sail)
      this.shipPush(arr, [-1.0, 0.32, 0], [0, 0, 1], sail);
      this.shipPush(arr, [-1.66, 0.62, 0], [0, 0, 1], sail);
      this.shipPush(arr, [-1.04, 0.96, 0], [0, 0, 1], sail);

      // One pennant template, centred at the origin (attach point), extending +x,
      // so it can be hung at each masthead and fluttered about its pole.
      const flagRed = hexToRgba("#d2452f");
      const flagDk = hexToRgba("#b23522");
      const fp = (x, y) => [x, y, 0.02 * Math.sin(x * 7)];
      this.shipPush(flagArr, fp(0, 0.04), [0, 0, 1], flagRed); this.shipPush(flagArr, fp(0, -0.12), [0, 0, 1], flagDk); this.shipPush(flagArr, fp(0.34, -0.04), [0, 0, 1], flagRed);
      this.shipPush(flagArr, fp(0, 0.04), [0, 0, 1], flagRed); this.shipPush(flagArr, fp(0.34, -0.04), [0, 0, 1], flagRed); this.shipPush(flagArr, fp(0.16, 0.08), [0, 0, 1], flagDk);
    }

    buildShipGlow(arr) {
      // Soft warm disc on the water around the ship (celebratory halo).
      const segs = 40, r = 1.7;
      const cen = [0, 0.02, 0];
      const inner = hexToRgba("#ffe6ac", 0.5);
      const outer = hexToRgba("#ffe6ac", 0.0);
      for (let j = 0; j < segs; j += 1) {
        const a0 = (j / segs) * 2 * Math.PI, a1 = ((j + 1) / segs) * 2 * Math.PI;
        const p0 = [Math.cos(a0) * r, 0.02, Math.sin(a0) * r * 0.7];
        const p1 = [Math.cos(a1) * r, 0.02, Math.sin(a1) * r * 0.7];
        this.shipPush(arr, cen, [0, 1, 0], inner); this.shipPush(arr, p0, [0, 1, 0], outer); this.shipPush(arr, p1, [0, 1, 0], outer);
      }
    }

    setupShip() {
      if (!this.gl || !this.levels || this.levels.length < 2) return;
      const sorted = this.levels.slice().sort((a, b) => a.id - b.id);
      const last = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      const stepZ = last.z - prev.z;       // "forward" direction (negative: into the distance)
      this.shipPos = {
        x: clamp(last.x * 0.5, -0.45, 0.45),
        z: last.z + stepZ * 0.9,
        scale: SHIP_SCALE * 1.08            // a touch larger for the celebratory finish
      };
      const body = [], flags = [], glow = [];
      this.buildShip(body, flags);
      this.buildShipGlow(glow);
      const gl = this.gl;
      this.shipBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.shipBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(body), gl.STATIC_DRAW);
      this.shipCount = body.length / 12;
      this.flagBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.flagBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flags), gl.STATIC_DRAW);
      this.flagCount = flags.length / 12;
      this.glowBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.glowBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(glow), gl.STATIC_DRAW);
      this.glowCount = glow.length / 12;
      // Masthead attach points for the fluttering pennants (ship-local space).
      this.shipFlags = [
        { x: 0.1, y: 2.05, z: 0, phase: 0.0 },
        { x: 0.74, y: 1.66, z: 0, phase: 1.7 }
      ];
      this.shipModel = new Float32Array(16);
      this.shipChild = new Float32Array(16);
    }

    drawShipBody() {
      if (!this.shipCount || !this.shipPos) return;
      const gl = this.gl;
      const t = this.reduceMotion ? 0 : (performance.now() - this.startTime) * 0.001;
      const bob = 0.05 * Math.sin(t * 0.9);
      const roll = this.reduceMotion ? 0 : 0.05 * Math.sin(t * 0.72) + 0.02 * Math.sin(t * 1.5);
      composeOctopusMatrix(this.shipModel, this.shipPos.x, -0.80 + bob, this.shipPos.z, roll, this.shipPos.scale);
      gl.uniformMatrix4fv(this.locations.model, false, this.shipModel);
      this.bindGeometry(this.shipBuffer);
      gl.drawArrays(gl.TRIANGLES, 0, this.shipCount);
      // Fluttering pennants: ship transform composed with a per-flag flap.
      if (this.flagCount) {
        this.bindGeometry(this.flagBuffer);
        for (let i = 0; i < this.shipFlags.length; i += 1) {
          const f = this.shipFlags[i];
          const ang = this.reduceMotion ? 0 : 0.22 * Math.sin(t * 4.2 + f.phase) + 0.13 * Math.sin(t * 7.1 + f.phase);
          const c = Math.cos(ang), s = Math.sin(ang);
          const L = this.shipChild;
          L[0] = c; L[1] = s; L[2] = 0; L[3] = 0;
          L[4] = -s; L[5] = c; L[6] = 0; L[7] = 0;
          L[8] = 0; L[9] = 0; L[10] = 1; L[11] = 0;
          L[12] = f.x; L[13] = f.y; L[14] = f.z; L[15] = 1;
          const M = new Float32Array(16);
          multiply(M, this.shipModel, L);
          gl.uniformMatrix4fv(this.locations.model, false, M);
          gl.drawArrays(gl.TRIANGLES, 0, this.flagCount);
        }
      }
      composeOctopusMatrix(this.shipModel, 0, 0, 0, 0, 1);
      gl.uniformMatrix4fv(this.locations.model, false, this.shipModel);
    }

    drawShipGlow() {
      if (!this.glowCount || !this.shipPos) return;
      const gl = this.gl;
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.locations.matrix, false, this.matrices.viewProjection);
      if (this.locations.cameraZ) gl.uniform1f(this.locations.cameraZ, this.cameraZ);
      gl.depthMask(false);
      const t = this.reduceMotion ? 0 : (performance.now() - this.startTime) * 0.001;
      const pulse = this.shipPos.scale * (1 + (this.reduceMotion ? 0 : 0.05 * Math.sin(t * 1.4)));
      composeOctopusMatrix(this.shipModel, this.shipPos.x, -0.79, this.shipPos.z, 0, pulse);
      gl.uniformMatrix4fv(this.locations.model, false, this.shipModel);
      this.bindGeometry(this.glowBuffer);
      gl.drawArrays(gl.TRIANGLES, 0, this.glowCount);
      composeOctopusMatrix(this.shipModel, 0, 0, 0, 0, 1);
      gl.uniformMatrix4fv(this.locations.model, false, this.shipModel);
      gl.depthMask(true);
    }

    difficultyOf(levelId) {
      const l = this.levels.find((x) => x.id === levelId);
      return l && l.diff ? l.diff : null;
    }

    handleOctopusTap(clientX, clientY) {
      if (!this.octopi || !this.matrices || !this.matrices.viewProjection) return;
      const rect = this.viewport.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      let best = null;
      let bestD = 46;   // generous touch radius (px)
      for (let i = 0; i < this.octopi.length; i += 1) {
        const o = this.octopi[i];
        if (o.id <= this.currentLevel || o.diveStart != null) continue;
        const sp = projectPoint(this.matrices.viewProjection, [o.x, -0.42, o.z], this.width, this.height);
        if (!sp) continue;
        const d = Math.hypot(sp.x - px, sp.y - py);
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best) best.diveStart = performance.now();
    }

    drawOctopi() {
      if (!this.octopi || !this.octopi.length) return;
      const gl = this.gl;
      const time = this.reduceMotion ? 0 : (performance.now() - this.startTime) * 0.001;
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.locations.matrix, false, this.matrices.viewProjection);
      if (this.locations.cameraZ) gl.uniform1f(this.locations.cameraZ, this.cameraZ);
      gl.depthMask(true);
      this.bindGeometry(this.octoBuffer);
      const now = performance.now();
      const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      for (let i = 0; i < this.octopi.length; i += 1) {
        const o = this.octopi[i];
        if (o.id <= this.currentLevel) continue;   // only submerged (upcoming) levels get a warning
        const bob = 0.07 * Math.sin(time * 1.6 + o.phase);
        const sway = 0.10 * Math.sin(time * 1.05 + o.phase * 0.7);
        // Tap-to-dive: a gentle duck under the surface and back — smooth ease
        // down, a brief hold, smooth ease back up (shallower + less linear).
        let diveY = 0;
        if (o.diveStart != null) {
          const p = (now - o.diveStart) / OCTO_DIVE_MS;
          if (p >= 1) { o.diveStart = null; }
          else {
            let d;
            if (p < 0.40) d = easeInOutCubic(p / 0.40);
            else if (p < 0.58) d = 1;
            else d = 1 - easeInOutCubic((p - 0.58) / 0.42);
            diveY = -OCTO_DIVE_DEPTH * d;
          }
        }
        // Sit at the surface: head above the waterline (-0.80), tentacles below.
        composeOctopusMatrix(this.octoModel, o.x, -0.55 + bob + diveY, o.z, sway, 0.78);
        gl.uniformMatrix4fv(this.locations.model, false, this.octoModel);
        gl.drawArrays(gl.TRIANGLES, this.octoRanges[o.ci].first, this.octoRanges[o.ci].count);
      }
      composeOctopusMatrix(this.octoModel, 0, 0, 0, 0, 1);   // reset model to identity
      gl.uniformMatrix4fv(this.locations.model, false, this.octoModel);
    }

    draw() {
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Opaque pass: deep-sea floor + every island (solid geometry). u_model is
      // identity for islands; only the floating octopuses use a real transform.
      composeOctopusMatrix(this.octoModel, 0, 0, 0, 0, 1);
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.locations.matrix, false, this.matrices.viewProjection);
      if (this.locations.cameraZ) gl.uniform1f(this.locations.cameraZ, this.cameraZ);
      if (this.locations.time) {
        const t = this.reduceMotion ? 0 : (performance.now() - this.startTime) * 0.001;
        gl.uniform1f(this.locations.time, t);
      }
      gl.uniformMatrix4fv(this.locations.model, false, this.octoModel);
      gl.depthMask(true);
      this.bindGeometry(this.opaqueBuffer);
      if (this.opaqueCount) gl.drawArrays(gl.TRIANGLES, 0, this.opaqueCount);

      // Level-up reveal: the newly-current island, lifted by a Y-offset model
      // matrix from below the surface up to its resting place.
      if (this.reveal && this.revealCount) {
        const rm = this.octoModel;
        rm[0] = 1; rm[1] = 0; rm[2] = 0; rm[3] = 0;
        rm[4] = 0; rm[5] = 1; rm[6] = 0; rm[7] = 0;
        rm[8] = 0; rm[9] = 0; rm[10] = 1; rm[11] = 0;
        rm[12] = 0; rm[13] = this.revealRise; rm[14] = 0; rm[15] = 1;
        gl.uniformMatrix4fv(this.locations.model, false, rm);
        this.bindGeometry(this.revealBuffer);
        gl.drawArrays(gl.TRIANGLES, 0, this.revealCount);
        composeOctopusMatrix(rm, 0, 0, 0, 0, 1);
        gl.uniformMatrix4fv(this.locations.model, false, rm);
      }

      // Floating octopus markers above submerged (upcoming) hard levels. Drawn
      // before the water so the translucent surface is depth-rejected behind them.
      this.drawShipBody();
      this.drawOctopi();

      // Translucent water surface over the submerged islands and floor.
      this.drawWater();
      this.drawShipGlow();

      // Transparent details (contact shadows, current-level halo) over the water.
      gl.useProgram(this.program);
      gl.uniformMatrix4fv(this.locations.matrix, false, this.matrices.viewProjection);
      if (this.locations.cameraZ) gl.uniform1f(this.locations.cameraZ, this.cameraZ);
      gl.uniformMatrix4fv(this.locations.model, false, this.octoModel);
      gl.depthMask(false);
      this.bindGeometry(this.transparentBuffer);
      if (this.transparentCount) gl.drawArrays(gl.TRIANGLES, 0, this.transparentCount);
      gl.depthMask(true);
    }

    updateLabelsProjection() {
      let currentProjection = null;
      let currentScale = 1;
      let glowFade = 1;

      this.levels.forEach((level) => {
        const label = this.labels.get(level.id);
        if (!label) return;
        // The pin number shows on the CURRENT level only — completed and locked
        // levels carry no number; the islands themselves signal the trail.
        if (level.id !== this.currentLevel) {
          label.style.opacity = "0";
          return;
        }
        // While the new island is still rising (or queued to), keep its number
        // hidden — it pops in once the island has surfaced and settled.
        if (this.pendingReveal || (this.reveal && this.reveal.id === level.id)) {
          label.style.opacity = "0";
          currentProjection = null;
          return;
        }
        const p = projectPoint(this.matrices.viewProjection, [level.x, 0.36 - this.activeDrop, level.z], this.width, this.height);
        if (!p || !p.visible || p.y < 80 || p.y > this.height - 80) {
          label.style.opacity = "0";
          currentProjection = null;
          return;
        }
        // Pin-number animate-in: scale up from small with a soft overshoot and fade.
        let popScale = 1;
        let popFade = 1;
        if (this.labelPop && this.labelPop.id === level.id) {
          const lp = clamp((performance.now() - this.labelPop.start) / LABEL_POP_MS, 0, 1);
          popFade = clamp(lp * 1.4, 0, 1);
          popScale = lerp(0.35, 1, easeOutBack(lp, 2.0));
          if (lp >= 1) this.labelPop = null;
        }
        glowFade = popFade;
        const screenScale = clamp(0.52 + (p.y / this.height) * 0.78, 0.58, 1.22) * (level.s || 1);
        // Distant labels (near the top of the screen) blur and fade into the mist.
        const mistEnd = this.height * 0.23;
        const mistT = clamp((mistEnd - p.y) / Math.max(1, mistEnd - 80), 0, 1);
        label.style.opacity = ((1 - mistT * 0.72) * popFade).toFixed(3);
        label.style.filter = mistT > 0.01 ? `blur(${(mistT * 3.0).toFixed(2)}px)` : "none";
        label.style.zIndex = String(Math.round(p.y) + 3);
        label.style.transform = `translate(-50%, -50%) translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) scale(${(screenScale * popScale).toFixed(3)})`;

        const glowPoint = projectPoint(this.matrices.viewProjection, [level.x, 0.19, level.z], this.width, this.height);
        if (glowPoint && glowPoint.visible && glowPoint.y >= 80 && glowPoint.y <= this.height - 80) {
          currentProjection = glowPoint;
          currentScale = clamp(0.72 + (glowPoint.y / this.height) * 0.88, 0.72, 1.34) * (level.s || 1);
        }
      });

      if (this.currentGlow) {
        if (!currentProjection) {
          this.currentGlow.style.opacity = "0";
        } else {
          this.currentGlow.style.opacity = glowFade.toFixed(3);
          this.currentGlow.style.zIndex = String(Math.round(currentProjection.y) + 1);
          this.currentGlow.style.transform = `translate(${currentProjection.x.toFixed(1)}px, ${currentProjection.y.toFixed(1)}px) scale(${currentScale.toFixed(3)})`;
        }
      }
    }

    updateReveal() {
      if (!this.reveal) return;
      if (this.reveal.start == null) {
        // Hold the island submerged until the camera has (nearly) arrived, so
        // the player watches it actually surface rather than missing it mid-scroll.
        if (Math.abs(this.cameraZ - this.targetZ) < 0.16) this.reveal.start = performance.now();
        return;
      }
      const p = clamp((performance.now() - this.reveal.start) / this.reveal.dur, 0, 1);
      this.revealRise = lerp(this.reveal.fromOffset, 0, easeOutBack(p, REVEAL_OVERSHOOT));
      if (p >= 1) {
        const id = this.reveal.id;
        this.reveal = null;
        this.revealCount = 0;
        this.rebuildGeometry();
        this.labelPop = { id, start: performance.now() };
      }
    }

    tick() {
      if (!this.gl) return;
      this.resize();
      this.updateCamera();
      this.updateReveal();
      this.draw();
      this.updateLabelsProjection();
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  function makeLevels(totalLevels) {
    // Islands are arranged as a handful of connected clusters (hexes sharing
    // sides) separated by gaps, instead of one uniform snake. The vertical rhythm
    // stays even (a constant z step); only the side-to-side position varies, and
    // every island is kept inside a safe horizontal envelope so the camera — which
    // only scrolls along z and never pans — always keeps them comfortably on screen.
    const N = Math.max(1, Math.floor(Number(totalLevels) || 18));
    const outerRx = 0.82 * 1.12;
    const outerRz = 0.66 * 1.10;
    const stepX = Math.cos(30 * DEG) * outerRx;     // exact hex side-adjacency step
    const stepZ = 1.5 * outerRz;                    // even vertical rhythm
    const xLimit = 1.15;                            // safe centre envelope (no panning)
    const rng = mulberry32(0x50da97);              // fixed seed -> deterministic layout

    // Up to 7 clusters of variable size (>= 5 levels each), summing to N.
    let clusters = Math.min(7, Math.max(4, 4 + Math.floor(rng() * 4)));
    clusters = Math.min(clusters, Math.max(1, Math.floor(N / 6)));
    const sizes = [];
    let remaining = N;
    for (let i = 0; i < clusters; i += 1) {
      if (i === clusters - 1) {
        sizes.push(remaining);
      } else {
        const slotsLeft = clusters - i;
        const avg = remaining / slotsLeft;
        let sz = Math.round(avg * (0.55 + rng() * 0.9));
        sz = Math.max(5, Math.min(sz, remaining - 5 * (slotsLeft - 1)));
        sizes.push(sz);
        remaining -= sz;
      }
    }

    const path = [];
    let z = 0.20;
    let x = (rng() * 2 - 1) * 0.5;                  // start near centre
    let dir = rng() < 0.5 ? 1 : -1;
    let id = 1;

    for (let ci = 0; ci < sizes.length; ci += 1) {
      if (ci > 0) {
        // Separation: step sideways to a new area so the boundary islands no
        // longer share a side (a visible gap). z keeps its even rhythm.
        const toward = x > 0 ? -1 : 1;
        x = clamp(x + toward * (1.55 + rng() * 0.7), -xLimit, xLimit);
        dir = x > 0 ? -1 : 1;                       // head back toward centre
      }
      for (let j = 0; j < sizes[ci]; j += 1) {
        path.push({ id, x: clamp(x, -xLimit, xLimit), z, s: 1 });
        id += 1;
        z += stepZ;
        if (j < sizes[ci] - 1) {
          // Connected zig-zag with run-based randomness, reflecting at the walls
          // so each within-cluster step stays an exact side-adjacency move.
          if (rng() < 0.34) dir = -dir;
          let nx = x + dir * stepX;
          if (nx > xLimit || nx < -xLimit) { dir = -dir; nx = x + dir * stepX; }
          x = nx;
        }
      }
    }

    // Reverse the saga direction: mirror along z so level 1 sits nearest the
    // camera (bottom) and later levels recede up into the distance (top).
    const zSum = path[0].z + path[path.length - 1].z;
    path.forEach((level) => { level.z = zSum - level.z; });

    // Difficulty: a seeded, spread-out set of hard / super-hard / ultra-hard
    // levels (kept at least 3 apart so the markers never bunch up). The opening
    // levels stay easy. Submerged hard levels get a floating octopus warning.
    const drng = mulberry32(0x0c70d1);
    let lastMarked = -10;
    path.forEach((level) => {
      level.diff = null;
      if (level.id < 4 || level.id - lastMarked < 3) return;
      if (drng() < 0.6) return;
      const t = drng();
      level.diff = t < 0.62 ? "hard" : t < 0.88 ? "super" : "ultra";
      lastMarked = level.id;
    });

    return path;
  }

  const defaultPalette = [
    { top: '#fff1c9', side: '#d96cb3' },
    { top: '#98fff3', side: '#8b58d4' },
    { top: '#ffd2fb', side: '#c75fbb' },
    { top: '#fff7a8', side: '#d96c9f' },
    { top: '#caffc4', side: '#7b55c9' },
    { top: '#d4e0ff', side: '#c868bb' }
  ];

  function createSodaHome3D(options = {}) {
    const providedLevels = Array.isArray(options.levels) ? options.levels : null;
    const canUseProvidedLevels = providedLevels && providedLevels.every((level) => Number.isFinite(level.z));
    const levels = canUseProvidedLevels
      ? providedLevels
      : makeLevels(options.totalLevels || (providedLevels ? providedLevels.length : undefined));

    const map = new SodaHome3DMap({
      viewport: options.viewport || options.stage || options.scrollEl || (options.canvas ? options.canvas.parentElement : null),
      canvas: options.canvas,
      labelLayer: options.labelLayer,
      currentLevel: options.currentLevel || 1,
      levels,
      palette: options.palette || defaultPalette
    });
    map.focusLevel = map.scrollToLevel.bind(map);
    return map;
  }

  function initSodaHome3D(options = {}) {
    if (!options.canvas || !options.labelLayer) return null;
    const map = createSodaHome3D(options);
    if (options.errorElement) options.errorElement.hidden = true;
    return {
      update(payload) {
        const levelId = typeof payload === 'number' ? payload : payload.currentLevel;
        map.setCurrentLevel(levelId);
      },
      scrollToLevel(levelId, immediate = false) { map.scrollToLevel(levelId, immediate); },
      focusLevel(levelId, immediate = false) { map.scrollToLevel(levelId, immediate); },
      difficultyOf(levelId) { return map.difficultyOf(levelId); },
      resize() { map.resize(); },
      instance: map
    };
  }

  window.SodaHome3DMap = SodaHome3DMap;
  window.createSodaHome3D = createSodaHome3D;
  window.SodaHome3D = { init: initSodaHome3D, mount: initSodaHome3D };
}());
