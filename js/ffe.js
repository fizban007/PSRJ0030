import * as THREE from '../vendor/three.module.js';
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
var canvas = document.createElement('canvas');
canvas.id = "mainCanvas";
var context = canvas.getContext( 'webgl2' );
// canvas.id = "mainCanvas"
var renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
  context: context
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
// const canvas = renderer.domElement;
document.body.appendChild(canvas);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
// THREE.Object3D.DefaultUp.set(0.5,0.0,0.8);
var camera = new THREE.PerspectiveCamera(30, width / height, 10.0, 10000);
// var camera = new THREE.OrthographicCamera(width / -20, width / 20, height / -20, height / 20,
//                                           0.1, 1000);
camera.position.z = 0;
camera.position.y = 160;
camera.up.set(0, 0, 1);
camera.lookAt(new THREE.Vector3(0, 0, 0));

var controls = new OrbitControls(camera, renderer.domElement);
controls.enableKeys = false;

// var fieldline_txt = new THREE.TextureLoader().load('textures/fieldline.png');

var Config = function () {
  // this.frame = init_frame;
  // this.prev_frame = init_frame;
  // this.frame_rate = 12.0;
  this.resetView = function() {
    controls.reset();
  };
  this.current_sheet = true;
  this.playing = false;
  this.alpha_correction = 4.0;
  this.wireframe = false;
  this.color1 = "#000000";
  this.stepPos1 = 0.15;
  this.color2 = "#b64000";
  this.stepPos2 = 0.65;
  this.color3 = "#25ff00";
  this.stepPos3 = 0.8;
};
var conf = new Config();
var open_lines = new THREE.Group();
var closed_lines = new THREE.Group();
closed_lines.visible = conf.show_closed;

var field_lines = [];
var json_loader = new THREE.FileLoader();
var data_dir = "data/";
var min_length = 50;

function load_field_lines(file, color, skip) {
  json_loader.load(file, function(content) {
    var line_group = new THREE.Group();
    var response = JSON.parse(content);
    for (var n = 0; n < response.length; n+=skip) {
      var line = make_field_line(response[n], color);
      if (!(line === null)) {
        line_group.add(line);
      }
    }
    // if (num == init_frame)
    //   line_group.visible = true;
    // else
    //   line_group.visible = false;
    scene.add(line_group);
    field_lines.push(line_group);
  });
}

// function load_next_step(num, color) {
//   if (num > final_frame) return;
//   load_field_lines(data_dir + "data" + ("00000" + num).slice(-5) + ".json", color);
// }

// // load_field_lines();
// load_next_step(init_frame);
load_field_lines(data_dir + "lines_closed.json", new THREE.Color("limegreen"), 4);
load_field_lines(data_dir + "lines_open.json", new THREE.Color("skyblue"), 8);

function make_field_line(data, color) {
  if (data.length < 30) return null;
  var g = new LineGeometry();
  var positions = [];
  for (var n = 0; n < data.length; n+=1) {
    positions.push(data[n][0], data[n][1], data[n][2]);
  }
  g.setPositions(positions);
  g.attributes.position.needsUpdate = true;

  var line = new Line2(g, new LineMaterial({
    // color: (open ? color1 : color2),
    color: color,
    linewidth: 0.0015,
    // transparent: true,
    // depthTest: true,
    // depthWrite: true
  }));
 	line.computeLineDistances();
  // console.log(line);
  return line;
}

function updateTransferFunction() {
  var canvas = document.createElement("canvas");
  canvas.height = 16;
  canvas.width = 256;
  var ctx = canvas.getContext("2d");
  var grd = ctx.createLinearGradient(0, 0, canvas.width - 1, canvas.height - 1);
  grd.addColorStop(conf.stepPos1, conf.color1);
  grd.addColorStop(conf.stepPos2, conf.color2);
  grd.addColorStop(conf.stepPos3, conf.color3);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  var transferTexture = new THREE.CanvasTexture(canvas);
  transferTexture.wrapS = transferTexture.wrapT = THREE.ClampToEdgeWrapping;
  transferTexture.minFilter = transferTexture.magFilter = THREE.LinearFilter;
  transferTexture.format = THREE.RGBAFormat;
  transferTexture.needsUpdate = true;
  return transferTexture;
}

var manager = new THREE.LoadingManager();
var loader = new THREE.FileLoader(manager);
var vs3, fs3, dataTex, transTex, cube2;
var texNeedsUpdate = false;
var samplingRate = 1.0;
loader.setResponseType("text");
loader.load("shaders/volume.vert.glsl", function(f) { vs3 = f; });
loader.load("shaders/volume.frag.glsl", function(f) { fs3 = f; });

transTex = updateTransferFunction();
manager.onLoad = function() { start(); };

var start = function() {
  var dir = "data/";
  var txtloader = new THREE.FileLoader();
  txtloader.setResponseType("arraybuffer");
  txtloader.load(dir + "lambda19_256.dat", function(content) {
    var data = new Uint8Array(content);
    // console.log(data.length);
    var texture = new THREE.DataTexture3D(data, 256, 256, 256);
    // texture.format = THREE.RGBAFormat;
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    texture.flipY = false;
    texture.unpackAlignment = 1;
    dataTex = texture;
    texNeedsUpdate = true;
  });

  var mat3 = new THREE.ShaderMaterial({
    uniforms : {
      eye_pos : new THREE.Uniform(camera.position),
      volume_scale : new THREE.Uniform(new THREE.Vector3(1.0, 1.0, 1.0)),
      cubeTex : {type : "t", value : dataTex},
      transferTex : {type : "t", value : transTex},
      alphaCorrection : {type : "f", value : 1.0},
      alphaEmph : {type : "f", value : 0.8},
      alphaSpread : {type : "f", value : 0.2},
      dt_scale : {type : "f", value : samplingRate},
      volume_dims : new THREE.Uniform(new Int32Array([ 256, 256, 256 ])),
      // starColor : {type : "c", value : new THREE.Color(menu.star_color)},
      // star_radius : {value : menu.star_radius},
      // species : {type : "i", value : menu.species}
    },
    vertexShader : vs3,
    fragmentShader : fs3,
    side : THREE.BackSide,
    transparent : true,
    depthWrite: false,
    depthTest: true,
  });

  var box_scale = 45.67 * 2;
  var cube_geometry = new THREE.BoxGeometry(1, 1, 1);

  cube2 = new THREE.Mesh(cube_geometry, mat3);
  cube2.scale.x = box_scale;
  cube2.scale.y = box_scale;
  cube2.scale.z = box_scale;
  cube2.visible = conf.current_sheet;
  scene.add(cube2);

  var cube_edge = new THREE.EdgesGeometry(cube_geometry);
  var wiremat = new THREE.LineBasicMaterial(
    {color : 0xffffff, linewidth : 2, depthTest : false, depthWrite : false});
  var wireframe = new THREE.LineSegments(cube_edge, wiremat);

  wireframe.scale.x = box_scale;
  wireframe.scale.y = box_scale;
  wireframe.scale.z = box_scale;
  scene.add(wireframe);

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

  // scene.add(open_lines);
  // scene.add(closed_lines);

  function update_fieldlines() {
    field_lines[conf.prev_frame].visible = false;
    conf.prev_frame = conf.frame;
    field_lines[conf.frame].visible = true;
    console.log(conf.prev_frame, conf.frame);
  }

  function updateTexture(value) {
    // mat3.uniforms.starColor.value = new THREE.Color(menu.star_color);
    mat3.uniforms.transferTex.value = updateTransferFunction();
  }

  const gui = new GUI();
  // gui.add(conf, "frame", init_frame, final_frame, 1)
  //   .listen()
  //   .onFinishChange(function() {
  //     conf.frame = Math.round(conf.frame);
  //     update_fieldlines();
  //   });
  // gui.add(conf, "frame_rate", 1, 60, 0.1).listen();
  // gui.add(conf, "playing").listen();
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
  gui.add(conf, "current_sheet");
  gui.add(conf, "alpha_correction", 0, 10.0).listen();
  gui.add(conf, "wireframe").listen();
  gui
    .addColor(conf, "color1")
    .listen()
    .onChange(updateTexture);
  gui
    .add(conf, "stepPos1", 0, 1)
    .listen()
    .onChange(updateTexture);
  gui
    .addColor(conf, "color2")
    .listen()
    .onChange(updateTexture);
  gui
    .add(conf, "stepPos2", 0, 1)
    .listen()
    .onChange(updateTexture);
  gui
    .addColor(conf, "color3")
    .listen()
    .onChange(updateTexture);
  gui
    .add(conf, "stepPos3", 0, 1)
    .listen()
    .onChange(updateTexture);

  var axis = new THREE.Geometry();
  axis.vertices.push(new THREE.Vector3(0, 0, -100));
  axis.vertices.push(new THREE.Vector3(0, 0, 100));
  var z_line = new THREE.Line(axis, new THREE.LineBasicMaterial({
    color: 0x8080aa,
    linewidth: 2.5,
  }));
  scene.add(z_line);

  var star_radius = 2.0;
  var star_g = new THREE.SphereGeometry(star_radius, 64, 64);
  var star_mat = new THREE.MeshPhongMaterial({
    color: 0xaaaaaa,
    // color: 0xffffff,
    // transparent: true,
    // depthWrite: true,
    // depthTest: false,
  });
  // var material = new THREE.MeshBasicMaterial({ color: 0xaaaaaa });
  var star = new THREE.Mesh(star_g, star_mat);
  scene.add(star);

  var directionalLight = new THREE.DirectionalLight(0xffffffff);
  directionalLight.position.set(0, 7, 0);
  scene.add(directionalLight);

  // var light = new THREE.AmbientLight(0x404040); // soft white light
  // scene.add(light);

  var startTime = Date.now();
  var endTime = Date.now();

  function animate() {
    requestAnimationFrame(animate, canvas);
    // if(!instance.active || sample_defaults.paused) return;

    // field_lines.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), 0.003);
    // closed_lines.visible = conf.show_closed;
    var time = (Date.now() - endTime);

    if (time > 1000.0 / conf.frame_rate && conf.playing) {
      // conf.frame += 1;
      // if (conf.frame > final_frame) conf.frame = init_frame;
      update_fieldlines();
      endTime = Date.now();
    }

    if (texNeedsUpdate) {
      mat3.uniforms.cubeTex.value = dataTex;
      texNeedsUpdate = false;
    }
    mat3.uniforms.alphaCorrection.value = conf.alpha_correction;
    wireframe.visible = conf.wireframe;
    cube2.visible = conf.current_sheet;
    // required if controls.enableDamping or controls.autoRotate are set to true
    controls.update();
    camera.updateProjectionMatrix();

    renderer.render(scene, camera);
  }

  animate();

}
