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
    Consideration(std::function<float()> utilityFunction, Transform::Transform transform, float min=1., float max=1.) 
      : utilityFunction(utilityFunction), transform(transform), min(min), max(max)
    {}

    /** Computes the utility score of this Consideration.  */
    inline float computeScore() const
    {
      return transform(utilityFunction(), min, max);
    }

  private:
    const std::function<float()>& utilityFunction;
    const Transform::Transform transform;
    const float min;
    const float max;
};
