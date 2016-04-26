#pragma once

#include <functional>
#include <string>
#include <vector>
#include "Consideration.h"

class Decision;
using Action = std::function<void(const Decision&)>;

/**/
enum class UtilityScore : int {
  Ignore = 0,
  SlightlyUseful = 1,
  Useful = 2,
  VeryUseful = 3,
  MostUseful = 4
};


/** Container for an Action, that can be performed when it seems useful.
 *
 * A Decision is used in the DecisionEngine when it has the highest total 
 * utility score of all active Decisions.  The utility score indicates how 
 * useful it is in the current situation to execute a specific Action.
 *
 * The total utility score is computed as a function of this Decision's 
 * utility, and the scores of its Considerations with Decision::computeScore().
 */
class Decision {
  public:
    Decision(const std::string& name, const std::string& description, UtilityScore utility, std::vector<Consideration> considerations, const Action& action)
      : name(name), 
      description(description),
      utility(utility),
      considerations(considerations),
      action(action)
    {}

    Decision() = default;
    Decision(const Decision& other) = default;
    Decision& operator=(const Decision& other) = default;

    /** Calculate the 'usefulness' of a Decision.
     *
     * This score is a multiplication of its utility and the scores of all
     * its Considerations.  Then, the score will be adjusted with a weighing
     * factor for the number of Considerations.
     *
     * Because all Considerations will return a score between 0 and 1, we 
     * can expect this number to become smaller for Decisions that have more 
     * Considerations.  For example, a Decision A with three Considerations 
     * scoring each 0.9 and utility of 1 has a score of 1 * 0.9 * 0.9 * 0.9 = 
     * 0.729.  Another Decision B with 1 Consideration scoring 0.75 has a 
     * total score of 1 * 0.75 = 0.75.  Intuitively, A should have a higher 
     * score; each of its Considerations indicate that it is very important.  
     * The weighing factor adjusts for this.
     */
    float computeScore() const {
      float score = static_cast<float>(utility);
      for (auto& consideration : considerations) {
        // TODO: Fix weighing
        score *= consideration.computeScore();
        if (score < 1e-6) break;
      }
      return score;
    }

    const std::string& getName() const { return name; }
    const std::string& getDescription() const { return description; }
    UtilityScore getUtility() const { return utility; }
    void setUtility(UtilityScore u) { utility = u; }
    const Action& getAction() const { return action; }

    /** Execute the Action associated with this Decision. */
    void execute() const { action(*this); }

  private:
    std::string name;
    std::string description;
    UtilityScore utility;
    std::vector<Consideration> considerations;
    Action action;
};
