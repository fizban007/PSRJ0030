extern crate js_sys;
extern crate wasm_bindgen;
// extern crate nalgebra as na;

use ode_solvers::dopri5::*;
use ode_solvers::*;
// use na::Vector3;
use wasm_bindgen::prelude::*;

pub mod vec3;

use vec3::Vec3;

#[wasm_bindgen]
extern "C" {
  pub fn alert(s: &str);

  // Use `js_namespace` here to bind `console.log(..)` instead of just
  // `log(..)`
  #[wasm_bindgen(js_namespace = console)]
  fn log(s: &str);

  // The `console.log` is quite polymorphic, so we can bind it with multiple
  // signatures. Note that we need to use `js_name` to ensure we always call
  // `log` in JS.
  #[wasm_bindgen(js_namespace = console, js_name = log)]
  fn log_u32(a: u32);

  // Multiple arguments too!
  #[wasm_bindgen(js_namespace = console, js_name = log)]
  fn log_many(a: &str, b: &str);
}

// Next let's define a macro that's like `println!`, only it works for
// `console.log`. Note that `println!` doesn't actually work on the wasm target
// because the standard library currently just eats all output. To get
// `println!`-like behavior in your app you'll likely want a macro like this.

macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct Conf {
  px: f32,
  py: f32,
  pz: f32,
  q11: f32,
  q12: f32,
  q13: f32,
  q22: f32,
  q23: f32,
  q_offset_x: f32,
  q_offset_y: f32,
  q_offset_z: f32,
  lc: f32,
}

#[wasm_bindgen]
impl Conf {
  #[wasm_bindgen(constructor)]
  pub fn new(params: &[f32]) -> Conf {
    Conf {
      px: params[0],
      py: params[1],
      pz: params[2],
      q11: params[3],
      q12: params[4],
      q13: params[5],
      q22: params[6],
      q23: params[7],
      q_offset_x: params[8],
      q_offset_y: params[9],
      q_offset_z: params[10],
      lc: params[11],
    }
  }
}

pub fn dipole_field(px: f32, py: f32, pz: f32, x: f32, y: f32, z: f32) -> Vec3<f32> {
  let r = (x * x + y * y + z * z).sqrt();
  let r5 = r * r * r * r * r;
  Vec3::new(
    (3.0 * x * (py * y + pz * z) - px * (-2.0 * x * x + y * y + z * z)) / r5,
    (3.0 * y * (px * x + pz * z) - py * (x * x - 2.0 * y * y + z * z)) / r5,
    (3.0 * z * (px * x + py * y) - pz * (x * x + y * y - 2.0 * z * z)) / r5,
  )
}

pub fn quadrupole_field(
  q11: f32,
  q12: f32,
  q13: f32,
  q22: f32,
  q23: f32,
  x: f32,
  y: f32,
  z: f32,
) -> Vec3<f32> {
  let r = (x * x + y * y + z * z).sqrt();
  let r2 = r * r;
  let r7 = r2 * r2 * r2 * r;
  Vec3::new(
    (-2.0 * (q11 * x + q12 * y + q13 * z) * r2
      + 5.0
        * x
        * (q11 * x * x + 2.0 * q12 * x * y + q22 * y * y + 2.0 * (q13 * x + q23 * y) * z
          - (q11 + q22) * z * z))
      / r7,
    (-2.0 * (q12 * x + q22 * y + q23 * z) * r2
      + 5.0
        * y
        * (q11 * x * x + 2.0 * q12 * x * y + q22 * y * y + 2.0 * (q13 * x + q23 * y) * z
          - (q11 + q22) * z * z))
      / r7,
    (-2.0 * (q13 * x + q23 * y) * (x * x + y * y)
      + ((7.0 * q11 + 2.0 * q22) * x * x + 10.0 * q12 * x * y + (2.0 * q11 + 7.0 * q22) * y * y)
        * z
      + 8.0 * (q13 * x + q23 * y) * z * z
      - 3.0 * (q11 + q22) * z * z * z)
      / r7,
  )
}

#[wasm_bindgen]
pub fn integrate_field_line(
  p0: &[f32],
  params: &[f32],
  dl: f32,
  nmax: u32,
  skip: i32,
  // pos_array: &mut [f32],
) -> Vec<f32> {
  let conf = Conf::new(params);
  let mut pos: Vec<f32> = Vec::new();
  pos.extend_from_slice(p0);
  // pos_array[0] = p0[0];
  // pos_array[1] = p0[1];
  // pos_array[2] = p0[2];
  // let mut p = dipole_field()
  let mut p = Vec3::new(p0[0], p0[1], p0[2]);
  let mut f = dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z)
    + &quadrupole_field(
      conf.q11,
      conf.q12,
      conf.q13,
      conf.q22,
      conf.q23,
      p.x - conf.q_offset_x,
      p.y - conf.q_offset_y,
      p.z - conf.q_offset_z,
    );
  f = f.normalize();
  let sign = if Vec3::dot(&f, &p) > 0.0 { 1.0 } else { -1.0 };
  // console_log!("sign is {}, f is ({}, {}, {})", sign, f.x, f.y, f.z);
  let mut _flen: f32 = 0.0;
  // let mut num = 3;

  for i in 1..nmax {
    p += f * dl * sign;
    if p.length_squared() < 1.0 {
      pos.extend_from_slice(&[p.x, p.y, p.z]);
      break;
    }
    if p.x * p.x + p.y * p.y > conf.lc * conf.lc {
      pos.extend_from_slice(&[p.x, p.y, p.z]);
      break;
    }
    if (i % skip as u32) == 0 {
      pos.extend_from_slice(&[p.x, p.y, p.z]);
    }
    // pos_array[(i * 3) as usize] = p.x;
    // pos_array[(i * 3 + 1) as usize] = p.y;
    // pos_array[(i * 3 + 2) as usize] = p.z;
    _flen += dl;

    // console_log!("flen is {}", flen);
    f = dipole_field(conf.px, conf.py, conf.pz, p.x, p.y, p.z)
      + &quadrupole_field(
        conf.q11,
        conf.q12,
        conf.q13,
        conf.q22,
        conf.q23,
        p.x - conf.q_offset_x,
        p.y - conf.q_offset_y,
        p.z - conf.q_offset_z,
      );
    f = f.normalize();
    // num += 3;
  }

  // console_log!("value: ({}, {}, {})", conf.q11, conf.q22, conf.q23);
  pos
  // num
}

#[wasm_bindgen]
pub fn greet(name: &str) {
  alert(&format!("Hello there, {}!", name));
}

#[wasm_bindgen]
pub fn test_log(name: &str) {
  console_log!("Hello there, {}!", name);
}

type State = Vector3<f64>;
type Time = f64;

pub fn dipole_B(px: f64, py: f64, pz: f64, p: &State) -> State {
  let r = p.norm();
  let r5 = r * r * r * r * r;
  // console_log!("r5 is {}", r5);
  Vector3::new(
    (3.0 * p[0] * (py * p[1] + pz * p[2]) - px * (-2.0 * p[0] * p[0] + p[1] * p[1] + p[2] * p[2]))
      / r5,
    (3.0 * p[1] * (px * p[0] + pz * p[2]) - py * (p[0] * p[0] - 2.0 * p[1] * p[1] + p[2] * p[2]))
      / r5,
    (3.0 * p[2] * (px * p[0] + py * p[1]) - pz * (p[0] * p[0] + p[1] * p[1] - 2.0 * p[2] * p[2]))
      / r5,
  )
}

pub fn quadrupole_B(q11: f64, q12: f64, q13: f64, q22: f64, q23: f64, p: &State) -> State {
  let r = p.norm();
  let r2 = r * r;
  let r7 = r2 * r2 * r2 * r;
  Vector3::new(
    (-2.0 * (q11 * p[0] + q12 * p[1] + q13 * p[2]) * r2
      + 5.0
        * p[0]
        * (q11 * p[0] * p[0]
          + 2.0 * q12 * p[0] * p[1]
          + q22 * p[1] * p[1]
          + 2.0 * (q13 * p[0] + q23 * p[1]) * p[2]
          - (q11 + q22) * p[2] * p[2]))
      / r7,
    (-2.0 * (q12 * p[0] + q22 * p[1] + q23 * p[2]) * r2
      + 5.0
        * p[1]
        * (q11 * p[0] * p[0]
          + 2.0 * q12 * p[0] * p[1]
          + q22 * p[1] * p[1]
          + 2.0 * (q13 * p[0] + q23 * p[1]) * p[2]
          - (q11 + q22) * p[2] * p[2]))
      / r7,
    (-2.0 * (q13 * p[0] + q23 * p[1]) * (p[0] * p[0] + p[1] * p[1])
      + ((7.0 * q11 + 2.0 * q22) * p[0] * p[0]
        + 10.0 * q12 * p[0] * p[1]
        + (2.0 * q11 + 7.0 * q22) * p[1] * p[1])
        * p[2]
      + 8.0 * (q13 * p[0] + q23 * p[1]) * p[2] * p[2]
      - 3.0 * (q11 + q22) * p[2] * p[2] * p[2])
      / r7,
  )
}

#[wasm_bindgen]
struct QuadruDipole {
  px: f64,
  py: f64,
  pz: f64,
  q11: f64,
  q12: f64,
  q13: f64,
  q22: f64,
  q23: f64,
  q_offset_x: f64,
  q_offset_y: f64,
  q_offset_z: f64,
  lc: f64,
  sign: f64,
}

#[wasm_bindgen]
impl QuadruDipole {
  #[wasm_bindgen(constructor)]
  pub fn new(params: &[f32], s: f64) -> QuadruDipole {
    QuadruDipole {
      px: params[0] as f64,
      py: params[1] as f64,
      pz: params[2] as f64,
      q11: params[3] as f64,
      q12: params[4] as f64,
      q13: params[5] as f64,
      q22: params[6] as f64,
      q23: params[7] as f64,
      q_offset_x: params[8] as f64,
      q_offset_y: params[9] as f64,
      q_offset_z: params[10] as f64,
      lc: params[11] as f64,
      sign: s,
    }
  }
}

impl ode_solvers::System<State> for QuadruDipole {
  // Equations of motion of the system
  fn system(&self, _t: Time, y: &State, dy: &mut State) {
    *dy = (dipole_B(self.px, self.py, self.pz, y)
        + quadrupole_B(
          self.q11,
          self.q12,
          self.q13,
          self.q22,
          self.q23,
          &(y - Vector3::new(self.q_offset_x, self.q_offset_y, self.q_offset_z)),
        )).normalize() * self.sign;
    // console_log!("dy is {}", dy);
  }

  fn solout(&mut self, _x: f64, _y: &State, _dy: &State) -> bool {
    let l = _y.norm();
    let l_cyl = (_y[0] * _y[0] + _y[1] * _y[1]).sqrt();
    // console_log!("l is {}", l);
    l < 1.0 || l_cyl > self.lc
  }
}

#[wasm_bindgen]
pub fn integrate_field(
  p0: &[f32],
  params: &[f32],
  dl: f32,
  nmax: u32,
  // pos_array: &mut [f32],
) -> Vec<f32> {
  let system = QuadruDipole::new(params, 1.0);
  let system2 = QuadruDipole::new(params, -1.0);

  // console_log!("p0 initial is {}, {}, {}", p0[0], p0[1], p0[2]);
  let p = Vector3::new(p0[0] as f64, p0[1] as f64, p0[2] as f64);
  // console_log!("p initial is {}", p);
  // let sign = if Vec3::dot(&f, &p) > 0.0 { 1.0 } else { -1.0 };
  // console_log!("sign is {}, f is ({}, {}, {})", sign, f.x, f.y, f.z);

  let lmax = (dl as f64) * (nmax as f64);
  let mut stepper = Dopri5::new(system, 0.0, lmax, dl as f64, p, 1.0e-6, 1.0e-6);
  let mut stepper2 = Dopri5::new(system2, 0.0, lmax, dl as f64, p, 1.0e-6, 1.0e-6);
  // stepper.out_type = OutputType::Sparse;
  let res = stepper.integrate();
  let res2 = stepper2.integrate();

  // let mut out: &Vec<State> = stepper.y_out();
  // out.reverse();
  let mut out1: Vec<f32> = stepper
    .y_out()
    .iter()
    .rev()
    .flat_map(|array| array.iter())
    .map(|x| *x as f32)
    .collect();
  let out2: Vec<f32> = stepper2
    .y_out()
    .iter()
    .flat_map(|array| array.iter())
    .map(|x| *x as f32)
    .collect();
  out1.extend(&out2);
  // Handle result
  match res {
    Ok(_stats) => {
      // stats.print();
      // console_log!("{}", stats);

      out1
    }
    Err(_) => {
      println!("An error occured.");
      Vec::new()
    }
  }

  // console_log!("value: ({}, {}, {})", conf.q11, conf.q22, conf.q23);
  // num
}
