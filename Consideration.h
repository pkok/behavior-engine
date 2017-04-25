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

/** Only used for labeling in DecisionEngine::addDecision */
class range : public std::tuple<float, float> {
  using std::tuple<float, float>::tuple;
};

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
      : description_(description),
      utilityFunction_(utilityFunction),
      spline_(spline),
      min_(min),
      max_(max)
    {}

    Consideration(const std::string& description,
        UtilityFunction utilityFunction,
        Spline::SplineFunction spline,
        range input_range)
      : description_(description),
      utilityFunction_(utilityFunction),
      spline_(spline),
      min_(std::get<0>(input_range)),
      max_(std::get<1>(input_range))
    {}

    Consideration() = default;
    Consideration(const Consideration& other) = default;
    Consideration& operator=(const Consideration& other) = default;

    /** Computes the utility score of this Consideration.  */
    inline float computeScore() const
    {
      return clip(spline_(scale(utilityFunction_(), min_, max_)));
    }

  private:
    std::string description_;
    UtilityFunction utilityFunction_;
    Spline::SplineFunction spline_;
    float min_;
    float max_;
};
