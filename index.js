// ----- Globals ----------
var canvas = document.getElementById("grid");    
var ctx = canvas.getContext("2d");
var drawList = [];

// ----- Primitives ----------
class Vec2 {
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
    }
}

class Line {
    constructor(pos1, pos2)
    {
        this.pos1 = pos1;
        this.pos2 = pos2;
    }

    draw() {
        ctx.moveTo(this.pos1.x, this.pos1.y);
        ctx.lineTo(this.pos2.x, this.pos2.y);
        ctx.stroke();
    }
}

class Rectangle {
    constructor(pos, size)
    {
        this.pos = pos;
        this.size = size;
    }

    draw() {
        ctx.fillRect(this.pos.x, this.pos.y, this.size.x, this.size.y);
    }
}

class Grid {
    constructor(horizontal, vertical)
    {
        this.list = []; // we create a our own list so our lines aren't cached and redrawn by the drawList during resize
        this.horizontal = horizontal;
        this.vertical = vertical;
    }

    draw() {
        this.list.length = 0; // clear list

        line(0, getHeight() / 2, getWidth(), getHeight() / 2, this.list);
        line(getWidth() / 2, 0, getWidth() / 2, getHeight(), this.list);
    }
}

const Operation = {
    Add: 'Add',
    Subtract: 'Subtract',
    Multiply: 'Multiply',
    Divide: 'Divide',
    Exponent: 'Exponent',
};

class Constant {
    constructor(value)
    {
        this.value = value;
    }

    evaluate() {
        return this.value;
    }
}

// For now, we'll only support x and y as our variables for equations.
// User-defined variables are totally a possibility in the future.
const Reserved = {
    X: Symbol('x'),
    Y: Symbol('y')
};

class Registry {
    static map = new Map;

    static get(variable) {
        return this.map.get(variable);
    }

    static set(variable, value) {
        this.map.set(variable, value);
    }

    static exists(variable) {
        return this.map.has(variable);
    }
}

class Variable
{
    constructor(symbol)
    {
        this.symbol = symbol;
        Registry.set(this.symbol, 0);
    }

    evaluate() {
        return Registry.get(this.symbol);
    }
}

class Expression {
    constructor(term1, term2, op)
    {
        this.term1 = term1;
        this.term2 = term2;
        this.op = op;
    }

    evaluate()
    {
        switch (this.op)
        {
            case Operation.Add: { return (this.term1.evaluate() + this.term2.evaluate()); }
            case Operation.Subtract: { return (this.term1.evaluate() - this.term2.evaluate()); }
            case Operation.Multiply: { return (this.term1.evaluate() * this.term2.evaluate()); }
            case Operation.Divide: { return (this.term1.evaluate() / this.term2.evaluate()); }
            case Operation.Exponent: { return Math.pow(this.term1.evaluate(), this.term2.evaluate()); }
            default: return 0;
        }
    }
}


// ----- Entry ----------
{
    // Resize Callback
    window.onresize = sizeCanvas;
    sizeCanvas();

    // Draw the grid
    grid();
}

// ----- Parsing Test ----------
/* {
    var tokens = tokenize("123/433*2+1");
    console.log(tokens);
} */

// ----- Registry Test ----------
/* {
    var variable = 'x';
    Registry.set(variable, 5);
    console.log(Registry.get(variable));
} */

// ----- Expression Test ----------
/* {
    var constants = [];
    for (var i = 0; i <= 10; i++)
    {
        constants.push(new Constant(i));
    }

    var mult = new Expression(constants[5], constants[2], Operation.Multiply);
    console.log(mult.evaluate());
    
    var add = new Expression(constants[1], mult, Operation.Add);
    console.log(add.evaluate());
} */

// ----- Graphing ----------

// The challenge here will be to create a system for representing equations
// and parsing them from the user. My plan is to create a class representing an
// expression which has two terms and an operation. A term can be a constant, 
// a variable, or another expression. We can then fairly easily write a system 
// to recursively evaluate an expression. When we want to graph, we'll convert the
// user-defined equation into and implicit equation (y = x -> y - x = 0) and then use
// the marching squares algorithm to graph. This will be the barebones of the graphing
// engine.

// ----- Parsing ----------

// I am writing this algorithm with a small bit of background knowledge on
// compiler design. First we tokenize into our seperate tokens. Then, we write
// a recursive algorithm that will convert the tokens into expressions.

function parseInput(id)
{
    var expr = document.body.getElementsByClassName("equation")[id].value; // retrieve raw input
    
    var tokens = tokenize(expr);
    console.log(tokens);
}

function isNumeric(str) {
    if (typeof str != "string") return false; // we only process strings!  

    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
           !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

function isOperator(str) {
    return (str == '+') 
        || (str == '-')
        || (str == '*')
        || (str == '/')
        || (str == '^');   
}

function tokenize(expr) {

    var tokens = [];

    for (var i = 0; i < expr.length; i++) // Loop through each character in the string.
    {
        var char = expr.charAt(i); // get the current character
        
        // Constants
        if (isNumeric(char)) 
        {
            var value = parseInt(char);

            while (i + 1 < expr.length) // loop as long as there is a character after
            {
                var nextChar = expr.charAt(i + 1);

                if (!isNumeric(nextChar)) // break out of loop if not a number
                    break; 
                
                // if next char is a number, append it to our constant.
                value = value * 10 + parseInt(nextChar);
                
                // we don't need to parse the next character now.
                i++;
            }
            
            // once we've parsed the constant, push it and skip to next token.
            tokens.push(value);
            continue;
        }

        // Operators
        if (isOperator(char))
        {
            var op;
            switch (char)
            {
                case '+': { op = Operation.Add; break; }
                case '-': { op = Operation.Subtract; break; }
                case '*': { op = Operation.Multiply; break; }
                case '/': { op = Operation.Divide; break; }
                case '^': { op = Operation.Exponent; break; }
            }
            
            tokens.push(op);
            continue;
        }

        // X & Y
        if (char.toLowerCase() == 'x')
        {
            tokens.push(Reserved.X);
            continue;
        } else if (char.toLowerCase() == 'y')
        {
            tokens.push(Reserved.Y);
            continue;
        }

        // Whitespace
        if (char == ' ')
            continue;

        console.error("Unknown token: " + char);
    }

    return tokens;
}

// ----- Utility ----------
function getWidth() {
    return ctx.canvas.width;
}

function getHeight() {
    return ctx.canvas.height;
}

// ----- Drawing ----------
function draw(list, item)
{
    item.draw();
    list.push(item);
}

function clear() {
    ctx.clear();
    drawList.clear();
}

function line(x1, y1, x2, y2, list = drawList)
{
    var pos1 = new Vec2(x1, y1);
    var pos2 = new Vec2(x2, y2);
    var line = new Line(pos1, pos2);
    draw(list, line);
}

function rect(x, y, w, h, list = drawList)
{
    var pos = new Vec2(x, y);
    var size = new Vec2(w, h);
    var rect = new Rectangle(pos, size);
    draw(list, rect);
}

function grid(left = -10, right = 10, bottom = -10, top = 10, list = drawList) {
    var grid = new Grid(new Vec2(left, right), new Vec2(bottom, top));
    draw(list, grid);
}

// Resize Callback
function sizeCanvas() {
    ctx.canvas.width = window.innerWidth * 0.75;
    ctx.canvas.height = window.innerHeight;

    // Redraw All Elements
    for (var i = 0; i < drawList.length; i++)
    {
        drawList[i].draw();
    }
}

// ----- Equations ----------
var equationCount = 0;

function addEquation() {
    var sidebar = document.getElementsByClassName("sidebar")[0];

    var input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Write your equation!";
    input.classList.add("equation");
    
    var id = equationCount; // copy id now so that it's stored
    input.oninput = function() { parseInput(id); }
    equationCount++;

    sidebar.appendChild(input);
}