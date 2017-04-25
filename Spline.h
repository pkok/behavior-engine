#pragma once

#include <iostream>
#include <vector>
#include <functional>

namespace Spline {
  struct P2
  {
    float x, y;
  };

  using SplineFunction = std::function<float(float)>;

  // pass by value so compiler can optimize this properly
  inline SplineFunction Linear(std::vector<P2> points) {
    return [points](float x) {
      if (x <= points.front().x) { return points.front().y; }
      if (x >= points.back().x) { return points.back().y; }

      size_t count = points.size() - 1;
      for (size_t i = 0; i < count; ++i)
      {
        P2 a = points[i];
        P2 b = points[i + 1];

        if (x >= a.x && x <= b.x)
        {
          float interpolation = (x - a.x) / (b.x - a.x);
          return (1 - interpolation) * a.y + interpolation * b.y;
        }
      }

      return points.back().y;
    };
  }

  inline SplineFunction StepBefore(std::vector<P2> points) {
    return [points](float x) {
      if (x <= points.front().x) { return points.front().y; }
      if (x >= points.back().x) { return points.back().y; }

      size_t count = points.size() - 1;
      for (size_t i = 0; i < count; ++i)
      {
        P2 a = points[i];
        P2 b = points[i + 1];

        if (x >= a.x && x <= b.x) { return b.y; }
      }

      return points.back().y;
    };
  }

  inline SplineFunction StepAfter(std::vector<P2> points) {
    return [points](float x) {
      if (x <= points.front().x) { return points.front().y; }
      if (x >= points.back().x) { return points.back().y; }

      size_t count = points.size() - 1;
      for (size_t i = 0; i < count; ++i)
      {
        P2 a = points[i];
        P2 b = points[i + 1];

        if (x >= a.x && x <= b.x) { return a.y; }
      }

      return points[count].y;
    };
  }

  inline SplineFunction Monotone(std::vector<P2> points)
  {
    size_t count = points.size() - 1;
    std::vector<float> deltaXs(count);
    std::vector<float> slopes(count);
    std::vector<float> coefficients1(points.size()), coefficients2(count), coefficients3(count);

    for (size_t i = 0; i < count; ++i)
    {
      P2 a = points[i];
      P2 b = points[i + 1];

      P2 d = { b.x - a.x, b.y - a.y };
      deltaXs[i] = d.x;
      slopes[i] = d.y / d.x;
    }

    coefficients1[0] = slopes[0];
    for (size_t i = 0; i < count - 1; ++i)
    {
      float slope = slopes[i];
      float slopeNext = slopes[i + 1];

      if (slope * slopeNext <= 0)
      { 
        coefficients1[i + 1] = 0; 
      }
      else
      {
        float dx = deltaXs[i];
        float dxNext = deltaXs[i + 1];
        float common = dx + dxNext;
        coefficients1[i + 1] = 3 * common / ((common + dxNext) / slope + (common + dx) / slopeNext);
      }
    }
    coefficients1.back() = slopes.back();

    for (size_t i = 0; i < count; ++i)
    {
      float c1 = coefficients1[i];
      float slope = slopes[i];
      float invDx = 1 / deltaXs[i];
      float common = c1 + coefficients1[i + 1] - 2 * slope;
      coefficients2[i] = (slope - c1 - common) * invDx;
      coefficients3[i] = common * invDx * invDx;
    }

    return [=](float x)
    {
      if (x <= points.front().x) { return points.front().y; }
      if (x >= points.back().x) { return points.back().y; }

      size_t low = 0;
      size_t mid;
      size_t high = count - 1;

      while (low <= high)
      {
        mid = (low + high) / 2;
        float xHere = points[mid].x;

        if (xHere < x) { low = mid + 1; }
        else if (xHere > x) { high = mid - 1; }
        else { return points[mid].y; }
      }

      size_t i = (high > 0) ? high : 0;

      float diff = x - points[i].x;
      float diffSq = diff * diff;
      return points[i].y + coefficients1[i] * diff + coefficients2[i] * diffSq + coefficients3[i] * diff * diffSq;
    };
  }
}
