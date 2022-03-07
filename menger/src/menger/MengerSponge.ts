import { Mat3, Mat4, Vec3, Vec4 } from "../lib/TSM.js";
import { normHelper, faceHelper, cubeVertices, flattenListOfVec } from "./Utils.js";

var debug = false;
var debug_cubes = 0;

/* A potential interface that students should implement */
interface IMengerSponge {
  setLevel(level: number): void;
  isDirty(): boolean;
  setClean(): void;
  normalsFlat(): Float32Array;
  indicesFlat(): Uint32Array;
  positionsFlat(): Float32Array;
}

/**
 * Represents a Menger Sponge
 */
export class MengerSponge implements IMengerSponge {

  // TODO: sponge data structures
  level:number;
  dirty:boolean;

  vertices:Vec4[];
  faces:Vec3[];
  normals:Vec4[];

  positions_array:Float32Array;
  face_array:Uint32Array;
  normals_array:Float32Array;

  private recursiveBuild(curr_level: number, xmin: number, ymin: number, zmin: number, len: number): void {
    if(curr_level == 1)
    {
      if(debug)
        console.log("Drawing Cube #" + ++debug_cubes + " at " + xmin + " " + ymin + " " + zmin + " " + "len: " + len + "\n");
      this.faces.push(...faceHelper(this.vertices.length));
      this.vertices.push(...cubeVertices(xmin, ymin, zmin, len));
      this.normals.push(...normHelper());
      return;
    }
    var x = xmin;
    var y = ymin;
    var z = zmin;
    var newLen = len/3.0;
    for(var cube = 0; cube < 27; cube++)
    {
      //middle cubes
      if(cube == 4 || cube == 10 || cube == 12 || cube == 13 || cube == 14 || cube == 16 || cube == 22)
        continue;
      x = xmin + (cube % 3)*newLen;
      y = ymin + (Math.floor(cube/3) % 3)*newLen;
      z = zmin + (Math.floor(cube/9))*newLen;
      this.recursiveBuild(curr_level - 1, x, y, z, newLen);
    }
  }

  constructor(level: number, ) {
    this.vertices = [];
    this.faces = [];
    this.normals = [];
    this.setLevel(level);
	  // TODO: other initialization
  }

  /**
   * Returns true if the sponge has changed.
   */
  public isDirty(): boolean {
       return this.dirty;
  }

  public setClean(): void {
      this.dirty = false;
  }
  
  public setLevel(lev: number)
  {
	  // TODO: initialize the cube
    this.level = lev;
    this.dirty = true;
    this.recursiveBuild(this.level, -.5, -.5, -.5, 1);
    this.positions_array = new Float32Array(flattenListOfVec(this.vertices));
    this.face_array = new Uint32Array(flattenListOfVec(this.faces));
    this.normals_array = new Float32Array(flattenListOfVec(this.normals));
  }



  /* Returns a flat Float32Array of the sponge's vertex positions */
  public positionsFlat(): Float32Array {
	  // TODO: right now this makes a single triangle. Make the cube fractal instead.
    return this.positions_array;
  }

  /**
   * Returns a flat Uint32Array of the sponge's face indices
   */
  public indicesFlat(): Uint32Array {
    // TODO: right now this makes a single triangle. Make the cube fractal instead.
    return this.face_array;
  }

  /**
   * Returns a flat Float32Array of the sponge's normals
   */
  public normalsFlat(): Float32Array {
	  // TODO: right now this makes a single triangle. Make the cube fractal instead.

	  return this.normals_array;
  }

  /**
   * Returns the model matrix of the sponge
   */
  public uMatrix(): Mat4 {

    // TODO: change this, if it's useful
    const ret : Mat4 = new Mat4().setIdentity();

    return ret;    
  } 
  
}
