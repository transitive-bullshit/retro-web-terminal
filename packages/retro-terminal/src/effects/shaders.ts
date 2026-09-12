// Original shaders. All intermediate textures use unwarped screen coordinates.
export const vertexShader = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

export const phosphorShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outputColor;
uniform sampler2D u_source;
uniform sampler2D u_overlay;
uniform sampler2D u_history;
uniform vec4 u_sourceRect;
uniform vec3 u_background;
uniform vec3 u_tint;
uniform float u_monochrome;
uniform float u_decay;
uniform float u_persistence;
void main() {
  vec2 uv = (v_uv - u_sourceRect.xy) / u_sourceRect.zw;
  vec3 color = u_background;
  if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
    vec4 source = texture(u_source, uv);
    vec4 overlay = texture(u_overlay, uv);
    color = mix(source.rgb, overlay.rgb, overlay.a);
  }
  if (u_monochrome > 0.5) {
    float signal = max(color.r, max(color.g, color.b));
    color = u_tint * signal;
  }
  vec3 current = pow(max(color, vec3(0.0)), vec3(2.2));
  vec3 previous = texture(u_history, v_uv).rgb * u_decay;
  outputColor = vec4(u_persistence > 0.5 ? max(current, previous) : current, 1.0);
}`

export const downsampleShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outputColor;
uniform sampler2D u_image;
uniform vec2 u_step;
void main() {
  vec3 c = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      c += texture(u_image, v_uv + vec2(float(x), float(y)) * u_step).rgb;
    }
  }
  outputColor = vec4(c / 9.0, 1.0);
}`

export const blurShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outputColor;
uniform sampler2D u_image;
uniform vec2 u_step;
void main() {
  vec3 c = vec3(0.0);
  float total = 0.0;
  for (int i = -6; i <= 6; i++) {
    float weight = exp(-float(i * i) / 8.0);
    c += texture(u_image, v_uv + u_step * float(i)).rgb * weight;
    total += weight;
  }
  outputColor = vec4(c / total, 1.0);
}`

export const screenShader = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outputColor;
uniform sampler2D u_image;
uniform sampler2D u_bloom;
uniform sampler2D u_source;
uniform sampler2D u_overlay;
uniform vec4 u_sourceRect;
uniform vec3 u_background;
uniform vec3 u_tint;
uniform vec2 u_resolution;
uniform vec2 u_cssResolution;
uniform float u_monochrome;
uniform float u_time;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_glow;
uniform float u_scanlines;
uniform float u_scanDensity;
uniform float u_phosphor;
uniform float u_curve;
uniform float u_trails;
uniform float u_rgbShift;
uniform float u_noise;
uniform float u_flicker;
uniform float u_flickerSpeed;
uniform float u_glitch;
uniform float u_glitchFrequency;
uniform float u_vignette;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec3 currentSignal(vec2 uv) {
  vec2 local = (uv - u_sourceRect.xy) / u_sourceRect.zw;
  vec3 c = u_background;
  if (all(greaterThanEqual(local, vec2(0.0))) && all(lessThanEqual(local, vec2(1.0)))) {
    vec4 overlay = texture(u_overlay, local);
    c = mix(texture(u_source, local).rgb, overlay.rgb, overlay.a);
  }
  if (u_monochrome > 0.5) c = u_tint * max(c.r, max(c.g, c.b));
  return pow(max(c, vec3(0.0)), vec3(2.2));
}
vec3 signalAt(vec2 uv) {
  return mix(currentSignal(uv), texture(u_image, uv).rgb, u_trails)
    + texture(u_bloom, uv).rgb * u_glow;
}
void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  vec2 uv = (p * (1.0 + u_curve * p.yx * p.yx) + 1.0) * 0.5;
  float tick = floor(u_time * 3.0);
  float burst = step(hash(vec2(tick, 91.7)), u_glitchFrequency)
    * (1.0 - step(0.2, fract(u_time * 3.0)));
  float band = floor(uv.y * 24.0);
  float tear = (hash(vec2(band, tick)) - 0.5) * 0.09 * u_glitch * burst;
  uv.x += tear;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) {
    outputColor = vec4(u_background * 0.3, 1.0);
    return;
  }
  vec2 shift = vec2(u_rgbShift / u_cssResolution.x, 0.0);
  vec3 c = vec3(signalAt(uv + shift).r, signalAt(uv).g, signalAt(uv - shift).b);
  float line = 0.5 + 0.5 * cos(uv.y * u_cssResolution.y * 6.283185 * u_scanDensity);
  c *= 1.0 - u_scanlines * line;
  float stripe = mod(floor(uv.x * u_resolution.x), 3.0);
  vec3 mask = vec3(stripe < 0.5 ? 1.0 : 0.45, abs(stripe - 1.0) < 0.5 ? 1.0 : 0.45, stripe > 1.5 ? 1.0 : 0.45);
  if (u_monochrome > 0.5) mask = vec3(mix(0.55, 1.0, step(0.5, stripe)));
  c *= mix(vec3(1.0), mask, u_phosphor);
  float flicker = sin(u_time * u_flickerSpeed * 6.283185) * 0.5
    + (hash(vec2(floor(u_time * 24.0), 7.1)) - 0.5) * 0.5;
  c *= 1.0 + flicker * u_flicker;
  float vignette = smoothstep(0.15, 1.35, length(p));
  c *= 1.0 - vignette * u_vignette;
  c = pow(max(c * u_brightness, vec3(0.0)), vec3(u_contrast));
  c = pow(c, vec3(1.0 / 2.2));
  float grain = hash(floor(uv * u_resolution) + fract(u_time) * 137.0) - 0.5;
  c += grain * u_noise * mix(vec3(1.0), u_tint, u_monochrome);
  outputColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`
