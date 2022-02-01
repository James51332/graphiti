// ----- Globals ----------
var canvas = document.getElementById("grid");    
var ctx = canvas.getContext("2d");
var drawList = [];
var graphList = [];
var mouseX = 0, mouseY = 0;

// ----- Primitives ----------

const Operation = {
    Add: {Name: 'Add', Precedence: 1, Left: true},
    Subtract: {Name: 'Subtract', Precedence: 1, Left: true},
    Multiply: {Name: 'Multiply', Precedence: 2, Left: true},
    Divide: {Name: 'Divide', Precedence: 2, Left: true},
    Exponent: {Name: 'Exponent', Precedence: 3, Left: false},
};

const TokenType = {
    None: 0, 
    Constant: 1 << 0,
    Variable: 1 << 1,
    Operator: 1 << 2,
    OpeningParenthesis: 1 << 3,
    ClosingParenthesis: 1 << 4,
    Equals: 1 << 5,
};

const TokenCategory = {
    Punctuator: (TokenType.OpeningParenthesis | TokenType.ClosingParenthesis | TokenType.Equals),
    Operand: (TokenType.Constant | TokenType.Variable),
    Operator: TokenType.Operator, 
    Any: (TokenType.Constant | TokenType.Variable | TokenType.Operator | TokenType.OpeningParenthesis | TokenType.ClosingParenthesis | TokenType.Equals)
};

class Token 
{
    constructor(type, category, value)
    {
        this.type = type;
        this.category = category;
        this.value = value;
    }

    static match(lhs, rhs)
    {
        // Token types and category are created so that a bitwise and 
        // will evaluate to true when the categories match.
        return (lhs & rhs);
    }
}

class Vec2 
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
    }
}

// ----- Drawables ----------

class Line 
{
    constructor(pos1, pos2, thickness)
    {
        this.pos1 = pos1;
        this.pos2 = pos2;
        this.thickness = thickness;
    }

    draw() 
    {
        ctx.beginPath();
        ctx.lineWidth = this.thickness;
        ctx.moveTo(this.pos1.x, this.pos1.y);
        ctx.lineTo(this.pos2.x, this.pos2.y);
        ctx.stroke();
    }
}

class Rectangle 
{
    constructor(pos, size)
    {
        this.pos = pos;
        this.size = size;
    }

    draw() {
        ctx.fillRect(this.pos.x, this.pos.y, this.size.x, this.size.y);
    }
}

class Grid 
{
    static list = [];
    static horizontal = new Vec2(-10, 10);
    static vertical = new Vec2(-10, 10);

    static set(horizontal, vertical)
    {
        this.horizontal = horizontal;
        this.vertical = vertical;
    }

    static draw() 
    {
        this.list.length = 0; // clear list

        var maxLines = 30;

        var x0 = map(0, this.horizontal.x, this.horizontal.y, 0, getWidth());
        var y0 = map(0, this.vertical.x, this.vertical.y, getHeight(), 0);

        var distBetweenX = getWidth() / (this.horizontal.y - this.horizontal.x);
        var distBetweenY = getHeight() / (this.vertical.y - this.vertical.x);

        // Midlines
        line(0, y0, getWidth(), y0, 5, -1);
        line(x0, 0, x0, getHeight(), 5, -1);

        for (var i = x0 - distBetweenX * Math.floor(x0 / distBetweenX); i < getWidth(); i += distBetweenX)
        {   
            line(i, 0, i, getHeight(), 1, -1);
        }

        for (var i = y0 - distBetweenY * Math.floor(y0 / distBetweenY); i < getHeight(); i += distBetweenY)
        {   
            line(0, i, getWidth(), i, 1, -1);
        }
    }
}

// ----- Constant ----------

class Constant 
{
    constructor(value)
    {
        this.value = value;
    }

    evaluate() {
        return this.value;
    }
}

// ----- Variables ----------

const Reserved = {
    X: Symbol('x'),
    Y: Symbol('y')
};

class Registry 
{
    static map = new Map;

    static get(variable) 
    {
        return this.map.get(variable);
    }

    static set(variable, value) 
    {
        this.map.set(variable, value);
    }

    static exists(variable) 
    {
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

// ----- Equations ----------

class Expression 
{
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

class Equation 
{
    constructor(lhs, rhs)
    {
        this.lhs = lhs;
        this.rhs = rhs;
    }
}

// ----- Graphing ----------

class Graph 
{
    constructor(equation)
    {
        this.equation = equation;
    }

    async draw()
    {
        if (this.equation == -1) return;

        // Constants
        var tileSize = 2;
        var canvasWidth = getWidth();
        var canvasHeight = getHeight();

        var screenLeft = Grid.horizontal.x;
        var screenRight = Grid.horizontal.y;
        var screenBottom = Grid.vertical.x;
        var screenTop = Grid.vertical.y;
        
        var implicit = new Expression(this.equation.lhs, this.equation.rhs, Operation.Subtract);

        var data = [];
        for (var i = 0; i <= canvasWidth; i += tileSize)
        {
            var col = [];
            data.push(col);
        }

        // Function to asynchronously evaluate a column
        async function evalCol(data, row) {
            var i = map(row, 0, data.length - 1, 0, getWidth());

            for (var j = 0; j <= canvasHeight; j += tileSize) {
                var x = map(i, 0, canvasWidth, screenLeft, screenRight);
                var y = map(j, 0, canvasHeight, screenTop, screenBottom);

                Registry.set(Reserved.X, x);
                Registry.set(Reserved.Y, y);
                var value = implicit.evaluate();

                data[row].push(value);
            }
        }

        // Run the calculation asynchronously
        var promises = [];
        for (var i = 0; i < data.length; i += 1)
        {
            promises.push(evalCol(data, i));
        }
        await Promise.all(promises);
        
        // Step 2) Draw
        for (var i = 0; i < data.length; i += 1)
        {
            // if there isn't another column after this, our algorithm won't work
            if (i >= data.length - 1) break;

            for (var j = 0; j < data[0].length; j += 1)
            {
                // if there isn't another row after this, our algorithm won't work
                if (j >= data[i].length - 1) break;

                var p1 = data[i][j]; // top left
                var p2 = data[i + 1][j]; // top right
                var p3 = data[i + 1][j + 1]; // bottom right
                var p4 = data[i][j + 1]; // bottom left

                // TODO: One flaw with this system is that it graphs lines across asymptotes 
                // because the sign of the implicit function changes. I'm not exactly sure how
                // to fix this yet. One thing to note is the difference between the points will
                // skip across infinities instead of zero. This could be a potential solution.
                if (oppositeSign(p1, p2) 
                    | oppositeSign(p2, p3)
                    | oppositeSign(p3, p4)
                    | oppositeSign(p4, p1))
                {
                    var sx = map(i, 0, data.length - 1, 0, canvasWidth);
                    var sy = map(j, 0, data[0].length - 1, 0, canvasHeight);
                    rect(sx, sy, tileSize, tileSize, -1);
                }
            }
        }
    }
}

// ----- Parsing ----------

function parse(tokens) 
{
    // Step 1) Convert Equation to Separate Expressions
    var sides = splitTokens(tokens);
    if (sides === -1) 
    {
        console.log("Parsing failed because tokens couldn't be split!");
        return -1;
    }

    // Step 2) Validate Expressions
    var valid = verifyExpression(sides[0]) && verifyExpression(sides[1]);
    if (!valid)
    {
        console.log("Parsing failed because expression(s) were invalid!");
        return -1;
    }

    // Step 3) Parse Expressions into Postfix Notation
    console.log(sides[0]);
    var lhs = parseTokens(sides[0]);
    var rhs = parseTokens(sides[1]);
    if (lhs === -1 || rhs === -1)
    {
        console.log("Parsing failed because expression(s) couldn't be parsed!");
        return -1;
    }

    // Step 4) Convert Postfix to Expression Tree
    var leftExpr = parsePostfix(lhs);
    var rightExpr = parsePostfix(rhs);
    if (leftExpr === -1 || rightExpr === -1)
    {
        console.log("Parsing failed because expression(s) couldn't be converted!");
        return -1;
    }

    // Step 5) Return Equation from Expressions.
    return new Equation(leftExpr, rightExpr);
}

// Here's my implementation for an error detection algorithm:
// Iterate through the array, knowing we must start with an operand or opening parenthesis:

// 1. If the last token we parsed was an operator, we can have an operand or opening parenthesis.
// 2. If the last token we parsed was a punctuator, there are a few options that could come next:
    // a. after an opening parenthesis, we can only accept an operand.
    // b. after a closing parenthesis, we can accept an operator.
// 3. If the last token we parsed was an operand, there are several possibilities:
    // a. we can accept a operator.
    // d. we can accept a closing parenthesis (closing expression).

// We also need to guarantee that we end on an operand or a closing parenthesis. and that all of our parenthesis are closed out.

function verifyExpression(tokens)
{
    var last = TokenType.None;
    var expected = (TokenCategory.Operand | TokenType.OpeningParenthesis);
    var parenthesis = 0;

    for (var i = 0; i < tokens.length; i++)
    {
        // Step 1) Determine allowable tokens
        if (last != TokenType.None) // For all calls except for first
        {
            if (Token.match(last, TokenCategory.Operator)) // Operator
            {
                expected = TokenCategory.Operand | TokenType.OpeningParenthesis;
            }
            else if (Token.match(last, TokenCategory.Punctuator)) // Punctuator
            {
                if (last == TokenType.OpeningParenthesis)
                    expected == TokenCategory.Operand;
                else if (last == TokenType.ClosingParenthesis)
                    expected == TokenType.Operator;
            }
            else if (Token.match(last, TokenCategory.Operand)) // Operand
            {
                expected = TokenType.Operator | TokenType.ClosingParenthesis;
            }
        }
        
        // Step 2) Verify token is allowable
        var token = tokens[i];
        var category = token.category;
        var type = token.type;

        if (!Token.match(category, expected)) 
        { 
            console.log("Unexpected token: ", token.value);
            return false; 
        }

        // Step 3) Increment or decrement parenthesis counter
        if (type == TokenType.OpeningParenthesis)
            parenthesis++;
        else if (type == TokenType.ClosingParenthesis)
            parenthesis--;

        var last = category;
    }

    // Step 4) Verify last token
    expected = TokenCategory.Operand | TokenType.ClosingParenthesis;
    if (!Token.match(last, expected))
    {
        console.log("Unexpected end of expression!");
        return false;
    }

    // Step 5) Ensure parenthesis are all matched
    if (parenthesis != 0)
    {
        console.log("Unmatched parenthesis");
        return false;
    }

    // Step 6) If all else succeeds, our expression is valid
    return true;
}

// ----- Shunting-Yard Algorithm ----------

// https://www.freecodecamp.org/news/parsing-math-expressions-with-javascript-7e8f5572276e/
// https://web.archive.org/web/20200719202722/https://en.wikipedia.org/wiki/Shunting-yard_algorithm

// Here's the algorithm
// 1. Read a token. Let’s call it t
// 2. If t is a Literal or Variable, push it to the output queue.
// 3. If t is an Operator:
    // a. while there is an Operator token o at the top of the operator stack and either t is left-associative and has precedence is less than or equal to that of o, or t is right associative, and has precedence less than that of o, pop o off the operator stack, onto the output queue;
    // b. at the end of iteration push t onto the operator stack.
// 6. If the token is a Left Parenthesis, push it onto the stack.
// 7. If the token is a Right Parenthesis, pop operators off the stack onto the output queue until the token at the top of the stack is a left parenthesis. Then pop the left parenthesis from the stack, but not onto the output queue.
// 8. If the token at the top of the stack is a Function, pop it onto the output queue.
// When there are no more tokens to read, pop any Operator tokens on the stack onto the output queue.
// Exit.

function parseTokens(tokens)
{   
    var outputQueue = [];
    var operatorStack = [];

    var last = TokenType.None;

    for (var i = 0; i < tokens.length; i++)
    {
        var token = tokens[i];

        // Parse Constants
        if (token.type == TokenType.Constant)
        {
            outputQueue.push(token.value);
        }

        // Parse Variables
        if (token.type == TokenType.Variable)
        {
            outputQueue.push(token.value);
        }

        // Handle Parenthesis
        if (Token.match(token.category, TokenCategory.Punctuator))
        {
            if (token.type == TokenType.OpeningParenthesis)
                operatorStack.push(token);
            
            if (token.type == TokenType.ClosingParenthesis)
            {
                while (true)
                {
                    var operator = operatorStack.pop();
                    if (operator.value == '(' || operatorStack.length == 0) break;

                    outputQueue.push(operator);
                }
            }
        }

        // Operator Stack
        if (token.type == TokenType.Operator)
        {
            var op = token;

            while (operatorStack.length > 0)
            {
                var prevOp = operatorStack[operatorStack.length - 1];

                if (prevOp.value.Precedence > op.value.Precedence || prevOp.value.Precedence == op.value.Precedence && prevOp.value.left == true)
                {
                    operatorStack.pop();
                    outputQueue.push(prevOp);
                } else 
                {
                    break;
                }
            }

            operatorStack.push(token);
        }

        last = token.type;
    }

    // Pop remaining stack to output
    while (operatorStack.length > 0)
    {
        outputQueue.push(operatorStack.pop());
    }

    return outputQueue;
}

// Split an array of tokens into two arrays if there is an equations. We also convert any equations
// that can be graphed into two sets of tokens.
function splitTokens(toks)
{
    // Loop through the array and ensure that there is only one '=' symbol.
    for (var i = 0; i < toks.length; i++)
    {
        var token = toks[i];

        if (token.category == TokenCategory.Punctuator && token.value == '=')
        {
            for (var j = i + 1; j < toks.length; j++) 
            {
                var tok = toks[j];
                if (tok.category == TokenCategory.Punctuator && tok.value == '=')
                {
                    console.log("Expression failed to parse because it contained more than on equals sign!");
                    return -1;
                }
            }

            // Split the equation into to sides and return them.
            var lhs = toks.slice(0, i);
            var rhs = toks.slice(i + 1, toks.length);
            return [lhs, rhs];
        }
    }

    // If we haven't returned yet, then we are only parsing an expression. Allow this to be 
    // equal to y. For instance, x^2 => x^2 = y. Note that if the lhs uses, y, this isn't
    // valid. Typing x*y shouldn't graph anything. We also should ensure there is at least
    // one reference to the variable x.

    var referenceX = false, referenceY = false;
    for (var i = 0; i < toks.length; i++)
    {
        var token = toks[i];

        if (token.type != TokenType.Variable)
            continue;
        else if (token.value.symbol == Reserved.X) 
            referenceX = true;
        else if (token.value.symbol == Reserved.Y)
            referenceY = true;
    }

    if (referenceX && !referenceY)
    {
        var rhs = [new Token(TokenType.Variable, TokenCategory.Operand, new Variable(Reserved.Y))];
        return [toks, rhs];
    } else
    {
        // No reason to throw an error here. We just go ahead and return -1
        // to signal that this expression shouldn't be parsed. We could eventually
        // implement some feature to evaluate and not necessarily graph, but that's
        // out of the current scope.
        return -1;
    }
}

// Accepts an RPN Array
function parsePostfix(expr)
{
    // Edge case where there is only one variable
    if (expr.length == 1)
    {
        var token = expr[0];
        if (token.type == TokenType.Operator)
            console.error("Operator cannot be parsed as expression!");
        else 
            return token;
    }

    // This is pretty simple. We are going to rely on the parsing algorithm to guarantee that this is valid
    // postfix notation. We go through the array and find the first operator, then we get the two tokens before it, and
    // create an expression out of them. After that, we replace those three values in the array with
    for (var i = 0; i < expr.length; i++)
    {
        var tok = expr[i]; // Get the current token.

        // In order to be able to easily check if a token is an operator, we 
        // pass operators as tokens, but constants and variables as their respective classes.
        if (tok.type != TokenType.Operator) 
            continue;

        if (expr.indexOf(tok) < 2) return -1; // If there aren't two terms before the operator, we have a problem.

        // We need to pass the constants and variables instead of tokens because we can't take the value since it could be an expression.
        var t1 = expr[i - 2];
        var t2 = expr[i - 1];
        var e = new Expression(t1, t2, tok.value); 

        expr.splice(i - 2, 3, e); // replace the three terms we just converted with an evaluable expression
        i = 0;

        if (expr.length == 1)
            return e;
    }
}

// ----- Tokenizing ----------

function isNumeric(str) 
{
    if (typeof str != "string") return false; // we only process strings!  

    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
           !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

function isOperator(str) 
{
    return (str == '+') 
        || (str == '-')
        || (str == '*')
        || (str == '/')
        || (str == '^');   
}

function tokenize(expr) 
{

    var tokens = [];
    var last = TokenType.None;

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

            if (last == TokenType.ClosingParenthesis) // implicit multiplication
                tokens.push(new Token(TokenType.Operator, TokenCategory.Operator, Operation.Multiply));

            // once we've parsed the constant, push it and skip to next token.
            tokens.push(new Token(TokenType.Constant, TokenCategory.Operand, new Constant(value)));
            last = TokenType.Constant;
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
            
            tokens.push(new Token(TokenType.Operator, TokenCategory.Operator, op));
            last = TokenType.Operator
            continue;
        }

        // X & Y
        if (char == 'x')
        {
            if (last == TokenType.ClosingParenthesis | Token.match(last, TokenCategory.Operand)) // implicit multiplication
                tokens.push(new Token(TokenType.Operator, TokenCategory.Operator, Operation.Multiply));

            tokens.push(new Token(TokenType.Variable, TokenCategory.Operand, new Variable(Reserved.X)));
            last = TokenType.Variable;
            continue;
        } else if (char == 'y')
        {
            if (last == TokenType.ClosingParenthesis | Token.match(last, TokenCategory.Operand)) // implicit multiplication
                tokens.push(new Token(TokenType.Operator, TokenCategory.Operator, Operation.Multiply));

            tokens.push(new Token(TokenType.Variable, TokenCategory.Operand, new Variable(Reserved.Y)));
            last = TokenType.Variable;
            continue;
        }

        // Parenthesis
        if (char == '(')
        {
            if (last == TokenType.ClosingParenthesis | Token.match(last, TokenCategory.Operand)) // implicit multiplication
                tokens.push(new Token(TokenType.Operator, TokenCategory.Operator, Operation.Multiply));

            tokens.push(new Token(TokenType.OpeningParenthesis, TokenCategory.Punctuator, '('));
            last = TokenType.OpeningParenthesis;
            continue;
        } else if (char == ')')
        {
            tokens.push(new Token(TokenType.ClosingParenthesis, TokenCategory.Punctuator, ')'));
            last = TokenType.ClosingParenthesis;
            continue;
        }

        // Equals
        if (char == '=')
        {
            tokens.push(new Token(TokenType.Equals, TokenCategory.Punctuator, '='));
            last = TokenType.Equals;
            continue;
        }

        // Whitespace
        if (char == ' ')
            continue;

        console.log("Unknown token: " + char);
        return -1;
    }

    return tokens;
}

// ----- Utility ----------

function getWidth() 
{
    return ctx.canvas.width;
}

function getHeight() 
{
    return ctx.canvas.height;
}

// ----- Math ----------

function map(val, lower, upper, newLower, newUpper)
{
    return ((val - lower) / (upper - lower)) * (newUpper - newLower) + newLower;
}

// treat zero as positive
function oppositeSign(x, y) {
    return (x >= 0 && y < 0) || (x < 0 && y >= 0);
}

// ----- Drawing ----------

function draw(list, item)
{
    item.draw();
    if (list != -1) list.push(item);
}

function clear() 
{
    ctx.clearRect(0, 0, getWidth(), getHeight());
    drawList.clear();
}

function redraw()
{
    // Step 1) Clear Screen
    ctx.clearRect(0, 0, getWidth(), getHeight());

    // Step 2) Redraw All Elements
    for (var i = 0; i < drawList.length; i++)
    {
        drawList[i].draw();
    }
    
    // Step 3) Redraw Grids
    for (var i = 0; i < graphList.length; i++)
    {
        graphList[i].draw();
    }
}

function line(x1, y1, x2, y2, t, list = drawList)
{
    var pos1 = new Vec2(x1, y1);
    var pos2 = new Vec2(x2, y2);
    var line = new Line(pos1, pos2, t);
    draw(list, line);
}

function rect(x, y, w, h, list = drawList)
{
    var pos = new Vec2(x, y);
    var size = new Vec2(w, h);
    var rect = new Rectangle(pos, size);
    draw(list, rect);
}

function grid(list = drawList)
{
    draw(list, Grid);
}

// ----- Resize Callback ----------

function sizeCanvas() 
{
    // The canvas thinks it's the full screen if we don't do this
    ctx.canvas.width = window.innerWidth * 0.75 * 2;
    ctx.canvas.height = window.innerHeight * 2;

    var ratio = getHeight() / getWidth();
    var newVertRange = (Grid.horizontal.y - Grid.horizontal.x) * ratio;
    var curVertRange = (Grid.vertical.y - Grid.vertical.x);
    var rangeRatio = newVertRange / curVertRange;
    Grid.vertical.y *= rangeRatio;
    Grid.vertical.x *= rangeRatio;

    redraw();
}

window.onresize = sizeCanvas;
sizeCanvas();

// ----- Equations ----------

var equationCount = 0;

function addEquation() 
{
    var sidebar = document.getElementsByClassName("sidebar")[0];

    var inputDiv = document.createElement("div");
    inputDiv.classList.add("container");
    
    var input = document.createElement("input");
    input.type = "text";
    input.classList.add("equation");
    
    
    var id = equationCount; // copy id now so that it's stored
    input.oninput = function() { parseInput(id); }
    equationCount++;
    
    inputDiv.appendChild(input);

    var left = document.createElement("div");
    left.classList.add("left");
    var num = document.createElement("h3");
    num.innerHTML = id + 1;
    left.appendChild(num);
    inputDiv.appendChild(left);

    sidebar.appendChild(inputDiv);
}

function parseInput(id)
{
    // Retrieve input
    var raw = document.body.getElementsByClassName("equation")[id].value;
    
    // Parse our string
    var tokens = tokenize(raw);
    var equation = parse(tokens);
    var graph = new Graph(equation);
    
    if (equationCount > graphList.length)
    {
        graphList.push(graph);
        graph.draw();
    } else
    {
        graphList[id] = graph;
        redraw();
    }
}

// ----- User Input ----------

var panning = false;
canvas.addEventListener('mousemove', (e) => 
{
    var deltaX = (e.offsetX * 2) - mouseX;
    var deltaY = (e.offsetY * 2) - mouseY;

    mouseX = e.offsetX * 2;
    mouseY = e.offsetY * 2;

    if (!panning) return;

    var moveX = map(deltaX, 0, getWidth(), 0, Grid.horizontal.y - Grid.horizontal.x); // if we move our mouse half way right, move the grid left. therefore, we subtract.
    Grid.horizontal.x -= moveX;
    Grid.horizontal.y -= moveX;

    var moveY = map(deltaY, 0, getHeight(), 0, Grid.vertical.x - Grid.vertical.y);
    Grid.vertical.x -= moveY;
    Grid.vertical.y -= moveY;

    redraw();
});
  
canvas.addEventListener('mousedown', (e) => 
{
    panning = true;
});

window.addEventListener('mouseup', e => 
{
    panning = false;
});

// ----- Entry ----------
{
    grid();
}