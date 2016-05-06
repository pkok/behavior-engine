#include <iostream>
#include <random>
#include <chrono>

#define NDEBUG
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
      << decision.getName()
      << "' ("
      << static_cast<std::underlying_type<UtilityScore>::type>(decision.getUtility())
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

  addDecision(
    name("First decision"),
    description("Some long text"),
    UtilityScore::MostUseful,
    events {Event::Always},

    considerations {
      consideration(0, 1, Transform::Identity(), {
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
      consideration(0, 1, Transform::Identity(), {
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
      consideration(0, 1, Transform::Binary(true), {
        return true;
      }),
    },

    actions {
      report("This is never executed.");
    }
  );

  raiseEvent(Event::Always);
}

int main(int, char**) {
  Test t;
  for (unsigned int i = 0; i < 5; ++i) {
    std::cout << "Round " << i << std::endl;
    t.showActives();
    Decision& d = t.getBestDecision();
    d.execute();
    std::cout << "Choice: '" << d.getName() << "'\n\n";
  }
}
