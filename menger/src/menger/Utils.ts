/* <<<{ */

import { Color } from "../lib/Colors.js";
import { Vec2, Vec3, Vec4 } from "../lib/TSM.js";
import _ from "../lib/Underscore.js";

var debug = false;

/*
    List Utility Functions
*/

/* Concatenates a list onto itself repeatedly */
export function repeat<T>(list: T[], times: number): T[] {
  let out: T[] = [];
  for (let i = 0; i < times; i++) {
    out = out.concat(list);
  }
  return out;
}

export function flattenListOfVec(listofVec: Vec3[] | Vec4[]): number[] {
  const out: number[] = new Array<number>();
  if (listofVec[0] instanceof Vec3) {
    (listofVec as Vec3[]).forEach((e) => out.push(e.x, e.y, e.z));
  } else if (listofVec[0] instanceof Vec4) {
    (listofVec as Vec4[]).forEach((e) => out.push(e.x, e.y, e.z, e.w));
  }
  return out;
}

// You will likely want to add extra helper functions throughout your project.
// Feel free to do so here!

//8 vertices of a cube from dimensions. Default (-.5, -.5, -.5) w/ len 1.0 -> list of triangle vertices
export function cubeVertices(xmin: number, ymin: number, zmin: number, len: number): Vec4[] {
      // (x1, y1, z1), (x2, y2, z2) -> 8 vertices
    var x = xmin;
    var y = ymin;
    var z = zmin;

    let vertices:Vec4[] = [];
    for(var index = 0; index < 8; index++)
    {
        x = (index % 2 < 1) ? xmin: xmin + len;
        y = (index % 4 < 2) ? ymin: ymin + len;
        z = (index % 8 < 4) ? zmin: zmin + len;
        var vec = new Vec4([x, y, z, 1.0]); //points, w = 1
        vertices.push(vec);
        if(debug)
          console.log("vec" + index + ": " + x + " " + y + " " + z + " " + "\n");
    }
  
  //from these 8, construct cube in this order s.t. face indices can be [2, 1, 0], [5, 4, 3]

  let ans:Vec4[] = [];
  //norm +x left face 5173
  ans.push(vertices[7]);
  ans.push(vertices[1]);
  ans.push(vertices[5]);
  ans.push(vertices[1]);
  ans.push(vertices[7]);
  ans.push(vertices[3]);
  //norm +y top face 6723
  ans.push(vertices[2]);
  ans.push(vertices[7]);
  ans.push(vertices[6]);
  ans.push(vertices[7]);
  ans.push(vertices[2]);
  ans.push(vertices[3]);
  //norm: +z front face 4567
  ans.push(vertices[6]);
  ans.push(vertices[5]);
  ans.push(vertices[4]);
  ans.push(vertices[5]);
  ans.push(vertices[6]);
  ans.push(vertices[7]);
  //norm -x right face 0426
  ans.push(vertices[2]);
  ans.push(vertices[4]);
  ans.push(vertices[0]);
  ans.push(vertices[4]);
  ans.push(vertices[2]);
  ans.push(vertices[6]);
  //norm: -y bottom face 0145
  ans.push(vertices[4]);
  ans.push(vertices[1]);
  ans.push(vertices[0]);
  ans.push(vertices[1]);
  ans.push(vertices[4]);
  ans.push(vertices[5]);
  //norm -z back face 1032
  ans.push(vertices[3]);
  ans.push(vertices[0]);
  ans.push(vertices[1]);
  ans.push(vertices[0]);
  ans.push(vertices[3]);
  ans.push(vertices[2]);
  return ans;
}

export function faceHelper(offset: number): Vec3[] {
  let ans:Vec3[] = [];
  // above verts are ordered in such a way that this can be generalized
  for(var face = 0; face < 6; face++)
  {
    var v1 = new Vec3([offset + 2, offset + 1, offset + 0]);
    var v2 = new Vec3([offset + 5, offset + 4, offset + 3]);
    offset += 6;
    ans.push(v1);
    ans.push(v2);
  }
  return ans;
}

export function normHelper(): Vec4[] {
  let ans:Vec4[] = [];
  var x = 0;
  var y = 0;
  var z = 0;
  for(var face = 0; face < 6; face++)
  {
    x = (face % 3 == 0) ? ((face == 0) ? 1.0: -1.0) : 0.0;
    y = (face % 3 == 1) ? ((face == 1) ? 1.0: -1.0) : 0.0;
    z = (face % 3 == 2) ? ((face == 2) ? 1.0: -1.0) : 0.0;
    var vec = new Vec4([x, y, z, 0.0]); //vectors, w = 0.0
    //one vector per vertex. six vectors per face
    for(var i = 0; i < 6; i++)
      ans.push(vec);
  }
  return ans;
}