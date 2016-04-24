#pragma once

#include <cmath>
#include <functional>

namespace Transform {
  using Transform = std::function<float(float, float, float)>;

  inline float scale(float value, float min, float max) {
    return (value - min) / (max - min);
  }

  inline float clip(float value, float min=0., float max=1.) {
    return value > max ? max : value < min ? min : value;
  }

  Transform Binary(float threshold) {
    return Transform([threshold](float value, float, float) {
        if (value >= (float) threshold) 
          return 1.;
        return 0.;
    });
  }

  Transform Exponential(float base) {
    return Transform([base](float value, float min, float max) {
        return scale(std::pow(base, value), std::pow(base, min), std::pow(base, max));
    });
  }

  Transform Identity() {
    return Transform([](float value, float min, float max) {
      return scale(value, min, max);
    });
  }

  Transform Inverted() {
    return Transform([](float value, float min, float max) {
      return 1. - scale(value, min, max);
    });
  }

  Transform Linear(float slope, float intercept) {
    return Transform([slope, intercept](float value, float min, float max) {
      return clip(slope * scale(value, min, max) + intercept);
    });
  }

  Transform Power(float power) {
    return Transform([power](float value, float min, float max) {
        return scale(std::pow(value, power), std::pow(min, power), std::pow(max, power));
    });
  }
}
