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
 *
 * NOTE: There is no direct link to the C++ code; any changes in the C++ API
 * will require manual changes in this Javascript library.
 */

/* Regular expressions to parse the calls to DecisionEngine::addDecision */
// Decision expressions
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
  + 'Spline::Linear({}),\n'
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
    return $('<label>')
      .text('Globals: ')
      .append($('<textarea>')
        .data('instance', this)
        .addClass('globals')
        .prop('placeholder', 'global variables')
        .prop('rows', 10)
        .prop('cols', 70)
        .change(function (event) { global.cppCode = event.target.val(); return false; })
        .val(this.cppCode));
  }

  toCpp() {
    return this.cppCode;
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
      update: function () {
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

  updateDecisionOrder() {
    let sortedDecisions = [];
    for (let decision of $('#decision_container').find('.decision')) {
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
    return $('<label>')
      .text('Name: ')
      .append($('<input>')
        .data('instance', this)
        .addClass('name')
        .prop('type', 'text')
        .prop('placeholder', 'name')
        .val(this.name)
        .change({owner: this}, function (event) { 
          let name = $(this).val();
          event.data.owner.name = name;
          $(this).parents('.decision_wrapper').find('.decision_label .content').text(name);
          return false; 
        }));
  }

  toCpp() {
    return 'name("' + this.name + '")';
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
    return $('<label>')
      .text('Description: ')
      .append($('<input>')
        .data('instance', this)
        .addClass('description')
        .prop('type', 'text')
        .prop('placeholder', 'description')
        .val(this.description)
        .change({owner: this}, function (event) {
          let description = $(this).val();
          event.data.owner.description = description;
          $(this).parents('.consideration_wrapper').find('.consideration_label .content').text(description);
          return false
        }));
  }

  toCpp() {
    return 'description("' + this.description + '")';
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
      .addClass('utility')
      .change({owner: this}, function (event) {
        event.data.owner.score = $(this).val();
        return false;
      });
    for (let utility in UtilityScore.valid) {
      out.append($('<option>')
        .prop('selected', utility === this.score)
        .val(utility)
        .text(utility));
    }
    return $('<label>')
      .text('Utility score: ')
      .append(out);
  }
  
  toCpp() {
    return 'UtilityScore::' + this.score;
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
        .append($('<label>')
          .text(event)
          .prepend($('<input>')
            .prop('type', 'checkbox')
            .prop('checked', this.events.indexOf(event) !== -1)
            .prop('name', event)
            .val(event)
            .change({owner: this}, function (event) {
              let eventLabel = $(this).val();
              let owner = event.data.owner;
              if ($(this).prop('checked')) {
                if (owner.events.indexOf(eventLabel) === -1) {
                  owner.events.push(eventLabel);
                }
              }
              else {
                let eventIndex = owner.events.indexOf(eventLabel);
                if (eventIndex >= 0) {
                  owner.events.splice(eventIndex, 1);
                }
              }
              return false;
            }))));
    }
    return out;
  }

  toCpp() {
    let cppEvents = this.events.map(function(x){ return 'Event::' + x; });
    return 'events {'
      + cppEvents.join(', ')
      + '}';
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
    return $('<label>')
      .append($('<div>').text('Action: '))
      .append($('<textarea>')
        .data('instance', this)
        .addClass('action')
        .prop('placeholder', 'action')
        .prop('rows', 10)
        .prop('cols', 70)
        .val(this.cppCode)
        .change({owner: this}, function (event) {
          event.data.owner.cppCode = $(this).val();
          return false;
        }));
  }
  
  toCpp() {
    return 'actions {\n'
      + this.cppCode
      + '\n}';
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
    //out.find('input, select, textarea').change(function (event) { updateOnChange(this, event); });
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
      .append($('<label>')
        .text('min range')
        .append($('<input>')
          .addClass('min')
          .prop('type', 'text')
          .prop('placeholder', 'min')
          .val(this.minRange)
          .change({owner: this}, function (event) {
            let newValue = parseFloat($(this).val());
            if (!isNaN(newValue)) {
              event.data.owner.minRange = newValue;
              return false;
            }
          })))
      .append($('<label>')
        .text('max range')
        .append($('<input>')
          .addClass('max')
          .prop('type', 'text')
          .prop('placeholder', 'max')
          .val(this.maxRange)
          .change({owner: this}, function (event) {
            let newValue = parseFloat($(this).val());
            if (!isNaN(newValue)) {
              event.data.owner.maxRange = newValue;
              return false;
            }
          })));
  }
  
  toCpp() {
    return 'range(' + this.minRange + ', ' + this.maxRange + ')';
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
    return $('<label>')
      .append($('<div>').text('Utility function: '))
      .append($('<textarea>')
        .data('instance', this)
        .addClass('utility_function')
        .prop('placeholder', 'utility function')
        .prop('rows', 10)
        .prop('cols', 70)
        .val(this.cppCode)
        .change({owner: this}, function (event) {
          event.data.owner.cppCode = $(this).val();
        }));
  }

  toCpp() {
    return '{\n'
      + this.cppCode
      + '\n}';
  }
}

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
    let ids = splineId.split('_');
    let decisionId = ids[1];
    let considerationId = ids[2];
    return intelligence.decisions.find(function (d) {
      return d.id == decisionId;
    })
      .considerations.find(function (c) {
        return c.id == considerationId;
      })
      .spline;
  }

  constructor(consideration, interpolation, splinePoints) {
    this.decisionId = consideration.parentDecision.id;
    this.considerationId = consideration.id;
    this.id = 'spline_' + this.decisionId + '_' + this.considerationId;
    
    window.sessionStorage.setItem(this.id + ',width', 500);
    window.sessionStorage.setItem(this.id + ',height', 300);
    
    this.parentConsideration = consideration;
    this.setPoints(splinePoints);
    this.setInterpolation(interpolation);
    this.interpolation = interpolation;
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
      .data('instance', spline)
      .append($('<div>')
        .append($('<label>')
            .text('Interpolation: ')
            .append(types)))
      .append($('<iframe>')
        .addClass('spline')
        .prop('id', this.id)
        .width(window.sessionStorage.getItem(this.id + ',width'))
        .height(window.sessionStorage.getItem(this.id + ',height'))
        .prop('src', 'spline_designer.html?id=' + this.id));
  }

  get maxRange() {
    return this.parentConsideration.range.maxRange;
  }

  get minRange() {
    return this.parentConsideration.range.minRange;
  }
  
  setPoints(pointString) {
    let minRange = this.minRange;
    let maxRange = this.maxRange;
    let width = window.sessionStorage.getItem(this.id + ',width');
    let height = window.sessionStorage.getItem(this.id + ',height');
    
    let pointsStripped = pointString.replace(/\{\s*\{/, '{');
    pointsStripped = pointsStripped.replace(/\}\s*\}/, '}');

    this.points = [];
    let pattern = /\{(\s*\d+.?\d*)f?\s*,\s*(\s*\d+.?\d*)f?\}/g;
    let match = pattern.exec(pointsStripped);
    while (match !== null) {
      // Transform coordinate system from (minRange,maxRange) x (0,1)
      // to (0,width) x (0,height)
      let x = parseFloat(match[1]);
      let y = parseFloat(match[2]);
      x = (x - minRange) / (maxRange - minRange) * width;
      y = height - (y * height);
      this.points.push([x, y]);
      match = pattern.exec(pointsStripped);
    }
    window.sessionStorage.setItem(this.id + ',points', JSON.stringify(this.points));
  }
  
  pointsToCpp() {
    let minRange = this.minRange;
    let maxRange = this.maxRange;

    let width = window.sessionStorage.getItem(this.id + ',width');
    let height = window.sessionStorage.getItem(this.id + ',height');
    
    let point_strings = [];
    let editor_points = JSON.parse(window.sessionStorage.getItem(this.id + ',points'));
    for (let point of editor_points) {
      // Transform coordinate system from SVG's (0,width) x (0,height)
      // to (minRange,maxRange) x (0,1)
      let x = point[0] / width * (maxRange - minRange) + minRange;
      let y = (height - point[1]) / height;
      point_strings.push('{' + numberToCppString(x) + ', ' + numberToCppString(y) + '}');
    }
    return '{' + point_strings.join(', ') + '}';
  }

  toCpp() {
    return 'Spline::' + this.interpolation + '('
      + this.pointsToCpp()
      + ')';
  }
  
  update(key, value) {
    if (key === 'points') {
      //this.points = value;
    }
    else if (key === 'interpolation') {
      this.interpolation = value;
    }
    return false;
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
    this.spline = new Spline(this, splineType, splinePoints);
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
    //out.find('input, select, textarea').change(function (event) { updateOnChange(this, event); });
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

  remove() {
    this.parentDecision.removeConsideration(this.id);
  }

  duplicate() {
    this.parentDecision.duplicateConsideration(this.id);
  }
}

function numberToCppString(number) {
  return number.toString() + (Number.isInteger(number) ? '.f' : 'f');
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
      $('#globals_container')
        .empty()
        .append(globals.toHtml());
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
      $('#intelligence_container')
        .empty()
        .append(intelligence.toHtml());
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

$(document).ready(function() {
  let mouseLastHoverSection = 'decisions_section';
  let splineHovered = null;

  $('#globals_section + #decisions_section').mouseenter(function (event) {
    mouseLastHoverSection = $(event.target).prop('id');
  });
  
  $(document)
    .on('mouseenter', 'iframe', function (event) {
      splineHovered = $(event.target).prop('id');
    })
    .on('mouseleave', 'iframe', function () {
      splineHovered = null;
    })
  ;

  $(window).keydown(function(event) {
    let eventKey = String.fromCodePoint(event.which);
    if (event.ctrlKey && (eventKey === 's' || eventKey === 'S')) {
      if (mouseLastHoverSection === 'globals_section' && globals !== null) {
        $('#getGlobals').click();
        event.preventDefault();
      }
      else if (mouseLastHoverSection === 'decisions_section' && intelligence != null) {
        $('#getDecisions').click();
        event.preventDefault();
      }
    }
    else if (event.which === 8 || event.which === 46) {// Backspace or Delete
      if (splineHovered !== null) {
        window.sessionStorage.setItem(splineHovered + ',remove', true);
        event.preventDefault();
      }
    }
  });
  
  $(window).on('storage', function (e) {
    e = e.originalEvent;
    if (intelligence.decisions && e.key.startsWith('spline')) {
      let specifier = e.key.split(',');
      Spline.findById(specifier[0]).update(specifier[1], e.newValue);
    }
  });

});
