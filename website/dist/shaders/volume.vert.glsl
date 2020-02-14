#version 300 es
// layout(location = 0) in vec3 pos;
// uniform mat4 proj_view;
// uniform vec3 eye_pos;
uniform vec3 volume_scale;

out vec3 vray_dir;
flat out vec3 transformed_eye;

void main(void) {
  // Translate the cube to center it at the origin.
  vec3 volume_translation = vec3(0.5) - volume_scale * 0.5;
  // vec3 volume_translation = vec3(-0.25);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position * volume_scale + volume_translation, 1);

  // Compute eye position and ray directions in the unit cube space
  vec3 eye_pos = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  // vec3 eye_pos = cameraPosition;
  transformed_eye = (eye_pos - volume_translation) / volume_scale;
  vray_dir = position - transformed_eye;
}
