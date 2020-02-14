import * as THREE from '../node_modules/three/build/three.module.js';
import { GUI } from '../node_modules/dat.gui/build/dat.gui.module.js';
// import { TrackballControls } from '../vendor/TrackballControls.js'
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from '../node_modules/three/examples/jsm/lines/Line2.js';
// import * as MeshLine from '../vender/THREE.MeshLine.js';
import { LineMaterial } from '../node_modules/three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from '../node_modules/three/examples/jsm/lines/LineGeometry.js';

function main() {
  const canvas = document.querySelector('#c');
  const renderer = new THREE.WebGLRenderer({canvas, alpha: true,
                                            antialias: true});

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
    camera.position.set(30, 0, 0);
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    scene.add(camera);
    scene.background = new THREE.Color(0x000000);

    const controls = new OrbitControls(camera, elem);
    controls.noZoom = false;
    controls.noPan = true;
    controls.enableKeys = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;

    {
      const color = 0xFFFFFF;
      const intensity = 1;
      const light = new THREE.DirectionalLight(color, intensity);
      light.position.set(4, 2, -4);
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

  function quadrupole_field(q11, q12, q13, q22, q23, xx, yy, zz, conf) {
    var x = xx - conf.q_offset_x;
    var y = yy - conf.q_offset_y;
    var z = zz - conf.q_offset_z;
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

  function integrate_field_line(p0, dl, nmax, color1, color2, field, conf) {
    var positions = [];
    positions.push(p0.x, p0.y, p0.z);
    var p = new THREE.Vector3();
    p.copy(p0);

    var f0 = field(p);
    var sign = 1.0;
    if (f0.dot(p) < 0.0) {
      sign = -1.0;
    }
    var g = new LineGeometry();
    var len = dl;
    var open = false;
    for (var i = 0; i < nmax; i++) {
      var f = field(p);
      f.normalize();
      p.addScaledVector(f, dl * sign);
      if (p.lengthSq() < 1.0) {
        break;
      }
      // var r = p.x*p.x+p.y*p.y
      if (p.x*p.x+p.y*p.y > conf.LC * conf.LC) {
        open = true;
        break;
      }
      positions.push(p.x, p.y, p.z);
      len += dl;
    }
    // console.log(positions);
    if (len >= conf.min_length) {
      g.setPositions(positions);
      g.attributes.position.needsUpdate = true;
      var line = new Line2(g, new LineMaterial({
        color: (open ? color1 : color2),
        linewidth: 0.0020,
        transparent: true,
      }));
 	    line.computeLineDistances();
      line.name = "line";
      return {line: line, open: open};
    }
    return {line: null, open: null};
  }

  function gen_seeds(N) {
    var p0s = [];
    for (var i = 0; i < N; i++) {
      var phi = 2.0 * Math.PI * Math.random();
      var u = 2.0 * Math.random() - 1.0;
      var v = Math.sqrt(1.0 - u*u);
      var p0 = new THREE.Vector3(v * Math.cos(phi), v * Math.sin(phi), u);
      p0s.push(p0);
    }
    return p0s;
  }

  function add_all_field_lines(p0s, dl, conf, func, open_lines, closed_lines) {
    for (var i = 0; i < p0s.length; i++) {
      // console.log(p0s[i]);
      var result = integrate_field_line(p0s[i], 0.05, 5000, new THREE.Color("skyblue"),
                                        new THREE.Color("limegreen"),
                                        func, conf);
      // console.log(result.line, result.open);
      if (result.line === null) continue;
      if (result.open)
        open_lines.add(result.line);
      else
        closed_lines.add(result.line);
    }
  }

  function remove_all_field_lines(open_lines, closed_lines) {
    for (var i = open_lines.children.length - 1; i >= 0; i--) {
      if (open_lines.children[i].name == "line") {
        var obj = open_lines.children[i];
        obj.material.dispose();
        obj.geometry.dispose();
        open_lines.remove(obj);
      }
    }
    for (var i = closed_lines.children.length - 1; i >= 0; i--) {
      if (closed_lines.children[i].name == "line") {
        var obj = closed_lines.children[i];
        obj.material.dispose();
        obj.geometry.dispose();
        closed_lines.remove(obj);
      }
    }
  }

  const sceneInitFunctionsByName = {
    'dipole': (elem) => {
      const {scene, camera, controls} = makeScene(elem);
      var n_seed = 1000;
      var ConfDipole = function() {
        this.p0 = 1.00;
        this.theta = 80.0;
        this.px = 0.0;
        this.py = this.p0 * Math.sin(this.theta*Math.PI/180.0);
        this.pz = this.p0 * Math.cos(this.theta*Math.PI/180.0);
        this.LC = 20.0;
        this.min_length = 10.0;
      };
      var conf = new ConfDipole();

      var radius = 1.0;
      var geometry = new THREE.SphereGeometry(radius, 64, 64);
      var material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
      var star = new THREE.Mesh(geometry, material);
      scene.add(star);
      var p0s = gen_seeds(n_seed);

      var open_lines = new THREE.Group();
      var closed_lines = new THREE.Group();
      function update_fieldlines() {
        remove_all_field_lines(open_lines, closed_lines);
        add_all_field_lines(p0s, 0.05, conf, function(p) {
          return dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z);
        }, open_lines, closed_lines);
      }

      update_fieldlines();
      scene.add(open_lines);
      scene.add(closed_lines);

      var axis = new THREE.Geometry();
      axis.vertices.push(new THREE.Vector3(0, 0, -100));
      axis.vertices.push(new THREE.Vector3(0, 0, 100));
      var z_line = new THREE.Line(axis, new THREE.LineBasicMaterial({
        color: 0x8080aa,
        linewidth: 2.5,
      }));
      scene.add(z_line);

      const gui = new GUI({ autoPlace: false });

      gui.add(conf, "px", -1.0, 1.0, 0.001).listen().onChange(update_fieldlines);
      gui.add(conf, "py", -1.0, 1.0, 0.001).listen().onChange(update_fieldlines);
      gui.add(conf, "pz", -1.0, 1.0, 0.001).listen().onChange(update_fieldlines);
      gui.add(conf, "p0", 0.0, 1.0, 0.001).onChange(function() {
        conf.py = conf.p0 * Math.sin(conf.theta*Math.PI/180.0);
        conf.pz = conf.p0 * Math.cos(conf.theta*Math.PI/180.0);
        update_fieldlines();
      });
      gui.add(conf, "theta", 0.0, 180.0, 1.0).onChange(function() {
        conf.py = conf.p0 * Math.sin(conf.theta*Math.PI/180.0);
        conf.pz = conf.p0 * Math.cos(conf.theta*Math.PI/180.0);
        update_fieldlines();
      });
      gui.add(conf, "LC", 5.0, 40.0, 0.1).onChange(update_fieldlines);
      gui.add(conf, "min_length", 1.0, 40.0, 0.01).onChange(update_fieldlines);
      conf.show_closed = true;
      gui.add(conf, "show_closed");
      conf.resetView = function() {
        // camera.position.set(80, 0, 0);
        controls.reset();
      }
      gui.add(conf, "resetView");
      conf.reseed = function() {
        p0s = gen_seeds(n_seed);
        update_fieldlines();
      }
      gui.add(conf, "reseed");

      var customContainer = document.getElementById('dipole-gui');
      customContainer.appendChild(gui.domElement);
      return (time, rect) => {
        // mesh.rotation.y = time * .1;
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        // controls.handleResize();
        controls.update();
        closed_lines.visible = conf.show_closed;
        renderer.render(scene, camera);
      };
    },
    'quadrupole': (elem) => {
      const {scene, camera, controls} = makeScene(elem);
      var n_seed = 3000;
      var ConfQuad = function() {
        this.q11 = 0.8;
        this.q12 = 0.0;
        this.q13 = 0.0;
        this.q22 = -0.6;
        this.q23 = -2.0;
        this.q_offset_x = 0.0;
        this.q_offset_y = 0.0;
        this.q_offset_z = -0.4;
        this.LC = 20.0;
        this.min_length = 10.0;
      };
      var conf = new ConfQuad();

      var radius = 1.0;
      var geometry = new THREE.SphereGeometry(radius, 64, 64);
      var material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
      var star = new THREE.Mesh(geometry, material);
      scene.add(star);
      var p0s = gen_seeds(n_seed);

      var open_lines = new THREE.Group();
      var closed_lines = new THREE.Group();
      function update_fieldlines() {
        remove_all_field_lines(open_lines, closed_lines);
        add_all_field_lines(p0s, 0.03, conf, function(p) {
          // return dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z);
          return quadrupole_field(conf.q11, conf.q12, conf.q13, conf.q22,
                                  conf.q23, p.x, p.y, p.z, conf);
        }, open_lines, closed_lines);
      }

      update_fieldlines();
      scene.add(open_lines);
      scene.add(closed_lines);

      var axis = new THREE.Geometry();
      axis.vertices.push(new THREE.Vector3(0, 0, -100));
      axis.vertices.push(new THREE.Vector3(0, 0, 100));
      var z_line = new THREE.Line(axis, new THREE.LineBasicMaterial({
        color: 0x8080aa,
        linewidth: 2.5,
      }));
      scene.add(z_line);

      const gui = new GUI({ autoPlace: false });

      gui.add(conf, "q11", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      gui.add(conf, "q12", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      gui.add(conf, "q13", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      gui.add(conf, "q22", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      gui.add(conf, "q23", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      gui.add(conf, "q_offset_x", -1.0, 1.0, 0.01).onChange(update_fieldlines);
      gui.add(conf, "q_offset_y", -1.0, 1.0, 0.01).onChange(update_fieldlines);
      gui.add(conf, "q_offset_z", -1.0, 1.0, 0.01).onChange(update_fieldlines);
      gui.add(conf, "LC", 5.0, 40.0, 0.1).onChange(update_fieldlines);
      gui.add(conf, "min_length", 1.0, 40.0, 0.01).onChange(update_fieldlines);
      conf.show_closed = true;
      gui.add(conf, "show_closed");
      conf.resetView = function() {
        // camera.position.set(80, 0, 0);
        controls.reset();
      }
      gui.add(conf, "resetView");
      conf.reseed = function() {
        p0s = gen_seeds(n_seed);
        update_fieldlines();
      }
      gui.add(conf, "reseed");

      var customContainer = document.getElementById('quadrupole-gui');
      customContainer.appendChild(gui.domElement);
      return (time, rect) => {
        // mesh.rotation.y = time * .1;
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        // controls.handleResize();
        controls.update();
        closed_lines.visible = conf.show_closed;
        renderer.render(scene, camera);
      };
    },
    'pulsar': (elem) => {
      const {scene, camera, controls} = makeScene(elem);
      var n_seed = 8000;
      var ConfPSR = function() {
        this.p0 = 1.00;
        this.theta = 80.0;
        this.px = 0.0;
        this.py = this.p0 * Math.sin(this.theta*Math.PI/180.0);
        this.pz = this.p0 * Math.cos(this.theta*Math.PI/180.0);
        this.q11 = 0.8;
        this.q12 = 0.0;
        this.q13 = 0.0;
        this.q22 = -0.6;
        this.q23 = -2.0;
        this.q_offset_x = 0.0;
        this.q_offset_y = 0.0;
        this.q_offset_z = -0.4;
        this.LC = 20.0;
        this.min_length = 10.0;
      };
      var conf = new ConfPSR();

      var radius = 1.0;
      var geometry = new THREE.SphereGeometry(radius, 64, 64);
      var material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
      var star = new THREE.Mesh(geometry, material);
      scene.add(star);
      var p0s = gen_seeds(n_seed);

      var open_lines = new THREE.Group();
      var closed_lines = new THREE.Group();
      function update_fieldlines() {
        remove_all_field_lines(open_lines, closed_lines);
        add_all_field_lines(p0s, 0.03, conf, function(p) {
          // return dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z);
          var f = dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z);
          f.add(quadrupole_field(conf.q11, conf.q12, conf.q13, conf.q22,
                                 conf.q23, p.x, p.y, p.z, conf));
          return f;
        }, open_lines, closed_lines);
      }

      update_fieldlines();
      scene.add(open_lines);
      scene.add(closed_lines);

      var axis = new THREE.Geometry();
      axis.vertices.push(new THREE.Vector3(0, 0, -100));
      axis.vertices.push(new THREE.Vector3(0, 0, 100));
      var z_line = new THREE.Line(axis, new THREE.LineBasicMaterial({
        color: 0x8080aa,
        linewidth: 2.5,
      }));
      scene.add(z_line);

      var gui = new GUI({ autoPlace: false });
      // var gui = new GUI();
      var f_dipole = gui.addFolder("Dipole");
      f_dipole.add(conf, "px", -1.0, 1.0, 0.001).listen().onChange(update_fieldlines);
      f_dipole.add(conf, "py", -1.0, 1.0, 0.001).listen().onChange(update_fieldlines);
      f_dipole.add(conf, "pz", -1.0, 1.0, 0.001).listen().onChange(update_fieldlines);
      f_dipole.add(conf, "p0", 0.0, 1.0, 0.001).onChange(function() {
        conf.py = conf.p0 * Math.sin(conf.theta*Math.PI/180.0);
        conf.pz = conf.p0 * Math.cos(conf.theta*Math.PI/180.0);
        update_fieldlines();
      });
      f_dipole.add(conf, "theta", 0.0, 180.0, 1.0).onChange(function() {
        conf.py = conf.p0 * Math.sin(conf.theta*Math.PI/180.0);
        conf.pz = conf.p0 * Math.cos(conf.theta*Math.PI/180.0);
        update_fieldlines();
      });
      f_dipole.close();
      var f_quad = gui.addFolder("Quadrupole");
      f_quad.add(conf, "q11", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      f_quad.add(conf, "q12", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      f_quad.add(conf, "q13", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      f_quad.add(conf, "q22", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      f_quad.add(conf, "q23", -2.0, 2.0, 0.01).onChange(update_fieldlines);
      f_quad.add(conf, "q_offset_x", -1.0, 1.0, 0.01).onChange(update_fieldlines);
      f_quad.add(conf, "q_offset_y", -1.0, 1.0, 0.01).onChange(update_fieldlines);
      f_quad.add(conf, "q_offset_z", -1.0, 1.0, 0.01).onChange(update_fieldlines);
      f_quad.close();
      gui.add(conf, "LC", 5.0, 40.0, 0.1).onChange(update_fieldlines);
      gui.add(conf, "min_length", 1.0, 40.0, 0.01).onChange(update_fieldlines);
      conf.show_closed = false;
      gui.add(conf, "show_closed");
      conf.resetView = function() {
        // camera.position.set(80, 0, 0);
        controls.reset();
      }
      gui.add(conf, "resetView");
      conf.reseed = function() {
        p0s = gen_seeds(n_seed);
        update_fieldlines();
      }
      gui.add(conf, "reseed");

      var customContainer = document.getElementById('pulsar-gui');
      customContainer.appendChild(gui.domElement);
      return (time, rect) => {
        // mesh.rotation.y = time * .1;
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        // controls.handleResize();
        controls.update();
        closed_lines.visible = conf.show_closed;
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
