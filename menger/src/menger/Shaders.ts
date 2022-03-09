export let defaultVSText = `
    precision mediump float;

    attribute vec3 vertPosition;
    attribute vec3 vertColor;
    attribute vec4 aNorm;
    
    varying vec4 lightDir;
    varying vec4 normal;   
 
    uniform vec4 lightPosition;
    uniform mat4 mWorld;
    uniform mat4 mView;
	uniform mat4 mProj;

    void main () {
		//  Convert vertex to camera coordinates and the NDC
        gl_Position = mProj * mView * mWorld * vec4 (vertPosition, 1.0);
        
        //  Compute light direction (world coordinates)
        lightDir = lightPosition - vec4(vertPosition, 1.0);
		
        //  Pass along the vertex normal (world coordinates)
        normal = aNorm;
    }
`;

// TODO: Write the fragment shader

export let defaultFSText = `
    precision mediump float;

    varying vec4 lightDir;
    varying vec4 normal;    
	
    
    void main () {
        if(normal[0] != 0.0)
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        if(normal[1] != 0.0)
            gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);  
        if(normal[2] != 0.0)
            gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0); 
        float kd = dot(normal, normalize(lightDir));
        gl_FragColor *= (kd > 0.0) ? kd : 0.0;
        gl_FragColor[3] = 1.0;
    }
`;

// TODO: floor shaders
// same as above for most of it. add the floor
export let floorVSText = `
precision mediump float;

attribute vec3 vertPosition;
attribute vec3 vertColor;
attribute vec4 aNorm;

varying vec4 lightDir;
varying vec4 normal;
varying vec3 vert;   

uniform vec4 lightPosition;
uniform mat4 mWorld;
uniform mat4 mView;
uniform mat4 mProj;

void main () {
    //  Convert vertex to camera coordinates and the NDC
    gl_Position = mProj * mView * mWorld * vec4 (vertPosition, 1.0);
    
    //  Compute light direction (world coordinates)
    lightDir = lightPosition - vec4(vertPosition, 1.0);
    
    //  Pass along the vertex normal (world coordinates)
    normal = aNorm;

    vert = vertPosition;
}
`;
export let floorFSText = `
    precision mediump float;

    varying vec4 lightDir;
    varying vec4 normal; 
    varying vec3 vert;  

    void main () {
        highp int x = int(floor(vert[0]));
        highp int z = int(floor(vert[2]));
        gl_FragColor = ((x + z)/2 * 2 == x + z) ? vec4(1.0, 1.0, 1.0, 1.0): vec4(0.0, 0.0, 0.0, 1.0);
        float kd = dot(normal, normalize(lightDir));
        gl_FragColor *= (kd > 0.0) ? kd : 0.0;
        gl_FragColor[3] = 1.0;
    }
`;

