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
 *
 * NOTE: There is no direct link to the C++ code; any changes in the C++ API
 * will require manual changes in this Javascript library.
 */

/* Regular expressions to parse the calls to DecisionEngine::addDecision */
// Decision expressions
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

function Intelligence(intelligenceText)
{
  this.decisions = [];

  // Parse file
  let match = decisionExpression.exec(intelligenceText);
  let id = 0;
  while (match != null)
  {
    let startPos = match.index + match[0].length-1;
    let endPos = findClosingBracket(intelligenceText, startPos, "normal");

    if (endPos != -1)
    {
      let decisionText = intelligenceText.substr(startPos, endPos - startPos + 1);
      let theDecision = new Decision(id, decisionText);
      this.decisions.push(theDecision);
      id++;
    }
    match = decisionExpression.exec(intelligenceText);
  }

  this.initializeVisualizations = function()
  {
    for(let dec of this.decisions)
    {
      dec.initializeVisualizations();
    }
  };

  this.toHtml = function() {
    let out = '<div id="decision_container">';
    for (let decision of this.decisions)
    {
      out += decision.toHtml();
    }
    out += '</div>';
    return out;
  };

  this.toCpp = function() {
    let out = "";
    for (let decision of this.decisions) {
      out += decision.toCpp()
        + "\n";
    }
    return out;
  };
}


/**
 * Wrapper for C++'s name type.
 */
function Name(name)
{
  this.name = name;

  this.toHtml = function() {
    return '<input type="text" placeholder="name" class="name" value="' + this.name + '"/>\n';
  };

  this.toCpp = function() {
    return 'name("' + this.name + '")';
  };
}


/**
 * Wrapper for C++'s description type.
 */
function Description(description)
{
  this.description = description;

  this.toHtml = function() {
    return '<input type="text" placeholder="description" class="description" value="' + this.description + '"/>\n';
  };

  this.toCpp = function() {
    return 'description("' + this.description + '")';
  };
}

/**
 * Validator and wrapper for C++'s UtilityScore values.
 *
 * A list of all members of C++'s UtilityScore enumeration is checked to see
 * if this score is valid.
 */
function UtilityScore(scoreLabel)
{
  const validUtilityScores = [
    "Ignore",
    "SlightlyUseful",
    "Useful",
    "VeryUseful",
    "MostUseful"
  ];

  if (validUtilityScores.indexOf(scoreLabel) === -1)
  {
    throw new Error("'" + scoreLabel  + "' is not a UtilityScore");
  }
  this.score = scoreLabel;

  this.toHtml = function() {
    let out = '<select class="utility">\n';
    for (let utility of validUtilityScores)
    {
      if (utility === this.score)
      {
        out += '<option selected value="' + utility + '">' + utility + '</option>\n';
      }
      else
      {
        out += '<option value="' + utility + '">' + utility + '</option>\n';
      }
    }
    out += '</select>\n';
    return out;
  };

  this.toCpp = function() {
    return "UtilityScore::" + this.score;
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
function Events(eventLabels)
{
  const validEvents = [
    "Always",
    "Ignore"
  ];

  for (let eventLabel of eventLabels)
  {
    if (validEvents.indexOf(eventLabel) === -1)
    {
      throw new Error("'" + eventLabel + "' is not a valid Event");
    }
  }
  this.events = eventLabels;

  this.toHtml = function() {
    let out = '<ul class="events">';
    for (let event of validEvents) {
      if (this.events.indexOf(event) !== -1)
      {
        out += '<li><input checked type="checkbox" name="' + event + '" value="' + event + '">' + event + '</li>';
      }
      else
      {
        out += '<li><input type="checkbox" name="' + event + '" value="' + event + '">' + event + '</li>';
      }
    }
    out += '</ul>';
    return out;
  };

  this.toCpp = function() {
    let cppEvents = this.events.map(function(x){ return "Event::" + x;});
    return "events {"
      + cppEvents.join(", ")
      + "}";
  };
}


/**
 * Wrapper for C++'s Action type.
 */
function Action(action_code)
{
  this.action_code = action_code;

  this.toHtml = function() {
    return '<textarea placeholder="action" class="action" rows="10" cols="70" >\n'
      + this.action_code
      + '\n</textarea>\n';
  };

  this.toCpp = function() {
    return 'actions {'
      + this.action_code
      + '\n}';
  };
}


/**
 * Wrapper and parser for C++'s Decision type.
 *
 * It delegates further parsing of the C++ code for creating a Decision.
 */
function Decision(id, decisionText)
{
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
  while (match != null)
  {
    let startPos = match.index + match[0].length - 1;
    let endPos = findClosingBracket(decisionText, startPos, "normal");
    let considerationText = decisionText.substr(startPos, endPos - startPos + 1);

    let theConsideration = new Consideration(id, conId, considerationText);
    this.considerations.push(theConsideration);
    conId++;
    match = considerationExpression.exec(decisionText)
  }

  this.initializeVisualizations = function()
  {
    for( let con of this.considerations)
    {
      con.transform.visualization.initialize();
    }
  };

  this.toHtml = function() {
    let htmlConsiderations = this.considerations.map(function(x){ return x.toHtml();});
    return '<div class="decision">\n'
      + this.name.toHtml()
      + this.description.toHtml()
      + this.utility.toHtml()
      + this.events.toHtml()
      + '<div class="considerations">\n'
      + '<input type="button" value="Add Consideration" class="addConsideration" />'
      + htmlConsiderations.join("\n")
      + '</div>\n'
      + this.action.toHtml()
      + '</div>\n';
  };

  this.toCpp = function() {
    let cppConsiderations = this.considerations.map(function(x){ return x.toCpp();});
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
  };
}


/**
 * Wrapper for C++'s range type.
 */
function Range(regexRangeMatch)
{
  if (regexRangeMatch.length !== 3)
  {
    throw new Error("Range needs 2 arguments");
  }
  this.minRange = parseFloat(regexRangeMatch[1]);
  this.maxRange = parseFloat(regexRangeMatch[2]);

  this.toHtml = function() {
    return '<span class="range">'
      + '<input placeholder="min" class="min" type="number" value="' + this.minRange + '"/>'
      + '<input placeholder="max" class="max" type="number" value="' + this.maxRange + '"/>'
      + '</span>';
  };

  this.toCpp = function() {
    return "range(" + this.minRange + ", " + this.maxRange + ")";
  };
}


/**
 * Wrapper for C++'s UtilityFunction type.
 */
function UtilityFunction(cpp_code)
{
  this.cpp_code = cpp_code;

  this.toHtml = function() {
    return '<textarea placeholder="utility function" class="utilityfunction" rows="10" cols="70" >\n'
      + this.cpp_code
      + '\n</textarea>\n';
  };

  this.toCpp = function() {
    return "{"
      + this.cpp_code
      + "\n}";
  };
}

/**
 * Wrapper for C++'s Consideration type.
 *
 * It delegates further parsing of the C++ code for creating a Consideration.
 */
function Consideration(decId, id, considerationText)
{
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

  this.toHtml = function() {
    return '<div class="consideration">\n'
      + this.description.toHtml()
      + this.range.toHtml()
      + this.transform.toHtml()
      + this.utilityFunction.toHtml()
      + '</div>\n';
  };

  this.toCpp = function() {
    return 'consideration(\n'
      + this.description.toCpp() + ",\n"
      + this.range.toCpp() + ",\n"
      + this.transform.toCpp() + ",\n"
      + "{\n"
      + this.utilityFunction.toCpp() + "\n"
      + "})";
  };
}

function Visualization(type, decId, conId, range, args)
{
  this.height = 200;
  this.width = 400;
  this.type = type;
  this.decId = decId;
  this.conId = conId;
  this.range = range;
  this.args = args;
  this.name = "visualisation_"+this.decId+"_"+this.conId;

  this.data = [];

  this.scale = function(value, min, max)
  {
    return (value - min) / (max - min);
  }

  /*
  this.clip = function(float value, float min=0.0, float max=1.0)
  {
    return value > max ? max : value < min ? min : value;
  }
  */

  this.generateData = function()
  {
    let min = range.minRange;
    let max = range.maxRange;
    let step = (max-min)/100.0;
    console.log(this.args);
    switch(this.type)
    {
      case "Binary":
        let threshold = parseFloat(this.args[0]);
        for (var i = min; i < max; i += step)
        {
          let val = 0.0;
          if( i >= threshold ) val = 1.0;
          this.data.push({x: i , y: val});
        }
        break;

      case "Exponential":
        let base = parseFloat(this.args[0]);
        for (var i = min; i < max; i += step)
        {
          // scale(std::pow(base, value), std::pow(base, min), std::pow(base, max));
          let val = this.scale(Math.pow(base, i), Math.pow(base, min), Math.pow(base, max));
          this.data.push({x: i , y: val});
        }
        break;

      case "Identity":
        for (var i = min; i < max; i += step)
        {
          this.data.push({x: i , y: this.scale(i, min, max)});
        }
        break;

      case "Inverted":
        for (var i = min; i < max; i += step)
        {
          this.data.push({x: i , y: 1.0 - this.scale(i, min, max)});
        }
        break;

      case "Linear":
        /*
        let slope = parseFloat(this.args[0]);
        let intercept = parseFloat(this.args[1]);

        for (var i = min; i < max; i += step)
        {
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

    for (let entry of this.data)
    {
      if (entry.y > 1) entry.y = 1;
      if (entry.y < 0) entry.y = 0
    }
  }

  this.initialize = function() {
    this.generateData();
    var vis = d3.select('#'+this.name),
      WIDTH = this.width,
      HEIGHT = this.height,
      MARGINS = {
        top: 20,
        right: 20,
        bottom: 20,
        left: 50
      },
      xRange = d3.scale.linear().range([MARGINS.left, WIDTH - MARGINS.right]).domain([d3.min(this.data, function(d) {
        return d.x;
      }), d3.max(this.data, function(d) {
        return d.x;
      })]),
      yRange = d3.scale.linear().range([HEIGHT - MARGINS.top, MARGINS.bottom]).domain([0, 1]),
      xAxis = d3.svg.axis()
        .scale(xRange)
        .tickSize(1)
        .tickSubdivide(true),
      yAxis = d3.svg.axis()
        .scale(yRange)
        .tickSize(1)
        .orient('left')
        .tickSubdivide(true);

    vis.append('svg:g')
      .attr('class', 'x axis')
      .attr('transform', 'translate(0,' + (HEIGHT - MARGINS.bottom) + ')')
      .call(xAxis);

    vis.append('svg:g')
      .attr('class', 'y axis')
      .attr('transform', 'translate(' + (MARGINS.left) + ',0)')
      .call(yAxis);

    var lineFunc = d3.svg.line()
      .x(function(d) {
        return xRange(d.x);
      })
      .y(function(d) {
        return yRange(d.y);
      })
      .interpolate('linear');

    vis.append('svg:path')
      .attr('d', lineFunc(this.data))
      .attr('stroke', 'blue')
      .attr('stroke-width', 2)
      .attr('fill', 'none');

  };

  // Should read values from corresponding fields when their values have
  // changed and update the data and axis
  this.update = function()
  {

  };

  this.toHtml = function() {
    let out = "";

    out += "<div class='plot_container'>\n";
    out += "<svg id='"+this.name+"' width='"+this.width+"' height='"+this.height+"'></svg>\n";
    out += "</div>\n";

    return out;
  };
}

// TODO: implement different transformations
function Transform(decId, conId, range, type, args)
{
  const validTransforms = [
    {"type": "Binary", "args": ["threshold"]},
    {"type": "Exponential", "args": ["base"]},
    {"type": "Identity", "args": []},
    {"type": "Inverted", "args": []},
    {"type": "Linear", "args": ["slope", "intercept"]},
    {"type": "Power", "args": ["power"]}
  ];
  let filteredTransforms = validTransforms.filter(function(element) { return element.type === type; });
  if (filteredTransforms.length == 0) {
    throw new Error("Transform '" + this.type + "' does not exist");
  }
  let arity = filteredTransforms[0].args.length;
  if (args.length !== arity) {
    throw new Error("Transform '" + this.type + "' should have "
      + arity + " arguments passed "
      + args.length + " arguments");
  }
  this.decisionId = decId;
  this.considerationId = conId;
  this.range = range;
  this.type = filteredTransforms[0].type;
  this.args = args;

  this.visualization = new Visualization(type, decId, conId, this.range, args);

  // TODO: Implement a better HTML representation.
  this.toHtml = function() {
    let htmlArgs = [];
    let out = '<select class="transform">\n';
    for (let transform of validTransforms)
    {
      var htmlArgument = '';
      if (transform.type === this.type)
      {
        out += '<option selected value="' + transform.type + '">' + transform.type + '</option>\n';
        for (let i = 0; i < transform.args.length; i++)
        {
          htmlArgument += '<input type="text" class="transform-argument ' + transform.type
            + '" placeholder="' + transform.args[i]
            + '" value="' + this.args[i] + '"/>\n';
        }
      }
      else
      {
        out += '<option value="' + transform.type + '">' + transform.type + '</option>\n';
        for (let i = 0; i < transform.args.length; i++)
        {
          htmlArgument += '<input type="text" class="transform-argument ' + transform.type
            + '" placeholder="' + transform.args[i] + '"/>\n';
        }
      }
      htmlArgs.push(htmlArgument);
    }
    out += '</select>\n';
    out += htmlArgs.join('');
    out += this.visualization.toHtml();

    return out;
  };

  this.toCpp = function() {
    return "Transform::"
      + this.type
      + "("
      + this.args.join(", ")
      + ")";
  };
}

/** Finds the closing bracket of a given opening bracket.
 *
 * This is used to help parsing C++ code.
 */
function findClosingBracket(text, openPosition, bracketType)
{
  let inString = false;
  let count = 1;
  let pos = openPosition + 1;

  let o = "(";
  let c = ")";
  if (bracketType === "curly")
  {
    o = "{";
    c = "}";
  }
  while (count != 0 && pos < text.length)
  {
    let char = text[pos];
    switch (char)
    {
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
function readSingleFile(evt)
{
  //console.log(evt);
  let f = evt.target.files[0];
  if (f) {
    let r = new FileReader();
    r.onload = function (e) {
      let content = e.target.result;
      intelligence = new Intelligence(content);
      let container = $("#intelligence_container");
      container.html(intelligence.toHtml());
      //let container = document.getElementById("intelligence_container");
      //container.innerHTML = intelligence.toHtml();
      intelligence.initializeVisualizations();

    };
    r.readAsText(f);
  } else {
    console.log("Failed to load file");
  }
}
