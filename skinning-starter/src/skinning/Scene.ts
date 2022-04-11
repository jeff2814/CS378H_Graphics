import { Mat4, Quat, Vec3 } from "../lib/TSM.js";
import { AttributeLoader, MeshGeometryLoader, BoneLoader, MeshLoader } from "./AnimationFileLoader.js";

export class Attribute {
  values: Float32Array;
  count: number;
  itemSize: number;

  constructor(attr: AttributeLoader) {
    this.values = attr.values;
    this.count = attr.count;
    this.itemSize = attr.itemSize;
  }
}

export class MeshGeometry {
  position: Attribute;
  normal: Attribute;
  uv: Attribute | null;
  skinIndex: Attribute; // which bones affect each vertex?
  skinWeight: Attribute; // with what weight?
  v0: Attribute; // position of each vertex of the mesh *in the coordinate system of bone skinIndex[0]'s joint*. Perhaps useful for LBS.
  v1: Attribute;
  v2: Attribute;
  v3: Attribute;

  constructor(mesh: MeshGeometryLoader) {
    this.position = new Attribute(mesh.position);
    this.normal = new Attribute(mesh.normal);
    if (mesh.uv) { this.uv = new Attribute(mesh.uv); }
    this.skinIndex = new Attribute(mesh.skinIndex);
    this.skinWeight = new Attribute(mesh.skinWeight);
    this.v0 = new Attribute(mesh.v0);
    this.v1 = new Attribute(mesh.v1);
    this.v2 = new Attribute(mesh.v2);
    this.v3 = new Attribute(mesh.v3);
  }
}

export class Bone {
  public loader: BoneLoader; //for easy copy constructor

  public parent: number;
  public children: number[];
  public position: Vec3; // current position of the bone's joint *in world coordinates*. Used by the provided skeleton shader, so you need to keep this up to date.
  public endpoint: Vec3; // current position of the bone's second (non-joint) endpoint, in world coordinates
  public rotation: Quat; // current orientation of the joint *with respect to world coordinates*
  public translation: Vec3; // all translations (excluding from rotation matrices) done so far

  public rotations: Map<Bone, Quat>;
  
  public initialPosition: Vec3; // position of the bone's joint *in world coordinates*
  public initialEndpoint: Vec3; // position of the bone's second (non-joint) endpoint, in world coordinates
  public initialRotation: Quat; // initial rotation

  public offset: number; // used when parsing the Collada file---you probably don't need to touch these
  public initialTransformation: Mat4;
  public deformTransformation: Mat4;
  public index: number;

  constructor(bone: BoneLoader) {
    this.loader = bone;

    this.parent = bone.parent;
    this.children = Array.from(bone.children);
    this.position = bone.position.copy();
    this.endpoint = bone.endpoint.copy();
    this.rotation = bone.rotation.copy();
    this.translation = new Vec3();

    this.rotations = new Map<Bone, Quat>();

    this.offset = bone.offset;
    this.initialPosition = bone.initialPosition.copy();
    this.initialEndpoint = bone.initialEndpoint.copy();
    this.initialRotation = (new Quat()).setIdentity();
    this.initialTransformation = bone.initialTransformation.copy();
  }

  public get_deform() : Mat4
  {
    let rot = this.rotation.toMat4();
    let pos = this.position;
    return new Mat4([rot.at(0), rot.at(1), rot.at(2), 0,
                    rot.at(4), rot.at(5), rot.at(6), 0,
                    rot.at(8), rot.at(9), rot.at(10), 0,
                    pos.x, pos.y, pos.z, 1]); //
  }

  public copy(): Bone 
  {
    var ret:Bone =  new Bone(this.loader);
    
    ret.parent = this.parent;
    ret.children = [];
    this.children.forEach((child) => {
      ret.children.push(child);
    })

    ret.position = this.position.copy();
    ret.endpoint = this.endpoint.copy()
    ret.rotation = this.rotation.copy();
    ret.translation = this.translation.copy();

    ret.rotations = new Map<Bone, Quat>(this.rotations);

    ret.initialPosition = this.initialPosition.copy();
    ret.initialEndpoint = this.initialEndpoint.copy();
    ret.initialRotation = this.initialRotation.copy();

    ret.offset = this.offset;
    ret.initialTransformation = this.initialTransformation.copy();
    ret.index = this.index;

    return ret;
  }
}

export class Mesh {
  public geometry: MeshGeometry;
  public worldMatrix: Mat4; // in this project all meshes and rigs have been transformed into world coordinates for you
  public rotation: Vec3;
  public bones: Bone[];
  public materialName: string;
  public imgSrc: String | null;

  private loader: MeshLoader;
  private boneIndices: number[];
  private bonePositions: Float32Array;
  private boneIndexAttribute: Float32Array;

  constructor(mesh: MeshLoader) 
  {
    this.loader = mesh;
    this.geometry = new MeshGeometry(mesh.geometry);
    this.worldMatrix = mesh.worldMatrix.copy();
    this.rotation = mesh.rotation.copy();
    this.bones = [];
    mesh.bones.forEach((bone, index) => {
      var temp = new Bone(bone);
      temp.index = index;
      this.bones.push(temp);
    });
    this.materialName = mesh.materialName;
    this.imgSrc = null;
    this.boneIndices = Array.from(mesh.boneIndices);
    this.bonePositions = new Float32Array(mesh.bonePositions);
    this.boneIndexAttribute = new Float32Array(mesh.boneIndexAttribute);
  }

  public getBoneIndices(): Uint32Array {
    return new Uint32Array(this.boneIndices);
  }

  public getBonePositions(): Float32Array {
    return this.bonePositions;
  }

  public getBoneIndexAttribute(): Float32Array {
    return this.boneIndexAttribute;
  }

  public getBoneTranslations(): Float32Array {
    let trans = new Float32Array(3 * this.bones.length);
    this.bones.forEach((bone, index) => {
      let res = bone.position.xyz;
      for (let i = 0; i < res.length; i++) {
        trans[3 * index + i] = res[i];
      }
    });
    return trans;
  }

  public getBoneRotations(): Float32Array {
    let trans = new Float32Array(4 * this.bones.length);
    this.bones.forEach((bone, index) => {
      let res = bone.rotation.xyzw;
      for (let i = 0; i < res.length; i++) {
        trans[4 * index + i] = res[i];
      }
    });
    return trans;
  }

  public copy(): Mesh 
  {
    var ret: Mesh = new Mesh(this.loader);

    ret.worldMatrix = this.worldMatrix.copy();
    ret.rotation = this.rotation.copy();
    ret.bones = [];
    for(var i = 0; i < this.bones.length; i++)
    {
      ret.bones.push(this.bones[i].copy());
    }
    
    ret.boneIndices = [];
    for(var j = 0; j < this.boneIndices.length; j++)
    {
      ret.boneIndices.push(this.boneIndices[j]);
    }

    ret.bonePositions = new Float32Array(this.bonePositions);
    ret.boneIndexAttribute = new Float32Array(this.boneIndexAttribute);
    return ret;
  }
}