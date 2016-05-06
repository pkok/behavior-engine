#pragma once

#include <functional>
#include "Transform.h"

/** An indication of the usefulness of a decision.
 *
 * A Consideration receives a signal from the utilityFunction.  This
 * utilityFunction has a minimum and maximum value.  Then, a Transform
 * changes the shape of the input, such that the score is between 0 and 1.
 */
class Consideration {
  public:
    Consideration(std::function<float()> utilityFunction, Transform::Transform transform, float min=1.f, float max=1.f)
      : utilityFunction(utilityFunction), transform(transform), min(min), max(max)
    {}

    Consideration() = default;
    Consideration(const Consideration& other) = default;
    Consideration& operator=(const Consideration& other) = default;

    /** Computes the utility score of this Consideration.  */
    inline float computeScore() const
    {
      return transform(utilityFunction(), min, max);
    }

  private:
    std::function<float()> utilityFunction;
    Transform::Transform transform;
    float min;
    float max;
};
