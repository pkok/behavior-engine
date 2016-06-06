'use strict';

/**
 * This library provides a graphical editor and viewer for this C++
 * DecisionEngine's collection of Decisions.  It can read in a file with
 * calls to DecisionEngine::addDecision, render this graphically, and generate
 * an edited list of calls to DecisionEngine::addDecision.
 *
 * Each of the types involved in adding a decision to a DecisionEngine have
 * a correspondingly named type in this library.  Each of these types have
 * at least two methods:
 *   - toCpp(), which generates a string that is a partial C++ expression that
 *     represents this object.
 *   - toHtml(), which generates a HTML representation of this object.
 *   - update(jQueryElement) or update(arrayOfjQueryElements), which either
 *     adjusts the value of a type's field to reflect the state of the HTML
 *     document, or delegates the update to a field's own update() function.
 *
 * NOTE: There is no direct link to the C++ code; any changes in the C++ API
 * will require manual changes in this Javascript library.
 */

/* Regular expressions to parse the calls to DecisionEngine::addDecision */
// Decision expressions
const idNumberExpression        = /\d+\s*$/;
const decisionExpression        = /addDecision\(/g;
const nameExpression            = /name\(\s*['"](.*)['"]\s*\)\s*,/;
const utilityExpression         = /UtilityScore::(.*)\s*,/;
const eventsExpression          = /events\s*\{(?:\s*Event::\w+\s*,)*(?:(?:\s*Event::\w+\s*),?)?\s*\}\s*,/;
const singleEventExpression     = /Event::(\w+)/g;
const actionExpression          = /actions\s*\{([\s\S]*)\s*\}/;

// Consideration expressions
const considerationExpression   = /consideration\(/g;
const rangeExpression           = /range\(\s*(.*?),\s*(.*?)\s*\)\s*,/;
const splineExpression          = /Spline::(\w+)\((.+)\)\s*,\s*{/;

// Shared expressions
const descriptionExpression     = /description\(\s*['"](.*)['"]\s*\)\s*,/;

// Example of an empty Decision in C++
const emptyDecisionCpp = 'addDecision(\n'
  + 'name("New Decision"),\n'
  + 'description(""),\n'
  + 'UtilityScore::Useful,\n'
  + 'events {},\n'
  + 'considerations {},\n'
  + 'actions {}\n'
  + ');';
// Example of an empty Consideration in C++
const emptyConsiderationCpp = 'consideration('
  + 'description("New Consideration"),\n'
  + 'range(0, 1),\n'
  + 'Spline::Linear({{0, 0}, {1, 1}}),\n'
  + '{}\n'
  + '),';

var globals = null;
var intelligence = null;

class Globals
{
  constructor(globalsText) {
    this.cppCode = globalsText.trim();
  }

  toHtml() {
    let global = this;
    return $('<textarea>')
      .data('instance', this)
      .addClass('globals')
      .prop('placeholder', 'global variables')
      .prop('rows', 10)
      .prop('cols', 70)
      .change(function (event) { return global.update($(event.target)); })
      .val(this.cppCode);
  }

  toCpp() {
    return this.cppCode;
  }

  update(element) {
    if (element.hasClass('globals')) {
      this.cppCode = element.val();
      return true;
    }
    return false;
  }
}

//noinspection JSDuplicatedDeclaration
class Intelligence
{
  constructor(intelligenceText) {
    this.decisions = [];

    // Parse file
    let match = decisionExpression.exec(intelligenceText);
    this.decisionId = 0;
    while (match !== null) {
      let startPos = match.index + match[0].length-1;
      let endPos = findClosingBracket(intelligenceText, startPos, 'normal');

      if (endPos !== -1) {
        let decisionText = intelligenceText.substr(startPos, endPos - startPos + 1);
        let theDecision = new Decision(this.decisionId++, decisionText);
        this.decisions.push(theDecision);
      }
      match = decisionExpression.exec(intelligenceText);
    }
  }

  toHtml() {
    let that = this;
    let out = $('<div>').prop('id', 'decision_container');
    out.sortable({
      axis: 'y',
      start: function (event, ui) {
        ui.item.accordion('disable');
      },
      stop: function (event, ui) {
        // For IE.
        ui.item.children('div:odd').triggerHandler('focusout');
        // Prevent accordion to open after the sort has stopped.
        window.setTimeout(function () { ui.item.accordion('enable'); }, 30);
      },
      update: function (event, ui) {
        that.updateDecisionOrder();
      }
    });
    for (let decision of this.decisions) {
      out.append(decision.toHtml());
    }
    return out;
  }

  toCpp() {
    let out = '';
    for (let decision of this.decisions) {
      out += decision.toCpp()
        + '\n';
    }
    return out;
  }

  addEmptyDecision() {
    this.decisions.unshift(new Decision(this.decisionId++, emptyDecisionCpp));
    $('#decision_container').prepend(this.decisions[0].toHtml());
  }

  duplicateDecision(decisionId) {
    let decisionIndex = this.decisions.findIndex(function (d) { return d.id == decisionId; });
    if (decisionIndex !== -1) {
      let decision = this.decisions[decisionIndex];
      let newDecision = new Decision(this.decisionId, decision.toCpp());
      this.decisions.splice(decisionIndex, 0, newDecision);
      newDecision.toHtml().insertBefore($(' .decision_wrapper:nth-child(' + (decisionIndex+1) + ')'));
    }
  }

  update(elementStack) {
    let decision = elementStack.pop().data('instance');
    if (decision) {
      decision.update(elementStack);
      return true;
    }
    console.error('Looking for decision#' + decisionIndex + ', but not found');
    return false
  }

  updateDecisionOrder() {
    let sortedDecisions = [];
    for (let decision of $('#decision_container .decision')) {
      sortedDecisions.push($(decision).data('instance'));
    }
    this.decisions = sortedDecisions;
  }
  
  removeDecision(decisionId) {
    let decisionIndex = this.decisions.findIndex(function (d) { return d.id == decisionId; });
    if (decisionIndex !== -1) {
      return this.decisions.splice(decisionIndex, 1);
    }
    return undefined;
  }
}


/**
 * Wrapper for C++'s name type.
 */
class Name
{
  constructor(name) {
    this.name = name.trim();
  }

  toHtml() {
    return $('<input>')
      .data('instance', this)
      .addClass('name')
      .prop('type', 'text')
      .prop('placeholder', 'name')
      .val(this.name);
  }

  toCpp() {
    return 'name("' + this.name + '")';
  }

  update(element) {
    if (element.hasClass('name')) {
      this.name = element.val();
      element.parent().prev('.decision_label').children('.content').text(this.name);
      return true;
    }
    return false;
  }
}


/**
 * Wrapper for C++'s description type.
 */
class Description
{
  constructor(description) {
    this.description = description.trim();
  }

  toHtml() {
    return $('<input>')
      .data('instance', this)
      .addClass('description')
      .prop('type', 'text')
      .prop('placeholder', 'description')
      .val(this.description);
  }

  toCpp() {
    return 'description("' + this.description + '")';
  }

  update(element) {
    if (element.hasClass('description')) {
      this.description = element.val();
      element.parent().prev('.consideration_label').children('.content').text(this.description);
      return true;
    }
    return false;
  }
}

/**
 * Validator and wrapper for C++'s UtilityScore values.
 *
 * A list of all members of C++'s UtilityScore enumeration is checked to see
 * if this score is valid.
 */
class UtilityScore
{
  static get valid() {
    return {
      'Ignore': 0,
      'SlightlyUseful': 1,
      'Useful': 2,
      'VeryUseful': 3,
      'MostUseful': 4
    };
  }

  constructor(scoreLabel) {
    if (!(scoreLabel in UtilityScore.valid)) {
      throw new Error('"' + scoreLabel  + '" is not a valid UtilityScore');
    }
    this.score = scoreLabel;
  }

  toHtml() {
    let out = $('<select>')
      .data('instance', this)
      .addClass('utility');
    for (let utility in UtilityScore.valid) {
      out.append($('<option>')
        .prop('selected', utility === this.score)
        .val(utility)
        .text(utility));
    }
    return out;
  }
  
  toCpp() {
    return 'UtilityScore::' + this.score;
  }

  update(element) {
    if (element.hasClass('utility')) {
      let newScore = element.val();
      if (!(newScore in UtilityScore.valid)) {
        throw new Error('"' + newScore + '" is not a valid UtilityScore');
      }
      this.score = newScore;
      return true;
    }
    return false;
  }
}

/**
 * Validator and wrapper for C++'s Event values.
 *
 * A list of all members of C++'s Event enumeration is checked to see
 * if this score is valid.
 *
 * Users of this codebase normally implement their own Events.  If they do,
 * they should update this list accordingly.
 */
class Events
{
  static get valid() {
    return [
      'Always',
      'Ignore',
      'Penalized',
      'GameStateInitial',
      'GameStateReady',
      'GameStateSet',
      'GameStatePlaying',
      'GameStateFinished'
    ];
  }

  constructor(eventLabels) {
    for (let eventLabel of eventLabels) {
      if (Events.valid.indexOf(eventLabel) === -1) {
        throw new Error('"' + eventLabel + '" is not a valid Event');
      }
    }
    this.events = eventLabels;
  }

  toHtml() {
    let out = $('<ul>').addClass('events').data('instance', this);
    for (let event of Events.valid) {
      out.append($('<li>')
        .append($('<input>')
          .prop('type', 'checkbox')
          .prop('checked', this.events.indexOf(event) !== -1)
          .prop('name', event)
          .val(event))
        .append(document.createTextNode(event)));
    }
    return out;
  }

  toCpp() {
    let cppEvents = this.events.map(function(x){ return 'Event::' + x; });
    return 'events {'
      + cppEvents.join(', ')
      + '}';
  }

  update(elementStack) {
    if (elementStack.pop().hasClass('events')) {
      elementStack.pop(); // LI element
      let checkbox = elementStack.pop();
      if (!elementStack.length) {
        let eventLabel = checkbox.val();
        if (Events.valid.indexOf(eventLabel) === -1) {
          throw new Error('"' + eventLabel + '" is not a valid Event');
        }
        if (checkbox.prop('checked')) {
          if (this.events.indexOf(eventLabel) === -1) {
            this.events.push(eventLabel);
          }
          return true;
        }
        else { // remove event from this.events
          let eventIndex = this.events.indexOf(eventLabel);
          if (eventIndex >= 0) {
            this.events.splice(eventIndex, 1);
          }
          return true;
        }
      }
    }
    return false;
  }
}


/**
 * Wrapper for C++'s Action type.
 */
class Action
{
  constructor(cppCode) {
    this.cppCode = cppCode.trim();
  }

  toHtml() {
    return $('<div>').text('Action:')
      .add($('<textarea>')
          .data('instance', this)
          .addClass('action')
          .prop('placeholder', 'action')
          .prop('rows', 10)
          .prop('cols', 70)
          .val(this.cppCode));
  }
  
  toCpp() {
    return 'actions {\n'
      + this.cppCode
      + '\n}';
  }

  update(element) {
    if (element.hasClass('action')) {
      this.cppCode = element.val();
      return true;
    }
    return false;
  }
}


/**
 * Wrapper and parser for C++'s Decision type.
 *
 * It delegates further parsing of the C++ code for creating a Decision.
 */
class Decision
{
  constructor(id, decisionText) {
    // Set decision information
    this.id = id;
    this.name = new Name(nameExpression.exec(decisionText)[1]);
    this.description = new Description(descriptionExpression.exec(decisionText)[1]);
    this.utility = new UtilityScore(utilityExpression.exec(decisionText)[1]);
    window.sessionStorage.setItem('decision_' + this.id +',utilityScore', UtilityScore.valid[this.utility.score]);
    this.action = new Action(actionExpression.exec(decisionText)[1]);
    this.considerations = [];
    
    let eventsText = eventsExpression.exec(decisionText)[0];
    let eventLabels = [];
    let match = singleEventExpression.exec(eventsText);
    while (match !== null) {
      eventLabels.push(match[1]);
      match = singleEventExpression.exec(eventsText);
    }
    this.events = new Events(eventLabels);

    // Parse considerations
    this.conId = 0;
    match = considerationExpression.exec(decisionText);
    while (match !== null) {
      let startPos = match.index /*+ match[0].length*/ - 1;
      let endPos = findClosingBracket(decisionText, startPos, 'normal');
      let considerationText = decisionText.substr(startPos, endPos - startPos + 1);

      this.considerations.push(new Consideration(this, this.conId++, considerationText));
      match = considerationExpression.exec(decisionText)
    }
  }

  addConsideration(considerationText) {
    this.considerations.unshift(new Consideration(this, this.conId++, considerationText));
    $('#decision_' + this.id + ' .considerations').prepend(this.considerations[0].toHtml());
  }
  
  addEmptyConsideration() {
    this.addConsideration(emptyConsiderationCpp);
  }

  duplicateConsideration(considerationId) {
    let considerationIndex = this.considerations.findIndex(function (d) { return d.id == considerationId; });
    if (considerationIndex !== -1) {
      let consideration = this.considerations[considerationIndex];
      let newConsideration = new Consideration(this, this.conId, consideration.toCpp());
      this.considerations.splice(considerationIndex, 0, newConsideration);
      newConsideration.toHtml().insertBefore($('#decision_' + this.id + ' .consideration_wrapper:nth-child(' + (considerationIndex+1) + ')'));
    }
  }

  duplicate() {
    intelligence.duplicateDecision(this.id);
  }

  toHtml() {
    let decision = this;
    let considerations = $('<div>').addClass('considerations');
    considerations.each(function (_, element) {
      $(element).sortable({
        axis: 'y',
        start: function (event, ui) {
          ui.item.accordion('disable');
        },
        stop: function (event, ui) {
          // For IE.
          ui.item.children('div:odd').triggerHandler('focusout');
          // Prevent accordion to open after the sort has stopped.
          window.setTimeout(function () { ui.item.accordion('enable'); }, 30);
        },
        update: function () {
          decision.updateConsiderationOrder();
        }
      });
    });
    
    for (let consideration of this.considerations) {
      considerations.append(consideration.toHtml());
    }
    
    let out = $('<div>')
      .data('instance', this)
      .addClass('decision_wrapper')
      .append(createLabel(this.name.name, 'decision_label'))
      .append($('<div>')
        .data('instance', this)
        .addClass('decision')
        .prop('id', 'decision_' + this.id)
        .append(this.name.toHtml())
        .append(this.description.toHtml())
        .append(this.utility.toHtml())
        .append(this.events.toHtml())
        .append($('<input>')
          .addClass('addConsideration')
          .addClass('control-add')
          .prop('type', 'button')
          .val('\u2731')
          .click(function() {
            decision.addEmptyConsideration();
          }))
        .append(considerations)
        .append(this.action.toHtml()))
      .accordion({
        active: false,
        collapsible: true,
        header: '.decision_label',
        heightStyle: 'content',
        icons: false
      });
    out.find('input, select, textarea').change(function (event) { updateOnChange(this, event); });
    return out;
  }

  toCpp() {
    let cppConsiderations = this.considerations.map(function(x){ return x.toCpp(); });
    return 'addDecision(\n'
      + this.name.toCpp() + ',\n'
      + this.description.toCpp() + ',\n'
      + this.utility.toCpp() + ',\n'
      + this.events.toCpp() + ',\n'
      + 'considerations {\n'
      + cppConsiderations.join(',\n')
      + '},\n'
      + this.action.toCpp()
      + ');\n';
  }

  update(elementStack) {
    let top = elementStack.pop();
    if (top.hasClass('considerations')) {
      let consideration = elementStack.pop().data('instance');
      return consideration ? consideration.update(elementStack) : false;
    }
    else if (top.hasClass('events')) {
      elementStack.push(top);
      return this.events.update(elementStack);
    }
    else if (!elementStack.length) {
      if (top.hasClass('name')) {
        return this.name.update(top);
      }
      else if (top.hasClass('description')) {
        return this.description.update(top);
      }
      else if (top.hasClass('utility')) {
        return this.utility.update(top)
          && (window.sessionStorage.setItem('decision_' + this.id +',utilityScore', UtilityScore.valid[this.utility.score])
            || true);
      }
      else if (top.hasClass('action')) {
        return this.action.update(top);
      }
    }
    return false;
  }

  updateConsiderationOrder() {
    let sortedConsideration = [];
    for (let consideration of $('#decision_' + this.id + ' .considerations .consideration')) {
      sortedConsideration.push($(consideration).data('instance'));
    }
    this.considerations = sortedConsideration;
  }

  removeConsideration(considerationId) {
    let considerationIndex = this.considerations.findIndex(function (d) { return d.id == considerationId; });
    if (considerationIndex !== -1) {
      return this.considerations.splice(considerationIndex, 1);
    }
    return undefined;
  }
  
  remove() {
    intelligence.removeDecision(this.id);
  }
}


/**
 * Wrapper for C++'s range type.
 */
class Range
{
  constructor(regexRangeMatch) {
    if (regexRangeMatch.length !== 3) {
      throw new Error('Range needs 2 arguments');
    }
    this.minRange = parseFloat(regexRangeMatch[1]);
    this.maxRange = parseFloat(regexRangeMatch[2]);
  }

  toHtml() {
    return $('<span>')
      .data('instance', this)
      .addClass('range')
      .append($('<input>')
        .addClass('min')
        .prop('type', 'text')
        .prop('placeholder', 'min')
        .val(this.minRange))
      .append($('<input>')
        .addClass('max')
        .prop('type', 'text')
        .prop('placeholder', 'max')
        .val(this.maxRange));
  }
  
  toCpp() {
    return 'range(' + this.minRange + ', ' + this.maxRange + ')';
  }

  update(element) {
    let newValue = parseFloat(element.val());
    if (!isNaN(newValue)) {
      if (element.hasClass('min')) {
        this.minRange = newValue;
        return true;
      }
      else if (element.hasClass('max')) {
        this.maxRange = newValue;
        return true;
      }
    }
    return false;
  }
}


/**
 * Wrapper for C++'s UtilityFunction type.
 */
class UtilityFunction
{
  constructor(cppCode) {
    this.cppCode = cppCode.trim();
  }
  
  toHtml() {
    return $('<div>').text('Utility Function:')
      .add($('<textarea>')
          .data('instance', this)
          .addClass('utility_function')
          .prop('placeholder', 'utility function')
          .prop('rows', 10)
          .prop('cols', 70)
          .val(this.cppCode));
  }

  toCpp() {
    return '{\n'
      + this.cppCode
      + '\n}';
  }

  update(element) {
    if (element.hasClass('utility_function')) {
      this.cppCode = element.val();
      return true;
    }
    return false;
  }
}

window.addEventListener('storage', function (e) {
  if (intelligence.decisions && e.key.startsWith('spline')) {
    let specifier = e.key.split(',');
    Spline.findById(specifier[0]).update(specifier[1], e.newValue);
  }
});

class Spline {
  static get valid() {
    return {
      'Linear': 'linear',
      'StepBefore': 'step-before',
      'StepAfter': 'step-after',
      'Monotone': 'monotone'
    };
  }
  
  static findById(splineId) {
    let decisionId = window.sessionStorage.getItem(splineId + ',decision');
    let considerationId = window.sessionStorage.getItem(splineId + ',consideration');
    return intelligence.decisions.find(function (d) {
      return d.id == decisionId;
    })
      .considerations.find(function (c) {
        return c.id == considerationId;
      })
      .spline;
  }

  constructor(decisionId, considerationId, range, interpolation, splinePoints) {
    this.id = 'spline_' + decisionId + '_' + considerationId;
    this.range = range;
    this.points = splinePoints;
    this.setInterpolation(interpolation);
    this.interpolation = interpolation;

    window.sessionStorage.setItem(this.id + ',decision', decisionId);
    window.sessionStorage.setItem(this.id + ',consideration', considerationId);
    window.sessionStorage.setItem(this.id + ',points', this.points);
    window.sessionStorage.setItem(this.id + ',minRange', this.range.minRange);
    window.sessionStorage.setItem(this.id + ',maxRange', this.range.maxRange);
  }

  setInterpolation(interpolation) {
    this.interpolation = interpolation;
    window.sessionStorage.setItem(this.id + ',interpolation', Spline.valid[interpolation]);
  }
  
  toHtml() {
    let spline = this;
    let types = $('<select>');
    for (let t in Spline.valid) {
      types.append($('<option>')
        .val(t)
        .text(t)
        .prop('selected', t === this.interpolation));
    }
    types.change(function() { spline.setInterpolation($(this).val()); });
    return $('<div>')
      .append($('<div>')
        .append($('<label>')
            .text('Interpolation: ')
            .append(types)))
      .append($('<iframe>')
        .addClass('spline')
        .width(500)
        .height(300)
        .prop('src', 'spline_designer.html?id=' + this.id));
  }

  toCpp() {
    return 'Spline::' + this.interpolation + '('
      + this.points
      + ')\n';
  }
  
  update(key, value) {
    if (key === 'points') {
      this.points = value;
      return true;
    }
    else if (key === 'interpolation') {
      this.interpolation = value;
    }
    return false;
  }

  updateRange(range) {
    this.range = range;
  }
}

/**
 * Wrapper for C++'s Consideration type.
 *
 * It delegates further parsing of the C++ code for creating a Consideration.
 */
class Consideration
{
  constructor(parentDecision, id, considerationText) {
    let splineInfo = splineExpression.exec(considerationText);
    let splineType = splineInfo[1];
    let splinePoints = splineInfo[2];
    let utilityFunctionStartPos = splineInfo.index + splineInfo[0].length;
    let utilityFunctionLength = findClosingBracket(considerationText, utilityFunctionStartPos, 'curly')
      - utilityFunctionStartPos;

    this.id = id;
    this.parentDecision = parentDecision;
    this.description = new Description(descriptionExpression.exec(considerationText)[1]);
    this.range = new Range(rangeExpression.exec(considerationText));
    this.spline = new Spline(this.parentDecision.id, this.id, this.range, splineType, splinePoints);
    this.utilityFunction = new UtilityFunction(considerationText.substr(utilityFunctionStartPos, utilityFunctionLength));
  }

  toHtml() {
    let out = $('<div>')
      .data('instance', this)
      .addClass('consideration_wrapper')
      .append(createLabel(this.description.description, 'consideration_label'))
      .append($('<div>')
        .data('instance', this)
        .addClass('consideration')
        .prop('id', 'consideration_' + this.parentDecision.id + '_' + this.id)
        .append(this.description.toHtml())
        .append(this.range.toHtml())
        .append(this.spline.toHtml())
        .append(this.utilityFunction.toHtml()));
    out.accordion({
      active: false,
      collapsible: true,
      header: '.consideration_label',
      heightStyle: 'content',
      icons: false
    });
    out.find('input, select, textarea').change(function (event) { updateOnChange(this, event); });
    return out;
  }

  toCpp() {
    return 'consideration(\n'
      + this.description.toCpp() + ',\n'
      + this.range.toCpp() + ',\n'
      + this.spline.toCpp() + ',\n'
      + this.utilityFunction.toCpp() + '\n'
      + ')';
  }

  update(elementStack) {
    elementStack.pop(); // remove wrapper
    let top = elementStack.pop();
    if (top.hasClass('range')) {
      if (elementStack.length !== 1) {
        return false;
      }
      return this.range.update(elementStack[0]) && this.spline.updateRange(this.range);
    }
    else if (!elementStack.length) {
      if (top.hasClass('description')) {
        return this.description.update(top);
      }
      else if (top.hasClass('utility_function')) {
        return this.utilityFunction.update(top);
      }
    }
    return false;
  }

  remove() {
    this.parentDecision.removeConsideration(this.id);
  }

  duplicate() {
    this.parentDecision.duplicateConsideration(this.id);
  }
}

function createLabel(content, labelClass) {
  let out = $('<div>')
    .addClass(labelClass === undefined ? 'label' : labelClass)
    .append($('<span>')
      .addClass('content')
      .text(content))
    // A ** symbol to duplicate this item
    .append($('<span>')
      .addClass('controls')
      .append($('<input>')
        .prop('type', 'button')
        .addClass('label-duplicate')
        .addClass('control-duplicate')
        .prop('title', 'Duplicate')
        .val('\u2042')
        .click(function() {
          let item = out.parent().first().data('instance');
          item.duplicate();
        }))
      // A cross symbol to remove this item
      .append($('<input>')
        .prop('type', 'button')
        .addClass('label-cross')
        .addClass('control-delete')
        .prop('title', 'Delete')
        .val('\u274C')
        .click(function() {
          let item = out.parent().first();
          let duration = 400; // ms

          item.data('instance').remove();
          item.animate({height: '0px'}, duration);
          window.setTimeout(function () { item.remove(); }, duration);
        })));
  if (labelClass === 'consideration_label') {
    out.find('.controls')
      .prepend($('<input>')
        .prop('type', 'button')
        .addClass('label-move')
        .addClass('control-move')
        .prop('title', 'Move Consideration to another Decision')
        .val('\u21F5')
        .click(function(event) {
          let consideration = out.parent().first().data('instance');
          decisionSelectorPopup(
            event.pageX,
            event.pageY,
            consideration.toCpp(),
            function () {
              consideration.parentDecision.removeConsideration(consideration.id);
              out.closest('.consideration_wrapper').remove();
            });
        }));
  }

  return out;
}

function decisionSelectorPopup(posX, posY, considerationText, removeCallback) {
  let out = $('<div>')
    .prop('class', 'popup')
    .css('top', posY)
    .css('left', posX);
  out.text("Move this Consideration to which Decision?");
  let id_storage = {};
  for (let decision of intelligence.decisions) {
    let id = 'popup_decision_' + decision.id;
    out.append($('<div>')
      .prop('id', id)
      .text(decision.name.name));
    id_storage[id] = decision;
  }
  let handler = function (event) {
    let id = $(event.target).prop('id');
    if (id in id_storage) {
      id_storage[id].addConsideration(considerationText);
      removeCallback();
    }
    $(document).unbind('click', handler);
    out.remove();
  };
  $('body').append(out);
  window.setTimeout(function () { $(document).click(handler); }, 30);
  //$(document).click(handler);
}

/** Finds the closing bracket of a given opening bracket.
 *
 * This is used to help parsing C++ code.
 */
function findClosingBracket(text, openPosition, bracketType) {
  let inString = false;
  let count = 1;
  let pos = openPosition + 1;

  let o = '(';
  let c = ')';
  if (bracketType === 'curly') {
    o = '{';
    c = '}';
  }
  while (count !== 0 && pos < text.length) {
    let char = text[pos];
    switch (char) {
      case '\"':
        if (text[pos-1] !== '\\')
          inString = !inString;
        break;
      case o:
        if (!inString)
          count++;
        break;
      case c:
        if (!inString)
          count--;
        break;
    }
    if (count === 0)
      return pos;
    pos++;
  }
  return -1;
}

function readGlobalsFile(evt) {
  let f = evt.target.files[0];
  if (f) {
    let r = new FileReader();
    r.onload = function (e) {
      let content = e.target.result;
      globals = new Globals(content);
      $('#globals_container').empty();
      $('#globals_container').append(globals.toHtml());
    };
    r.readAsText(f);
  } else {
    console.error('Failed to load file');
  }
}
/**
 * Read a C++ file with only calls to DecisionEngine::addDecision, and parse it.
 *
 * This functions requires a HTML input element with type="file" as input.
 * When the file is loaded, it creates an Intelligence object that is a
 * Javascript representation of the set of Decisions.
 */
function readDecisionFile(evt) {
  let f = evt.target.files[0];
  if (f) {
    let r = new FileReader();
    r.onload = function (e) {
      let content = e.target.result;
      intelligence = new Intelligence(content);
      $('#intelligence_container').empty();
      $('#intelligence_container').append(intelligence.toHtml());
    };
    r.readAsText(f);
  } else {
    console.error('Failed to load file');
  }
}

function downloadHeaderFile(content, fileName) {
  let data = new File([content], fileName, {type: 'application/prs.decision-engine'});
  let textFile = window.URL.createObjectURL(data);
  window.open(textFile);
  window.URL.revokeObjectURL(textFile);
}

/**
 * Given a changed HTML element, update the corresponding Javascript object.
 *
 * This function expects to be bound by jQuery on a "change" event of any
 * select, input or textarea elements in the environment.
 *
 * It expects a jQuery representation of the changed HTML element, and the
 * event.  It builds a stack of parent elements of this HTML element, until
 * the div.decision element is reached.  The function then makes a call to
 * the global variable intelligence's update method.
 */
function updateOnChange(element, event) {
  let stack = [$(element)];
  while (true) {
    let ancestor = stack[stack.length - 1].parent();
    stack.push(ancestor);
    if (ancestor.hasClass('decision')) {
      break;
    }
    else if (ancestor.is('html')) {
      throw new Error('Malformed HTML document: no element with class="decision" found.');
    }
  }
  if (!intelligence.update(stack)) {
    console.error('The intelligence is not updated correctly!');
  }
}

$(document).ready(function() {
  let mouseLastHoverSection = 'decisions_section';

  $('#globals_section + #decisions_section').mouseenter(function (event) {
    mouseLastHoverSection = $(event.target).prop('id');
  });
  
  $(window).keydown(function(event) {
    if (!((event.which == 115 || event.which == 83) && event.ctrlKey) && !(event.which == 19)) return true;
    if (mouseLastHoverSection === 'globals_section' && globals !== null) {
      // downloadHeaderFile(globals.toCpp(), $('#globals_file').val());
      $('#getGlobals').click();
    }
    else if (mouseLastHoverSection === 'decisions_section' && intelligence != null) {
      // downloadHeaderFile(intelligence.toCpp(), $('#decisions_file').val());
      $('#getDecisions').click();
    }
    event.preventDefault();
    return false;
  });
});
