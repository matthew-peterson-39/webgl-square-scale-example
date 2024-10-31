// Get the canvas and initialize WebGL context
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

// Vertex shader program with 3D transformations
const vertexShaderSource = `
  attribute vec3 aPosition;
  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;
  void main() {
    gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
  }
`;

// Fragment shader program for blue faces
const fragmentShaderSourceBlue = `
  void main() {
    gl_FragColor = vec4(0.0, 0.5, 1.0, 1.0); // Blue color for faces
  }
`;

// Fragment shader program for black lines
const fragmentShaderSourceBlack = `
  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black color for edges
  }
`;

function initShaderProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
  const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Error linking program:", gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

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


// Initialize shader programs for faces and edges
const shaderProgramFaces = initShaderProgram(gl, vertexShaderSource, fragmentShaderSourceBlue);
const shaderProgramEdges = initShaderProgram(gl, vertexShaderSource, fragmentShaderSourceBlack);

// Define vertices for a 3D cube
const vertices = new Float32Array([
  -0.5, -0.5, -0.5, // Bottom-back-left
   0.5, -0.5, -0.5, // Bottom-back-right
   0.5,  0.5, -0.5, // Top-back-right
  -0.5,  0.5, -0.5, // Top-back-left
  -0.5, -0.5,  0.5, // Bottom-front-left
   0.5, -0.5,  0.5, // Bottom-front-right
   0.5,  0.5,  0.5, // Top-front-right
  -0.5,  0.5,  0.5  // Top-front-left
]);

// Indices for the cube faces (two triangles per face)
const faceIndices = new Uint16Array([
  0, 1, 2,  0, 2, 3, // Back face
  4, 5, 6,  4, 6, 7, // Front face
  0, 4, 7,  0, 7, 3, // Left face
  1, 5, 6,  1, 6, 2, // Right face
  3, 2, 6,  3, 6, 7, // Top face
  0, 1, 5,  0, 5, 4  // Bottom face
]);

// Indices for the cube edges
const edgeIndices = new Uint16Array([
  0, 1,  1, 2,  2, 3,  3, 0, // Back edges
  4, 5,  5, 6,  6, 7,  7, 4, // Front edges
  0, 4,  1, 5,  2, 6,  3, 7  // Connecting edges
]);

// Buffer setup for vertices and indices
function setupBuffers(gl) {
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const faceIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceIndices, gl.STATIC_DRAW);

  const edgeIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edgeIndices, gl.STATIC_DRAW);

  return { vertexBuffer, faceIndexBuffer, edgeIndexBuffer };
}

// Initialize position attribute
function initAttributes(gl, shaderProgram) {
  const positionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
  gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(positionLocation);
}

// Set up uniform matrices
const modelViewMatrixLocationFaces = gl.getUniformLocation(shaderProgramFaces, "uModelViewMatrix");
const projectionMatrixLocationFaces = gl.getUniformLocation(shaderProgramFaces, "uProjectionMatrix");

const modelViewMatrixLocationEdges = gl.getUniformLocation(shaderProgramEdges, "uModelViewMatrix");
const projectionMatrixLocationEdges = gl.getUniformLocation(shaderProgramEdges, "uProjectionMatrix");

// Transformation variables
let angle = 0;

// Update model view matrix
function updateModelViewMatrix() {
  const modelViewMatrix = mat4.create();
  mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -2.0]);
  mat4.rotateY(modelViewMatrix, modelViewMatrix, angle);
  mat4.rotateX(modelViewMatrix, modelViewMatrix, angle * 0.5);
  angle += 0.01;

  gl.useProgram(shaderProgramFaces);
  gl.uniformMatrix4fv(modelViewMatrixLocationFaces, false, modelViewMatrix);

  gl.useProgram(shaderProgramEdges);
  gl.uniformMatrix4fv(modelViewMatrixLocationEdges, false, modelViewMatrix);
}

// Set up perspective projection
function setupProjectionMatrix() {
  const projectionMatrix = mat4.create();
  mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 10.0);

  gl.useProgram(shaderProgramFaces);
  gl.uniformMatrix4fv(projectionMatrixLocationFaces, false, projectionMatrix);

  gl.useProgram(shaderProgramEdges);
  gl.uniformMatrix4fv(projectionMatrixLocationEdges, false, projectionMatrix);
}

// Render function
function render() {
  // Clear the canvas and enable depth testing
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST);

  // Update transformations
  updateModelViewMatrix();

  // Draw faces in blue
  gl.useProgram(shaderProgramFaces);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.faceIndexBuffer);
  gl.drawElements(gl.TRIANGLES, faceIndices.length, gl.UNSIGNED_SHORT, 0);

  // Draw edges in black
  gl.useProgram(shaderProgramEdges);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.edgeIndexBuffer);
  gl.drawElements(gl.LINES, edgeIndices.length, gl.UNSIGNED_SHORT, 0);

  // Loop
  requestAnimationFrame(render);
}

// Initialize buffers, attributes, and render
const buffers = setupBuffers(gl);
gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
initAttributes(gl, shaderProgramFaces);
initAttributes(gl, shaderProgramEdges);
setupProjectionMatrix();
render();
