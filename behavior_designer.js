"use strict";

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
const nameExpression            = /name\(\s*"(.*)"\s*\)/;
const utilityExpression         = /UtilityScore::(.*),/;
const eventsExpression          = /events\s*\{\s*Event::(.*?)\s*(?:,\s*Event::(.*?)\s*)?\}\s*,/;
const actionExpression          = /actions \{\n([\s\S]*)\n\s*}/;

// Consideration expressions
const considerationExpression   = /consideration\(/g;
const rangeExpression           = /range\(\s*(.*?),\s*(.*?)\s*\)\s*,/;
const transformExpression       = /Transform::\s*(\S*?)\s*\((.*?)(?:,(.*?))*\)/;
const inputExpression           = /Transform::.*?\(.*?\), \{/;

// Shared expressions
const descriptionExpression     = /description\(\s*"(.*)"\s*\)/;

var intelligence = null;

//noinspection JSDuplicatedDeclaration
class Intelligence
{
  constructor(intelligenceText) {
    this.decisions = [];

    // Parse file
    let match = decisionExpression.exec(intelligenceText);
    let id = 0;
    while (match != null) {
      let startPos = match.index + match[0].length-1;
      let endPos = findClosingBracket(intelligenceText, startPos, "normal");

      if (endPos != -1) {
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
    let out = '<div id="decision_container">';
    for (let decision of this.decisions) {
      out += decision.toHtml();
    }
    out += '</div>';
    return out;
  }

  toCpp() {
    let out = "";
    for (let decision of this.decisions) {
      out += decision.toCpp()
        + "\n";
    }
    return out;
  }

  update(elementStack) {
    let decision = elementStack.pop();
    let match = idNumberExpression.exec(decision.attr('id'));
    let decisionIndex = parseInt(match[0], 10);
    if (!isNaN(decisionIndex)) {
      for (let decision of this.decisions) {
        if (decision.id === decisionIndex) {
          return decision.update(elementStack);
        }
      }
    }
    console.error("Looking for decision#" + decisionIndex + ", but not found");
    return false
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
    return '<input type="text" placeholder="name" class="name" value="' + this.name + '"/>\n';
  }

  toCpp() {
    return 'name("' + this.name + '")';
  }
  
  toLabel(labelClass) {
    return '<div class="' + labelClass + '">' + this.name + "</div>\n";
  }

  update(element) {
    if (element.hasClass("name")) {
      this.name = element.val();
      element.parent().prev().text(this.name);
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
    return '<input type="text" placeholder="description" class="description" value="' + this.description + '"/>\n';
  }

  toCpp() {
    return 'description("' + this.description + '")';
  }
  
  toLabel(labelClass) {
    return '<div class="' + labelClass + '">' + this.description + '</div>\n';
  }

  update(element) {
    if (element.hasClass("description")) {
      this.description = element.val();
      element.parent().prev(".consideration_label").text(this.description);
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
      "Ignore",
      "SlightlyUseful",
      "Useful",
      "VeryUseful",
      "MostUseful"
    ];
  }

  constructor(scoreLabel) {
    if (UtilityScore.valid.indexOf(scoreLabel) === -1) {
      throw new Error("'" + scoreLabel  + "' is not a valid UtilityScore");
    }
    this.score = scoreLabel;
  }

  toHtml() {
    let out = '<select class="utility">\n';
    for (let utility of UtilityScore.valid) {
      if (utility === this.score) {
        out += '<option selected value="' + utility + '">' + utility + '</option>\n';
      }
      else {
        out += '<option value="' + utility + '">' + utility + '</option>\n';
      }
    }
    out += '</select>\n';
    return out;
  }

  toCpp() {
    return "UtilityScore::" + this.score;
  }

  update(element) {
    if (element.hasClass("utility")) {
      let newScore = element.val();
      if (UtilityScore.valid.indexOf(newScore) === -1) {
        throw new Error("'" + newScore + "' is not a valid UtilityScore");
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
      "Always",
      "Ignore"
    ];
  }

  constructor(eventLabels) {
    for (let eventLabel of eventLabels) {
      if (Events.valid.indexOf(eventLabel) === -1) {
        throw new Error("'" + eventLabel + "' is not a valid Event");
      }
    }
    this.events = eventLabels;
  }

  toHtml() {
    let out = '<ul class="events">';
    for (let event of Events.valid) {
      if (this.events.indexOf(event) !== -1) {
        out += '<li><input checked type="checkbox" name="' + event + '" value="' + event + '">' + event + '</li>';
      }
      else {
        out += '<li><input type="checkbox" name="' + event + '" value="' + event + '">' + event + '</li>';
      }
    }
    out += '</ul>';
    return out;
  }

  toCpp() {
    let cppEvents = this.events.map(function(x){ return "Event::" + x; });
    return "events {"
      + cppEvents.join(", ")
      + "}";
  }

  update(elementStack) {
    if (elementStack.pop().hasClass("events")) {
      elementStack.pop(); // LI element
      let checkbox = elementStack.pop();
      if (!elementStack.length) {
        let eventLabel = checkbox.val();
        if (Events.valid.indexOf(eventLabel) === -1) {
          throw new Error("'" + eventLabel + "' is not a valid Event");
        }
        if (checkbox.prop("checked")) {
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
    return '<textarea placeholder="action" class="action" rows="10" cols="70" >\n'
      + this.cppCode
      + '\n</textarea>\n';
  }

  toCpp() {
    return 'actions {'
      + this.cppCode
      + '\n}';
  }

  update(element) {
    if (element.hasClass("action")) {
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
    while (match != null) {
      let startPos = match.index + match[0].length - 1;
      let endPos = findClosingBracket(decisionText, startPos, "normal");
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
    let htmlConsiderations = this.considerations.map(function(x){ return x.toHtml(); });
    return this.name.toLabel("decision_label")
      + '<div class="decision" id="decision' + this.id + '">\n'
      + this.name.toHtml()
      + this.description.toHtml()
      + this.utility.toHtml()
      + this.events.toHtml()
      + '<input type="button" value="Add Consideration" class="addConsideration" />'
      + '<div class="considerations">\n'
      + htmlConsiderations.join("\n")
      + '</div>\n'
      + this.action.toHtml()
      + '</div>\n';
  }

  toCpp() {
    let cppConsiderations = this.considerations.map(function(x){ return x.toCpp(); });
    return "addDecision(\n"
      + this.name.toCpp() + ",\n"
      + this.description.toCpp() + ",\n"
      + this.utility.toCpp() + ",\n"
      + this.events.toCpp() + ",\n"
      + "considerations {\n"
      + cppConsiderations.join(",\n")
      + "},\n"
      + this.action.toCpp()
      + ");\n";
  }

  update(elementStack) {
    let top = elementStack.pop();
    if (top.hasClass("considerations")) {
      let consideration = elementStack.pop();
      let match = idNumberExpression.exec(consideration.attr('id'));
      let considerationIndex = parseInt(match[0], 10);
      if (!isNaN(considerationIndex)) {
        for (let consideration of this.considerations) {
          if (consideration.id === considerationIndex) {
            return consideration.update(elementStack);
          }
        }
      }
      console.error("Looking for consideration#" + considerationIndex + " of decision#" + this.id + ", but not found");
      return false;
    }
    else if (top.hasClass("events")) {
      elementStack.push(top);
      return this.events.update(elementStack);
    }
    else if (!elementStack.length) {
      if (top.hasClass("name")) {
        return this.name.update(top);
      }
      else if (top.hasClass("description")) {
        return this.description.update(top);
      }
      else if (top.hasClass("utility")) {
        return this.utility.update(top);
      }
      else if (top.hasClass("action")) {
        return this.action.update(top);
      }
    }
    return false;
  }
}


/**
 * Wrapper for C++'s range type.
 */
class Range
{
  constructor(regexRangeMatch) {
    if (regexRangeMatch.length !== 3) {
      throw new Error("Range needs 2 arguments");
    }
    this.minRange = parseFloat(regexRangeMatch[1]);
    this.maxRange = parseFloat(regexRangeMatch[2]);
  }

  toHtml() {
    return '<span class="range">'
      + '<input placeholder="min" class="min" type="number" value="' + this.minRange + '"/>'
      + '<input placeholder="max" class="max" type="number" value="' + this.maxRange + '"/>'
      + '</span>';
  }

  toCpp() {
    return "range(" + this.minRange + ", " + this.maxRange + ")";
  }

  update(element) {
    let newValue = parseFloat(element.val());
    if (!isNaN(newValue)) {
      if (element.hasClass("min")) {
        this.minRange = newValue;
        return true;
      }
      else if (element.hasClass("max")) {
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
    return '<textarea placeholder="utility function" class="utility_function" rows="10" cols="70" >\n'
      + this.cppCode
      + '\n</textarea>\n';
  }

  toCpp() {
    return "{"
      + this.cppCode
      + "\n}";
  }

  update(element) {
    if (element.hasClass("utility_function")) {
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
    let inputEndPos = findClosingBracket(considerationText, inputStartPos, "curly");

    this.id = id;
    this.decisionId = decId;
    this.description = new Description(descriptionExpression.exec(considerationText)[1]);
    this.range = new Range(rangeExpression.exec(considerationText));
    this.transform = new Transform(this.decisionId, this.id, this.range, transformText[1], transformText.slice(2, transformText.length));
    this.utilityFunction = new UtilityFunction(considerationText.substr(inputStartPos, inputEndPos - inputStartPos));
  }

  toHtml() {
    return this.description.toLabel("consideration_label")
      + '<div class="consideration" id="consideration_' + this.decisionId + '_' + this.id + '">\n'
      + this.description.toHtml()
      + this.range.toHtml()
      + this.transform.toHtml()
      + this.utilityFunction.toHtml()
      + '</div>\n';
  }

  toCpp() {
    return 'consideration(\n'
      + this.description.toCpp() + ",\n"
      + this.range.toCpp() + ",\n"
      + this.transform.toCpp() + ",\n"
      + "{\n"
      + this.utilityFunction.toCpp() + "\n"
      + "})";
  }

  update(elementStack) {
    console.log(elementStack);
    let top = elementStack.pop();
    if (top.hasClass("range")) {
      if (elementStack.length !== 1) {
        return false;
      }
      return this.range.update(elementStack[0]) && this.transform.visualization.update();
    }
    else if (top.hasClass("transform")) {
      if (elementStack.length !== 1) {
        return false;
      }
      return this.transform.update(elementStack[0]);
    }
    else if (!elementStack.length) {
      if (top.hasClass("description")) {
        return this.description.update(top);
      }
      else if (top.hasClass("utility_function")) {
        return this.utilityFunction.update(top);
      }
    }
    console.error("Update is not yet implemented for Transforms");
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
    
    this.name = "visualisation_" + this.decisionId + "_" + this.considerationId;
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
      case "Binary":
        let threshold = parseFloat(this.args[0]);
        for (let i = min; i < max; i += step) {
          let val = 0.0;
          if (i >= threshold) val = 1.0;
          this.data.push({x: i , y: val});
        }
        break;

      case "Exponential":
        let base = parseFloat(this.args[0]);
        for (let i = min; i < max; i += step) {
          // scale(std::pow(base, value), std::pow(base, min), std::pow(base, max));
          let val = this.scale(Math.pow(base, i), Math.pow(base, min), Math.pow(base, max));
          this.data.push({x: i , y: val});
        }
        break;

      case "Identity":
        for (let i = min; i < max; i += step) {
          this.data.push({x: i , y: this.scale(i, min, max)});
        }
        break;

      case "Inverted":
        for (let i = min; i < max; i += step) {
          this.data.push({x: i , y: 1.0 - this.scale(i, min, max)});
        }
        break;

      case "Linear":
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
      case "Power":

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

    vis.select(".x-axis")
      .duration(change_time)
      .call(this.xAxis());

    vis.select(".y-axis")
      .duration(change_time)
      .call(this.yAxis());

    vis.select(".path")
      .duration(change_time)
      .attr('d', this.lineFunc()(this.data));
    
    return true;
  }

  toHtml() {
    let out = "";

    out += "<div class='plot_container'>\n";
    out += "<svg id='"+this.name+"' width='"+this.width+"' height='"+this.height+"'></svg>\n";
    out += "</div>\n";

    return out;
  }
}

/**
 * Wrapper for C++'s Transform type.
 */
class Transform
{
  static get valid() {
    return {
      "Binary": ["threshold"],
      "Exponential": ["base"],
      "Identity": [],
      "Inverted": [],
      "Linear": ["slope", "intercept"],
      "Power": ["power"]
    };
  }

  constructor(decId, conId, range, type, args) {
    if (!(type in Transform.valid)) {
      throw new Error("Transform '" + type + "' does not exist");
    }
    let arity = Transform.valid[type].length;
    if (args.length !== arity) {
      throw new Error("Transform '" + type + "' should have "
        + arity + " arguments, but received "
        + args.length + " arguments");
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
    let htmlArgs = [];
    let out = '<div class="transform">\n'
      + '<select class="transform-type">\n';
    for (let transformType in Transform.valid) {
      let htmlArgument = '';
      let transformArgs = Transform.valid[transformType];
      if (transformType === this.type) {
        out += '<option selected value="' + transformType + '">' + transformType + '</option>\n';
        for (let i = 0; i < transformArgs.length; i++) {
          htmlArgument += '<input type="text" class="transform-argument ' + transform.type
            + '" placeholder="' + transformArgs[i]
            + '" value="' + this.args[i] + '"/>\n';
        }
      }
      else {
        out += '<option value="' + transformType + '">' + transformType + '</option>\n';
        for (let i = 0; i < transformArgs.length; i++) {
          htmlArgument += '<input type="text" ' 
            + 'class="transform-argument ' + transformType + ' ' + transformArgs[i] + '" '
            + 'placeholder="' + transformArgs[i] + '"/>\n';
        }
      }
      htmlArgs.push(htmlArgument);
    }
    out += '</select>\n';
    out += htmlArgs.join('');
    out += this.visualization.toHtml();
    out += '</div>\n';

    return out;
  }

  toCpp() {
    return "Transform::"
      + this.type
      + "("
      + this.args.join(", ")
      + ")";
  }

  update(element) {
    let successful = false;
    if (element.hasClass("transform-type")) {
      let type = element.val();
      if (!(type in Transform.valid)) {
        throw new Error("Transform '" + this.type + "' does not exist");
      }
      let arity = Transform.valid[type].length;
      this.type = type;
      this.args = new Array(arity);
      for (let i = 0; i < Transform.valid[type]; i++) {
        let argName = Transform.valid[type][i];
        let argElement = $(element).siblings(".transform-argument + ." + this.type + " + ." + argName);
        this.args[i] = parseFloat(argElement.val());
      }
      successful = true;
    }
    else if (element.hasClass("transform-argument")) {
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
  $(transformTypeTag).siblings(".transform-argument").hide();
  $(transformTypeTag).siblings(".transform-argument + ." + $(transformTypeTag).val()).show();
}

/** Finds the closing bracket of a given opening bracket.
 *
 * This is used to help parsing C++ code.
 */
function findClosingBracket(text, openPosition, bracketType) {
  let inString = false;
  let count = 1;
  let pos = openPosition + 1;

  let o = "(";
  let c = ")";
  if (bracketType === "curly") {
    o = "{";
    c = "}";
  }
  while (count != 0 && pos < text.length) {
    let char = text[pos];
    switch (char) {
      case "\"":
        if (text[pos-1] != "\\")
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
    if (count == 0)
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
      let container = $("#intelligence_container");
      container.html(intelligence.toHtml());
      intelligence.initializeVisualizations();
      
      // Update the displayed graph of a Transform when its type is changed
      $(".transform-type").each(function (_, element) { showRelevantTransformArguments(element); });
      // Make each Decision collapsible
      $(function() {
        $("#decision_container").accordion({
          active: false,
          collapsible: true,
          header: ".decision_label",
          heightStyle: "content",
          icons: false
        });
      });
      // Also, make each Consideration collapsible
      $(function() {
        $(".considerations").accordion({
          active: false,
          collapsible: true,
          header: ".consideration_label",
          heightStyle: "content",
          icons: false
        });
      });

    };
    r.readAsText(f);
  } else {
    console.log("Failed to load file");
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
  console.log("***");
  console.log("Change event triggered.");
  let stack = [$(element)];
  while (true) {
    let ancestor = stack[stack.length - 1].parent();
    stack.push(ancestor);
    if (ancestor.hasClass("decision")) {
      break;
    }
    else if (ancestor.is('html')) {
      throw new Error("Malformed HTML document: no element with class='decision' found.");
    }
  }
  if (!intelligence.update(stack)) {
    console.error("The intelligence is not updated correctly!");
  }
}
