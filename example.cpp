#include <iostream>
#include <random>
#include <chrono>
#include "DecisionEngine.h"

class Test {
  public:
    Test();
    float getRandom();
    void report(const std::string& msg);
    Decision next() { return decider.getBestDecision(); }
    void showActives() {
      for (const auto& decision : decider.getActiveDecisions()) {
        std::cout << "- '"
        << decision.getName()
        << "' ("
        << static_cast<std::underlying_type<UtilityScore>::type>(decision.getUtility())
        << ")\n";
      }
    }

    DecisionEngine decider;
    std::mt19937 generator;
    std::uniform_real_distribution<float> distribution;
};


float Test::getRandom() {
  return distribution(generator);
}

void Test::report(const std::string& msg) {
  std::cout << msg << std::endl;
}

Test::Test() {
  auto t = std::chrono::system_clock::now();
  generator.seed(static_cast<unsigned int>(t.time_since_epoch().count()));

  decider.addDecision(
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
      report("First decision");
    }
  );

  decider.addDecision(
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
          report("Decision 2");
      }
  );

  decider.addDecision(
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

  decider.raiseEvent(Event::Always);
}

int main(int, char**) {
  Test t;
  for (unsigned int i = 0; i < 5; ++i) {
    std::cout << "Round " << i << std::endl;
    t.showActives();
    Decision d = t.next();
    std::cout << "Choice: '" << d.getName() << "'\n\n";
  }
}
