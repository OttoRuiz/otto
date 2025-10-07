/* Three.js WebGL orb with procedural noise + post bloom */
const canvas = document.getElementById('orb');
let width = canvas.clientWidth;
let height = canvas.clientHeight;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, width/height, .1, 100);
camera.position.z = 4;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/* --- ShaderMaterial for the orb --- */
const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float time;
  varying vec2 vUv;
  varying vec3 vNormal;

  /* 2-D simplex noise */
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                           + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                            dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    float t = time * .2;
    vec2 uv = vUv * 3.0;
    float n = snoise(uv + t) * .5 + .5;
    vec3 color = 0.5 + 0.5 * cos(t + uv.xyx * 3. + vec3(0,2,4));
    color = mix(color, vec3(1.,.3,.8), n);
    float fres = 1. - dot(vNormal, vec3(0,0,1.));
    color += fres * .4;
    gl_FragColor = vec4(color, 1.);
  }
`;

const orb = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 128, 128),
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { time: { value: 0 } }
  })
);
scene.add(orb);

/* --- Optional bloom post-effect (UnrealBloomPass) --- */
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(width, height),
  1.2,   // strength
  .4,    // radius
  .85    // threshold
);
const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

/* --- Mouse/touch camera control --- */
let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
let isDown = false;

function onPointerDown(e) { isDown = true; }
function onPointerUp() { isDown = false; }
function onPointerMove(e) {
  if (!isDown) return;
  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const y = e.touches ? e.touches[0].clientY : e.clientY;
  mouseX = (x / width) * 2 - 1;
  mouseY = -(y / height) * 2 + 1;
}
canvas.addEventListener('mousedown', onPointerDown);
canvas.addEventListener('mouseup', onPointerUp);
canvas.addEventListener('mousemove', onPointerMove);
canvas.addEventListener('touchstart', onPointerDown);
canvas.addEventListener('touchend', onPointerUp);
canvas.addEventListener('touchmove', onPointerMove);

/* --- Zoom with wheel --- */
canvas.addEventListener('wheel', e => {
  camera.position.z = Math.max(2, Math.min(8, camera.position.z + e.deltaY * .01));
  e.preventDefault();
});

/* --- Resize --- */
window.addEventListener('resize', () => {
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
});

/* --- Animate --- */
const clock = new THREE.Clock();
(function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  orb.material.uniforms.time.value = t;

  targetX += (mouseX - targetX) * .05;
  targetY += (mouseY - targetY) * .05;
  orb.rotation.y = targetX * Math.PI;
  orb.rotation.x = targetY * Math.PI * .5;

  composer.render();
})();