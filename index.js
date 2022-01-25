// ----- Globals ----------
var canvas = document.getElementById("grid");    
var ctx = canvas.getContext("2d");
var drawList = [];
var graphList = [];

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

class Token {
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

class Vec2 {
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
    }
}

// ----- Drawables ----------

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

// ----- Constant ----------

class Constant {
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

// ----- Equations ----------

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

class Equation {
    constructor(lhs, rhs)
    {
        this.lhs = lhs;
        this.rhs = rhs;
    }
}

// ----- Graphing ----------

class Graph {
    constructor(equation)
    {
        this.equation = equation;
    }

    async draw()
    {
        if (this.equation == -1) return;

        // Constants
        var tileSize = 1;
        var canvasWidth = getWidth();
        var canvasHeight = getHeight();

        // TODO: obtain these from the grid.
        var screenLeft = -10;
        var screenRight = 10;
        var screenTop = 10;
        var screenBottom = -10;
        
        var implicit = new Expression(this.equation.lhs, this.equation.rhs, Operation.Subtract);

        var data = [];
        for (var i = 0; i <= canvasWidth; i += tileSize)
        {
            var col = [];
            data.push(col);
        }

        // Function to asynchronously evaluate a column
        async function evalCol(data, row) {
            for (var j = 0; j <= canvasHeight; j += tileSize) {
                var x = map(row, 0, canvasWidth, screenLeft, screenRight);
                var y = map(j, 0, canvasHeight, screenTop, screenBottom);

                Registry.set(Reserved.X, x);
                Registry.set(Reserved.Y, y);
                var value = implicit.evaluate();

                data[row].push(value);
            }
        }

        // Run the calculation asynchronously
        var promises = [];
        for (var i = 0; i <= canvasWidth; i += tileSize)
        {
            promises.push(evalCol(data, i));
        }
        await Promise.all(promises);
        
        // Step 2) Draw
        for (var i = 0; i < canvasWidth; i += tileSize)
        {
            // if there isn't another column after this, our algorithm won't work
            if (i >= data.length - 1) break;

            for (var j = 0; j < canvasHeight; j += tileSize)
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
                    rect(i, j, tileSize, tileSize, -1);
                }
            }
        }
    }
}

// ----- Entry ----------
{
    // Resize Callback
    window.onresize = sizeCanvas;
    sizeCanvas();

    grid();

    var tokens = tokenize("x^(x");
    console.log(validate(tokens));
}

// ----- Parsing ----------

// Here's my implementation for an error detection algorithm:
// Iterate through the array, knowing we must start with an operand or opening parenthesis:

// 1. If the last token we parsed was an operator, we can have an operand or opening parenthesis.
// 2. If the last token we parsed was a punctuator, there are a few options that could come next:
    // a. after an opening parenthesis, we can only accept an operand.
    // b. after a closing parenthesis, we can accept an opening parenthesis (implicit multiplication), an operator, or an operand.
// 3. If the last token we parsed was an operand, there are several possibilities:
    // a. we can accept a operator.
    // b. we can accept a variable (implicit multiplication).
    // c. we can accept an opening parenthesis (implicit multiplication).
    // d. we can accept a closing parenthesis (closing expression).

// We also need to guarantee that we end on an operand or a closing parenthesis. and that all of our parenthesis are closed out.

function validate(tokens)
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
                    expected == TokenType.OpeningParenthesis | TokenType.Operator | TokenCategory.Operand;
            }
            else if (Token.match(last, TokenCategory.Operand)) // Operand
            {
                expected = TokenType.Operator | TokenType.Variable | TokenType.OpeningParenthesis | TokenType.ClosingParenthesis;
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

// I want to take a minute to breakdown the pipeline for converting from a string a text to a parsed
// equation. This will allow us to maintain a larger codebase. Here are the steps:

// 1) Tokenize (via tokenize)
// 2) Split equation into expressions (via splitTokens)
// 3) Parse expressions into postfix (via parseTokens)
// 4) Convert postfix into expression tree (via parseExpr)

function parse(string) {
    // Convert the string of characters into an array of tokens
    var toks = tokenize(string);
    console.log(toks);
    if (toks === -1) 
    {
        console.log("Parsing failed because string couldn't be tokenized!");
        return -1;
    }

    // Split the tokens into to expressions to be parsed
    var sides = splitTokens(toks);
    console.log(sides);
    if (sides === -1) 
    {
        console.log("Parsing failed because tokens couldn't be split!");
        return -1;
    }

    var valid = validate(sides[0]) && validate(sides[1]);
    if (!valid)
    {
        console.log("Parsing failed because expression(s) were invalid!");
        return -1;
    }

    var lhs = parseTokens(sides[0]);
    var rhs = parseTokens(sides[1]);
    console.log(lhs, rhs);
    if (lhs === -1 || rhs === -1)
    {
        console.log("Parsing failed because expression(s) couldn't be parsed!");
        return -1;
    }

    lhs = parseExpr(lhs);
    rhs = parseExpr(rhs);
    console.log(lhs, rhs);
    if (lhs === -1 || rhs === -1)
    {
        console.log("Parsing failed because expression(s) couldn't be converted!");
        return -1;
    }

    return new Equation(lhs, rhs);
}

// Another thing to note is that we have essentially **NO** safe error checking. We could switch
// to an infix parser or create a state machine to determine what should be expected in the equation next.
// https://stackoverflow.com/questions/29634992/shunting-yard-validate-expression
// I don't think this is something that will be too hard but it's crucial to implementing a better system.

// Older Comments

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
            outputQueue.push(new Constant(token.value));
        }

        // Parse Variables
        if (token.type == TokenType.Variable)
        {
            outputQueue.push(new Variable(token.value));
        }

        // Handle Parenthesis
        if (Token.match(token.category, TokenCategory.Punctuator))
        {
            if (token.type == TokenType.OpeningParenthesis)
                operatorStack.push('(');
            
            if (token.type == TokenType.ClosingParenthesis)
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
        if (token.type == TokenType.Operator)
        {
            var op = token.value;

            while (operatorStack.length > 0)
            {
                var prevOp = operatorStack[operatorStack.length - 1];

                if (prevOp.Precedence > op.Precedence || prevOp.Precedence == op.Precedence && prevOp.left == true)
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
        else if (token.value == Reserved.X) 
            referenceX = true;
        else if (token.value == Reserved.Y)
            referenceY = true;
    }

    if (referenceX && !referenceY)
    {
        var rhs = [new Token(TokenType.Variable, TokenCategory.Operand, Reserved.Y)];
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
    // Edge case where there is only one variable
    if (expr.length == 1)
    {
        if (isOpName(expr[0]))
            console.error("Operator cannot be parsed as expression!");
        else 
            return expr[0];
    }

    // This is pretty simple. We are going to rely on the parsing algorithm to guarantee that this is valid
    // postfix notation. We go through the array and find the first operator, then we get the two tokens before it, and
    // create an expression out of them. After that, we replace those three values in the array with
    for (var i = 0; i < expr.length; i++)
    {
        var tok = expr[i]; // Get the current token.

        if (!isOpName(tok.Name)) // TODO: This isn't the most comfortable way to write this code. Revisit later.
            continue;

        if (expr.indexOf(tok) < 2) return -1; // If there aren't two terms before the operator, we have a problem.

        var t1 = expr[i - 2];
        var t2 = expr[i - 1];
        var e = new Expression(t1, t2, tok);

        expr.splice(i - 2, 3, e); // replace the three terms we just converted with an evaluable expression
        i = 0;

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
            tokens.push(new Token(TokenType.Constant, TokenCategory.Operand, value));
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

            tokens.push(new Token(TokenType.Variable, TokenCategory.Operand, Reserved.X));
            last = TokenType.Variable;
            continue;
        } else if (char == 'y')
        {
            if (last == TokenType.ClosingParenthesis | Token.match(last, TokenCategory.Operand)) // implicit multiplication
                tokens.push(new Token(TokenType.Operator, TokenCategory.Operator, Operation.Multiply));

            tokens.push(new Token(TokenType.Variable, TokenCategory.Operand, Reserved.Y));
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

function getWidth() {
    return ctx.canvas.width;
}

function getHeight() {
    return ctx.canvas.height;
}

// ----- Math ----------

function map(val, lower, upper, newLower, newUpper)
{
    return ((val - lower) / (upper - lower)) * (newUpper - newLower) + newLower;
}

function oppositeSign(x, y) {
    return (x >= 0 && y <= 0) || (x <= 0 && y >= 0);
}

// ----- Drawing ----------

function draw(list, item)
{
    item.draw();
    if (list != -1) list.push(item);
}

function clear() {
    ctx.clearRect(0, 0, getWidth(), getHeight());
    drawList.clear();
}

function redraw()
{
    ctx.clearRect(0, 0, getWidth(), getHeight());

    // Redraw All Elements
    for (var i = 0; i < drawList.length; i++)
    {
        drawList[i].draw();
    }
    
    for (var i = 0; i < graphList.length; i++)
    {
        graphList[i].draw();
    }
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

// ----- Resize Callback ----------
function sizeCanvas() {
    // The canvas thinks it's the full screen if we don't do this
    ctx.canvas.width = window.innerWidth * 0.75;
    ctx.canvas.height = window.innerHeight;

    redraw();
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

function parseInput(id)
{
    // Retrieve input
    var raw = document.body.getElementsByClassName("equation")[id].value;
    
    // Parse our string
    var equation = parse(raw);
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