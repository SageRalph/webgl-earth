/**
 * This file contains all the JavaScript code needed for a 'simple' 3D Earth 
 * with satellite webgl application, including projection, textures, lighting, 
 * and shaders.
 * 
 * Much of the code here is low-level boilerplate, so is split into: 
 * - 'Code specific to this world', custom written specifically for this program
 * - 'General purpose code', mostly boilerplate code which could be reused
 * 
 * Documentation focuses on detailing the custom code as most of the general
 * purpose code performs common operations or simple but verbose tasks.
 * 
 * This program should work in all modern web browsers that support JavaScript
 * and webgl, but must be served by a webserver due to CORS.
 * Some browsers may reserve the mouse wheel for page scrolling, if the
 * mouse wheel does not result in a change in zoom, try disabling this setting
 * or using another browser.
 */





////////////////////////////////////////////////////////////////////////////////
// Code specific to this 'world'
////////////////////////////////////////////////////////////////////////////////


// Setup ///////////////////////////////////////////////////////////////////////

/**
 * Performs setup and initialisation of object necessary before drawing can 
 * begin. This should be called on first load and on webglcontextrestored.
 */
function init() {

    initObjects();
    setupEarthBuffers();
    setupSatBuffers();

    setupShaders();
    setupLights();
    setupTextures();
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    // Camera position / direction
    pwgl.aspectRatio = gl.viewportWidth / gl.viewportHeight;
    pwgl.zoom = 60;
    mat4.perspective(pwgl.zoom, pwgl.aspectRatio, 1, 100.0, pwgl.projectionMatrix);
    mat4.identity(pwgl.modelViewMatrix);
    mat4.lookAt([16, 16, 16], [0, 0, 0], [0, 1, 0], pwgl.modelViewMatrix);

    // Variables related to animation
    pwgl.nbrOfFramesForFPS = 0;
    pwgl.lastFPSupdateTime = Date.now();
}

/**
 * Defines the initial and constant properties of the Earth and satellite.
 */
function initObjects() {
    // Initialize variables for satellite
    pwgl.sat = {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        rotAngle: 0, // Direction satellite is facing
        orbitAngle: Math.PI, // Progress around Earth (angular displacement)
        orbitRadius: 16.0, // Orbital distance from Earth centre
        orbitRPM: 6.0, // Complete orbits per minute

        // Constants
        scale: 1.0,
        minOrbitRadius: 8.0 // Prevents satellite clipping with Earth
    };

    // Initialize variables for Earth
    pwgl.earth = {
        x: 0.0,
        y: 0.0,
        z: 0.0,
        rotAngle: 0, // Direction Earth is facing

        // Constants
        radius: 5.0,
        scale: 1.0,
        RPM: 6.0, // Number of 'days' (full earth rotations) per minute
        latitudeStrips: 64,
        longitudeStrips: 64
    };

}

/**
 * Defines the position and colour of light sources.
 */
function setupLights() {
    gl.uniform3fv(pwgl.uniformLightPositionLoc, [0.0, 20.0, 0.0]); // Directly above scene
    gl.uniform3fv(pwgl.uniformAmbientLightColorLoc, [0.2, 0.2, 0.2]);
    gl.uniform3fv(pwgl.uniformDiffuseLightColorLoc, [0.7, 0.7, 0.7]);
    gl.uniform3fv(pwgl.uniformSpecularLightColorLoc, [0.8, 0.8, 0.8]);
}

/**
 * Asynchronously loads the required textures for the Earth and satellite.
 */
function setupTextures() {
    // Texture for Earth
    pwgl.earth.texture = gl.createTexture();
    loadImageForTexture("earth.jpg", pwgl.earth.texture);

    // Textures for satellite
    pwgl.sat.texture = gl.createTexture();
    loadImageForTexture("sat.jpg", pwgl.sat.texture);
    pwgl.sat.texture2 = gl.createTexture();
    loadImageForTexture("sat2.jpg", pwgl.sat.texture2);
}

/**
 * Converts JavaScript arrays into gl buffers, returning them as an object with
 * the buffers as properties.
 * @param {type} position The vertex position array
 * @param {type} index The vertex index array
 * @param {type} texture The texture coordinates array
 * @param {type} normal The vertex normal array
 * @returns {prepBuffers.buffers} Object holding the buffers
 */
function prepBuffers(position, index, texture, normal) {

    var buffers = {};

    // Setup buffer with positions
    buffers.vertexPosition = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexPosition);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(position), gl.STATIC_DRAW);

    // Setup buffer with index
    buffers.vertexIndex = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.vertexIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);

    // Setup buffer with texture coordinates
    buffers.vertexTextureCoordinate = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexTextureCoordinate);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture), gl.STATIC_DRAW);

    // Setup buffer with normals (for lighting calculations)
    buffers.vertexNormal = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.vertexNormal);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normal), gl.STATIC_DRAW);

    return buffers;
}



// Code for satellite //////////////////////////////////////////////////////////

/**
 * Defines the shape of the satellite and binds the necessary buffers.
 */
function setupSatBuffers() {

    var vertexPositions = [
        // Front face
        1.0, 1.0, 1.0, //   v0
        -1.0, 1.0, 1.0, //  v1
        -1.0, -1.0, 1.0, // v2
        1.0, -1.0, 1.0, //  v3

        // Back face
        1.0, 1.0, -1.0, //  v4
        -1.0, 1.0, -1.0, // v5
        -1.0, -1.0, -1.0, //v6
        1.0, -1.0, -1.0, // v7

        // Left face
        -1.0, 1.0, 1.0, //  v8
        -1.0, 1.0, -1.0, // v9
        -1.0, -1.0, -1.0, //v10
        -1.0, -1.0, 1.0, // v11

        // Right face
        1.0, 1.0, 1.0, //   v12
        1.0, -1.0, 1.0, //  v13
        1.0, -1.0, -1.0, // v14
        1.0, 1.0, -1.0, //  v15

        // Top face
        1.0, 1.0, 1.0, //   v16
        1.0, 1.0, -1.0, //  v17
        -1.0, 1.0, -1.0, // v18
        -1.0, 1.0, 1.0, //  v19

        // Bottom face
        1.0, -1.0, 1.0, //  v20
        1.0, -1.0, -1.0, // v21
        -1.0, -1.0, -1.0, //v22
        -1.0, -1.0, 1.0 //  v23
    ];

    var vertexIndices = [
        0, 1, 2, 0, 2, 3, //        Front face
        4, 6, 5, 4, 7, 6, //        Back face
        8, 9, 10, 8, 10, 11, //     Left face
        12, 13, 14, 12, 14, 15, //  Right face
        16, 17, 18, 16, 18, 19, //  Top face
        20, 22, 21, 20, 23, 22 //   Bottom face
    ];

    var textureCoordinates = [
        //Front face
        0.0, 0.0, //v0
        1.0, 0.0, //v1
        1.0, 1.0, //v2
        0.0, 1.0, //v3

        // Back face
        0.0, 1.0, //v4
        1.0, 1.0, //v5
        1.0, 0.0, //v6
        0.0, 0.0, //v7

        // Left face
        0.0, 1.0, //v1
        1.0, 1.0, //v5
        1.0, 0.0, //v6
        0.0, 0.0, //v2

        // Right face
        0.0, 1.0, //v0
        1.0, 1.0, //v3
        1.0, 0.0, //v7
        0.0, 0.0, //v4

        // Top face
        0.0, 1.0, //v0
        1.0, 1.0, //v4
        1.0, 0.0, //v5
        0.0, 0.0, //v1

        // Bottom face
        0.0, 1.0, //v3
        1.0, 1.0, //v7
        1.0, 0.0, //v6
        0.0, 0.0  //v2
    ];

    var vertexNormals = [
        // Front face
        0.0, 0.0, 1.0, //v0
        0.0, 0.0, 1.0, //v1
        0.0, 0.0, 1.0, //v2
        0.0, 0.0, 1.0, //v3

        // Back face
        0.0, 0.0, -1.0, //v4
        0.0, 0.0, -1.0, //v5
        0.0, 0.0, -1.0, //v6
        0.0, 0.0, -1.0, //v7

        // Left face
        -1.0, 0.0, 0.0, //v1
        -1.0, 0.0, 0.0, //v5
        -1.0, 0.0, 0.0, //v6
        -1.0, 0.0, 0.0, //v2

        // Right face
        1.0, 0.0, 0.0, //0
        1.0, 0.0, 0.0, //3
        1.0, 0.0, 0.0, //7
        1.0, 0.0, 0.0, //4

        // Top face
        0.0, 1.0, 0.0, //v0
        0.0, 1.0, 0.0, //v4
        0.0, 1.0, 0.0, //v5
        0.0, 1.0, 0.0, //v1

        // Bottom face
        0.0, -1.0, 0.0, //v3
        0.0, -1.0, 0.0, //v7
        0.0, -1.0, 0.0, //v6
        0.0, -1.0, 0.0  //v2
    ];

    pwgl.sat.indexNumber = vertexIndices.length;
    pwgl.sat.buffers = prepBuffers(
            vertexPositions, vertexIndices, textureCoordinates, vertexNormals);
}

/**
 * Updates the position and rotation of the satellite, then draws it.
 * @param {int} dt Time passed since last update (in milliseconds)
 */
function updateAndDrawSat(dt) {

    var sat = pwgl.sat; // This is just for readability

    // Calculate orbit/rotation
    sat.orbitAngle += (sat.orbitRPM / 60000) * dt * (2 * Math.PI);
    sat.rotAngle = Math.PI + Math.PI / 2 - sat.orbitAngle;

    sat.x = sat.orbitRadius * Math.cos(sat.orbitAngle); // r cos(a)
    sat.z = sat.orbitRadius * Math.sin(sat.orbitAngle); // r sin(a)

    drawObject(sat);
}



// Code for Earth //////////////////////////////////////////////////////////////

/**
 * Defines the shape of the Earth and binds the necessary buffers.
 */
function setupEarthBuffers() {

    var pi = Math.PI; // This is just for readability

    var m = pwgl.earth.latitudeStrips + 1;
    var n = pwgl.earth.longitudeStrips + 1;

    var vertexPositions = [];
    var textureCoordinates = [];
    var vertexNormals = [];

    for (var i = 0; i <= m; i++) { // Latitude
        for (var j = 0; j <= n; j++) { // Longitude

            // VERTEX POSITION & NORMAL
            var nx = Math.sin(i * pi / m) * Math.cos(2 * j * pi / n);
            var ny = Math.cos(i * pi / m);
            var nz = Math.sin(i * pi / m) * Math.sin(2 * j * pi / n);

            vertexNormals.push(nx);
            vertexNormals.push(ny);
            vertexNormals.push(nz);

            // For a uniform sphere: vertex position = vertex normal * radius
            vertexPositions.push(nx * pwgl.earth.radius);
            vertexPositions.push(ny * pwgl.earth.radius);
            vertexPositions.push(nz * pwgl.earth.radius);

            // TEXTURE COORDINATES
            // i and j subtracted from m and n to flip texture right way up
            textureCoordinates.push((n-j) / n);
            textureCoordinates.push((m-i) / m);
        }
    }

    var indexData = [];
    for (var i = 0; i < m; i++) {
        for (var j = 0; j < n; j++) {

            var v1 = i * (n + 1) + j;   //index of vi,j  
            var v2 = v1 + n + 1;        //index of vi+1,j
            var v3 = v1 + 1;            //index of vi,j+1 
            var v4 = v2 + 1;            //index of vi+1,j+1  
            // indices of first triangle
            indexData.push(v1);
            indexData.push(v2);
            indexData.push(v3);
            // indices of second triangle
            indexData.push(v3);
            indexData.push(v2);
            indexData.push(v4);
        }
    }

    pwgl.earth.indexNumber = indexData.length;
    pwgl.earth.buffers = prepBuffers(
            vertexPositions, indexData, textureCoordinates, vertexNormals);
}

/**
 * Updates the rotation of the Earth, then draws it.
 * @param {int} dt Time passed since last update (in milliseconds)
 */
function updateAndDrawEarth(dt) {

    // Calculate rotation
    pwgl.earth.rotAngle += (pwgl.earth.RPM / 60000) * dt * (2 * Math.PI);
    drawObject(pwgl.earth);
}



// Code for drawing / displaying ///////////////////////////////////////////////

/**
 * Draws the scene.
 */
function draw() {
    pwgl.requestId = requestAnimFrame(draw);

    var currentTime = Date.now();

    handlePressedDownKeys();

    updateDisplay(currentTime);

    // Ensure variables are set
    if (pwgl.lastFrameTime === undefined) {
        pwgl.lastFrameTime = Date.now();
    }

    var dt = currentTime - pwgl.lastFrameTime;

    updateAndDrawEarth(dt);
    updateAndDrawSat(dt);

    pwgl.lastFrameTime = currentTime;
    pwgl.nbrOfFramesForFPS++;
}

/**
 * Performs display updates necessary each draw cycle.
 * This includes handling camera movement, updating the FPS counter and other
 * variable displays, and uploading data to the shader.
 * @param {int} currentTime The current time in milliseconds
 */
function updateDisplay(currentTime) {

    // Update variable display
    var orbitDir = pwgl.sat.orbitRPM >= 0 ? "clockwise" : "anticlockwise";
    var orbitRPMRounded = Math.round(Math.abs(pwgl.sat.orbitRPM));
    pwgl.displayOrbitRPM.innerHTML = orbitRPMRounded + " (" + orbitDir + ")";
    pwgl.displayOrbitRadius.innerHTML = Math.round(pwgl.sat.orbitRadius);


    // Update FPS if a second or more has passed since last FPS update
    if (currentTime - pwgl.lastFPSupdateTime >= 1000) {
        pwgl.fpsCounter.innerHTML = pwgl.nbrOfFramesForFPS;
        pwgl.nbrOfFramesForFPS = 0;
        pwgl.lastFPSupdateTime = currentTime;
    }

    // Apply camera movement
    mat4.translate(pwgl.modelViewMatrix, [transX, transY, transZ], pwgl.modelViewMatrix);
    
    // Apply camera rotation
    mat4.rotateX(pwgl.modelViewMatrix, xRot / 50, pwgl.modelViewMatrix);
    mat4.rotateY(pwgl.modelViewMatrix, yRot / 50, pwgl.modelViewMatrix);
    
    // Apply camera zoom
    mat4.perspective(pwgl.zoom, pwgl.aspectRatio, 1, 100.0, pwgl.projectionMatrix);


    // Reset accumulated camera move commands (prevents accelerating infinity)
    yRot = xRot = zRot = transY = transZ = transX = 0;

    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();

    gl.uniform1i(pwgl.uniformSamplerLoc, 0);

    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

/**
 * Draws the provided object
 * @param {Object} obj
 */
function drawObject(obj) {

    pushModelViewMatrix();

    mat4.translate(pwgl.modelViewMatrix, [obj.x, obj.y, obj.z], pwgl.modelViewMatrix);
    mat4.rotateY(pwgl.modelViewMatrix, obj.rotAngle, pwgl.modelViewMatrix);
    if(obj.scale !== 1){
        mat4.scale(pwgl.modelViewMatrix, [obj.scale, obj.scale, obj.scale], pwgl.modelViewMatrix);
    }

    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();

    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffers.vertexPosition);
    gl.vertexAttribPointer(pwgl.vertexPositionAttributeLoc, 3, gl.FLOAT, false, 0, 0);

    // Bind normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffers.vertexNormal);
    gl.vertexAttribPointer(pwgl.vertexNormalAttributeLoc, 3, gl.FLOAT, false, 0, 0);
    
    // Bind index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.buffers.vertexIndex);

    // Bind texture coordinate buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffers.vertexTextureCoordinate);
    gl.vertexAttribPointer(pwgl.vertexTextureAttributeLoc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);

    gl.bindTexture(gl.TEXTURE_2D, obj.texture);

    if (obj.texture2 !== undefined) { // for satellite

        // Draw first face with texture
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

        // Draw other faces with texture2
        gl.bindTexture(gl.TEXTURE_2D, obj.texture2);
        gl.drawElements(gl.TRIANGLES, obj.indexNumber - 6, gl.UNSIGNED_SHORT, 12);

    } else {
        // Draw with texture on all faces
        gl.drawElements(gl.TRIANGLES, obj.indexNumber, gl.UNSIGNED_SHORT, 0);
    }

    popModelViewMatrix();
}


// User Interaction ////////////////////////////////////////////////////////////

/**
 * Handles user interaction through key-presses.
 */
function handlePressedDownKeys() {

    var sat = pwgl.sat; // Just for readability

    // Arrow up, increase orbit radius
    if (pwgl.listOfPressedKeys[38]) {
        sat.orbitRadius += 0.1;
    }

    // Arrow down, decrease orbit radius
    if (pwgl.listOfPressedKeys[40]) {
        sat.orbitRadius -= 0.1;
        if (sat.orbitRadius < sat.minOrbitRadius) {
            sat.orbitRadius = sat.minOrbitRadius;
        }
    }

    // Arrow right, increase sat speed
    if (pwgl.listOfPressedKeys[39]) {
        sat.orbitRPM += 0.2;
    }

    // Arrow left, decrease sat speed
    if (pwgl.listOfPressedKeys[37]) {
        sat.orbitRPM -= 0.2;
//        // Uncomment to prevent reverse orbital direction
//        if (sat.orbitRPM < 0.0) {
//            sat.orbitRPM = 0.0;
//        }
    }
}

/**
 * Handles user interaction through dragging the mouse.
 * @param {Event} ev
 */
function handleMouseAction(ev){
    if (ev.shiftKey) {
        transZ = (ev.clientY - yOffs) / 10; // Move on Z axis with shift
    } else if (ev.ctrlKey) {
        transX = (ev.clientY - yOffs) / 10; // Move on X axis with ctrl
    } else if (ev.altKey) {
        transY = -(ev.clientY - yOffs) / 10;// Move on Y axis with alt
    } else {
        yRot = -xOffs + ev.clientX;         // Otherwise rotate
        xRot = -yOffs + ev.clientY;
    }
    xOffs = ev.clientX;
    yOffs = ev.clientY;
}

/**
 * Handles user interaction through the mouse-wheel.
 * @param {Event} ev
 */
function wheelHandler(ev) {
    pwgl.zoom += ev.detail;
    
    // Prevent camera inversion
    if(pwgl.zoom < 0){
        pwgl.zoom = 0;
    }else if (pwgl.zoom>180){
        pwgl.zoom = 180;
    }
    
    ev.preventDefault();
}








////////////////////////////////////////////////////////////////////////////////
// General purpose code
////////////////////////////////////////////////////////////////////////////////

// global
var gl;
var pwgl = {}; //Many variables are added to this as properties
pwgl.ongoingImageLoads = [];
var canvas;

// Variables for interactive control
var transY = transZ = transX = 0;
var xRot = yRot = zRot = xOffs = yOffs = drag = 0;
pwgl.listOfPressedKeys = []; // Keep track of pressed down keys in a list


function createGLContext(canvas) {
    var names = ["webgl", "experimental-webgl"];
    var context = null;
    for (var i = 0; i < names.length; i++) {
        try {
            context = canvas.getContext(names[i]);
        } catch (e) {
        }
        if (context) {
            break;
        }
    }
    if (context) {
        context.viewportWidth = canvas.width;
        context.viewportHeight = canvas.height;
    } else {
        alert("Failed to create WebGL context!");
    }
    return context;
}

function loadShaderFromDOM(id) {
    var shaderScript = document.getElementById(id);
    // If the element with the specified id is not found, exit
    if (!shaderScript) {
        return null;
    }

    // Loop through the children for the found DOM element and
    // build up the shader source code as a string
    var shaderSource = "";
    var currentChild = shaderScript.firstChild;
    while (currentChild) {
        if (currentChild.nodeType === 3) { // 3 corresponds to TEXT_NODE
            shaderSource += currentChild.textContent;
        }
        currentChild = currentChild.nextSibling;
    }

    var shader;
    if (shaderScript.type === "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type === "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        alert("compiler!!!!!!");
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    return shader;
}

function setupShaders() {
    var vertexShader = loadShaderFromDOM("shader-vs");
    var fragmentShader = loadShaderFromDOM("shader-fs");
    var shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS) && !gl.isContextLost()) {
        alert("Failed to link shaders: " + gl.getProgramInfoLog(shaderProgram));
    }

    gl.useProgram(shaderProgram);

    pwgl.vertexPositionAttributeLoc = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    pwgl.vertexTextureAttributeLoc = gl.getAttribLocation(shaderProgram, "aTextureCoordinates");
    pwgl.uniformMVMatrixLoc = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    pwgl.uniformProjMatrixLoc = gl.getUniformLocation(shaderProgram, "uPMatrix");
    pwgl.uniformSamplerLoc = gl.getUniformLocation(shaderProgram, "uSampler");

    pwgl.uniformNormalMatrixLoc = gl.getUniformLocation(shaderProgram, "uNMatrix");
    pwgl.vertexNormalAttributeLoc = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    pwgl.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");
    pwgl.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");
    pwgl.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
    pwgl.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");

    gl.enableVertexAttribArray(pwgl.vertexNormalAttributeLoc);
    gl.enableVertexAttribArray(pwgl.vertexPositionAttributeLoc);
    gl.enableVertexAttribArray(pwgl.vertexTextureAttributeLoc);

    pwgl.modelViewMatrix = mat4.create();
    pwgl.projectionMatrix = mat4.create();
    pwgl.modelViewMatrixStack = [];
}

function pushModelViewMatrix() {
    var copyToPush = mat4.create(pwgl.modelViewMatrix);
    pwgl.modelViewMatrixStack.push(copyToPush);
}

function popModelViewMatrix() {
    if (pwgl.modelViewMatrixStack.length === 0) {
        throw "Error popModelViewMatrix() - Stack was empty ";
    }
    pwgl.modelViewMatrix = pwgl.modelViewMatrixStack.pop();
}



// TEXTURES ////////////////////////////////////////////////////////////////////

function loadImageForTexture(url, texture) {
    var image = new Image();
    image.onload = function () {
        pwgl.ongoingImageLoads.splice(pwgl.ongoingImageLoads.indexOf(image), 1);

        textureFinishedLoading(image, texture);
    };
    pwgl.ongoingImageLoads.push(image);
    image.src = url;
}

function textureFinishedLoading(image, texture) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.generateMipmap(gl.TEXTURE_2D);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null);
}




// MATRIX UPLOADS //////////////////////////////////////////////////////////////

function uploadNormalMatrixToShader() {
    var normalMatrix = mat3.create();
    mat4.toInverseMat3(pwgl.modelViewMatrix, normalMatrix);
    mat3.transpose(normalMatrix);
    gl.uniformMatrix3fv(pwgl.uniformNormalMatrixLoc, false, normalMatrix);
}

function uploadModelViewMatrixToShader() {
    gl.uniformMatrix4fv(pwgl.uniformMVMatrixLoc, false, pwgl.modelViewMatrix);
}

function uploadProjectionMatrixToShader() {
    gl.uniformMatrix4fv(pwgl.uniformProjMatrixLoc, false, pwgl.projectionMatrix);
}



// STARTUP /////////////////////////////////////////////////////////////////////

function startup() {
    canvas = document.getElementById("myGLCanvas");
    canvas = WebGLDebugUtils.makeLostContextSimulatingCanvas(canvas);
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
    document.addEventListener('keydown', handleKeyDown, false);
    document.addEventListener('keyup', handleKeyUp, false);
    canvas.addEventListener('mousemove', mymousemove, false);
    canvas.addEventListener('mousedown', mymousedown, false);
    canvas.addEventListener('mouseup', mymouseup, false);
    canvas.addEventListener('mousewheel', wheelHandler, false);
    canvas.addEventListener('DOMMouseScroll', wheelHandler, false);

    gl = createGLContext(canvas);

    init();

    pwgl.fpsCounter = document.getElementById("fps");
    pwgl.displayOrbitRadius = document.getElementById("orbitRadius");
    pwgl.displayOrbitRPM = document.getElementById("orbitRPM");

    // Draw the complete scene
    draw();
}



// EVENT HANDLERS //////////////////////////////////////////////////////////////

function handleContextLost(event) {
    event.preventDefault();
    cancelRequestAnimFrame(pwgl.requestId);
    // Ignore all ongoing image loads by removing their onload handler
    for (var i = 0; i < pwgl.ongoingImageLoads.length; i++) {
        pwgl.ongoingImageLoads[i].onload = undefined;
    }
    pwgl.ongoingImageLoads = [];
}

function handleContextRestored(event) {
    init();
    pwgl.requestId = requestAnimFrame(draw, canvas);
}

function handleKeyDown(event) {
    pwgl.listOfPressedKeys[event.keyCode] = true;
}

function handleKeyUp(event) {
    pwgl.listOfPressedKeys[event.keyCode] = false;
}

function mymousedown(ev) {
    drag = 1;
    xOffs = ev.clientX;
    yOffs = ev.clientY;
}

function mymouseup(ev) {
    drag = 0;
}

function mymousemove(ev) {
    if (drag !== 0)
        handleMouseAction(ev);
}