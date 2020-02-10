import * as THREE from '../vendor/three.module.js';
// import Stats from '../vendor/stats.module.js';
import { GUI } from '../vendor/dat.gui.module.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { Line2 } from '../vendor/lines/Line2.js';
// import * as MeshLine from '../vender/THREE.MeshLine.js';
import { LineMaterial } from '../vendor/lines/LineMaterial.js';
import { LineGeometry } from '../vendor/lines/LineGeometry.js';
import { GeometryUtils } from '../vendor/lines/GeometryUtils.js';

const width = window.innerWidth;
const height = window.innerHeight;
const aspect = width / height;
// var canvas = document.createElement('canvas');
// var context = canvas.getContext( 'webgl2' );
// canvas.id = "mainCanvas"
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

// var fieldline_txt = new THREE.TextureLoader().load('textures/fieldline.png');

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

var Config = function () {
  this.p0 = 0.5;
  this.theta = 80.0;
  this.px = 0.0;
  this.py = this.p0 * Math.sin(this.theta*Math.PI/180.0);
  this.pz = this.p0 * Math.cos(this.theta*Math.PI/180.0);
  this.q11 = 0.35;
  this.q12 = 0.0;
  this.q13 = 0.0;
  this.q22 = -0.43;
  this.q23 = -0.81;
  this.q_offset_x = 0.0;
  this.q_offset_y = 0.0;
  this.q_offset_z = -0.4;
  // this.q_offset_z = 0.0;
  this.min_length = 15.0;
  this.LC = 20.0;
  this.show_closed = true;
};
var conf = new Config();
var open_lines = new THREE.Group();
var closed_lines = new THREE.Group();
closed_lines.visible = conf.show_closed;

function integrate_field_line(p0, dl, nmax, color1, color2) {
  var positions = [];
  positions.push(p0.x, p0.y, p0.z);
  var p = new THREE.Vector3();
  p.copy(p0);
  var f0 = dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z);
  f0.add(quadrupole_field(conf.q11, conf.q12, conf.q13, conf.q22, conf.q23,
                          p.x - conf.q_offset_x, p.y - conf.q_offset_y, p.z - conf.q_offset_z));
  // console.log(f0);
  var sign = 1.0;
  if (f0.dot(p) < 0.0) {
    sign = -1.0;
  }
  // console.log("p0 is", p0);
  var g = new LineGeometry();
  var len = dl;
  var open = false;
  for (var i = 0; i < nmax; i++) {
    var f = dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z);
    f.add(quadrupole_field(conf.q11, conf.q12, conf.q13, conf.q22, conf.q23,
                           p.x - conf.q_offset_x, p.y - conf.q_offset_y, p.z - conf.q_offset_z));
    f.normalize();
    p.addScaledVector(f, dl * sign);
    if (p.lengthSq() < 1.0) {
      break;
    }
    if (p.x*p.x+p.y*p.y > conf.LC * conf.LC) {
      open = true;
      break;
    }
    // g.vertices.push(p);
    positions.push(p.x, p.y, p.z);
    len += dl;
  }
  // console.log(positions);
  if (len >= conf.min_length) {
    g.setPositions(positions);
    g.attributes.position.needsUpdate = true;
    var line = new Line2(g, new LineMaterial({
      color: (open ? color1 : color2),
      linewidth: 0.0015,
      transparent: true,
    }));
 	  line.computeLineDistances();
    line.name = "line";
    if (open)
      open_lines.add(line);
    else
      closed_lines.add(line);
  }
	// line.scale.set( 1, 1, 1 ); // arc.computeLineDistances();
  return line;
}

// function add_dipole_line(theta_i, phi, smoothness, color) {
//   var s2i = Math.sin(theta_i) * Math.sin(theta_i);

//   var angleRange = Math.PI - 2 * theta_i; // get the angle between vectors
//   var angleDelta = angleRange / (smoothness - 1); // increment

//   var g = new THREE.Geometry();
//   for (var i = 0; i < smoothness; i++) {
//     var th = i * angleDelta + theta_i;
//     var r = Math.sin(th) * Math.sin(th) * radius / s2i;
//     // console.log(r, th);
//     var p = new THREE.Vector3(r * Math.sin(th) * Math.cos(phi),
//                               r * Math.sin(th) * Math.sin(phi),
//                               r * Math.cos(th));
//     g.vertices.push(p)  // this is the key operation
//   }

//   var fline = new MeshLine();
//   fline.setGeometry(g, function(p) { return 0.3; });
//   var arc = new THREE.Mesh(fline.geometry, new MeshLineMaterial({
//     // color: color,
//     useMap: true,
//     map: fieldline_txt,
//     transparent: true,
//   }));
//   return arc;
// }

// var field_lines = new THREE.Group();
// for (var i = 0; i < 3; i++) {
//   var theta = 0.15 + i * 0.12;
//   var nj = 8;
//   for (var j = 0; j < nj; j++) {
//     var phi = 0.3 + j * Math.PI * 2.0 / nj;
//     var p0 = new THREE.Vector3(Math.sin(theta)*Math.cos(phi),
//                                Math.sin(theta)*Math.sin(phi),
//                                Math.cos(theta));
//     // var line = add_dipole_line(theta, phi, 180, new THREE.Color("limegreen"));
//     var line = integrate_field_line(p0, 0.1, 500, new THREE.Color("limegreen"));
//     field_lines.add(line);
//   }
// }
var N = 10000;
var p0s = [];

function gen_p0() {
  p0s = [];
  for (var i = 0; i < N; i++) {
    var phi = 2.0 * Math.PI * Math.random();
    var u = 2.0 * Math.random() - 1.0;
    var v = Math.sqrt(1.0 - u*u);
    var p0 = new THREE.Vector3(v * Math.cos(phi), v * Math.sin(phi), u);
    p0s.push(p0);
  }
}

gen_p0();

function add_all_field_lines() {
  var field_lines = new THREE.Group();
  for (var i = 0; i < p0s.length; i++) {
    var line = integrate_field_line(p0s[i], 0.03, 3000, new THREE.Color("skyblue"),
                                    new THREE.Color("limegreen"));
    // console.log("adding", i, line);
  }
  // console.log(field_lines);
  // field_lines.name = "fieldlines";
  // scene.add(field_lines);
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

var f_quad = gui.addFolder("Quadrupole");
f_quad.add(conf, "q11", -5.0, 5.0, 0.01).onChange(update_fieldlines);
f_quad.add(conf, "q12", -5.0, 5.0, 0.01).onChange(update_fieldlines);
f_quad.add(conf, "q13", -5.0, 5.0, 0.01).onChange(update_fieldlines);
f_quad.add(conf, "q22", -5.0, 5.0, 0.01).onChange(update_fieldlines);
f_quad.add(conf, "q23", -5.0, 5.0, 0.01).onChange(update_fieldlines);
f_quad.add(conf, "q_offset_x", -1.0, 1.0, 0.01).onChange(update_fieldlines);
f_quad.add(conf, "q_offset_y", -1.0, 1.0, 0.01).onChange(update_fieldlines);
f_quad.add(conf, "q_offset_z", -1.0, 1.0, 0.01).onChange(update_fieldlines);

gui.add(conf, "min_length", 1.0, 40.0, 0.01).onChange(update_fieldlines);
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
