// import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r112/build/three.module.js';
// import {TrackballControls} from 'https://threejsfundamentals.org/threejs/resources/threejs/r112/examples/jsm/controls/TrackballControls.js';
import * as THREE from '../vendor/three.module.js'
import {TrackballControls} from '../vendor/TrackballControls.js'

function main() {
  const canvas = document.querySelector('#c');
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true});

  const sceneElements = [];
  function addScene(elem, fn) {
    sceneElements.push({elem, fn});
  }

  function makeScene(elem) {
    const scene = new THREE.Scene();

    const fov = 45;
    const aspect = 2;  // the canvas default
    const near = 0.1;
    const far = 500;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(40, 0, 0);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    scene.add(camera);
    scene.background = new THREE.Color(0x000000);

    const controls = new TrackballControls(camera, elem);
    controls.noZoom = false;
    controls.noPan = true;

    {
      const color = 0xFFFFFF;
      const intensity = 1;
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(-1, 2, 4);
      scene.add(light);
    }

    return {scene, camera, controls};
  }

function dipole_field(px, py, pz, x, y, z) {
  var r = Math.sqrt(x*x + y*y + z*z);
  var r5 = r*r*r*r*r;
  return new THREE.Vector3((3.0*x*(py*y+pz*z)-px*(-2.0*x*x+y*y+z*z))/r5,
                           (3.0*y*(px*x+pz*z)-py*(x*x-2.0*y*y+z*z))/r5,
                           (3.0*z*(px*x+py*y)-pz*(x*x+y*y-2.0*z*z))/r5);
}

function quadrupole_field(q11, q12, q13, q22, q23, x, y, z) {
  var r = Math.sqrt(x*x + y*y + z*z);
  var r2 = r*r;
  var r7 = r2*r2*r2*r;
  return new THREE.Vector3(
    (-2.0 * (q11*x + q12*y + q13*z) * r2 + 5.0*x*
     (q11*x*x + 2.0*q12*x*y + q22*y*y + 2.0*(q13*x + q23*y)*z - (q11+q22)*z*z)) / r7,
    (-2.0 * (q12*x + q22*y + q23*z) * r2 + 5.0*y*
     (q11*x*x + 2.0*q12*x*y + q22*y*y + 2.0*(q13*x + q23*y)*z - (q11+q22)*z*z)) / r7,
    (-2.0 * (q13*x + q23*y) * (x*x + y*y) +
     ((7.0*q11 + 2.0*q22)*x*x + 10.0*q12*x*y + (2.0*q11 + 7.0*q22)*y*y)*z +
     8.0*(q13*x + q23*y)*z*z - 3.0*(q11 + q22)*z*z*z) / r7);
}

  const sceneInitFunctionsByName = {
    'box': (elem) => {
      const {scene, camera, controls} = makeScene(elem);
      var radius = 1.0;
      var geometry = new THREE.SphereGeometry(radius, 64, 64);
      var material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
      // var material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
      var star = new THREE.Mesh(geometry, material);
      scene.add(star);
      return (time, rect) => {
        // mesh.rotation.y = time * .1;
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        controls.handleResize();
        controls.update();
        renderer.render(scene, camera);
      };
    },
    'pyramid': (elem) => {
      const {scene, camera, controls} = makeScene(elem);
      var radius = 1.0;
      var geometry = new THREE.SphereGeometry(radius, 64, 64);
      var material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
      // var material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
      var star = new THREE.Mesh(geometry, material);
      scene.add(star);
      return (time, rect) => {
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        controls.handleResize();
        controls.update();
        renderer.render(scene, camera);
      };
    },
  };

  document.querySelectorAll('[data-diagram]').forEach((elem) => {
    const sceneName = elem.dataset.diagram;
    const sceneInitFunction = sceneInitFunctionsByName[sceneName];
    const sceneRenderFunction = sceneInitFunction(elem);
    addScene(elem, sceneRenderFunction);
  });

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  const clearColor = new THREE.Color('#000');
  function render(time) {
    time *= 0.001;

    resizeRendererToDisplaySize(renderer);

    renderer.setScissorTest(false);
    renderer.setClearColor(clearColor, 0);
    renderer.clear(true, true);
    renderer.setScissorTest(true);

    const transform = `translateY(${window.scrollY}px)`;
    renderer.domElement.style.transform = transform;

    for (const {elem, fn} of sceneElements) {
      // get the viewport relative position opf this element
      const rect = elem.getBoundingClientRect();
      const {left, right, top, bottom, width, height} = rect;

      const isOffscreen =
          bottom < 0 ||
          top > renderer.domElement.clientHeight ||
          right < 0 ||
          left > renderer.domElement.clientWidth;

      if (!isOffscreen) {
        const positiveYUpBottom = renderer.domElement.clientHeight - bottom;
        renderer.setScissor(left, positiveYUpBottom, width, height);
        renderer.setViewport(left, positiveYUpBottom, width, height);

        fn(time, rect);
      }
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

main();
