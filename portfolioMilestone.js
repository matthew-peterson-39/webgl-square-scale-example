// Event listeners for pause, color sync, and camera control sliders
document.getElementById("playPauseButton").onclick = () => {
    animationPaused = !animationPaused;
    if (!animationPaused) render();
};

document.getElementById("colorSyncButton").onclick = () => {
    const color = getRandomColor();
    colors.forEach(cubeColor => {
        cubeColor.current = [...color];
        cubeColor.target = getRandomColor();
    });
};

document.getElementById("radiusSlider").addEventListener("input", (e) => {
    radius = parseFloat(e.target.value);
});

document.getElementById("thetaSlider").addEventListener("input", (e) => {
    theta = parseFloat(e.target.value);
});

document.getElementById("phiSlider").addEventListener("input", (e) => {
    phi = parseFloat(e.target.value);
});

//Global Variables
// WebGL context and canvas initialization
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

// Camera position parameters in polar coordinates
let radius = 2.0;    // Distance from camera to origin
let theta = 0.0;     // Azimuthal angle in the x-z plane (radians)
let phi = Math.PI/2; // Polar angle from the y-axis (radians)

// Animation state flag
let isAnimating = true;

// Global variables (add with your other globals)
let startTime = Date.now();
//End Global Variables


// Helper Functions
// Collision detection function
function checkCollisions(cubeIndex) {
    const cube = positions[cubeIndex];
    const cubeSize = 0.2; // Based on your scale factor
    
    for (let i = 0; i < positions.length; i++) {
        if (i !== cubeIndex) {
            const other = positions[i];
            
            // Simple box collision check
            const collision = Math.abs(cube.x - other.x) < cubeSize &&
                            Math.abs(cube.y - other.y) < cubeSize &&
                            Math.abs(cube.z - other.z) < cubeSize;
            
            if (collision && !cube.hasSplit) {
                splitCube(cubeIndex);
                cube.hasSplit = true;
                return true;
            } else if (collision) {
                // Bounce logic for already split cubes
                directions[cubeIndex].dx *= -1;
                directions[cubeIndex].dy *= -1;
                directions[cubeIndex].dz *= -1;
            }
        }
    }
    return false;
}

// Cube splitting function
function splitCube(index) {
    const originalPos = positions[index];
    const smallScale = 0.1; // Half the original size
    
    // Create 8 smaller cubes
    for (let i = 0; i < 8; i++) {
        const xOffset = (i & 1) ? smallScale : -smallScale;
        const yOffset = (i & 2) ? smallScale : -smallScale;
        const zOffset = (i & 4) ? smallScale : -smallScale;
        
        positions.push({
            x: originalPos.x + xOffset,
            y: originalPos.y + yOffset,
            z: originalPos.z + zOffset,
            hasSplit: true
        });
        
        // Add corresponding properties for new cubes
        angles.push(angles[index]);
        speeds.push(speeds[index] * 1.2);
        colors.push({
            current: [...colors[index].current],
            target: getRandomColor(),
            step: 0
        });
        
        // Add random directions for split pieces
        directions.push({
            dx: (Math.random() - 0.5) * 0.01,
            dy: (Math.random() - 0.5) * 0.01,
            dz: (Math.random() - 0.5) * 0.01
        });
    }
}
// End Helper Functions

const vertexShaderSource = `
    attribute vec3 aPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    
    varying vec3 vPosition;
    
    void main() {
        vPosition = aPosition;
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 uColor;
    uniform float uTime;
    
    varying vec3 vPosition;
    
    void main() {
        vec3 color = vec3(
            sin(uTime + vPosition.x) * 0.5 + 0.5,
            cos(uTime + vPosition.y) * 0.5 + 0.5,
            sin(uTime + vPosition.z) * 0.5 + 0.5
        );
        gl_FragColor = vec4(mix(uColor.rgb, color, 0.3), 1.0);
    }
`;

const fragmentShaderSourceBlack = `
    precision mediump float;
    
    void main() {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
`;

/**
 * Initializes a shader program by compiling and linking vertex and fragment shaders.
 * 
 * - Compiles the provided vertex and fragment shader sources.
 * - Creates a shader program, attaches the shaders, and links the program.
 * - Checks for successful linking and logs an error if linking fails.
 * 
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {string} vertexSource - The source code for the vertex shader.
 * @param {string} fragmentSource - The source code for the fragment shader.
 * @returns {WebGLProgram | null} - The linked shader program, or null if linking fails.
 */
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

// Function to compile a shader from source code
function compileShader(gl, source, type) {
    // Create a new shader of the given type (vertex or fragment)
    const shader = gl.createShader(type);
    
    // Attach the source code to the shader
    gl.shaderSource(shader, source);
    
    // Compile the shader
    gl.compileShader(shader);

    // Check if compilation was successful; log an error if not
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader); // Delete the shader if it failed to compile
        return null;
    }
    
    // Return the compiled shader
    return shader;
}

// Initialize shader programs
const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
const shaderProgramEdges = initShaderProgram(gl, vertexShaderSource, fragmentShaderSourceBlack);

// Define the vertices for a cube in 3D space
const vertices = new Float32Array([
    -0.5, -0.5, -0.5,  // Bottom-back-left
    0.5, -0.5, -0.5,   // Bottom-back-right
    0.5,  0.5, -0.5,   // Top-back-right
    -0.5,  0.5, -0.5,  // Top-back-left
    -0.5, -0.5,  0.5,  // Bottom-front-left
    0.5, -0.5,  0.5,   // Bottom-front-right
    0.5,  0.5,  0.5,   // Top-front-right
    -0.5,  0.5,  0.5   // Top-front-left
]);

// Define indices for the faces of the cube (two triangles per face)
const faceIndices = new Uint16Array([
    0, 1, 2,   0, 2, 3,  // Back face
    4, 5, 6,   4, 6, 7,  // Front face
    0, 4, 7,   0, 7, 3,  // Left face
    1, 5, 6,   1, 6, 2,  // Right face
    3, 2, 6,   3, 6, 7,  // Top face
    0, 1, 5,   0, 5, 4   // Bottom face
]);

// Define indices for the edges of the cube (for wireframe rendering)
const edgeIndices = new Uint16Array([
    0, 1,  1, 2,  2, 3,  3, 0,  // Back edges
    4, 5,  5, 6,  6, 7,  7, 4,  // Front edges
    0, 4,  1, 5,  2, 6,  3, 7   // Connecting edges
]);

// Define initial rotation angles for each cube
let angles = [0, 0, 0, 0, 0, 0];

// Define rotation speeds for each cube, with differnt values, to create varied motion
const speeds = [0.01, 0.02, 0.015, 0.017, 0.018, 0.016];

// Define initial positions for each cube in 3D space
const positions = [
    { x: -0.5, y:  0.0, z: -2.0, hasSplit: false },
    { x:  0.0, y:  0.0, z: -2.5, hasSplit: false },
    { x:  0.5, y:  0.0, z: -3.0, hasSplit: false },
    { x: -1.0, y:  0.5, z: -2.5, hasSplit: false },
    { x:  1.0, y: -0.5, z: -2.5, hasSplit: false },
    { x:  0.0, y:  1.0, z: -3.5, hasSplit: false }
];

// Define movement directions for each cube in x, y, and z axes
const directions = [
    { dx:  0.005, dy:  0.003, dz:  0.002 },
    { dx: -0.004, dy:  0.004, dz:  0.003 },
    { dx:  0.003, dy: -0.005, dz:  0.004 },
    { dx:  0.006, dy: -0.004, dz:  0.003 },
    { dx: -0.005, dy:  0.005, dz: -0.002 },
    { dx:  0.004, dy:  0.003, dz: -0.004 }
];

// Define boundary limits to keep cubes within the canvas view
const boundary = { x: 1.5, y: 1.0, z: -4.0 };

/**
 * Initializes an array of color objects for each cube.
 * Each object in the array contains:
 * - 'current': The current color of the cube in RGBA format (randomly generated).
 * - 'target': The target color to transition to, also in RGBA format (randomly generated).
 * - 'step': A value to control the transition progress between the current and target colors.
 * 
 * This array enables smooth color transitions by interpolating from 'current' to 'target' over time.
 * New target colors are assigned once the transition completes.
 */
const colors = Array.from({ length: 6 }, () => ({
    current: [Math.random(), Math.random(), Math.random(), 1.0],  // Initial random color
    target: [Math.random(), Math.random(), Math.random(), 1.0],    // Target random color for transition
    step: 0  // Step value to control the transition speed
}));


function getRandomColor() {
    return [Math.random(), Math.random(), Math.random(), 1.0];
}

/**
 * Updates the color transition for a cube.
 * 
 * - Increments the 'step' to gradually move from the current color to the target color.
 * - Interpolates each color channel (R, G, B) to create a smooth transition.
 * - Once the transition is complete, sets a new random target color and resets the step.
 * 
 * @param {Object} colorObj - The color object containing 'current', 'target', and 'step' properties.
 */
function updateColorTransition(colorObj) {
    colorObj.step += 0.005;
    for (let i = 0; i < 3; i++) {
        colorObj.current[i] = colorObj.current[i] + (colorObj.target[i] - colorObj.current[i]) * 0.02;
    }
    if (colorObj.step >= 1) {
        colorObj.target = getRandomColor();
        colorObj.step = 0;
    }
}

const buffers = setupBuffers(gl);

/**
 * Sets up buffers for vertex positions, face indices, and edge indices of the cube.
 * 
 * - Creates and binds a buffer for vertex positions.
 * - Creates and binds a buffer for face indices (for filled faces).
 * - Creates and binds a buffer for edge indices (for wireframe edges).
 * 
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @returns {Object} - An object containing the vertex, face, and edge buffers.
 */
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

/**
 * Initializes the position attribute for the vertex shader.
 * 
 * - Retrieves the attribute location for 'aPosition' in the shader program.
 * - Configures the attribute to read vertex data as 3D coordinates (x, y, z).
 * - Enables the attribute array for rendering.
 * 
 * @param {WebGLRenderingContext} gl - The WebGL context.
 * @param {WebGLProgram} shaderProgram - The shader program containing the attribute.
 */
function initAttributes(gl, shaderProgram) {
    const positionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLocation);
}

// Function to update camera view matrix
function updateModelViewMatrix() {
    const modelViewMatrix = mat4.create();
    
    // Convert polar coordinates to Cartesian for camera position
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    // Position camera and look at origin
    mat4.lookAt(
        modelViewMatrix,
        [x, y, z],    // Camera position
        [0, 0, 0],    // Target (origin)
        [0, 1, 0]     // Up vector
    );

    return modelViewMatrix;
}

// Create the projection matrix for setting up the 3D perspective
// Defined globally for use by render() without passing as arg.
const projectionMatrix = mat4.create();
mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 10.0);

// Variable to control whether the animation is paused
let animationPaused = false;

/**
* Renders the scene, updating camera position, transformations, and drawing each cube.
*
* - Clears the canvas and enables depth testing for 3D rendering.
* - Calculates camera position using polar coordinates from user input.
* - Updates each cube's position, rotation, and color transitions.
* - Combines camera and model matrices for proper 3D perspective.
* - Applies transformations and uniforms to render cube faces and edges.
* - Maintains continuous animation through requestAnimationFrame unless paused.
*/
function render() {
    if (animationPaused) return;
 
    // Clear the canvas and enable depth testing for 3D rendering
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
 
    // Calculate time for shader animations
    const currentTime = (Date.now() - startTime) * 0.001;
 
    // Get the camera view matrix
    const cameraMatrix = updateModelViewMatrix();
 
    // Loop through each cube and apply transformations and colors
    for (let i = 0; i < positions.length; i++) {
        const color = colors[i];
        updateColorTransition(color);
 
        gl.useProgram(shaderProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
        initAttributes(gl, shaderProgram);
 
        // Create model matrix for cube positioning and rotation
        const modelMatrix = mat4.create();
        mat4.translate(modelMatrix, modelMatrix, [positions[i].x, positions[i].y, positions[i].z]);
        mat4.scale(modelMatrix, modelMatrix, [0.2, 0.2, 0.2]);
        mat4.rotateY(modelMatrix, modelMatrix, angles[i]);
        mat4.rotateX(modelMatrix, modelMatrix, angles[i] * 0.5);
 
        // Combine camera matrix with model matrix
        const modelViewMatrix = mat4.create();
        mat4.multiply(modelViewMatrix, cameraMatrix, modelMatrix);
 
        // Check for collisions before updating position
        checkCollisions(i);
 
        // Update rotation angle and position based on speed and direction
        angles[i] += speeds[i];
        positions[i].x += directions[i].dx;
        positions[i].y += directions[i].dy;
        positions[i].z += directions[i].dz;
 
        // Bounce cubes off boundaries by reversing direction
        if (positions[i].x > boundary.x || positions[i].x < -boundary.x) directions[i].dx *= -1;
        if (positions[i].y > boundary.y || positions[i].y < -boundary.y) directions[i].dy *= -1;
        if (positions[i].z > -0.5 || positions[i].z < boundary.z) directions[i].dz *= -1;
 
        // Pass time uniform to shader
        const timeLocation = gl.getUniformLocation(shaderProgram, "uTime");
        if (timeLocation) {
            gl.uniform1f(timeLocation, currentTime);
        }
 
        // Set the transformation and color uniforms for the face shader
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "uModelViewMatrix"), false, modelViewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgram, "uProjectionMatrix"), false, projectionMatrix);
        gl.uniform4fv(gl.getUniformLocation(shaderProgram, "uColor"), color.current);
 
        // Draw the cube faces
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.faceIndexBuffer);
        gl.drawElements(gl.TRIANGLES, faceIndices.length, gl.UNSIGNED_SHORT, 0);
 
        // Set and draw the cube edges using the edge shader program
        gl.useProgram(shaderProgramEdges);
        initAttributes(gl, shaderProgramEdges);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgramEdges, "uModelViewMatrix"), false, modelViewMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(shaderProgramEdges, "uProjectionMatrix"), false, projectionMatrix);
 
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.edgeIndexBuffer);
        gl.drawElements(gl.LINES, edgeIndices.length, gl.UNSIGNED_SHORT, 0);
    }
 
    requestAnimationFrame(render);
 }

render();