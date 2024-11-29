// Event Listener Section
// Controls animation playback state
document.getElementById("playPauseButton").onclick = () => {
    animationPaused = !animationPaused;
    if (!animationPaused) render();
};

// Synchronizes all cube colors to a new random color
document.getElementById("colorSyncButton").onclick = () => {
    const color = getRandomColor();
    colors.forEach(cubeColor => {
        cubeColor.current = [...color];
        cubeColor.target = getRandomColor();
    });
};

// Camera Control Section
// Updates camera distance from origin (zoom)
document.getElementById("radiusSlider").addEventListener("input", (e) => {
    radius = parseFloat(e.target.value);
});

// Updates horizontal camera rotation angle
document.getElementById("thetaSlider").addEventListener("input", (e) => {
    theta = parseFloat(e.target.value);
});

// Updates vertical camera rotation angle
document.getElementById("phiSlider").addEventListener("input", (e) => {
    phi = parseFloat(e.target.value);
});

// WebGL Setup Section
// Initialize WebGL context and canvas
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");

// Camera Configuration
let radius = 2.0;    // Camera distance from scene center
let theta = 0.0;     // Horizontal rotation angle (x-z plane)
let phi = Math.PI/2; // Vertical rotation angle from y-axis

// Animation State
let isAnimating = true;
let startTime = Date.now();

// Grid Configuration
const gridSize = 10;  // Number of grid lines in each direction
const gridStep = 0.5; // Spacing between grid lines
const gridVertices = [];
const gridIndices = [];

// Generate grid vertices and indices for visual reference
let index = 0;
for (let i = -gridSize; i <= gridSize; i++) {
    // Create X-axis parallel lines
    gridVertices.push(i * gridStep, 0, -gridSize * gridStep);  // Line start
    gridVertices.push(i * gridStep, 0, gridSize * gridStep);   // Line end
    gridIndices.push(index, index + 1);
    index += 2;

    // Create Z-axis parallel lines
    gridVertices.push(-gridSize * gridStep, 0, i * gridStep);  // Line start
    gridVertices.push(gridSize * gridStep, 0, i * gridStep);   // Line end
    gridIndices.push(index, index + 1);
    index += 2;
}

/**
 * Collision Detection System
 * Implements Axis-Aligned Bounding Box (AABB) collision detection between cubes
 * and handles collision responses through either subdivision or direction reversal.
 * 
 * Detection Algorithm:
 * Uses AABB (Axis-Aligned Bounding Box) collision detection:
 * - Checks separation along each axis (x, y, z)
 * - Collision occurs if separation < cubeSize on all axes
 * - More efficient than sphere or complex polygon collision
 * 
 * Collision Response Types:
 * 1. Subdivision Response:
 *    - Triggers when an unsplit cube collides
 *    - Splits cube into 8 smaller cubes
 *    - Sets hasSplit flag to prevent further splits
 * 
 * 2. Bounce Response:
 *    - Triggers when already-split cubes collide
 *    - Reverses all movement directions
 *    - Simulates elastic collision
 * 
 * @param {number} cubeIndex - Index of cube to check for collisions
 * @returns {boolean} True if collision occurred and cube was split, false otherwise
 * 
 * Performance Considerations:
 * - O(n) complexity where n is number of cubes
 * - Excludes self-collision check
 * - Early returns on split collision
 * 
 * Global Dependencies:
 * @requires positions - Array of cube positions
 * @requires directions - Array of movement vectors
 * @requires splitCube - Function to handle cube subdivision
 * 
 * @example
 * // Check collisions for cube 0
 * if (checkCollisions(0)) {
 *     console.log("Cube 0 collided and split");
 * }
 */
function checkCollisions(cubeIndex) {
    const cube = positions[cubeIndex];
    const cubeSize = 0.2;
    
    const candidates = spatialGrid.getPotentialCollisions(cubeIndex);
    
    for (const i of candidates) {
        const other = positions[i];
        
        const collision = 
            Math.abs(cube.x - other.x) < cubeSize &&
            Math.abs(cube.y - other.y) < cubeSize &&
            Math.abs(cube.z - other.z) < cubeSize;
        
        if (collision) {
            if (!cube.hasSplit) {
                splitCube(cubeIndex);
                cube.hasSplit = true;
                return true;
            } else {
                directions[cubeIndex].dx *= -1;
                directions[cubeIndex].dy *= -1;
                directions[cubeIndex].dz *= -1;
            }
        }
    }
    return false;
}

/**
 * Cube Subdivision System
 * Splits a single cube into 8 smaller cubes upon collision, creating an
 * octree-like subdivision effect with inherited and modified properties.
 * 
 * Algorithm Overview:
 * 1. Takes original cube's position
 * 2. Creates 8 smaller cubes at offset positions
 * 3. Inherits and modifies properties from parent cube
 * 4. Assigns new movement patterns to child cubes
 * 
 * @param {number} index - Index of the original cube in the positions array
 * 
 * Bit Operations for Position Calculation:
 * - i & 1: Determines X offset (0 or 1)
 * - i & 2: Determines Y offset (0 or 2)
 * - i & 4: Determines Z offset (0 or 4)
 * 
 * Example bit patterns for i=0 to 7:
 * i=0: 000 → (-x, -y, -z)
 * i=1: 001 → (+x, -y, -z)
 * i=2: 010 → (-x, +y, -z)
 * i=3: 011 → (+x, +y, -z)
 * i=4: 100 → (-x, -y, +z)
 * i=5: 101 → (+x, -y, +z)
 * i=6: 110 → (-x, +y, +z)
 * i=7: 111 → (+x, +y, +z)
 * 
 * Property Inheritance:
 * - Position: Offset from parent's position
 * - Angles: Direct inheritance
 * - Speeds: 120% of parent's speed
 * - Colors: Initial color inherited, new target color
 * - Movement: Random direction with scaled magnitude
 * 
 * Global Dependencies:
 * @requires positions - Array of cube positions
 * @requires angles - Array of rotation angles
 * @requires speeds - Array of rotation speeds
 * @requires colors - Array of color states
 * @requires directions - Array of movement vectors
 */
function splitCube(index) {
    // Store original cube's position for reference
    const originalPos = positions[index];
    const smallScale = 0.1; // Half-size of child cubes
    
    // Create 8 smaller cubes (2^3 octants)
    for (let i = 0; i < 8; i++) {
        // Use bit operations to determine offset signs
        // Bit 0 (i & 1): X axis offset
        // Bit 1 (i & 2): Y axis offset
        // Bit 2 (i & 4): Z axis offset
        const xOffset = (i & 1) ? smallScale : -smallScale;
        const yOffset = (i & 2) ? smallScale : -smallScale;
        const zOffset = (i & 4) ? smallScale : -smallScale;
        
        // Position new cube in corresponding octant
        positions.push({
            x: originalPos.x + xOffset,
            y: originalPos.y + yOffset,
            z: originalPos.z + zOffset,
            hasSplit: true // Mark as subdivided to prevent further splits
        });
        
        // Copy and modify inherited properties
        angles.push(angles[index]);  // Maintain parent's rotation
        speeds.push(speeds[index] * 1.2);  // Increase rotation speed
        
        // Initialize color state with inheritance
        colors.push({
            current: [...colors[index].current],  // Copy current color
            target: getRandomColor(),  // Set new target color
            step: 0  // Reset transition progress
        });
        
        // Generate random movement vector
        // Scale factor 0.01 controls movement speed
        // Random - 0.5 centers range around 0
        directions.push({
            dx: (Math.random() - 0.5) * 0.01,  // X direction
            dy: (Math.random() - 0.5) * 0.01,  // Y direction
            dz: (Math.random() - 0.5) * 0.01   // Z direction
        });
    }
}

/**
 * Vertex Shader for Cube Rendering
 * This GLSL shader processes individual vertices for the cube geometry,
 * applying camera and projection transformations.
 * 
 * Shader Inputs:
 * @attribute vec3 aPosition - Raw vertex position from vertex buffer
 *   - Format: (x, y, z) coordinates
 *   - Range: Defined in model space
 *   - Usage: Input from WebGL vertex buffer
 * 
 * Uniforms (Global Variables):
 * @uniform mat4 uModelViewMatrix 
 *   - Combined model and view transformations
 *   - Handles object position and camera view
 *   - Updated per frame for animation
 * 
 * @uniform mat4 uProjectionMatrix
 *   - Perspective projection matrix
 *   - Converts 3D coordinates to clip space
 *   - Typically updated only on canvas resize
 * 
 * Outputs:
 * @varying vec3 vPosition
 *   - Passes vertex position to fragment shader
 *   - Used for position-based color effects
 * 
 * @output gl_Position
 *   - Built-in output for final vertex position
 *   - Must be in clip space (-1 to +1 for each component)
 * 
 * Transformation Pipeline:
 * 1. Start with raw vertex position (aPosition)
 * 2. Convert to vec4 for matrix multiplication
 * 3. Apply model-view transformation
 * 4. Apply projection transformation
 * 5. Output to gl_Position for rasterization
 */
const vertexShaderSource = `
    // Input vertex position from buffer
    attribute vec3 aPosition;

    // Transformation matrices from JavaScript
    uniform mat4 uModelViewMatrix;    // Camera and object transforms
    uniform mat4 uProjectionMatrix;   // Perspective projection
    
    // Output to fragment shader
    varying vec3 vPosition;
    
    void main() {
        // Pass position to fragment shader for color calculations
        vPosition = aPosition;

        // Transform vertex position through matrices
        // 1. Convert vec3 position to vec4 (w = 1.0 for points)
        // 2. Multiply by model-view matrix for camera space
        // 3. Multiply by projection matrix for clip space
        gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
    }
`;

/**
 * Fragment Shader for Animated Cube Faces
 * This GLSL shader determines the color of each pixel on cube faces,
 * creating an animated color effect by blending base color with 
 * position-based and time-based variations.
 * 
 * Precision Setting:
 * @precision mediump float
 *   - Medium precision for floating-point calculations
 *   - Balances performance and accuracy
 *   - Sufficient for color computations
 * 
 * Inputs:
 * @uniform vec4 uColor
 *   - Base color for the cube face
 *   - Format: (red, green, blue, alpha)
 *   - Range: [0.0, 1.0] for each component
 * 
 * @uniform float uTime
 *   - Elapsed time for animation
 *   - Used to create dynamic color changes
 *   - Updated per frame
 * 
 * @varying vec3 vPosition
 *   - Interpolated vertex position from vertex shader
 *   - Used to create position-based color variation
 *   - Varies across face of cube
 * 
 * Color Calculation:
 * 1. Dynamic Color Component Generation:
 *    - Red:   sin(time + x_position) * 0.5 + 0.5
 *    - Green: cos(time + y_position) * 0.5 + 0.5
 *    - Blue:  sin(time + z_position) * 0.5 + 0.5
 *    Note: * 0.5 + 0.5 transforms range from [-1,1] to [0,1]
 * 
 * 2. Color Blending:
 *    - Mixes base color (uColor) with animated color
 *    - Blend factor: 0.3 (30% animated, 70% base color)
 *    - Alpha fixed at 1.0 for full opacity
 * 
 * Output:
 * @output gl_FragColor
 *   - Final pixel color (RGBA)
 *   - Format: vec4(red, green, blue, alpha)
 *   - Range: [0.0, 1.0] for each component
 */
const fragmentShaderSource = `
    // Set floating point precision
    precision mediump float;

    // Input uniforms for base color and animation time
    uniform vec4 uColor;    // Base color from JavaScript
    uniform float uTime;    // Animation time
    
    // Input varying from vertex shader
    varying vec3 vPosition; // Interpolated position
    
    void main() {
        // Generate animated color components based on position and time
        vec3 color = vec3(
            // Red component: Sine wave based on x-position and time
            sin(uTime + vPosition.x) * 0.5 + 0.5,
            
            // Green component: Cosine wave based on y-position and time
            cos(uTime + vPosition.y) * 0.5 + 0.5,
            
            // Blue component: Sine wave based on z-position and time
            sin(uTime + vPosition.z) * 0.5 + 0.5
        );

        // Mix base color with animated color and set full opacity
        // mix(x,y,a) = x * (1-a) + y * a
        gl_FragColor = vec4(mix(uColor.rgb, color, 0.3), 1.0);
    }
`;

/**
 * Fragment Shader for Cube Edges
 * A minimal GLSL shader that renders solid black lines for cube wireframes
 * and grid lines. This shader is designed for maximum simplicity and efficiency
 * when rendering structural elements.
 * 
 * Precision Setting:
 * @precision mediump float
 *   - Medium precision floating-point calculations
 *   - Optimal for simple color output
 *   - Provides good balance between precision and performance
 *   - More than sufficient for solid color rendering
 * 
 * Color Output:
 * gl_FragColor components:
 *   - Red:   0.0 (no red component)
 *   - Green: 0.0 (no green component)
 *   - Blue:  0.0 (no blue component)
 *   - Alpha: 1.0 (fully opaque)
 * 
 * Usage Context:
 * - Applied to cube edges for wireframe visualization
 * - Used for reference grid lines
 * - Provides visual structure and depth cues
 * - Creates contrast with colored cube faces
 * 
 * Performance Notes:
 * - No uniform inputs required
 * - No varying inputs required
 * - No calculations performed
 * - Highly efficient shader execution
 * 
 * @output gl_FragColor
 *   - Fixed black color output
 *   - Format: vec4(r, g, b, a)
 *   - All components in range [0.0, 1.0]
 */
const fragmentShaderSourceBlack = `
    // Set floating point precision for calculations
    precision mediump float;
    
    void main() {
        // Output solid black color with full opacity
        // vec4(red, green, blue, alpha)
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
`;

/**
 * Creates and initializes a WebGL shader program from vertex and fragment shader sources.
 * The shader program is essential for rendering as it controls how vertices are processed
 * and how pixels are colored in WebGL.
 * 
 * Process:
 * 1. Compiles individual vertex and fragment shaders
 * 2. Creates a new shader program
 * 3. Attaches both shaders to the program
 * 4. Links the program to create an executable
 * 5. Validates the program creation
 * 
 * @param {WebGLRenderingContext} gl - The WebGL rendering context
 * @param {string} vertexSource - GLSL source code for the vertex shader
 * @param {string} fragmentSource - GLSL source code for the fragment shader
 * @returns {WebGLProgram|null} The compiled and linked shader program, or null if creation fails
 * 
 * @example
 * const shaderProgram = initShaderProgram(gl, 
 *     `attribute vec3 position; void main() { ... }`, // vertex shader
 *     `precision mediump float; void main() { ... }`  // fragment shader
 * );
 */
function initShaderProgram(gl, vertexSource, fragmentSource) {
    // Compile both shaders using helper function
    const vertexShader = compileShader(gl, vertexSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentSource, gl.FRAGMENT_SHADER);
    
    // Exit if either shader compilation fails
    if (!vertexShader || !fragmentShader) return null;
   
    // Create new shader program object
    const program = gl.createProgram();
    
    // Attach both shaders to the program
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    
    // Link shaders into a complete program
    gl.linkProgram(program);

    // Verify program creation success
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Error linking program:", gl.getProgramInfoLog(program));
        return null;
    }
   
    return program;
}

/**
 * Compiles a WebGL shader from source code.
 * This function handles the compilation of individual shader objects
 * (either vertex or fragment shaders) that will be used in a shader program.
 * 
 * Process:
 * 1. Creates a new shader object of specified type
 * 2. Assigns the GLSL source code to the shader
 * 3. Compiles the shader
 * 4. Verifies compilation success
 * 
 * @param {WebGLRenderingContext} gl - The WebGL rendering context
 * @param {string} source - GLSL source code for the shader
 * @param {number} type - Shader type: gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @returns {WebGLShader|null} The compiled shader object, or null if compilation fails
 * 
 * @example
 * const vertexShader = compileShader(gl, 
 *     `attribute vec3 position; void main() { ... }`, 
 *     gl.VERTEX_SHADER
 * );
 */
function compileShader(gl, source, type) {
    // Create new shader object of specified type
    const shader = gl.createShader(type);
    
    // Attach source code to shader object
    gl.shaderSource(shader, source);
    
    // Compile the shader
    gl.compileShader(shader);

    // Check compilation status
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Error compiling shader:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);  // Clean up failed shader object
        return null;
    }
   
    return shader;
}

// Initialize shader programs for faces and edges
const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
const shaderProgramEdges = initShaderProgram(gl, vertexShaderSource, fragmentShaderSourceBlack);

// Geometry Data
// Cube vertex coordinates
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

// Triangle indices for cube faces
const faceIndices = new Uint16Array([
    0, 1, 2,   0, 2, 3,  // Back face
    4, 5, 6,   4, 6, 7,  // Front face
    0, 4, 7,   0, 7, 3,  // Left face
    1, 5, 6,   1, 6, 2,  // Right face
    3, 2, 6,   3, 6, 7,  // Top face
    0, 1, 5,   0, 5, 4   // Bottom face
]);

// Line indices for cube edges
const edgeIndices = new Uint16Array([
    0, 1,  1, 2,  2, 3,  3, 0,  // Back edges
    4, 5,  5, 6,  6, 7,  7, 4,  // Front edges
    0, 4,  1, 5,  2, 6,  3, 7   // Connecting edges
]);

// Animation and Movement Configuration
// Initial rotation angles for each cube
let angles = [0, 0, 0, 0, 0, 0];

// Unique rotation speeds for varied motion
const speeds = [0.01, 0.02, 0.015, 0.017, 0.018, 0.016];

// Initial cube positions in 3D space
const positions = [
    { x: -0.5, y:  0.0, z: -2.0, hasSplit: false },
    { x:  0.0, y:  0.0, z: -2.5, hasSplit: false },
    { x:  0.5, y:  0.0, z: -3.0, hasSplit: false },
    { x: -1.0, y:  0.5, z: -2.5, hasSplit: false },
    { x:  1.0, y: -0.5, z: -2.5, hasSplit: false },
    { x:  0.0, y:  1.0, z: -3.5, hasSplit: false }
];

// Movement vectors for each cube
const directions = [
    { dx:  0.005, dy:  0.003, dz:  0.002 },
    { dx: -0.004, dy:  0.004, dz:  0.003 },
    { dx:  0.003, dy: -0.005, dz:  0.004 },
    { dx:  0.006, dy: -0.004, dz:  0.003 },
    { dx: -0.005, dy:  0.005, dz: -0.002 },
    { dx:  0.004, dy:  0.003, dz: -0.004 }
];

// Movement boundaries to contain cubes
const boundary = { x: 1.5, y: 1.0, z: -4.0 };

/**
 * Color Management System for WebGL Cubes
 * Initializes an array of color states for each cube in the scene using Array.from().
 * Each cube maintains both current and target colors for smooth transitions.
 * 
 * Structure breakdown:
 * - Array of 6 color objects (one per initial cube)
 * - Each color object contains:
 *   - current: Active color values [R, G, B, A]
 *   - target: Color values to transition towards
 *   - step: Progress tracker for color transitions
 * 
 * Color format:
 * - RGB values are in range [0.0, 1.0]
 * - Alpha (A) is fixed at 1.0 for full opacity
 * - Array indices: [0]=R, [1]=G, [2]=B, [3]=A
 * 
 * @constant {Array<Object>} colors
 * @property {Array<number>} current - Current [R,G,B,A] values for active color
 * @property {Array<number>} target - Target [R,G,B,A] values for transition
 * @property {number} step - Transition progress (0.0 to 1.0)
 * 
 * @example
 * // Accessing color values for first cube
 * const firstCubeColor = colors[0].current;  // [R,G,B,A]
 * const firstCubeTarget = colors[0].target;  // [R,G,B,A]
 * const transitionProgress = colors[0].step;  // 0.0 to 1.0
 */
const colors = Array.from({ length: 6 }, () => ({
    // Initialize current color with random RGB values and full opacity
    current: [Math.random(), Math.random(), Math.random(), 1.0],
    
    // Set initial target color for smooth transition
    target: [Math.random(), Math.random(), Math.random(), 1.0],
    
    // Initialize transition progress at 0
    step: 0
}));

/**
 * Generates a random RGBA color array for WebGL rendering.
 * Creates colors suitable for cube faces and color transitions.
 * 
 * Color Components:
 * - Red:   Random value between 0.0 and 1.0
 * - Green: Random value between 0.0 and 1.0
 * - Blue:  Random value between 0.0 and 1.0
 * - Alpha: Fixed at 1.0 (fully opaque)
 * 
 * Return Format:
 * [R, G, B, A] where each value is in range [0.0, 1.0]
 * Index mapping:
 * - 0: Red component
 * - 1: Green component
 * - 2: Blue component
 * - 3: Alpha component (always 1.0)
 * 
 * @returns {Array<number>} Four-element array containing RGBA values
 * 
 * @example
 * // Generate a random color
 * const color = getRandomColor();  // Returns [0.7, 0.2, 0.9, 1.0]
 * 
 * // Use in WebGL uniform
 * gl.uniform4fv(colorLocation, getRandomColor());
 * 
 * // Use for color transition
 * colorObj.target = getRandomColor();
 */
function getRandomColor() {
    return [
        Math.random(),  // Red component   (0.0 to 1.0)
        Math.random(),  // Green component (0.0 to 1.0)
        Math.random(),  // Blue component  (0.0 to 1.0)
        1.0            // Alpha component (fixed at 1.0)
    ];
}

/**
 * Manages smooth color transitions between current and target colors for cubes.
 * This function implements a linear interpolation (lerp) for RGB color channels
 * and handles the generation of new target colors when transitions complete.
 * 
 * Algorithm steps:
 * 1. Increments transition progress by small step value
 * 2. Updates each RGB channel (index 0-2) using linear interpolation
 * 3. Generates new target color when transition completes
 * 
 * @param {Object} colorObj - Object containing color transition data
 * @param {Array} colorObj.current - Current [R,G,B,A] color values (range 0-1)
 * @param {Array} colorObj.target - Target [R,G,B,A] color values (range 0-1)
 * @param {number} colorObj.step - Tracks transition progress (range 0-1)
 */
function updateColorTransition(colorObj) {
    // Increment transition progress (0.005 controls overall transition speed)
    colorObj.step += 0.005;

    // Update each RGB channel separately (skip alpha channel)
    for (let i = 0; i < 3; i++) {
        // Linear interpolation formula: current + (target - current) * step
        // 0.02 controls individual step size for smooth transition
        colorObj.current[i] = colorObj.current[i] + (colorObj.target[i] - colorObj.current[i]) * 0.02;
    }

    // Check if transition is complete
    if (colorObj.step >= 1) {
        colorObj.target = getRandomColor();  // Generate new target color
        colorObj.step = 0;                   // Reset transition progress
    }
}

// Buffer Setup
const buffers = setupBuffers(gl);

/**
 * Initializes and configures all WebGL buffers required for rendering the scene.
 * This function creates separate buffers for cube vertices, faces, edges, and the reference grid.
 * 
 * Buffer Types Created:
 * 1. Vertex Buffer: Stores cube vertex positions
 * 2. Face Index Buffer: Stores triangle indices for cube faces
 * 3. Edge Index Buffer: Stores line indices for cube wireframes
 * 4. Grid Vertex Buffer: Stores reference grid vertex positions
 * 5. Grid Index Buffer: Stores grid line indices
 * 
 * Buffer Usage:
 * - All buffers use gl.STATIC_DRAW as they contain static geometry
 * - Vertex data uses Float32Array for precise positions
 * - Index data uses Uint16Array for efficient memory usage
 * 
 * @param {WebGLRenderingContext} gl - The WebGL rendering context
 * @returns {Object} Collection of initialized WebGL buffers
 * @property {WebGLBuffer} vertexBuffer - Cube vertex positions
 * @property {WebGLBuffer} faceIndexBuffer - Cube face triangle indices
 * @property {WebGLBuffer} edgeIndexBuffer - Cube wireframe line indices
 * @property {WebGLBuffer} gridVertexBuffer - Reference grid vertices
 * @property {WebGLBuffer} gridIndexBuffer - Reference grid line indices
 */
function setupBuffers(gl) {
    // Initialize cube vertex buffer
    // Stores the 3D positions of all cube vertices
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Initialize cube face index buffer
    // Stores indices for drawing cube faces as triangles
    const faceIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, faceIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceIndices, gl.STATIC_DRAW);

    // Initialize cube edge index buffer
    // Stores indices for drawing cube edges as lines
    const edgeIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edgeIndices, gl.STATIC_DRAW);

    // Initialize reference grid vertex buffer
    // Stores positions for grid lines in 3D space
    const gridVertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, gridVertexBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER, 
        new Float32Array(gridVertices),  // Convert to typed array for WebGL
        gl.STATIC_DRAW
    );

    // Initialize reference grid index buffer
    // Stores indices for connecting grid vertices into lines
    const gridIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gridIndexBuffer);
    gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array(gridIndices),    // Convert to typed array for WebGL
        gl.STATIC_DRAW
    );

    // Return all buffer references for use in rendering
    return {
        vertexBuffer,     // For cube vertices
        faceIndexBuffer,  // For cube faces
        edgeIndexBuffer,  // For cube wireframe
        gridVertexBuffer, // For grid vertices
        gridIndexBuffer   // For grid lines
    };
}

class SpatialGrid {
    constructor(worldSize, cellSize) {
        this.cellSize = cellSize;
        this.gridSize = Math.ceil(worldSize * 2 / cellSize);
        this.grid = new Array(this.gridSize * this.gridSize * this.gridSize).fill().map(() => []);
    }

    getGridIndex(x, y, z) {
        const gridX = Math.floor((x + boundary.x) / this.cellSize);
        const gridY = Math.floor((y + boundary.y) / this.cellSize);
        const gridZ = Math.floor((z + Math.abs(boundary.z)) / this.cellSize);
        return gridX + gridY * this.gridSize + gridZ * this.gridSize * this.gridSize;
    }

    updateGrid() {
        this.grid.forEach(cell => cell.length = 0);
        positions.forEach((pos, index) => {
            const gridIndex = this.getGridIndex(pos.x, pos.y, pos.z);
            if (gridIndex >= 0 && gridIndex < this.grid.length) {
                this.grid[gridIndex].push(index);
            }
        });
    }

    getPotentialCollisions(cubeIndex) {
        const pos = positions[cubeIndex];
        const gridIndex = this.getGridIndex(pos.x, pos.y, pos.z);
        const candidates = new Set();
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const neighborIndex = gridIndex + 
                        dx + 
                        dy * this.gridSize + 
                        dz * this.gridSize * this.gridSize;
                    
                    if (neighborIndex >= 0 && neighborIndex < this.grid.length) {
                        this.grid[neighborIndex].forEach(idx => {
                            if (idx !== cubeIndex) candidates.add(idx);
                        });
                    }
                }
            }
        }
        
        return Array.from(candidates);
    }
}

// Initialize spatial partitioning grid
const spatialGrid = new SpatialGrid(Math.max(boundary.x, boundary.y, Math.abs(boundary.z)), 0.5);

/**
 * Configures vertex attribute settings for shader position data.
 * This function sets up the connection between the vertex buffer data
 * and the vertex shader's position attribute.
 * 
 * Configuration Details:
 * - Attribute Name: 'aPosition' in the vertex shader
 * - Components: 3 (x, y, z coordinates)
 * - Data Type: gl.FLOAT (32-bit floating point)
 * - Normalization: false (use values as-is)
 * - Stride: 0 (tightly packed data)
 * - Offset: 0 (start at beginning of buffer)
 * 
 * Process:
 * 1. Locates the position attribute in the shader program
 * 2. Specifies how to read vertex data from the buffer
 * 3. Enables the attribute for use in rendering
 * 
 * @param {WebGLRenderingContext} gl - The WebGL rendering context
 * @param {WebGLProgram} shaderProgram - The compiled shader program containing the attribute
 * 
 * @example
 * // Usage in rendering loop
 * gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
 * initAttributes(gl, shaderProgram);
 * // Ready for drawing commands
 * 
 * @throws {Error} If position attribute location is not found (-1)
 */
function initAttributes(gl, shaderProgram) {
    // Get the location of the position attribute in the shader program
    const positionLocation = gl.getAttribLocation(shaderProgram, "aPosition");
    
    // Verify attribute location was found
    if (positionLocation === -1) {
        throw new Error("Position attribute 'aPosition' not found in shader program");
    }

    // Configure the attribute pointer:
    // - positionLocation: Where in the shader to put the data
    // - 3: Each vertex has 3 components (x, y, z)
    // - gl.FLOAT: Data is 32-bit floating point
    // - false: Don't normalize the data
    // - 0: No stride (data is tightly packed)
    // - 0: Start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionLocation,  // Attribute location
        3,                 // Number of components per vertex
        gl.FLOAT,         // Data type
        false,            // Don't normalize values
        0,                // Stride (0 = auto)
        0                 // Offset into buffer
    );

    // Enable the attribute array for rendering
    gl.enableVertexAttribArray(positionLocation);
}

/**
 * Calculates and returns the camera's model-view matrix using spherical coordinates.
 * This function converts user-controlled spherical coordinates (radius, theta, phi)
 * into a camera position and generates the corresponding view matrix.
 * 
 * Coordinate System:
 * Spherical to Cartesian conversion:
 * - radius: Distance from origin to camera
 * - theta: Azimuthal angle in x-z plane from x-axis (horizontal rotation)
 * - phi: Polar angle from y-axis (vertical rotation)
 * 
 * Matrix Components:
 * - Position: Calculated camera position in 3D space
 * - Target: Fixed at origin [0,0,0]
 * - Up Vector: Fixed as [0,1,0] (world-space up direction)
 * 
 * Mathematical Conversions:
 * x = radius * sin(phi) * cos(theta)
 * y = radius * cos(phi)
 * z = radius * sin(phi) * sin(theta)
 * 
 * Global Dependencies:
 * @requires radius - Camera distance from origin
 * @requires theta - Horizontal rotation angle
 * @requires phi - Vertical rotation angle
 * @requires mat4 - glMatrix library for matrix operations
 * 
 * @returns {mat4} The calculated model-view matrix for the camera
 * 
 * @example
 * // Update camera position based on user input
 * radius = 5.0;  // 5 units from origin
 * theta = Math.PI / 4;  // 45 degrees horizontal
 * phi = Math.PI / 3;    // 60 degrees vertical
 * const viewMatrix = updateModelViewMatrix();
 */
function updateModelViewMatrix() {
    // Initialize a new 4x4 matrix
    const modelViewMatrix = mat4.create();
   
    // Convert spherical coordinates to Cartesian coordinates
    // x coordinate: Distance in the x direction
    const x = radius * Math.sin(phi) * Math.cos(theta);
    
    // y coordinate: Height above the x-z plane
    const y = radius * Math.cos(phi);
    
    // z coordinate: Distance in the z direction
    const z = radius * Math.sin(phi) * Math.sin(theta);

    // Create view matrix using glMatrix lookAt function
    // Parameters:
    // 1. out: Matrix to store result
    // 2. eye: Camera position [x,y,z]
    // 3. center: Point to look at [0,0,0]
    // 4. up: Up direction [0,1,0]
    mat4.lookAt(
        modelViewMatrix,  // Output matrix
        [x, y, z],       // Camera position in world space
        [0, 0, 0],       // Looking at origin
        [0, 1, 0]        // World-space up vector
    );

    return modelViewMatrix;
}

// Set up perspective projection matrix
const projectionMatrix = mat4.create();
mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 50.0);

// Animation control flag
let animationPaused = false;

/**
 * Main WebGL Render Loop
 * Handles the complete rendering pipeline for the 3D scene including grid and cubes.
 * This function is called recursively through requestAnimationFrame to create smooth animation.
 * 
 * Rendering Pipeline Stages:
 * 1. Frame Setup
 *    - Check animation state
 *    - Clear buffers
 *    - Setup 3D environment
 * 
 * 2. Grid Rendering
 *    - Set grid shader program
 *    - Apply camera transformation
 *    - Draw reference grid
 * 
 * 3. Cube Rendering (For each cube)
 *    - Update colors and animations
 *    - Apply transformations
 *    - Handle collisions and boundaries
 *    - Render faces and edges
 * 
 * Performance Considerations:
 * - Uses depth testing for correct 3D rendering
 * - Minimizes state changes in WebGL context
 * - Optimizes matrix calculations
 * - Handles shader switching efficiently
 * 
 * Global Dependencies:
 * @requires gl - WebGL context
 * @requires buffers - WebGL buffer objects
 * @requires shaderProgram - Main shader program
 * @requires shaderProgramEdges - Edge shader program
 * @requires positions - Cube positions
 * @requires colors - Cube colors
 * @requires angles - Rotation angles
 * @requires directions - Movement vectors
 * @requires boundary - Movement boundaries
 * 
 * Animation Control:
 * - Checks animationPaused flag
 * - Uses requestAnimationFrame for timing
 * - Calculates elapsed time for animations
 */
function render() {
    // Animation state check
    if (animationPaused) return;

    spatialGrid.updateGrid();

    // ---- Stage 1: Frame Setup ----
    // Clear to white background and reset depth buffer
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);  // Enable 3D depth sorting

    // Calculate animation time in seconds
    const currentTime = (Date.now() - startTime) * 0.001;

    // Get current camera view matrix
    const cameraMatrix = updateModelViewMatrix();

    // ---- Stage 2: Grid Rendering ----
    // Setup grid shader and buffers
    gl.useProgram(shaderProgramEdges);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.gridVertexBuffer);
    initAttributes(gl, shaderProgramEdges);

    // Create and apply grid transformation
    const gridModelViewMatrix = mat4.create();
    mat4.multiply(gridModelViewMatrix, cameraMatrix, mat4.create());

    // Set grid shader uniforms
    gl.uniformMatrix4fv(
        gl.getUniformLocation(shaderProgramEdges, "uModelViewMatrix"),
        false,
        gridModelViewMatrix
    );
    gl.uniformMatrix4fv(
        gl.getUniformLocation(shaderProgramEdges, "uProjectionMatrix"),
        false,
        projectionMatrix
    );

    // Render grid
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.gridIndexBuffer);
    gl.drawElements(gl.LINES, gridIndices.length, gl.UNSIGNED_SHORT, 0);

    // ---- Stage 3: Cube Rendering ----
    for (let i = 0; i < positions.length; i++) {
        const color = colors[i];
        updateColorTransition(color);  // Handle color animation

        // Setup cube shader program
        gl.useProgram(shaderProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexBuffer);
        initAttributes(gl, shaderProgram);

        // Create cube transformation matrix
        const modelMatrix = mat4.create();
        // Position
        mat4.translate(modelMatrix, modelMatrix, [
            positions[i].x,
            positions[i].y,
            positions[i].z
        ]);
        // Scale
        mat4.scale(modelMatrix, modelMatrix, [0.2, 0.2, 0.2]);
        // Rotation
        mat4.rotateY(modelMatrix, modelMatrix, angles[i]);
        mat4.rotateX(modelMatrix, modelMatrix, angles[i] * 0.5);

        // Combine with camera view
        const modelViewMatrix = mat4.create();
        mat4.multiply(modelViewMatrix, cameraMatrix, modelMatrix);

        // Physics and animation updates
        checkCollisions(i);  // Check for collisions with other cubes

        // Update cube properties
        angles[i] += speeds[i];  // Rotation
        positions[i].x += directions[i].dx;  // Position X
        positions[i].y += directions[i].dy;  // Position Y
        positions[i].z += directions[i].dz;  // Position Z

        // Boundary collision checks
        if (positions[i].x > boundary.x || positions[i].x < -boundary.x) 
            directions[i].dx *= -1;
        if (positions[i].y > boundary.y || positions[i].y < -boundary.y) 
            directions[i].dy *= -1;
        if (positions[i].z > -0.5 || positions[i].z < boundary.z) 
            directions[i].dz *= -1;

        // Set shader uniforms for animation and transformation
        const timeLocation = gl.getUniformLocation(shaderProgram, "uTime");
        if (timeLocation) {
            gl.uniform1f(timeLocation, currentTime);
        }

        // Apply transformation matrices
        gl.uniformMatrix4fv(
            gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
            false,
            modelViewMatrix
        );
        gl.uniformMatrix4fv(
            gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
            false,
            projectionMatrix
        );
        
        // Set color uniform
        gl.uniform4fv(
            gl.getUniformLocation(shaderProgram, "uColor"),
            color.current
        );

        // Render cube faces
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.faceIndexBuffer);
        gl.drawElements(gl.TRIANGLES, faceIndices.length, gl.UNSIGNED_SHORT, 0);

        // Render cube edges with edge shader
        gl.useProgram(shaderProgramEdges);
        initAttributes(gl, shaderProgramEdges);
        gl.uniformMatrix4fv(
            gl.getUniformLocation(shaderProgramEdges, "uModelViewMatrix"),
            false,
            modelViewMatrix
        );
        gl.uniformMatrix4fv(
            gl.getUniformLocation(shaderProgramEdges, "uProjectionMatrix"),
            false,
            projectionMatrix
        );

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.edgeIndexBuffer);
        gl.drawElements(gl.LINES, edgeIndices.length, gl.UNSIGNED_SHORT, 0);
    }

    // Schedule next frame
    requestAnimationFrame(render);
}

// Start the animation
render();