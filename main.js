// Get the canvas and initialize WebGL context
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

// Vertex shader program
const vertexShaderSource = `
  attribute vec2 aPosition;
  uniform float uScale;
  void main() {
    gl_Position = vec4(aPosition * uScale, 0.0, 1.0);
  }
`;

// Fragment shader program
const fragmentShaderSource = `
  void main() {
    gl_FragColor = vec4(0.0, 0.5, 1.0, 1.0); // Color the square blue
  }
`;

// Compile shader helper function
function compileShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

// Create and link shader program
const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
const shaderProgram = gl.createProgram();
gl.attachShader(shaderProgram, vertexShader);
gl.attachShader(shaderProgram, fragmentShader);
gl.linkProgram(shaderProgram);
gl.useProgram(shaderProgram);

// Define square vertices
const vertices = new Float32Array([
  -0.5, -0.5,
   0.5, -0.5,
  -0.5,  0.5,
   0.5,  0.5
]);

// Create buffer and send data
const vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Get attribute location, enable it, and point to the data
const positionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(positionLocation);

// Get uniform location for scale
const scaleLocation = gl.getUniformLocation(shaderProgram, "uScale");

// Scaling variables
let scale = 1.0;
let scalingDirection = 1;

// Render function
function render() {
  // Clear the canvas
  gl.clearColor(1.0, 1.0, 1.0, 1.0); // White background
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Update scale
//   scale += 0.1 * scalingDirection; // Fast scale
  scale += 0.01 * scalingDirection; // Med scale
//   scale += 0.001 * scalingDirection;  // Slow scale

  if (scale > 2.0 || scale < 0.5) scalingDirection *= -1; // Reverse direction

  // Set the scale uniform
  gl.uniform1f(scaleLocation, scale);

  // Draw the square
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Loop
  requestAnimationFrame(render);
}

// Start rendering
render();
