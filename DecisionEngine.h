#pragma once

#include <algorithm>
#include <exception>
#include <functional>
#include <limits>
#include <map>
#include <memory>
#include <set>
#include <string>
#include <vector>

#include "Consideration.h"
#include "Decision.h"
#include "Spline.h"

#ifdef NDEBUG
#include <iostream>
#endif

#if defined(BHUMAN) && BHUMAN
#include "Representations/BehaviorControl/ActivationGraph.h"
#include "Tools/Enum.h"

constexpr float DEFAULT_SCORE = -1.0;
#endif

/** Using these macros, writing addDecision becomes more readable and less
 *  error prone than typing them out.  Note that within the Decision you are
 *  creating, you have access to other values through the following ways:
 *  - Any member of the DecisionEngine instance through the this pointer
 *  - Any member of the Decision instance through a reference
 *  - Any other value defined in the current scope through a reference.
 *    Note that this reference is not const, so any changes made to this
 *    reference are observable by all other Decisions.  Also note that
 *    these references have a shorter lifetime than the lambda expressions
 *    of the Consideration and Action of a Decision, and thus these values
 *    should be static.
 */
#define consideration(DESCRIPTION, RANGE, TRANSFORM, FN) \
  createConsideration(DESCRIPTION, [&]() mutable FN, TRANSFORM, RANGE)
#define actions [&](Decision& theDecision) mutable

// TODO: Fill this with your application-specific list of events.
enum class Event : unsigned int;

#if !defined(__clang__)
/** Overloading std::hash for all enums. */
namespace std {
  template<class E>
  struct hash : public __hash_base<size_t, E>
  {
  public:
      size_t operator()(E __val) const noexcept {
        return static_cast<typename std::underlying_type<E>::type>(__val);
      }
  private:
      using sfinae = typename std::enable_if<std::is_enum<E>::value, E>::type;
  };
}
#endif

using considerations = std::vector<Consideration>;
using events = std::vector<Event>;

/** Only used for labeling in DecisionEngine::addDecision */
class name : public std::string {
  using std::string::string;
};

/** Only used for labeling in DecisionEngine::addDecision */
class description : public std::string {
  using std::string::string;
};

/** Only used for labeling in DecisionEngine::addDecision */
class range : public std::tuple<float, float> {
  using std::tuple<float, float>::tuple;
};

Consideration createConsideration(const description& d,
    UtilityFunction f,
    Spline::SplineFunction s,
    const range& r) {
  return Consideration(d, f, s, std::get<0>(r), std::get<1>(r));
}

class DecisionException : public std::runtime_error {
  public:
    using std::runtime_error::runtime_error;
};

/** Lazily selects a Decision with the highest score from an activated subset.
 *
 * The DecisionEngine selects the optimal Decision, based on its
 * Decision::computeScore.  Each Decision is associated with an Event.  By
 * raising and clearing an Event, you load and unload the associated
 * Decisions into the set of active Decisions.
 */
class DecisionEngine {
  public:
#if !defined(BHUMAN) || !BHUMAN
    DecisionEngine() = default;
#endif

    /** Add a new Decision to the rules.
     *
     * If any of the events is active right now, the new Decision
     * is loaded into the current set of behavior rules.
     */
    void addDecision(const name& n,
        const description& d,
        UtilityScore u,
        events e,
        considerations c,
        const Action& a)
    {
      for (auto event : e) {
        rules[event].emplace_back(n, d, u, c, a);
        updated_events.insert(event);
      }
    }

    /** Load behavior associated with a specific Event.
     *
     * This does not unload behavior associated with any other raised Events.
     * To unload these behaviors, use clearEvent(Event) to remove all
     * Decisions associated to a specific event, or clearActive() to empty the
     * list of active Decisions.
     */
    void raiseEvent(Event e) {
      if (!updated_events.empty()) {
        sort_decisions();
      }
      if (active_events.find(e) == active_events.end()) {
        for (auto& decision : rules[e]) {
          active_rules.emplace_back(e, std::make_shared<Decision>(decision));
        }
        active_events.insert(e);
        sort_active_decisions();
      }
#if defined(BHUMAN) && BHUMAN
      initializeActivationGraph();
#endif
    }

    /** Clear all known behaviors.
     *
     * After this, nothing is loaded, and no Decision will be loaded when any
     * Event is raised.
     */
    void clear() {
      clearActive();
      rules.clear();
    }

    /** Clear all active behavior.
     *
     * After this, use raiseEvent(Event) to load Decisions into the engine.
     */
    void clearActive() {
      active_rules.clear();
      active_events.clear();
    }

    /** Clear Decisions associated with an event.
     *
     * This might leave the engine empty.
     */
    void clearEvent(Event e) {
      active_rules.erase(std::remove_if(active_rules.begin(), active_rules.end(),
            [e](const Rule& entry) {
            return std::get<0>(entry) == e;
            }),
          active_rules.end());
      const auto& it = std::get<0>(active_events.insert(e));
      active_events.erase(it);
#if defined(BHUMAN) && BHUMAN
      initializeActivationGraph();
#endif
    }

    const std::set<Event> getActiveEvents(){
        return active_events;
    }

    /** Select the Decision with the highest score, and run its Action. */
    void executeBestDecision() {
      getBestDecision()->execute();
    }

    /** Select the Decision with the highest score.
     *
     * It should run as lazy as possible.  There is probably some
     * optimization to squeeze out of here.
     */
    std::shared_ptr<Decision> getBestDecision() {
      if (!updated_events.empty()) {
        sort_decisions();
      }
      if (active_rules.empty()) {
        throw DecisionException("Empty active rule set");
      }
      float highest_score = 0.f;
      size_t best_index = 0;

      size_t i = 0;
      for (; i < active_rules.size(); ++i) {
        std::shared_ptr<const Decision> decision = std::get<1>(active_rules[i]);
        float utility = static_cast<float>(decision->getUtility());
#ifdef NDEBUG
        std::cout << "  Computing Decision '" << decision->getName() << "', utility: " << utility << "\n";
#endif
        // Because active_rules is sorted and because for any score s holds
        // 0 <= s <= 1, we are guaranteed not to find
        if (utility < highest_score || utility == 0) {
#ifdef NDEBUG
          std::cout << "    Ignoring this one: ";
          if (utility == 0) std::cout << "utility = 0\n";
          else std::cout << "utility < highest\n";
#endif
          break;
        }
        float score = decision->computeScore();
#if defined(BHUMAN) && BHUMAN
        updateActivationGraph(i, score);
#endif
#ifdef NDEBUG
        std::cout << "    score: " << score << "\n";
#endif
        if (score > highest_score) {
#ifdef NDEBUG
          std::cout << "    High score!\n";
#endif
          highest_score = score;
          best_index = i;
          if (score == utility) {
#ifdef NDEBUG
            std::cout << "    Can't do better than this. Quitting.\n";
#endif
            break;
          }
        }
      }
      if (!highest_score) {
        throw DecisionException("No rule was activated");
      }
#if defined(BHUMAN) && BHUMAN
      activation_graph.get().bestDecisionIndex = best_index;
      finalizeUpdateActivationGraphFromDecision(i + 1);
#endif
      return std::get<1>(active_rules[best_index]);
    }

    /** Return a list of all Decisions which the Engine could use. */
    std::vector<std::shared_ptr<Decision>> getActiveDecisions() {
      std::vector<std::shared_ptr<Decision>> actives;
      actives.reserve(active_rules.size());
      for (auto& rule : active_rules) {
        actives.emplace_back(std::get<1>(rule));
      }
      return actives;
    }

#if defined(BHUMAN) && BHUMAN
    DecisionEngine()
      : activation_graph(dummy_activation_graph)
    {
    }

    DecisionEngine(ActivationGraph& a)
      : activation_graph(a)
    {
    }

    void setActivationGraph(ActivationGraph& a)
    {
      activation_graph = std::reference_wrapper<ActivationGraph>(a);
    }

    ActivationGraph getActivationGraph() {
      return activation_graph;
    }
#endif

  protected:
    using Rule = std::tuple<Event, std::shared_ptr<Decision>>;

    std::map<Event, std::vector<Decision>> rules;
    std::vector<Rule> active_rules;
    std::set<Event> active_events;
    std::set<Event> updated_events;
#if defined(BHUMAN) && BHUMAN
    std::reference_wrapper<ActivationGraph> activation_graph;
    ActivationGraph dummy_activation_graph;
#endif

    /** Sort Decisions in rules and active_rules based on their UtilityScore.
     *
     * It only sorts the containers which have been updated since the last
     * invocation of sort_decisions().
     */
    void sort_decisions() {
      bool do_sort_active_decisions = false;
      for (auto& event : updated_events) {
        std::stable_sort(rules[event].begin(), rules[event].end(),
            [](const Decision& x, const Decision& y) {
                return x.getUtility() > y.getUtility();
            });
        if (!do_sort_active_decisions && active_events.find(event) != active_events.end()) {
          do_sort_active_decisions = true;
        }
        if (do_sort_active_decisions) {
          sort_active_decisions();
        }
      }
      updated_events.clear();
    }

    /** Sorts active decisions based on their UtilityScore. */
    void sort_active_decisions() {
      std::stable_sort(active_rules.begin(), active_rules.end(),
          [](const Rule& x, const Rule& y) {
              return std::get<1>(x)->getUtility() > std::get<1>(y)->getUtility();
          });
    }

#if defined(BHUMAN) && BHUMAN
    void initializeActivationGraph() {
        activation_graph.get().dlist.clear();
        activation_graph.get().dlist.reserve(active_rules.size());
        for (size_t i = 0; i < active_rules.size(); i++) {
            activation_graph.get().dlist.emplace_back(std::get<1>(active_rules[i]).get().getName(), DEFAULT_SCORE);
        }
    }

    void updateActivationGraph(size_t index, float score) {
        activation_graph.get().dlist[index].score = score;
    }

    void finalizeUpdateActivationGraphFromDecision(size_t updated_index) {
        for (size_t i = updated_index; i < active_rules.size(); i++) {
            updateActivationGraph(i, DEFAULT_SCORE);
        }
    }
#endif
};
