use std::ops::{Add, AddAssign, Div, DivAssign, Mul, MulAssign, Neg, Sub, SubAssign};

#[derive(Copy, Clone, Debug, PartialEq, PartialOrd)]
pub struct Vec3 {
  pub x: f32,
  pub y: f32,
  pub z: f32,
}

impl Vec3 {
  pub const ZERO: Vec3 = Vec3 {
    x: 0.0,
    y: 0.0,
    z: 0.0,
  };

  pub const ONE: Vec3 = Vec3 {
    x: 1.0,
    y: 1.0,
    z: 1.0,
  };

  pub fn new(x: f32, y: f32, z: f32) -> Vec3 {
    Vec3 { x: x, y: y, z: z }
  }

  // Returns a new copy of self with the x-value replaced
  // with the specified value.
  pub fn with_x(self, x: f32) -> Vec3 {
    return Vec3 {
      x: x,
      y: self.y,
      z: self.z,
    };
  }

  // Returns a new copy of self with the y-value replaced
  // with the specified value.
  pub fn with_y(self, y: f32) -> Vec3 {
    return Vec3 {
      x: self.x,
      y: y,
      z: self.z,
    };
  }

  // Returns a new copy of self with the z-value replaced
  // with the specified value.
  pub fn with_z(self, z: f32) -> Vec3 {
    return Vec3 {
      x: self.x,
      y: self.y,
      z: z,
    };
  }

  pub fn normalize(self) -> Vec3 {
    self / self.length()
  }

  pub fn length(&self) -> f32 {
    return self.length_squared().sqrt();
  }

  pub fn min(&self, other: &Vec3) -> Vec3 {
    return Vec3 {
      x: self.x.min(other.x),
      y: self.y.min(other.y),
      z: self.z.min(other.z),
    };
  }

  pub fn max(&self, other: &Vec3) -> Vec3 {
    return Vec3 {
      x: self.x.max(other.x),
      y: self.y.max(other.y),
      z: self.z.max(other.z),
    };
  }

  pub fn length_squared(&self) -> f32 {
    return self.x * self.x + self.y * self.y + self.z * self.z;
  }

  pub fn dot(a: &Vec3, b: &Vec3) -> f32 {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  pub fn cross(a: &Vec3, b: &Vec3) -> Vec3 {
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
  // $Operation is something like `Add`
  // $op_fn is something like `add`
  // $op_symbol is something like `+`
  ($VectorType:ident $Operation:ident $op_fn:ident $op_symbol:tt) => {
    // Implement a + b where a and b are both of type &VectorType.
    // Lower down we'll implement cases where either a or b - or both
    // - are values by forwarding through to this implementation.
    impl<'a, 'b> $Operation<&'a $VectorType> for &'b $VectorType {
      type Output = $VectorType;
      fn $op_fn(self, other: &'a $VectorType) -> $VectorType {
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
    impl $Operation<$VectorType> for $VectorType {
      type Output = $VectorType;

      #[inline]
      fn $op_fn(self, other: $VectorType) -> $VectorType {
        &self $op_symbol &other
      }
    }

    impl<'a> $Operation<&'a $VectorType> for $VectorType {
      type Output = $VectorType;

      #[inline]
      fn $op_fn(self, other: &'a $VectorType) -> $VectorType {
        &self $op_symbol other
      }
    }

    impl<'a> $Operation<$VectorType> for &'a $VectorType {
      type Output = $VectorType;

      #[inline]
      fn $op_fn(self, other: $VectorType) -> $VectorType {
        self $op_symbol &other
      }
    }

    // Implement a + b where a is type &$VectorType and b is type f32
    impl<'a> $Operation<f32> for &'a $VectorType {
      type Output = $VectorType;

      fn $op_fn(self, other: f32) -> $VectorType {
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
    impl $Operation<f32> for $VectorType {
      type Output = $VectorType;

      #[inline]
      fn $op_fn(self, other: f32) -> $VectorType {
        &self $op_symbol other
      }
    }

    impl $Operation<$VectorType> for f32 {
      type Output = $VectorType;

      #[inline]
      fn $op_fn(self, other: $VectorType) -> $VectorType {
        &other $op_symbol self
      }
    }

    impl<'a> $Operation<&'a $VectorType> for f32 {
      type Output = $VectorType;

      #[inline]
      fn $op_fn(self, other: &'a $VectorType) -> $VectorType {
        other $op_symbol self
      }
    }
  };
}

// It also implements unary operators like - a where a is of
// type Vec3 or &Vec3.
macro_rules! impl_unary_operations {
  // $VectorType is something like `Vec3`
  // $Operation is something like `Neg`
  // $op_fn is something like `neg`
  // $op_symbol is something like `-`
  ($VectorType:ident $Operation:ident $op_fn:ident $op_symbol:tt) => {

    // Implement the unary operator for references
    impl<'a> $Operation for &'a $VectorType {
      type Output = $VectorType;

      fn $op_fn(self) -> Vec3 {
        $VectorType {
          x: $op_symbol self.x,
          y: $op_symbol self.y,
          z: $op_symbol self.z,
        }
      }
    }

    // Have the operator on values forward through to the implementation
    // above
    impl $Operation for $VectorType {
      type Output = $VectorType;

      #[inline]
      fn $op_fn(self) -> Vec3 {
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
  // $OperationAssign is something like `AddAssign`
  // $op_fn is something like `add_assign`
  // $op_symbol is something like `+=`
  ($VectorType:ident $OperationAssign:ident $op_fn:ident $op_symbol:tt) => {
    // Implement $OperationAssign for RHS &Vec3
    impl<'a> $OperationAssign<&'a $VectorType> for $VectorType {
      fn $op_fn(&mut self, other: &'a $VectorType) {
        *self = $VectorType {
          x: self.x $op_symbol other.x,
          y: self.y $op_symbol other.y,
          z: self.z $op_symbol other.z,
        };
      }
    }

    // Implement $OperationAssign for RHS Vec3 by forwarding through to the
    // implementation above
    impl $OperationAssign for $VectorType {
      #[inline]
      fn $op_fn(&mut self, other: $VectorType) {
        *self = *self $op_symbol &other
      }
    }
  };
}

impl_binary_operations!(Vec3 Add add +);
impl_op_assign!(Vec3 AddAssign add_assign +);

impl_binary_operations!(Vec3 Sub sub -);
impl_op_assign!(Vec3 SubAssign sub_assign -);
impl_unary_operations!(Vec3 Neg neg -);

impl_binary_operations!(Vec3 Mul mul *);
impl_op_assign!(Vec3 MulAssign mul_assign *);

impl_binary_operations!(Vec3 Div div /);
impl_op_assign!(Vec3 DivAssign div_assign /);

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
      let mut c = Vec3::ONE;
      c += a;
      assert_eq!(c, Vec3::new(1.0, 2.0, 3.0));
    }

    // Test for RHS borrowed reference
    {
      let mut c = Vec3::ONE;
      c += &a;
      assert_eq!(c, Vec3::new(1.0, 2.0, 3.0));
    }
  }
}
