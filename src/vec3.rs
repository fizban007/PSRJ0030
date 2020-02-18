extern crate num_traits;

use std::ops::{Add, AddAssign, Div, DivAssign, Mul, MulAssign, Neg, Sub, SubAssign};

pub trait Sqrt {
  type Output;
  fn sqrt(self) -> Self::Output;
}

impl Sqrt for f32 {
  type Output = f32;
  fn sqrt(self) -> Self::Output {
    self.sqrt()
  }
}

impl Sqrt for f64 {
  type Output = f64;
  fn sqrt(self) -> Self::Output {
    self.sqrt()
  }
}

impl Sqrt for i32 {
  type Output = i32;
  fn sqrt(self) -> Self::Output {
    (self as f32).sqrt() as i32
  }
}

#[derive(Copy, Clone, Debug, PartialEq, PartialOrd)]
pub struct Vec3<T> {
  pub x: T,
  pub y: T,
  pub z: T,
}

impl<T: Sqrt<Output = T> + num_traits::Num + Copy> Vec3<T> {
  pub fn zero() -> Vec3<T> {
    Vec3 {
      x: T::zero(),
      y: T::zero(),
      z: T::zero(),
    }
  }

  pub fn one() -> Vec3<T> {
    Vec3 {
      x: T::one(),
      y: T::one(),
      z: T::one(),
    }
  }

  pub fn new(x: T, y: T, z: T) -> Vec3<T> {
    Vec3 { x: x, y: y, z: z }
  }

  // Returns a new copy of self with the x-value replaced
  // with the specified value.
  pub fn with_x(self, x: T) -> Vec3<T> {
    return Vec3 {
      x: x,
      y: self.y,
      z: self.z,
    };
  }

  // Returns a new copy of self with the y-value replaced
  // with the specified value.
  pub fn with_y(self, y: T) -> Vec3<T> {
    return Vec3 {
      x: self.x,
      y: y,
      z: self.z,
    };
  }

  // Returns a new copy of self with the z-value replaced
  // with the specified value.
  pub fn with_z(self, z: T) -> Vec3<T> {
    return Vec3 {
      x: self.x,
      y: self.y,
      z: z,
    };
  }

  pub fn normalize(self) -> Vec3<T>
  {
    self / self.length()
  }

  pub fn length(&self) -> T {
    return self.length_squared().sqrt();
  }

  pub fn dot(a: &Vec3<T>, b: &Vec3<T>) -> T {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  pub fn length_squared(&self) -> T {
    Vec3::dot(&self, &self)
  }

  pub fn cross(a: &Vec3<T>, b: &Vec3<T>) -> Vec3<T> {
    return Vec3 {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }
}

// This macro helps us implement math operators on Vector3
// in such a way that it handles binary operators on any
// combination of Vec3, &Vec3 and f32.
macro_rules! impl_binary_operations {
  // $VectorType is something like `Vec3`
  // $Op is something like `Add`
  // $op_fn is something like `add`
  // $op_symbol is something like `+`
  ($VectorType:ident $Op:ident $op_fn:ident $op_symbol:tt) => {
    // Implement a + b where a and b are both of type &VectorType.
    // Lower down we'll implement cases where either a or b - or both
    // - are values by forwarding through to this implementation.
    impl<'a, 'b, T: $Op<Output = T> + Copy> $Op<&'a $VectorType<T>> for &'b $VectorType<T> {
      type Output = $VectorType<T>;
      fn $op_fn(self, other: &'a $VectorType<T>) -> $VectorType<T> {
        $VectorType {
          x: self.x $op_symbol other.x,
          y: self.y $op_symbol other.y,
          z: self.z $op_symbol other.z,
        }
      }
    }

    // Implement a + b for the cases...
    //
    //   a: $VectorType,  b: &$VectorType
    //   a: &$VectorType, b: $VectorType
    //   a: $VectorType, b: $VectorType
    //
    // In each case we forward through to the implementation above.
    impl<T: $Op<Output = T> + Copy> $Op<$VectorType<T>> for $VectorType<T> {
      type Output = $VectorType<T>;

      #[inline]
      fn $op_fn(self, other: $VectorType<T>) -> $VectorType<T> {
        &self $op_symbol &other
      }
    }

    impl<'a, T: $Op<Output = T> + Copy> $Op<&'a $VectorType<T>> for $VectorType<T> {
      type Output = $VectorType<T>;

      #[inline]
      fn $op_fn(self, other: &'a $VectorType<T>) -> $VectorType<T> {
        &self $op_symbol other
      }
    }

    impl<'a, T: $Op<Output = T> + Copy> $Op<$VectorType<T>> for &'a $VectorType<T> {
      type Output = $VectorType<T>;

      #[inline]
      fn $op_fn(self, other: $VectorType<T>) -> $VectorType<T> {
        self $op_symbol &other
      }
    }

    // Implement a + b where a is type &$VectorType and b is type f32
    impl<'a, T: $Op<T, Output = T> + Copy> $Op<T> for &'a $VectorType<T> {
      type Output = $VectorType<T>;

      fn $op_fn(self, other: T) -> $VectorType<T> {
        $VectorType {
          x: self.x $op_symbol other,
          y: self.y $op_symbol other,
          z: self.z $op_symbol other
        }
      }
    }

    // Implement a + b where...
    //
    // a is $VectorType and b is f32
    // a is f32 and b is $VectorType
    // a is f32 and b is &$VectorType
    //
    // In each case we forward the logic to the implementation
    // above.
    impl<T: $Op<T, Output = T> + Copy> $Op<T> for $VectorType<T> {
      type Output = $VectorType<T>;

      #[inline]
      fn $op_fn(self, other: T) -> $VectorType<T> {
        &self $op_symbol other
      }
    }

    // impl<T: $Op<Output = T>> $Op<$VectorType<T>> for T {
    //   type Output = $VectorType<T>;

    //   #[inline]
    //   fn $op_fn(self, other: $VectorType<T>) -> $VectorType<T> {
    //     &other $op_symbol self
    //   }
    // }

    // impl<'a, T: $Op<Output = T>> $Op<&'a $VectorType<T>> for T {
    //   type Output = $VectorType<T>;

    //   #[inline]
    //   fn $op_fn(self, other: &'a $VectorType<T>) -> $VectorType<T> {
    //     other $op_symbol self
    //   }
    // }
  };
}

// It also implements unary operators like - a where a is of
// type Vec3 or &Vec3.
macro_rules! impl_unary_operations {
  // $VectorType is something like `Vec3`
  // $Op is something like `Neg`
  // $op_fn is something like `neg`
  // $op_symbol is something like `-`
  ($VectorType:ident $Op:ident $op_fn:ident $op_symbol:tt) => {

    // Implement the unary operator for references
    impl<'a, T: $Op<Output = T> + Copy> $Op for &'a $VectorType<T> {
      type Output = $VectorType<T>;

      fn $op_fn(self) -> $VectorType<T> {
        $VectorType {
          x: $op_symbol self.x,
          y: $op_symbol self.y,
          z: $op_symbol self.z,
        }
      }
    }

    // Have the operator on values forward through to the implementation
    // above
    impl<T: $Op<Output = T> + Copy> $Op for $VectorType<T> {
      type Output = $VectorType<T>;

      #[inline]
      fn $op_fn(self) -> $VectorType<T> {
        $op_symbol &self
      }
    }
  };
}

// Implement add-assignment operators like a += b where a and
// b is either &Vec3 or Vec3 (in this case a is always of type
// &mut Vec3).
macro_rules! impl_op_assign {
  // $VectorType is something like `Vec3`
  // $OpAssign is something like `AddAssign`
  // $op_fn is something like `add_assign`
  // $op_symbol is something like `+=`
  ($VectorType:ident $Op:ident $OpAssign:ident $op_fn:ident $op_symbol:tt) => {
    // Implement $OpAssign for RHS &Vec3
    impl<'a, T: $Op<T, Output = T> + Copy> $OpAssign<&'a $VectorType<T>> for $VectorType<T> {
      fn $op_fn(&mut self, other: &'a $VectorType<T>) {
        *self = $VectorType {
          x: self.x $op_symbol other.x,
          y: self.y $op_symbol other.y,
          z: self.z $op_symbol other.z,
        };
      }
    }

    // Implement $OpAssign for RHS Vec3 by forwarding through to the
    // implementation above
    impl<T: $Op<T, Output = T> + Copy> $OpAssign<$VectorType<T>> for $VectorType<T> {
      #[inline]
      fn $op_fn(&mut self, other: $VectorType<T>) {
        *self = *self $op_symbol &other
      }
    }

    // Implement $OpAssign for RHS Vec3 by forwarding through to the
    // implementation above
    impl<T: $Op<T, Output = T> + Copy> $OpAssign<T> for $VectorType<T> {
      #[inline]
      fn $op_fn(&mut self, other: T) {
        *self = $VectorType {
          x: self.x $op_symbol other,
          y: self.y $op_symbol other,
          z: self.z $op_symbol other,
        };
      }
    }
  };
}

impl_binary_operations!(Vec3 Add add +);
impl_op_assign!(Vec3 Add AddAssign add_assign +);

impl_binary_operations!(Vec3 Sub sub -);
impl_op_assign!(Vec3 Sub SubAssign sub_assign -);
impl_unary_operations!(Vec3 Neg neg -);

impl_binary_operations!(Vec3 Mul mul *);
impl_op_assign!(Vec3 Mul MulAssign mul_assign *);

impl_binary_operations!(Vec3 Div div /);
impl_op_assign!(Vec3 Div DivAssign div_assign /);

// // An example impl for vector add
// impl<T> Add<&Vec3<T>> for Vec3<T>
// where
// T : Add<Output = T> + Copy, {
//   type Output = Vec3<T>;
//   fn add(self, other: &Vec3<T>) -> Vec3<T> {
//     Vec3 {
//       x: self.x + other.x,
//       y: self.y + other.y,
//       z: self.z + other.z,
//     }
//   }
// }

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn add() {
    let a = Vec3::new(0.0, 1.0, 2.0);
    let b = Vec3::new(3.0, 4.0, 5.0);
    assert_eq!(&a + &b, Vec3::new(3.0, 5.0, 7.0));
    assert_eq!(a + &b, Vec3::new(3.0, 5.0, 7.0));
    assert_eq!(&a + b, Vec3::new(3.0, 5.0, 7.0));
    assert_eq!(a + b, Vec3::new(3.0, 5.0, 7.0));

    // Test for RHS value type
    {
      let mut c = Vec3::one();
      c += a;
      assert_eq!(c, Vec3::new(1.0, 2.0, 3.0));
    }

    // Test for RHS borrowed reference
    {
      let mut c = Vec3::one();
      c += &a;
      assert_eq!(c, Vec3::new(1.0, 2.0, 3.0));
    }
  }
}
