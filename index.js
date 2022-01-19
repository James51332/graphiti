// ----- Globals ----------
var canvas = document.getElementById("grid");    
var ctx = canvas.getContext("2d");
var drawList = [];

// ----- Primitives ----------
const Token = {
    Constant: 'Constant',
    Variable: 'Variable',
    Operator: 'Operator',
    Punctuator: 'Punctuator'
};

const Operation = {
    Add: {Name: 'Add', Precedence: 1},
    Subtract: {Name: 'Subtract', Precedence: 1},
    Multiply: {Name: 'Multiply', Precedence: 2},
    Divide: {Name: 'Divide', Precedence: 2},
    Exponent: {Name: 'Exponent', Precedence: 3},
};

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
        ctx.lineWidth = 2;
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
        
        if (!Registry.exists(symbol))
            Registry.set(symbol, 0);
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

    grid();
    graphRaw("y-x^2");
}

// ----- Graphing ----------

// The challenge here will be to create a system for representing equations
// and parsing them from the user. My plan is to create a class representing an
// expression which has two terms and an operation. A term can be a constant, 
// a variable, or another expression. We can then fairly easily write a system 
// to recursively evaluate an expression. When we want to graph, we'll convert the
// user-defined equation into and implicit equation (y = x -> y - x = 0) and then use
// the marching squares algorithm to graph. This will be the barebones of the graphing
// engine.

// I've gone ahead and implemented a couple of these features. I haven't written the marching squares algorithm yet
// instead choosing to iterate and check how close a single point on each "tile" is to 0. This has the problem of where
// some parts of the curve don't fall into the tolerance.

function oppositeSign(x, y) {
    return (x >= 0 && y <= 0) || (x <= 0 && y >= 0);
}

class Voxel {
    constructor(l, t, size, expr) {
        this.l = l;
        this.t = t;
        this.size = size;
        this.expr = expr;
    }

    evaluate() {
        // Point 1
        Registry.set(Reserved.X, this.l);
        Registry.set(Reserved.Y, this.t);
        p1 = expr.evaluate();
        // Point 2
        Registry.set(Reserved.X, this.l + this.size);
        Registry.set(Reserved.Y, this.t);
        p2 = expr.evaluate();
        // Point 3
        Registry.set(Reserved.X, this.l + this.size);
        Registry.set(Reserved.Y, this.t + this.size);
        p3 = expr.evaluate();
        // Point 4
        Registry.set(Reserved.X, this.l);
        Registry.set(Reserved.Y, this.t + this.size);
        p4 = expr.evaluate();
    }
}

function map(val, lower, upper, newLower, newUpper)
{
    return ((val - lower) / (upper - lower)) * (newUpper - newLower) + newLower;
}

function graphRaw(expr)
{
    var toks = tokenize(expr);
    //console.log(toks);
    var rpn = parseTokens(toks);
    //console.log(rpn);
    var expr = parseExpr(rpn);
    console.log(expr);

    // let's try out our grid test
    // we'll assume our expression is one side of an implicit equation
    var tileSize = 2;
    var canvasWidth = getWidth();
    var canvasHeight = getHeight();

    // let's evaluate our function at the corners of our box.
    // if the sign varies between points we'll need to draw a line.
    // this could be parallelized in the future.
    var screenLeft = -10;
    var screenRight = 10;
    var screenTop = 10;
    var screenBottom = -10;
    
    // i and j represent screen space
    for (var i = 0; i < canvasWidth; i += tileSize)
    {
        for (var j = 0; j < canvasHeight; j += tileSize)
        {
            // here we map to grid space
            var l = map(i, 0, canvasWidth, screenLeft, screenRight);
            var t = map(j, 0, canvasHeight, screenTop, screenBottom);
            var r = map(i + tileSize, 0, canvasWidth, screenLeft, screenRight);
            var b = map(j + tileSize, 0, canvasHeight, screenTop, screenBottom);

            // Point 1
            Registry.set(Reserved.X, l);
            Registry.set(Reserved.Y, t);
            p1 = expr.evaluate();

            // Point 2
            Registry.set(Reserved.X, r);
            Registry.set(Reserved.Y, t);
            p2 = expr.evaluate();

            // Point 3
            Registry.set(Reserved.X, r);
            Registry.set(Reserved.Y, b);
            p3 = expr.evaluate();

            // Point 4
            Registry.set(Reserved.X, l);
            Registry.set(Reserved.Y, b);
            p4 = expr.evaluate();

            // This is a simple method for now to graph our curve based on its closeness to 0.
            // We'll adjust to marching squares in future revisions.

            var points = [];
            if (oppositeSign(p1, p2)) 
            {
                points.push(new Vec2(i + tileSize/2, j));
            }
            if (oppositeSign(p2, p3))
            {
                points.push(new Vec2(i + tileSize, j + tileSize/2));
            }
            if (oppositeSign(p3, p4))
            {
                points.push(new Vec2(i + tileSize/2, j + tileSize));
            }
            if (oppositeSign(p4, p1))
            {
                points.push(new Vec2(i, j + tileSize/2));
            }

            for (var k = 0; k + 1 < points.length; k += 2)
            {
                line(points[k].x, points[k].y, points[k + 1].x, points[k + 1].y);
            }

            // if (Math.abs(p1) < 1) 
            // rect(i, getHeight() - j, tileSize, tileSize);
        }
    }
}

// ----- Parsing ----------

// I am writing this algorithm with a small bit of background knowledge on
// compiler design. First we tokenize into our seperate tokens. Then, we write
// a recursive descent algorithm that will convert the tokens into expressions.
// Currently, I'm looking at the Shunting-yard algorithm as a good starting place.
// This will also handle operator-precedence. We create two stacks of values and then
// operators.

// https://www.freecodecamp.org/news/parsing-math-expressions-with-javascript-7e8f5572276e/
// https://web.archive.org/web/20200719202722/https://en.wikipedia.org/wiki/Shunting-yard_algorithm

// Here's the algorithm
// 1. Read a token. Let’s call it t
// 2. If t is a Literal or Variable, push it to the output queue.
// 3. If t is a Function, push it onto the stack.
// 4. If t is a Function Argument Separator (a comma), pop operators off the stack onto the output queue until the token at the top of the stack is a Left Parenthesis.
// 5. If t is an Operator:
    // a. while there is an Operator token o at the top of the operator stack and either t is left-associative and has precedence is less than or equal to that of o, or t is right associative, and has precedence less than that of o, pop o off the operator stack, onto the output queue;
    // b. at the end of iteration push t onto the operator stack.
// 6. If the token is a Left Parenthesis, push it onto the stack.
// 7. If the token is a Right Parenthesis, pop operators off the stack onto the output queue until the token at the top of the stack is a left parenthesis. Then pop the left parenthesis from the stack, but not onto the output queue.
// 8. If the token at the top of the stack is a Function, pop it onto the output queue.
// When there are no more tokens to read, pop any Operator tokens on the stack onto the output queue.
// Exit.

// This function uses the shunting-yard algorithm to convert the token list into postfix notation
// which can more easily be converted into an abstract syntax tree, and therefore, an expression

function parseTokens(tokens)
{
    var outputQueue = [];
    var operatorStack = [];

    // TODO: Parsing Validation
    for (var i = 0; i < tokens.length; i++)
    {
        var token = tokens[i];

        // Parse Numbers
        if (token[0] == Token.Constant)
            outputQueue.push(new Constant(token[1]));

        // Parse Variables
        if (token[0] == Token.Variable)
            outputQueue.push(new Variable(token[1]));

        // Handle Parenthesis
        if (token[0] == Token.Punctuator)
        {
            if (token[1] == '(')
                operatorStack.push('(');
            
            if (token[1] == ')')
            {
                while (true)
                {
                    var operator = operatorStack.pop();
                    if (operator == '(' || operatorStack.length == 0) break;

                    outputQueue.push(operator);
                }
            }
        }

        // Operator Stack
        if (token[0] == Token.Operator)
        {
            var op = token[1];

            while (operatorStack.length > 0)
            {
                var prevOp = operatorStack[operatorStack.length - 1];

                if (prevOp.Precedence > op.Precedence)
                {
                    operatorStack.pop();
                    outputQueue.push(prevOp);
                } else 
                {
                    break;
                }
            }

            operatorStack.push(op);
        }
    }

    // Pop remaining stack to output
    while (operatorStack.length > 0)
    {
        outputQueue.push(operatorStack.pop());
    }

    return outputQueue;
}

function parseInput(id)
{
    var raw = document.body.getElementsByClassName("equation")[id].value; // retrieve raw input
    
    var tokens = tokenize(raw);
    //console.log(tokens);

    var rpn = parseTokens(tokens);
    //console.log(rpn);

    var expr = parseExpr(rpn);
    //console.log(expr.evaluate());

    try { if (expr.evaluate()) // test to see if the expression evaluates.
        graphRaw(raw);
    } catch {}
}

function isOpName(tok)
{
    return (tok == 'Add')
        || (tok == 'Subtract')
        || (tok == 'Multiply')
        || (tok == 'Divide')
        || (tok == 'Exponent');
}

// Accepts an RPN Array
function parseExpr(expr)
{
    for (var i = 0; i < expr.length; i++)
    {
        var tok = expr[i];
        if (!isOpName(tok.Name)) // TODO: This isn't the most comfortable way to write this code. Revisit later.
            continue;

        if (expr.indexOf(tok) < 2)
        {
            console.log("Parsing Error!");
            return;
        }

        var t1 = expr[i - 2];
        var t2 = expr[i - 1];

        var e = new Expression(t1, t2, tok);
        expr.splice(i - 2, 3, e);
        i=0;

        if (expr.length == 1)
            return e;
    }
}

// ----- Tokenizing ----------

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
            tokens.push([Token.Constant, value]);
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
            
            tokens.push([Token.Operator, op]);
            continue;
        }

        // X & Y
        if (char.toLowerCase() == 'x')
        {
            tokens.push([Token.Variable, Reserved.X]);
            continue;
        } else if (char.toLowerCase() == 'y')
        {
            tokens.push([Token.Variable, Reserved.Y]);
            continue;
        }

        // Parenthesis
        if (char == '(')
        {
            tokens.push([Token.Punctuator, '(']);
            continue;
        } else if (char == ')')
        {
            tokens.push([Token.Punctuator, ')']);
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

// ----- Registry Test ----------
{
    // Marching Square Algorithm
    // Cases obtained from https://en.wikipedia.org/wiki/Marching_squares
    
    const lookup = [
        [ // cell 1 negative
            [ // cell 2 negative
                [ // cell 3 negative
                    function() { // (0, 0, 0, 0)
                        // do nothing
                    },
                    function() { // (0, 0, 0, 1)
                        // triangle bottom left
                    }
                ],
                [
                    function() { // (0, 0, 1, 0)
                        // triangle bottom right
                    },
                    function() { // (0, 0, 1, 1)
                        // bottom half
                    }
                ]
            ],
            [ // cell 2 positive
                [ // cell 3 negative
                    function() { // (0, 1, 0, 0)
                        // triangle top right
                    },
                    function() { // (0, 1, 0, 1)
                        // ambiguous case (test center)
                    }  
                ],
                [ // cell 3 positive
                    function() { // (0, 1, 1, 0)
                        // right half
                    },
                    function() { // (0, 1, 1, 1)
                        // all but top left
                    }
                ]
            ]
        ],
        [ // cell 1 positive
            [ // cell 2 negative
                [ // cell 3 negative
                    function() { // (1, 0, 0, 0)
                        // top left triangle
                    },
                    function() { // (1, 0, 0, 1)
                        // left half
                    }
                ],
                [ // cell 3 positive
                    function() { // (1, 0, 1, 0)
                        // ambiguous case (test center)
                    },
                    function() { // (1, 0, 1, 1)
                        // all but top right
                    }
                ]
            ],
            [ // cell 2 positive
                [ // cell 3 negative
                    function() { // (1, 1, 0, 0)
                        // top half
                    },
                    function() { // (1, 1, 0, 1)
                        // all but bottom right
                    } 
                ],
                [ // cell 3 positive
                    function() { // (1, 1, 1, 0)
                        // all but 
                    },
                    function() { // (1, 1, 1, 1)
                        line(10, 10, 200, 200);
                    }
                ]
            ]
        ]
    ];

    lookup[1][1][1][1]();

    // var variable = 'x';
    // Registry.set(variable, 5);
    // console.log(Registry.get(variable));
}

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