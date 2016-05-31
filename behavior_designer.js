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
const nameExpression            = /name\(\s*['"](.*)['"]\s*\)/;
const utilityExpression         = /UtilityScore::(.*),/;
const eventsExpression          = /events\s*\{\s*Event::(.*?)\s*(?:,\s*Event::(.*?)\s*)?\}\s*,/;
const actionExpression          = /actions \{\n([\s\S]*)\n\s*}/;

// Consideration expressions
const considerationExpression   = /consideration\(/g;
const rangeExpression           = /range\(\s*(.*?),\s*(.*?)\s*\)\s*,/;
const transformExpression       = /Transform::\s*(\S*?)\s*\((.*?)(?:,(.*?))*\)/;
const inputExpression           = /Transform::.*?\(.*?\), \{/;

// Shared expressions
const descriptionExpression     = /description\(\s*['"](.*)['"]\s*\)/;

var intelligence = null;

//noinspection JSDuplicatedDeclaration
class Intelligence
{
  constructor(intelligenceText) {
    this.decisions = [];

    // Parse file
    let match = decisionExpression.exec(intelligenceText);
    let id = 0;
    while (match !== null) {
      let startPos = match.index + match[0].length-1;
      let endPos = findClosingBracket(intelligenceText, startPos, 'normal');

      if (endPos !== -1) {
        let decisionText = intelligenceText.substr(startPos, endPos - startPos + 1);
        let theDecision = new Decision(id++, decisionText);
        this.decisions.push(theDecision);
      }
      match = decisionExpression.exec(intelligenceText);
    }
  }

  initializeVisualizations() {
    for (let dec of this.decisions) {
      dec.initializeVisualizations();
    }
  }

  toHtml() {
    let out = $('<div>').prop('id', 'decision_container');
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

  update(elementStack) {
    let decision = elementStack.pop();
    let match = idNumberExpression.exec(decision.prop('id'));
    let decisionIndex = parseInt(match[0], 10);
    if (!isNaN(decisionIndex)) {
      for (let decision of this.decisions) {
        if (decision.id === decisionIndex) {
          return decision.update(elementStack);
        }
      }
    }
    console.error('Looking for decision#' + decisionIndex + ', but not found');
    return false
  }

  updateDecisionOrder() {
    let sortedDecisions = [];
    for (let decisionElement of $('#decision_container .decision')) {
      let match = idNumberExpression.exec($(decisionElement).prop('id'));
      let id = parseInt(match[0], 10);
      sortedDecisions.push(this.getDecisionById(id));
    }
    this.decisions = sortedDecisions;
  }
  
  getDecisionById(decisionId) {
    return this.decisions.find(function (d) { return d.id === decisionId; });
  }
  
  getDecisionIndexById(decisionId) {
    return this.decisions.findIndex(function (d) { return d.id === decisionId; });
  }
  
  removeDecision(decisionId) {
    return this.decisions.splice(this.getDecisionIndexById(decisionId), 1);
  }
}


/**
 * Wrapper for C++'s name type.
 */
class Name
{
  constructor(name) {
    this.name = name;
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
    this.description = description;
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
    return [
      'Ignore',
      'SlightlyUseful',
      'Useful',
      'VeryUseful',
      'MostUseful'
    ];
  }

  constructor(scoreLabel) {
    if (UtilityScore.valid.indexOf(scoreLabel) === -1) {
      throw new Error('"' + scoreLabel  + '" is not a valid UtilityScore');
    }
    this.score = scoreLabel;
  }

  toHtml() {
    let out = $('<select>')
      .data('instance', this)
      .addClass('utility');
    for (let utility of UtilityScore.valid) {
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
      if (UtilityScore.valid.indexOf(newScore) === -1) {
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
      'Ignore'
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
      out.append($('<li>').append($('<input>')
        .prop('type', 'checkbox')
        .prop('checked', this.events.indexOf(event) !== -1)
        .prop('name', event)
        .val(event)));
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
    this.cppCode = cppCode;
  }

  toHtml() {
    return $('<textarea>')
      .data('instance', this)
      .addClass('action')
      .prop('placeholder', 'action')
      .prop('rows', 10)
      .prop('cols', 70)
      .val(this.cppCode);
  }
  
  toCpp() {
    return 'actions {'
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
    this.events = new Events(eventsExpression.exec(decisionText).slice(1).filter(Boolean));
    this.action = new Action(actionExpression.exec(decisionText)[1]);
    this.considerations = [];

    // Parse considerations
    let conId = 0;
    let match = considerationExpression.exec(decisionText);
    while (match !== null) {
      let startPos = match.index + match[0].length - 1;
      let endPos = findClosingBracket(decisionText, startPos, 'normal');
      let considerationText = decisionText.substr(startPos, endPos - startPos + 1);

      let theConsideration = new Consideration(this.id, conId++, considerationText);
      this.considerations.push(theConsideration);
      match = considerationExpression.exec(decisionText)
    }
  }

  initializeVisualizations() {
    for (let con of this.considerations) {
      con.transform.visualization.initialize();
    }
  }

  toHtml() {
    let considerations = $('<div>').addClass('considerations');
    for (let consideration of this.considerations) {
      considerations.append(consideration.toHtml());
    }
    
    return $('<div>')
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
          .prop('type', 'button')
          .val('Add Consideration'))
        .append(considerations)
        .append(this.action.toHtml()));
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
      let consideration = elementStack.pop();
      let match = idNumberExpression.exec(consideration.prop('id'));
      let considerationIndex = parseInt(match[0], 10);
      if (!isNaN(considerationIndex)) {
        for (let consideration of this.considerations) {
          if (consideration.id === considerationIndex) {
            return consideration.update(elementStack);
          }
        }
      }
      console.error('Looking for consideration#' + considerationIndex + ' of decision#' + this.id + ', but not found');
      return false;
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
        return this.utility.update(top);
      }
      else if (top.hasClass('action')) {
        return this.action.update(top);
      }
    }
    return false;
  }

  updateConsiderationOrder() {
    let sortedConsideration = [];
    for (let considerationElement of $('#decision_' + this.id + ' .considerations .consideration')) {
      let match = idNumberExpression.exec($(considerationElement).prop('id'));
      let id = parseInt(match[0], 10);
      let result = this.getConsiderationById(id);
      sortedConsideration.push(result);
    }
    this.considerations = sortedConsideration;
  }

  getConsiderationById(considerationId) {
    return this.considerations.find(function (c) { return c.id === considerationId; });
  }
  
  getConsiderationIndexById(considerationId) {
    return this.considerations.findIndex(function (c) { return c.id === considerationId; });
  }
  
  removeConsideration(considerationId) {
    return this.considerations.splice(this.getConsiderationIndexById(considerationId), 1);
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
        .prop('type', 'number')
        .prop('placeholder', 'min')
        .val(this.minRange))
      .append($('<input>')
        .addClass('max')
        .prop('type', 'number')
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
    this.cppCode = cppCode;
  }
  
  toHtml() {
    return $('<textarea>')
      .data('instance', this)
      .addClass('utility_function')
      .prop('placeholder', 'utility function')
      .prop('rows', 10)
      .prop('cols', 70)
      .val(this.cppCode);
  }

  toCpp() {
    return '{'
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

/**
 * Wrapper for C++'s Consideration type.
 *
 * It delegates further parsing of the C++ code for creating a Consideration.
 */
class Consideration
{
  constructor(decId, id, considerationText) {
    let transformText = transformExpression.exec(considerationText).filter(Boolean);
    let transformInputStart = inputExpression.exec(considerationText);
    let inputStartPos = transformInputStart.index+transformInputStart[0].length;
    let inputEndPos = findClosingBracket(considerationText, inputStartPos, 'curly');

    this.id = id;
    this.decisionId = decId;
    this.description = new Description(descriptionExpression.exec(considerationText)[1]);
    this.range = new Range(rangeExpression.exec(considerationText));
    this.transform = new Transform(this.decisionId, this.id, this.range, transformText[1], transformText.slice(2, transformText.length));
    this.utilityFunction = new UtilityFunction(considerationText.substr(inputStartPos, inputEndPos - inputStartPos));
  }

  toHtml() {
    return $('<div>')
      .data('instance', this)
      .addClass('consideration_wrapper')
      .append(createLabel(this.description.description, 'consideration_label'))
      .append($('<div>')
        .data('instance', this)
        .addClass('consideration')
        .prop('id', 'consideration_' + this.decisionId + '_' + this.id)
        .append(this.description.toHtml())
        .append(this.range.toHtml())
        .append(this.transform.toHtml())
        .append(this.utilityFunction.toHtml()));
  }

  toCpp() {
    return 'consideration(\n'
      + this.description.toCpp() + ',\n'
      + this.range.toCpp() + ',\n'
      + this.transform.toCpp() + ',\n'
      + '{\n'
      + this.utilityFunction.toCpp() + '\n'
      + '})';
  }

  update(elementStack) {
    let top = elementStack.pop();
    if (top.hasClass('range')) {
      if (elementStack.length !== 1) {
        return false;
      }
      return this.range.update(elementStack[0]) && this.transform.visualization.update();
    }
    else if (top.hasClass('transform')) {
      if (elementStack.length !== 1) {
        return false;
      }
      return this.transform.update(elementStack[0]);
    }
    else if (!elementStack.length) {
      if (top.hasClass('description')) {
        return this.description.update(top);
      }
      else if (top.hasClass('utility_function')) {
        return this.utilityFunction.update(top);
      }
    }
    console.error('Update is not yet implemented for Transforms');
    return false;
  }
}

class Visualization
{
  constructor(transform) {
    this.height = 200;
    this.width = 400;
    this.transform = transform;
    this.type = this.transform.type;
    this.decisionId = this.transform.decisionId;
    this.considerationId = this.transform.considerationId;
    this.range = this.transform.range;
    this.args = this.transform.args;

    this.name = 'visualisation_' + this.decisionId + '_' + this.considerationId;
    this.data = [];
  }

  scale(value, min, max) {
    return (value - min) / (max - min);
  }

  /*
  clip(float value, float min=0.0, float max=1.0) {
    return value > max ? max : value < min ? min : value;
  }
  */

  generateData() {
    let min = this.range.minRange;
    let max = this.range.maxRange;
    let step = (max-min)/100.0;
    switch(this.type) {
      case 'Binary':
        let threshold = parseFloat(this.args[0]);
        for (let i = min; i < max; i += step) {
          let val = 0.0;
          if (i >= threshold) val = 1.0;
          this.data.push({x: i , y: val});
        }
        break;

      case 'Exponential':
        let base = parseFloat(this.args[0]);
        for (let i = min; i < max; i += step) {
          // scale(std::pow(base, value), std::pow(base, min), std::pow(base, max));
          let val = this.scale(Math.pow(base, i), Math.pow(base, min), Math.pow(base, max));
          this.data.push({x: i , y: val});
        }
        break;

      case 'Identity':
        for (let i = min; i < max; i += step) {
          this.data.push({x: i , y: this.scale(i, min, max)});
        }
        break;

      case 'Inverted':
        for (let i = min; i < max; i += step) {
          this.data.push({x: i , y: 1.0 - this.scale(i, min, max)});
        }
        break;

      case 'Linear':
        /*
        let slope = parseFloat(this.args[0]);
        let intercept = parseFloat(this.args[1]);

        for (let i = min; i < max; i += step) {
          let val = this.clip(slope * this.scale(value, min, max) + intercept);
          this.data.push({x: i , y: 1.0 - this.scale(i, min, max)});
        }

        });
        break;
        */
      case 'Power':

        break;
    }
    /*
    Transform Binary(float threshold) {
      return Transform([threshold](float value, float, float) {
          if (value >= (float) threshold)
            return 1.f;
          return 0.f;
      });
    }

    Transform Exponential(float base) {
      return Transform([base](float value, float min, float max) {
          return scale(std::pow(base, value), std::pow(base, min), std::pow(base, max));
      });
    }

    Transform Identity() {
      return Transform([](float value, float min, float max) {
        return scale(value, min, max);
      });
    }

    Transform Inverted() {
      return Transform([](float value, float min, float max) {
        return 1.f - scale(value, min, max);
      });
    }

    Transform Linear(float slope, float intercept) {
      return Transform([slope, intercept](float value, float min, float max) {
        return clip(slope * scale(value, min, max) + intercept);
      });
    }

    Transform Power(float power) {
      return Transform([power](float value, float min, float max) {
          return scale(std::pow(value, power), std::pow(min, power), std::pow(max, power));
      });
    }
    */

    for (let entry of this.data) {
      if (entry.y > 1) entry.y = 1;
      if (entry.y < 0) entry.y = 0
    }
  }

  static get margins() {
    return {
      top: 20,
      right: 20,
      bottom: 20,
      left: 50
    };
  }

  xRange() {
    return d3.scale.linear().range([
      Visualization.margins.left,
      this.width - Visualization.margins.right
    ])
      .domain([
        d3.min(this.data, function(d) {
          return d.x;
        }),
        d3.max(this.data, function(d) {
          return d.x;
        })]);
  }

  xAxis() {
    return d3.svg.axis()
      .scale(this.xRange())
      .tickSize(1)
      .tickSubdivide(true);
  }

  yRange() {
    return d3.scale.linear().range([
      this.height - Visualization.margins.top,
      Visualization.margins.bottom
    ])
      .domain([this.range.minRange, this.range.maxRange]);
  }

  yAxis() {
    return d3.svg.axis()
      .scale(this.yRange())
      .tickSize(1)
      .orient('left')
      .tickSubdivide(true);
  }

  lineFunc() {
    let that = this;
    return d3.svg.line()
      .x(function(d) {
        return that.xRange()(d.x);
      })
      .y(function(d) {
        return that.yRange()(d.y);
      })
      .interpolate('linear');
  }

  initialize() {
    this.generateData();
    let vis = d3.select('#' + this.name);

    vis.append('svg:g')
      .attr('class', 'x-axis')
      .attr('transform', 'translate(0,' + (this.height - Visualization.margins.bottom) + ')')
      .call(this.xAxis());

    vis.append('svg:g')
      .attr('class', 'y-axis')
      .attr('transform', 'translate(' + Visualization.margins.left + ',0)')
      .call(this.yAxis());

    vis.append('svg:path')
      .attr('class', 'path')
      .attr('d', this.lineFunc()(this.data))
      .attr('stroke', 'blue')
      .attr('stroke-width', 2)
      .attr('fill', 'none');
  }

  // Should read values from corresponding fields when their values have
  // changed and update the data and axis
  update() {
    this.type = this.transform.type;
    this.range = this.transform.range;
    this.args = this.transform.args;

    let change_time = 750;
    this.generateData();
    let vis = d3.select('#' + this.name).transition();

    vis.select('.x-axis')
      .duration(change_time)
      .call(this.xAxis());

    vis.select('.y-axis')
      .duration(change_time)
      .call(this.yAxis());

    vis.select('.path')
      .duration(change_time)
      .attr('d', this.lineFunc()(this.data));

    return true;
  }

  toHtml() {
    return $('<div>')
      .data('instance', this)
      .addClass('plot_container')
      .append($('<svg>')
        .prop('id', this.name)
        .prop('width', this.width)
        .prop('height', this.height));
  }

  toCpp() {
    return '';
  }
}

/**
 * Wrapper for C++'s Transform type.
 */
class Transform
{
  static get valid() {
    return {
      'Binary': ['threshold'],
      'Exponential': ['base'],
      'Identity': [],
      'Inverted': [],
      'Linear': ['slope', 'intercept'],
      'Power': ['power']
    };
  }

  constructor(decId, conId, range, type, args) {
    if (!(type in Transform.valid)) {
      throw new Error('Transform "' + type + '" does not exist');
    }
    let arity = Transform.valid[type].length;
    if (args.length !== arity) {
      throw new Error('Transform "' + type + '" should have '
        + arity + ' arguments, but received '
        + args.length + ' arguments');
    }
    this.decisionId = decId;
    this.considerationId = conId;
    this.range = range;
    this.type = type;
    this.args = args;

    this.visualization = new Visualization(this);
    //this.visualization = new Visualization(this.type, this.decisionId, this.considerationId, this.range, this.args);
  }

  toHtml() {
    let out = $('<div>')
      .data('instance', this)
      .addClass('transform');
    let types = $('<select>')
      .addClass('transform-type');

    out.append(types);

    for (let transformType in Transform.valid) {
      let transformArgs = Transform.valid[transformType];

      types.append($('<option>')
        .prop('selected', transformType === this.type)
        .val(transformType)
        .text(transformType));

      for (let transformArg of transformArgs) {
        out.append($('<input>')
          .addClass('transform-argument')
          .addClass(transformType)
          .addClass(transformArg)
          .prop('type', 'text')
          .prop('placeholder', transformArg));
      }
    }
  }

  toCpp() {
    return 'Transform::'
      + this.type
      + '('
      + this.args.join(', ')
      + ')';
  }

  update(element) {
    let successful = false;
    if (element.hasClass('transform-type')) {
      let type = element.val();
      if (!(type in Transform.valid)) {
        throw new Error('Transform "' + this.type + '" does not exist');
      }
      let arity = Transform.valid[type].length;
      this.type = type;
      this.args = new Array(arity);
      for (let i = 0; i < Transform.valid[type]; i++) {
        let argName = Transform.valid[type][i];
        let argElement = $(element).siblings('.transform-argument + .' + this.type + ' + .' + argName);
        this.args[i] = parseFloat(argElement.val());
      }
      successful = true;
    }
    else if (element.hasClass('transform-argument')) {
      if (element.hasClass(this.type)) {
        for (let i = 0; i < Transform.valid[this.type].length; i++) {
          let argName = Transform.valid[this.type][i];
          if (element.hasClass(argName)) {
            this.args[i] = parseFloat(element.val());
            successful = true;
            break;
          }
        }
      }
    }
    return successful ? this.visualization.update(this) : false;
  }
}


function showRelevantTransformArguments(transformTypeTag) {
  $(transformTypeTag).siblings('.transform-argument').hide();
  $(transformTypeTag).siblings('.transform-argument + .' + $(transformTypeTag).val()).show();
}

function createLabel(content, labelClass) {
  return $('<div>')
    .addClass(labelClass === undefined ? 'label' : labelClass)
    .append($('<span>')
      .addClass('content')
      .text(content))
    .append($('<span>')
      .addClass('label-cross')
      .text('\u274C'));
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

/**
 * Read a C++ file with only calls to DecisionEngine::addDecision, and parse it.
 *
 * This functions requires a HTML input element with type="file" as input.
 * When the file is loaded, it creates an Intelligence object that is a
 * Javascript representation of the set of Decisions.
 */
function readSingleFile(evt) {
  let f = evt.target.files[0];
  if (f) {
    let r = new FileReader();
    r.onload = function (e) {
      let content = e.target.result;
      intelligence = new Intelligence(content);
      $('#intelligence_container').append(intelligence.toHtml());
      intelligence.initializeVisualizations();

      // Update the displayed graph of a Transform when its type is changed
      $('.transform-type').each(function (_, element) { showRelevantTransformArguments(element); });

      // Make each Decision collapsible
      $('#decision_container .decision_wrapper').each(function(_, element) {
        $(element).accordion({
          active: false,
          collapsible: true,
          header: '.decision_label',
          heightStyle: 'content',
          icons: false
        })
      });
      $('#decision_container').sortable({
        axis: 'y',
        start: function (event, ui) {
          ui.item.accordion('disable');
        },
        stop: function (event, ui) {
          // For IE.
          ui.item.children('h3').triggerHandler('focusout');
          // Prevent accordion to open after the sort has stopped.
          window.setTimeout(function () { ui.item.accordion('enable'); }, 30);
        },
        update: function (event, ui) {
          intelligence.updateDecisionOrder();
        }
      });
      $('.decision_label').disableSelection();
      
      // Remove a Decision when clicking on the cross
      $('.decision_label .label-cross').click(function () {
        // Select the decision to remove
        let match = idNumberExpression.exec($(this).parent().next().prop('id'));
        let decisionId = parseInt(match[0], 10);
        intelligence.removeDecision(decisionId);
        // And make it go away on screen as well
        let duration = 400;
        let decision = $(this).parent().parent();
        decision.animate({height: '0px'}, duration);
        window.setTimeout(function () { decision.remove(); }, duration);
      });

      // Also, make each Consideration collapsible
      $('.considerations .consideration_wrapper').each(function (_, element) {
        $(element).accordion({
          active: false,
          collapsible: true,
          header: '.consideration_label',
          heightStyle: 'content',
          icons: false
        });
      });
      $('.considerations').each(function (_, element) {
        $(element).sortable({
          axis: 'y',
          start: function (event, ui) {
            ui.item.accordion('disable');
          },
          stop: function (event, ui) {
            // For IE.
            ui.item.children('h3').triggerHandler('focusout');
            // Prevent accordion to open after the sort has stopped.
            window.setTimeout(function () { ui.item.accordion('enable'); }, 30);
          },
          update: function (event, ui) {
            let htmlConsideration = ui.item.children('.consideration');
            let htmlId = htmlConsideration.prop('id');
            let decisionId = parseInt(/\d+/.exec(htmlId)[0], 10);
            intelligence.getDecisionById(decisionId).updateConsiderationOrder();
          }
        });
      });
      $('.consideration_label').disableSelection();

      // Remove a Consideration when clicking on the cross
      $('.consideration_label .label-cross').click(function() {
        // Select the consideration to remove
        let match = idNumberExpression.exec($(this).parent().next().prop('id'));
        let considerationId = parseInt(match[0], 10);
        match = idNumberExpression.exec($(this).closest('.decision').prop('id'));
        let decisionId = parseInt(match[0], 10);
        intelligence.getDecisionById(decisionId).removeConsideration(considerationId);
        // And make it go away on the screen as well
        let duration = 400;
        let consideration = $(this).parent().parent();
        consideration.animate({height: '0px'}, duration);
        window.setTimeout(function () { consideration.remove(); }, duration);
      });
    };
    r.readAsText(f);
  } else {
    console.error('Failed to load file');
  }
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
