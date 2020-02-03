#version 300 es
precision highp int;
precision highp float;

uniform highp sampler3D cubeTex;
// WebGL doesn't support 1D textures, so we use a 2D texture for the transfer
// function
uniform highp sampler2D transferTex;
uniform ivec3 volume_dims;
uniform float alphaCorrection;
uniform float dt_scale;

in vec3 vray_dir;
flat in vec3 transformed_eye;

out vec4 color;

vec2 intersect_box(vec3 orig, vec3 dir) {
  const vec3 box_min = vec3(-0.5);
  const vec3 box_max = vec3(0.5);
  vec3 inv_dir = 1.0 / dir;
  vec3 tmin_tmp = (box_min - orig) * inv_dir;
  vec3 tmax_tmp = (box_max - orig) * inv_dir;
  vec3 tmin = min(tmin_tmp, tmax_tmp);
  vec3 tmax = max(tmin_tmp, tmax_tmp);
  float t0 = max(tmin.x, max(tmin.y, tmin.z));
  float t1 = min(tmax.x, min(tmax.y, tmax.z));
  return vec2(t0, t1);
}

void main(void) {
  // Step 1: Normalize the view ray
  vec3 ray_dir = normalize(vray_dir);

  // Step 2: Intersect the ray with the volume bounds to find the interval
  // along the ray overlapped by the volume.
  vec2 t_hit = intersect_box(transformed_eye, ray_dir);
  if (t_hit.x > t_hit.y) {
    discard;
  }
  // We don't want to sample voxels behind the eye if it's
  // inside the volume, so keep the starting point at or in front
  // of the eye
  t_hit.x = max(t_hit.x, 0.0);

  // Step 3: Compute the step size to march through the volume grid
  vec3 dt_vec = 1.0 / (vec3(volume_dims) * abs(ray_dir));
  float dt = dt_scale * min(dt_vec.x, min(dt_vec.y, dt_vec.z));

  // Step 4: Starting from the entry point, march the ray through the volume
  // and sample it
  vec3 p = transformed_eye + t_hit.x * ray_dir;
  float alphasample;
  float cum_alpha = 0.0;
  for (float t = t_hit.x; t < t_hit.y; t += dt) {
    // Step 4.1: Sample the volume, and color it by the transfer function.
    // Note that here we don't use the opacity from the transfer function,
    // and just use the sample value as the opacity
    float val = texture(cubeTex, p + 0.5).r;
    vec4 val_color = vec4(texture(transferTex, vec2(val, 0.5)).rgb, val);
    // vec4 val_color = sampleAs3DTexture(p + 0.5);
    // val_color.a = 1.0 - pow(1.0 - val_color.a, dt_scale);

    // Step 4.2: Accumulate the color and opacity using the front-to-back
    // compositing equation
    // alphasample = (1.0 - cum_alpha) * val * alphaCorrection * 0.01;
    alphasample = (1.0 - cum_alpha) * val * alphaCorrection * 0.02;
    cum_alpha += alphasample;
    color.rgb += alphasample * val_color.rgb;
    // color.a = exp(-(cum_alpha - alphaEmph)*(cum_alpha - alphaEmph)/(alphaSpread*alphaSpread)) * 0.95;
    color.a = cum_alpha;
    // color.rgb = ;
    // color.a = 1.0;

    // Optimization: break out of the loop when the color is near opaque
    if (cum_alpha >= 0.95) {
      break;
    }
    p += ray_dir * dt;
  }
  // gl_FragColor = color;
}
