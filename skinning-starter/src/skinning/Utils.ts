import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat } from "../lib/TSM.js";
import { CLoader } from "./AnimationFileLoader.js";
import { Bone, Mesh } from "./Scene.js";

const RADIUS = .2;
const RAY_EPSILON = 1e-8;
const PI = Math.PI;

export class Cylinder {
    public radius: number;
    public height: number;
    public start: Vec3;
    public end: Vec3;
    public dir: Vec3;
    public bone: Bone;
  
    constructor(bone: Bone) 
    {
      this.bone = bone;
      this.radius = RADIUS;
      this.start = (new Vec3([bone.position.x, bone.position.y, bone.position.z]));
      this.end = (new Vec3([bone.endpoint.x, bone.endpoint.y, bone.endpoint.z]));
      var pq = Vec3.difference(new Vec3(this.end.xyz), new Vec3(this.start.xyz));
      this.dir = pq.normalize();
      this.height = pq.length();
    }
  
    public intersectsBody(pos: Vec3, dir: Vec3) : number
    {
      var conv_pos = (new Vec4([pos.x, pos.y, pos.z, 1]));
      var conv_dir = (new Vec4([dir.x, dir.y, dir.z, 0]));
  
      var position = new Vec3(conv_pos.xyz);
      var direction = new Vec3(conv_dir.xyz);
  
      // derivation... || (p + vt - p_a) x v_a || / ||v_a|| <= r
      let v = direction; // direction of the ray
      let v_a = this.dir; // cylinder's axis
      let dp = Vec3.difference(position, new Vec3(this.start.xyz)); // vector PQ in the formula
      let r = this.radius;
  
      let temp_a = v.y*v_a.z - v.z*v_a.y;
      let temp_b = v.z*v_a.x - v.x*v_a.z;
      let temp_c = v.x*v_a.y - v.y*v_a.x;
      let v_va = new Vec3([temp_a, temp_b, temp_c]);
  
      let temp_x = dp.y*v_a.z - dp.z*v_a.y;
      let temp_y = dp.z*v_a.x - dp.x*v_a.z;
      let temp_z = dp.x*v_a.y - dp.y*v_a.x;
      let p_va = new Vec3([temp_x, temp_y, temp_z]);
  
      var a = v_va.squaredLength();
      var b = 2.0*Vec3.dot(v_va, p_va);
      var c = p_va.squaredLength() - r*r;
  
      // This implies that x1 = 0.0 and y1 = 0.0, which further
          // implies that the ray is aligned with the body of the cylinder,
          // so no intersection.
      if(a == 0.0) {
        return -1;
      }
  
      var discriminant = b*b - 4.0*a*c;
      //console.log("discriminant: " + discriminant);
  
      if(discriminant < 0) {
        return -1;
      }
      
      var t2 = (-b + Math.sqrt(discriminant)) / (2.0 * a);
      if( t2 <= RAY_EPSILON ) {
        return -1;
      }
  
      var t1 = (-b - Math.sqrt(discriminant)) / (2.0 * a);
  
      var p1 = new Vec3([position.x + direction.x*t1,
                          position.y + direction.y*t1,
                          position.z + direction.z*t1]);
      var p2 = new Vec3([position.x + direction.x*t2,
                         position.y + direction.y*t2,
                         position.z + direction.z*t2]);
      var pq1_start = Vec3.difference(p1, this.start);
      var pq1_end = Vec3.difference(p2, this.end);
      var pq2_start = Vec3.difference(p2, this.start);
      var pq2_end = Vec3.difference(p2, this.end);
  
      if(t1 > RAY_EPSILON) 
      {
        if(Vec3.dot(v_a, pq1_start) >= 0 && Vec3.dot(v_a, pq1_end) <= 0)
        {
          // It's okay.
          return t1;
        }
      }
      if(Vec3.dot(v_a, pq2_start) >= 0 && Vec3.dot(v_a, pq2_end) <= 0)
      {
        return t2;
      }
  
      return -1;
    }
  }

export class KeyFrame {
    public meshes: Mesh[];

    constructor(scene: CLoader) 
    {
        if(scene == null)
            return;
        this.meshes = [];

        // copy over the initial state of the keyframe, not a pointer as it animates
        var meshes = scene.meshes;
        for(var i = 0; i < meshes.length; i++)
        {
            var cur_mesh = meshes[i].copy();
            this.meshes.push(cur_mesh)
            for(var j = 0; j < cur_mesh.bones.length; j++)
            {
                var cur_bone =  meshes[i].bones[j].copy()
                cur_bone.position = new Vec3( meshes[i].bones[j].position.xyz)
                cur_bone.endpoint = new Vec3( meshes[i].bones[j].endpoint.xyz)
            }
        }

        // console.log("CONSTRUCTING KEYFRAME: ")
        // this.print();
    }

    public print(): void 
    {
        var meshes = this.meshes;
        for(var i = 0; i < meshes.length; i++)
        {
            var bone_forest = meshes[i].bones;
            for(var j = 0; j < bone_forest.length; j++)
            {
                var cur_bone = bone_forest[j];
                console.log("Bone Index " + j);
                console.log("Bone Pos: " + cur_bone.position.xyz);
                console.log("Bone End: " + cur_bone.endpoint.xyz);
                console.log("Bone Rot " + cur_bone.rotation.xyzw);
                console.log("Bone Orient " + cur_bone.orientation.xyzw);
                console.log("Bone Trans " + cur_bone.translation.xyz)
            }
        }
    }

    public copy(): KeyFrame 
    {
        var ret = new KeyFrame(null);
        ret.meshes = [];
        for(var i = 0; i < this.meshes.length; i++)
            ret.meshes.push(this.meshes[i].copy())
        return ret;
    }

    public get_forest(bf_index: number): Bone[]
    {
        return this.meshes[bf_index].bones;
    }

    public get_bone(bf_index: number, b_index:number): Bone
    {
        return this.meshes[bf_index].bones[b_index];
    }

    public get_pos(bf_index: number, b_index: number): Vec3
    {
        return this.get_bone(bf_index, b_index).position;
    }

    public get_end(bf_index: number, b_index: number): Vec3
    {
        return this.get_bone(bf_index, b_index).endpoint;
    }

    public get_rot(bf_index: number, b_index: number): Quat
    {
        return this.get_bone(bf_index, b_index).rotation;
    }

    public get_trans(bf_index: number, b_index: number): Vec3
    {
        return this.get_bone(bf_index, b_index).translation;
    }
}