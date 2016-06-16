#pragma once

#include <functional>
#include <string>
#include "Spline.h"

using UtilityFunction = std::function<float()>;

inline float scale(float value, float min, float max) {
  return (value - min) / (max - min);
}

inline float clip(float value, float min=0.f, float max=1.f) {
  return value > max ? max : value < min ? min : value;
}

/** An indication of the usefulness of a decision.
 *
 * A Consideration receives a signal from the utilityFunction.  This
 * utilityFunction has a minimum and maximum value.  Then, a Spline
 * changes the shape of the input, such that the score is between 0 and 1.
 */
class Consideration {
  public:
    Consideration(const std::string& description,
        UtilityFunction utilityFunction,
        Spline::SplineFunction spline,
        float min=1.f,
        float max=1.f)
      : description(description),
      utilityFunction(utilityFunction),
      spline(spline),
      min(min),
      max(max)
    {}

    Consideration() = default;
    Consideration(const Consideration& other) = default;
    Consideration& operator=(const Consideration& other) = default;

    /** Computes the utility score of this Consideration.  */
    inline float computeScore() const
    {
      return clip(spline(scale(utilityFunction(), min, max)));
    }

  private:
    std::string description;
    UtilityFunction utilityFunction;
    Spline::SplineFunction spline;
    float min;
    float max;
};
