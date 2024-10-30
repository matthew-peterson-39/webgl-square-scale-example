// Get the canvas and initialize WebGL context
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

// Vertex shader program with translation and scaling
const vertexShaderSource = `
  attribute vec2 aPosition;
  uniform float uScale;
  uniform vec2 uTranslation;
  void main() {
    gl_Position = vec4((aPosition * uScale) + uTranslation, 0.0, 1.0);
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

// Initialize and link shader program
function initShaderProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);
  return program;
}

const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);

// Define square vertices
const vertices = new Float32Array([
  -0.5, -0.5,
   0.5, -0.5,
  -0.5,  0.5,
   0.5,  0.5
]);

// Buffer setup
function setupBuffers(gl) {
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  return vertexBuffer;
}

// Initialize position attribute
function initAttributes(gl, shaderProgram) {
  const positionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionLocation);
}

// Set up uniforms
const scaleLocation = gl.getUniformLocation(shaderProgram, "uScale");
const translationLocation = gl.getUniformLocation(shaderProgram, "uTranslation");

// Transformation variables
let scale = 1.0;
let scalingDirection = 1;
let translation = [0.0, 0.0];
let translationDirection = 1;

// Update scale
function updateScale() {
  scale += 0.01 * scalingDirection;
  if (scale > 2.0 || scale < 0.5) scalingDirection *= -1;
  gl.uniform1f(scaleLocation, scale);
}

// Update translation
function updateTranslation() {
  translation[0] += 0.01 * translationDirection;
  if (translation[0] > 0.5 || translation[0] < -0.5) translationDirection *= -1;
  gl.uniform2fv(translationLocation, translation);
}

// Render function
function render() {
  // Clear the canvas
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Update transformations
  updateScale();
  updateTranslation();

  // Draw the square
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Loop
  requestAnimationFrame(render);
}

// Initialize and render
setupBuffers(gl);
initAttributes(gl, shaderProgram);
render();
