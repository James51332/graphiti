// Canvas and Draw List
var canvas = document.getElementById("grid");    
var ctx = canvas.getContext("2d");
var drawList = [];

// Primitives
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
        this.list = []; // we create a manual list so our lines aren't cached by the drawList during resize
        this.horizontal = horizontal;
        this.vertical = vertical;
    }

    draw() {
        this.list.length = 0;
        line(0, getHeight() / 2, getWidth(), getHeight() / 2, this.list);
        line(getWidth() / 2, 0, getWidth() / 2, getHeight(), this.list);
    }
}

// Resize Callback
window.onresize = sizeCanvas;
sizeCanvas();

// Entry
grid();

// Graphing API

// The challenge here will be to create a system for representing equations
// and parsing them from the user. My plan is to create a class representing an
// expression which has two terms and an operation. A term can be a constant, 
// a variable, or another expression. We can then fairly easily write a system 
// to recursively evaluate an expression. When we want to graph, we'll convert the
// user-defined equation into and implicit equation (y = x -> y - x = 0) and then use
// the marching squares algorithm to graph. This will be the barebones of the graphing
// engine.

// Utility API
function getWidth() {
    return ctx.canvas.width;
}

function getHeight() {
    return ctx.canvas.height;
}

// Drawing API
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

// Create Expressions
function addEquation() {
    var sidebar = document.getElementsByClassName("sidebar")[0];

    var input = document.createElement("input");
    input.type = "text";
    input.placeholder="Write your equation!"
    input.classList.add("equation");
    sidebar.appendChild(input);
}