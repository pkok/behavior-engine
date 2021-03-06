#include <iostream>
#include <random>
#include <chrono>

#include "DecisionEngine.h"

enum class Event : unsigned int {
  Always,
  Penalized
};

class Test : public DecisionEngine{
  public:
    Test();
    float getRandom();
    void report(const std::string& msg);
    void showActives();

    std::mt19937 generator;
    std::uniform_real_distribution<float> distribution;
};


float Test::getRandom() {
  return distribution(generator);
}

void Test::showActives() {
  for (const auto& decision : getActiveDecisions()) {
    std::cout << "- '"
      << decision->getName()
      << "' ("
      << static_cast<std::underlying_type<UtilityScore>::type>(decision->getUtility())
      << ")\n";
  }
}

void Test::report(const std::string& msg) {
  std::cout << msg << std::endl;
}

Test::Test() : DecisionEngine() {
  auto t = std::chrono::system_clock::now();
  generator.seed(static_cast<unsigned int>(t.time_since_epoch().count()));

  // Within Decisions, you have access to values in the following scopes:
  // - Any member of the DecisionEngine instance through the this pointer
  // - Any member of the Decision instance through a reference
  // - Any other value defined in the current scope through a reference.
  //   Note that this reference is not const, so any changes made to this
  //   reference are observable by all other Decisions.  Also note that
  //   these references have a shorter lifetime than the lambda expressions
  //   of the Consideration and Action of a Decision, and thus these values
  //   should be static.
  static int counter = 0;

// The actions demonstrated below do not use the Decision& that is passed to 
// it. This results in an (understandable) unused parameter warning. Because
// the warning is expected, it is suppressed.
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wunused-parameter"
  addDecision(
    name("First decision"),
    description("Some long text"),
    UtilityScore::MostUseful,
    events {Event::Always},

    considerations {
      consideration(
        description("Randomness"), 
        range(0, 1),
        Spline::Linear({{0,0}, {1,1}}), {
          return getRandom();
        }),
    },

    actions {
      report("Executed " + std::to_string(++counter) + " times");
      report("First decision");
    }
  );

  addDecision(
    name("Another decision"),
    description("Look, a story"),
    UtilityScore::VeryUseful,
    events {Event::Always},

    considerations {
      consideration(
        description("Randomness"), 
        range(0, 1), 
        Spline::Linear({{0,0}, {1, 1}}), {
          return getRandom();
        }),
    },

    actions {
      report("Executed " + std::to_string(++counter) + " times");
      report(theDecision.getName());
    }
  );

  addDecision(
    name("Ignored decision"),
    description("Some more text"),
    UtilityScore::Ignore,
    events {Event::Always},

    considerations {
      consideration(
        description("Always true"),
        range(0, 1),
        Spline::StepBefore({{0,0}, {0.5, 1}, {1,1}}), {
          return true;
        }),
    },

    actions {
      report("This is never executed.");
    }
  );
#pragma clang diagnostic pop

  raiseEvent(Event::Always);
}

int main(int, char**) {
  Test t;
  for (unsigned int i = 0; i < 5; ++i) {
    std::cout << "Round " << i << std::endl;
    t.showActives();
    std::shared_ptr<Decision> d = t.getBestDecision();
    d->execute();
    std::cout << "Choice: '" << d->getName() << "'\n\n";
  }
}
