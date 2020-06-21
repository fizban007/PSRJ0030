import * as THREE from '../node_modules/three/build/three.module.js';
// import Stats from '../vendor/stats.module.js';
import { GUI } from '../node_modules/dat.gui/build/dat.gui.module.js';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from '../node_modules/three/examples/jsm/lines/Line2.js';
// import * as MeshLine from '../vender/THREE.MeshLine.js';
import { LineMaterial } from '../node_modules/three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from '../node_modules/three/examples/jsm/lines/LineGeometry.js';

const js = import("../node_modules/integrate-field/integrate_field.js");

const width = window.innerWidth;
const height = window.innerHeight;
const aspect = width / height;
var renderer = new THREE.WebGLRenderer({
  // canvas: canvas,
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true
});
renderer.setSize(width, height);
const canvas = renderer.domElement;
document.body.appendChild(canvas);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
// THREE.Object3D.DefaultUp.set(0.5,0.0,0.8);
var camera = new THREE.PerspectiveCamera(30, width / height, 1, 1000);
camera.position.z = 0;
camera.position.x = 80;
camera.up.set(0, 0, 1);
camera.lookAt(new THREE.Vector3(0, 0, 0));

var controls = new OrbitControls(camera, renderer.domElement);
controls.enableKeys = false;

var radius = 1.0;
var geometry = new THREE.SphereGeometry(radius, 64, 64);
var material = new THREE.MeshPhongMaterial({ color: 0xaaaaaa });
// var material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
var mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

var Config = function () {
  this.p0 = 1.0;
  this.theta = 80.0;
  this.px = 0.0;
  this.py = this.p0 * Math.sin(this.theta*Math.PI/180.0);
  this.pz = this.p0 * Math.cos(this.theta*Math.PI/180.0);
  this.q11 = 0.6;
  this.q12 = 0.0;
  this.q13 = 0.0;
  this.q22 = -0.8;
  this.q23 = -2.0;
  this.q_offset_x = 0.0;
  this.q_offset_y = 0.0;
  this.q_offset_z = -0.4;
  // this.q_offset_z = 0.0;
  this.seed_radius = 10.0;
  this.LC = 20.0;
  this.show_closed = true;
};
var conf = new Config();
var all_lines = new THREE.Group();
var open_lines = new THREE.Group();
var closed_lines = new THREE.Group();
closed_lines.visible = conf.show_closed;

var N = 200;
var p0s = [];

function gen_p0() {
  p0s = [];
  for (var i = 0; i < N; i++) {
    var phi = 2.0 * Math.PI * Math.random();
    var u = 2.0 * Math.random() - 1.0;
    var v = Math.sqrt(1.0 - u*u);
    var p0 = new THREE.Vector3(v * Math.cos(phi),
                               v * Math.sin(phi),
                               u);
    p0s.push(p0);
  }
}

gen_p0();

js.then(js => {
  // js.greet("WebAssembly");
  js.test_log("WebAssembly");
  // var v = js.integrate_field_line(
  //   [1.0, 2.0, 3.0],
  //   [conf.px, conf.py, conf.pz, conf.q11, conf.q12, conf.q13,
  //    conf.q22, conf.q23, conf.q_offset_x, conf.q_offset_y,
  //    conf.q_offset_z, conf.LC], 0.03, 5000);
  // console.log(v);
  // js.test_dict(conf, conf.px);
  function integrate_line(p0, dl, nmax, color1, color2) {
    // var positions = new Float32Array(nmax*3);
    var positions = js.integrate_field(
      [conf.seed_radius * p0.x,
       conf.seed_radius * p0.y,
       conf.seed_radius * p0.z],
      [conf.px, conf.py, conf.pz, conf.q11, conf.q12, conf.q13,
       conf.q22, conf.q23, conf.q_offset_x, conf.q_offset_y,
       conf.q_offset_z, conf.LC], dl, nmax);
    // console.log(positions);
      // positions);
    var l = positions.length;
    // if (l * dl / 3.0 >= conf.seed_radius / skip) {
    // if (l * dl / 3.0 >= conf.seed_radius) {
    var xlast = positions[l-3];
    var ylast = positions[l-2];
    var xfirst = positions[0];
    var yfirst = positions[1];
    var open = (xlast*xlast + ylast*ylast > conf.LC*conf.LC ||
                xfirst*xfirst + yfirst*yfirst > conf.LC*conf.LC ? true : false);
    var g = new LineGeometry();

    // g.setPositions(positions.slice(0,num));
    g.setPositions(positions);
    g.attributes.position.needsUpdate = true;
    var line = new Line2(g, new LineMaterial({
      color: (open ? color1 : color2),
      linewidth: 0.002,
      transparent: true,
    }));
    line.computeLineDistances();
    line.name = "line";
    if (open)
      open_lines.add(line);
    else
      closed_lines.add(line);
    // line.scale.set( 1, 1, 1 ); // arc.computeLineDistances();
    // }
  }

  function add_all_field_lines() {
    for (var i = 0; i < p0s.length; i++) {
      integrate_line(p0s[i], 0.2, 400, new THREE.Color("skyblue"),
                     new THREE.Color("limegreen"));
      // console.log("adding", i, line);
    }
  }

  add_all_field_lines();

  function remove_all_field_lines() {
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

  var g_cone = new THREE.ConeGeometry(1, 40, 32);
  var g_cone2 = new THREE.ConeGeometry(1, 40, 32);
  var mat_cone = new THREE.MeshPhongMaterial({
    color: 0xaaaaff,
    transparent: true,
    opacity: 0.8,
    emissive: 0xdddddd,
  });
  var cone = new THREE.Mesh(g_cone, mat_cone);
  var cone2 = new THREE.Mesh(g_cone2, mat_cone);
  cone.translateZ(-20.0);
  cone2.translateZ(20.0);
  cone.rotateX(0.5 * Math.PI);
  cone2.rotateX(-0.5 * Math.PI);
  // cone2.rotateY(Math.PI);
  // field_lines.add(cone);
  // field_lines.add(cone2);
  // field_lines.rotateY(-0.8);
  // scene.add(field_lines);

  // var stats = new Stats();
  // stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
  // document.body.appendChild( stats.dom );
  scene.add(open_lines);
  scene.add(closed_lines);

  function update_fieldlines() {
    remove_all_field_lines();
    add_all_field_lines();
  }

  const gui = new GUI();
  var f_dipole = gui.addFolder("Dipole");
  f_dipole.add(conf, "px", -1.0, 1.0, 0.001).listen().onChange(function() {
    conf.p0 = Math.sqrt(conf.px * conf.px + conf.py * conf.py + conf.pz * conf.pz);
    conf.theta = Math.atan(conf.pz / conf.py);
  });
  f_dipole.add(conf, "py", -1.0, 1.0, 0.001).listen().onChange(function() {
    conf.p0 = Math.sqrt(conf.px * conf.px + conf.py * conf.py + conf.pz * conf.pz);
    conf.theta = Math.atan(conf.pz / conf.py);
  });
  f_dipole.add(conf, "pz", -1.0, 1.0, 0.001).listen().onChange(function() {
    conf.p0 = Math.sqrt(conf.px * conf.px + conf.py * conf.py + conf.pz * conf.pz);
    conf.theta = Math.atan(conf.pz / conf.py);
  });
  f_dipole.add(conf, "p0", 0.0, 2.0, 0.001).onChange(function() {
    conf.py = conf.p0 * Math.sin(conf.theta*Math.PI/180.0);
    conf.pz = conf.p0 * Math.cos(conf.theta*Math.PI/180.0);
    update_fieldlines();
  });
  f_dipole.add(conf, "theta", 0.0, 180.0, 1.0).onChange(function() {
    conf.py = conf.p0 * Math.sin(conf.theta*Math.PI/180.0);
    conf.pz = conf.p0 * Math.cos(conf.theta*Math.PI/180.0);
    update_fieldlines();
  });

  var f_quad = gui.addFolder("Quadrupole");
  f_quad.add(conf, "q11", -5.0, 5.0, 0.01).onChange(update_fieldlines);
  f_quad.add(conf, "q12", -5.0, 5.0, 0.01).onChange(update_fieldlines);
  f_quad.add(conf, "q13", -5.0, 5.0, 0.01).onChange(update_fieldlines);
  f_quad.add(conf, "q22", -5.0, 5.0, 0.01).onChange(update_fieldlines);
  f_quad.add(conf, "q23", -5.0, 5.0, 0.01).onChange(update_fieldlines);
  f_quad.add(conf, "q_offset_x", -1.0, 1.0, 0.01).onChange(update_fieldlines);
  f_quad.add(conf, "q_offset_y", -1.0, 1.0, 0.01).onChange(update_fieldlines);
  f_quad.add(conf, "q_offset_z", -1.0, 1.0, 0.01).onChange(update_fieldlines);

  gui.add(conf, "seed_radius", 1.0, 40.0, 0.01).onChange(update_fieldlines);
  gui.add(conf, "LC", 10.0, 30.0, 0.01).onChange(update_fieldlines);
  gui.add(conf, "show_closed");
  conf.clear = function() {
    setTimeout(remove_all_field_lines, 0, 5000);
  }
  conf.draw = function() {
    add_all_field_lines();
    // setTimeout(add_all_field_lines, 0, 5000);
  }
  conf.reseed = function() {
    remove_all_field_lines();
    gen_p0();
    add_all_field_lines();
  }
  conf.resetView = function() {
    controls.reset();
  }
  gui.add(conf, "clear");
  gui.add(conf, "draw");
  gui.add(conf, "reseed");

  var f_view = gui.addFolder("View");
  f_view.add(conf, "resetView");
  conf.look_x = function() {
    camera.position.set(80, 0, 0);
    controls.update();
  }
  f_view.add(conf, "look_x");
  conf.look_y = function() {
    camera.position.set(0, 80, 0);
    controls.update();
  }
  f_view.add(conf, "look_y");
  conf.look_z = function() {
    camera.position.set(0, 0, 80);
    controls.update();
  }
  f_view.add(conf, "look_z");

  var axis = new THREE.Geometry();
  axis.vertices.push(new THREE.Vector3(0, 0, -100));
  axis.vertices.push(new THREE.Vector3(0, 0, 100));
  var z_line = new THREE.Line(axis, new THREE.LineBasicMaterial({
    color: 0x8080aa,
    linewidth: 2.5,
  }));
  scene.add(z_line);

  var directionalLight = new THREE.DirectionalLight(0xffffffff);
  directionalLight.position.set(0, 7, 0);
  scene.add(directionalLight);

  var light = new THREE.AmbientLight(0x404040); // soft white light
  scene.add(light);

  function animate() {
    requestAnimationFrame(animate, canvas);
    // stats.begin();
    // if(!instance.active || sample_defaults.paused) return;

    // field_lines.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), 0.003);
    closed_lines.visible = conf.show_closed;

    renderer.render(scene, camera);
    // stats.end();
  }

  animate();
});

// var fieldline_txt = new THREE.TextureLoader().load('textures/fieldline.png');

// function integrate_field_line(p0, dl, nmax, color1, color2) {
//   var positions = [];
//   positions.push(p0.x, p0.y, p0.z);
//   var p = new THREE.Vector3();
//   p.copy(p0);
//   var f0 = dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z);
//   f0.add(quadrupole_field(conf.q11, conf.q12, conf.q13, conf.q22, conf.q23,
//                           p.x - conf.q_offset_x, p.y - conf.q_offset_y, p.z - conf.q_offset_z));
//   // console.log(f0);
//   var sign = 1.0;
//   if (f0.dot(p) < 0.0) {
//     sign = -1.0;
//   }
//   // console.log("p0 is", p0);
//   var g = new LineGeometry();
//   var len = dl;
//   var open = false;
//   for (var i = 0; i < nmax; i++) {
//     var f = dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z);
//     f.add(quadrupole_field(conf.q11, conf.q12, conf.q13, conf.q22, conf.q23,
//                            p.x - conf.q_offset_x, p.y - conf.q_offset_y, p.z - conf.q_offset_z));
//     f.normalize();
//     p.addScaledVector(f, dl * sign);
//     if (p.lengthSq() < 1.0) {
//       break;
//     }
//     if (p.x*p.x+p.y*p.y > conf.LC * conf.LC) {
//       open = true;
//       break;
//     }
//     // g.vertices.push(p);
//     positions.push(p.x, p.y, p.z);
//     len += dl;
//   }
//   // console.log(positions);
//   if (len >= conf.seed_radius) {
//     g.setPositions(positions);
//     g.attributes.position.needsUpdate = true;
//     var line = new Line2(g, new LineMaterial({
//       color: (open ? color1 : color2),
//       linewidth: 0.0015,
//       transparent: true,
//     }));
//  	  line.computeLineDistances();
//     line.name = "line";
//     if (open)
//       open_lines.add(line);
//     else
//       closed_lines.add(line);
//   }
// 	// line.scale.set( 1, 1, 1 ); // arc.computeLineDistances();
//   return line;
// }
