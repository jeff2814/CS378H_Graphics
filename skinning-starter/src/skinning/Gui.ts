 import { Camera } from "../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { SkinningAnimation } from "./App.js";
import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat } from "../lib/TSM.js";
import { Bone } from "./Scene.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";
import { RGBA_ASTC_8x5_Format } from "../lib/threejs/src/constants.js";
import { Cylinder, KeyFrame } from "./Utils.js";

const RADIUS = .2;
const RAY_EPSILON = 1e-8;
const PI = Math.PI;

/**
 * Might be useful for designing any animation GUI
 */
interface IGUI {
  viewMatrix(): Mat4;
  projMatrix(): Mat4;
  dragStart(me: MouseEvent): void;
  drag(me: MouseEvent): void;
  dragEnd(me: MouseEvent): void;
  onKeydown(ke: KeyboardEvent): void;
}

export enum Mode {
  playback,  
  edit  
}

/**
 * Handles Mouse and Button events along with
 * the the camera.
 */


export class GUI implements IGUI {
  private static readonly rotationSpeed: number = 0.05;
  private static readonly zoomSpeed: number = 0.1;
  private static readonly rollSpeed: number = 0.1;
  private static readonly panSpeed: number = 0.1;

  private camera: Camera;
  private dragging: boolean;
  private dragging_cam: boolean;
  private fps: boolean;
  private prevX: number;
  private prevY: number;

  private height: number;
  private viewPortHeight: number;
  private width: number;
  private viewPortWidth: number;

  private num_keyframes: number;
  private keyframes: KeyFrame[];

  private animation: SkinningAnimation;

  public time: number;

  private selected_bone: Bone;
  private hovered_bone: Bone;
  
  public mode: Mode;
  

  public hoverX: number = 0;
  public hoverY: number = 0;


  /**
   *
   * @param canvas required to get the width and height of the canvas
   * @param animation required as a back pointer for some of the controls
   * @param sponge required for some of the controls
   */
  constructor(canvas: HTMLCanvasElement, animation: SkinningAnimation) {
    this.height = canvas.height;
    this.viewPortHeight = this.height - 200;
    this.width = canvas.width;
    this.viewPortWidth = this.width - 320;
    this.prevX = 0;
    this.prevY = 0;
    this.selected_bone = null;
    this.hovered_bone = null;
    
    this.num_keyframes = 0;
    this.keyframes = [];

    this.animation = animation;
    
    this.reset();
    
    this.registerEventListeners(canvas);
  }

  public getNumKeyFrames(): number {
    // TODO
    // Used in the status bar in the GUI
    return this.num_keyframes;
  }
  public getTime(): number { return this.time; }
  
  public getMaxTime(): number { 
    // TODO
    // The animation should stop after the last keyframe
    return (this.num_keyframes > 1) ? this.num_keyframes - 1: 0;
  }

  /**
   * Resets the state of the GUI
   */
  public reset(): void {
    this.fps = false;
    this.dragging = false;
    this.time = 0;
    this.mode = Mode.edit;
    this.selected_bone = null;
    this.hovered_bone = null;

    this.num_keyframes = 0;
    this.keyframes = [];
    
    this.camera = new Camera(
      new Vec3([0, 0, -6]),
      new Vec3([0, 0, 0]),
      new Vec3([0, 1, 0]),
      45,
      this.viewPortWidth / this.viewPortHeight,
      0.1,
      1000.0
    );
  }

  /**
   * Sets the GUI's camera to the given camera
   * @param cam a new camera
   */
  public setCamera(
    pos: Vec3,
    target: Vec3,
    upDir: Vec3,
    fov: number,
    aspect: number,
    zNear: number,
    zFar: number
  ) {
    this.camera = new Camera(pos, target, upDir, fov, aspect, zNear, zFar);
  }

  /**
   * Returns the view matrix of the camera
   */
  public viewMatrix(): Mat4 {
    return this.camera.viewMatrix();
  }

  /**
   * Returns the projection matrix of the camera
   */
  public projMatrix(): Mat4 {
    return this.camera.projMatrix();
  }

  /**
   * Callback function for the start of a drag event.
   * @param mouse
   */
  public dragStart(mouse: MouseEvent): void {
    if (mouse.offsetY > 600 || mouse.offsetX > 800) {
      // outside the main panel
      return;
    }
    
    // TODO
    // Some logic to rotate the bones, instead of moving the camera, if there is a currently highlighted bone
    
    this.dragging = true;
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;

    let x = mouse.offsetX;
    let y = mouse.offsetY;
    //console.log("X: " + x + " Y: " + y);
    var ray = this.getRayFromScreen(x, y);
    this.selected_bone = this.intersectsBone(this.camera.pos(), ray);
    this.dragging_cam = this.selected_bone == null;
    if(!this.dragging_cam)
      console.log("Bone selected. Initiating drag/rotate.");   
  }

  public incrementTime(dT: number): void {
    if (this.mode === Mode.playback) {
      this.time += dT;
      if (this.time >= this.getMaxTime()) {
        this.time = 0;
        this.mode = Mode.edit;
      }
    }
  }


  private rotateHelper(root: Bone, curr: Bone, rot_qat: Quat, ref?: Bone): void 
  {
    let rot_copy = rot_qat.copy();
    if(!ref && this.mode == Mode.edit && root.position.equals(curr.position) && root.endpoint.equals(curr.endpoint))
    {
      curr.orientation = rot_copy.multiply(curr.orientation);
    }
    if(!ref)
      ref = curr;
    let root_pos = (new Vec4([ref.position.x - root.position.x, ref.position.y - root.position.y, ref.position.z - root.position.z, 1]));
    let root_end = (new Vec4([ref.endpoint.x - root.position.x, ref.endpoint.y - root.position.y, ref.endpoint.z - root.position.z, 1]));

    root_pos = rot_qat.toMat4().multiplyVec4(root_pos);
    root_end = rot_qat.toMat4().multiplyVec4(root_end);

    curr.rotation = rot_qat.multiply(ref.rotation);
    curr.position = Vec3.sum((new Vec3(root_pos.xyz)), (root.position));
    curr.endpoint = Vec3.sum((new Vec3(root_end.xyz)), (root.position));

  }

  private rotateRecursive(root: Bone, bones: Bone[], curr: Bone, rot_qat: Quat, ref?: Bone ,ref_forest?: Bone[]): void 
  { 
    var rot_copy1 = rot_qat.copy();
    var rot_copy2 = rot_qat.copy();
    if(!ref && !ref_forest)
      this.rotateHelper(root, curr, rot_copy1) //do work: rotate me
    else
      this.rotateHelper(root, curr, rot_copy1, ref) 
    let children: number[] = curr.children;
    if(children.length != 0)
      for(var i = 0; i < children.length; i++)
      {
        if(!ref && !ref_forest)
          this.rotateRecursive(root, bones, bones[children[i]], rot_copy2); // recursive step: do work on my children
        else
          this.rotateRecursive(root, bones, bones[children[i]], rot_copy2, ref_forest[children[i]], ref_forest); // recursive step: do work on my children
      }
    
  }

  private topDownBoneRotate(bone: Bone, axis: Vec3, angle: number): void
  {
    var meshes = this.animation.getScene().meshes;
    //search for the bone.
    for(var i = 0; i < meshes.length; i++)
    {
      var bone_forest = meshes[i].bones;
      for(var j = 0; j < bone_forest.length; j++)
      {
        let cur_bone = bone_forest[j];
        if(cur_bone.position == bone.position && cur_bone.endpoint == bone.endpoint)
        {
          //axis in its original direction, assume position = (0, 0, 0);
          axis.normalize();
          this.rotateRecursive(cur_bone, bone_forest, bone, Quat.fromAxisAngle(axis, angle));
          return; // found, so we're done here.
        }
      }
    }
  }

  private translateHelper(curr: Bone, trans: Vec3)
  {
    curr.position = Vec3.sum(curr.position, trans);
    curr.endpoint = Vec3.sum(curr.endpoint, trans);
    curr.translation = Vec3.sum(curr.translation, trans);
  }

  private translateRecursive(bones: Bone[], curr: Bone, trans: Vec3)
  {
    this.translateHelper(curr, trans);
    let children: number[] = curr.children;
    if(children.length != 0)
      for(var i = 0; i < children.length; i++)
        this.translateRecursive(bones, bones[children[i]], trans)
  }


  private topDownBoneTranslate(bone: Bone, trans: Vec3): void
  {
    var meshes = this.animation.getScene().meshes;
    //search for the bone.
    for(var i = 0; i < meshes.length; i++)
    {
      var bone_forest = meshes[i].bones;
      for(var j = 0; j < bone_forest.length; j++)
      {
        let cur_bone = bone_forest[j];
        if(cur_bone.position == bone.position && cur_bone.endpoint == bone.endpoint)
        {
          this.translateRecursive(bone_forest, bone, trans);
          return; // found, so we're done here.
        }
      }
    }
  }

  private getRayFromScreen(x: number, y: number): Vec3
  {
    var halfx = this.viewPortWidth/2.0;
    var halfy = this.viewPortHeight/2.0;
    var ndc = new Vec2([(x - halfx)/halfx, -1*(y - halfy)/halfy]);
    var clip = new Vec4([ndc.x, ndc.y, -1.0, 1.0]);
    var eye = this.projMatrix().inverse().multiplyVec4(clip);
    var ray_eye = new Vec4([eye.x, eye.y, -1.0, 0.0]);
    var ray_world = this.viewMatrix().inverse().multiplyVec4(ray_eye);
    var norm = (new Vec3(ray_world.xyz)).normalize();
    return norm;
  }

  private intersectsBone(camera_pos: Vec3, direction: Vec3) : Bone
  {
    var meshes = this.animation.getScene().meshes;
    let minTime = Number.MAX_SAFE_INTEGER;
    let minBone = null;
    for(var i = 0; i < meshes.length; i++)
    {
      var bone_forest = meshes[i].bones;
      for(var j = 0; j < bone_forest.length; j++)
      {
        var cur_bone = bone_forest[j];
        var cylinder = new Cylinder(cur_bone);
        var time = cylinder.intersectsBody(camera_pos, direction);
        if(time != -1 && time < minTime)
        {
          minTime = time;
          minBone = cur_bone;
        }
      }
    }
    return minBone;
  }

  public animate(): void
  {
    if(this.keyframes.length < 1)
    {
      console.log("ERROR: Can't animate on less than one keyframe...");
      return;
    }
    var cur_index = Math.ceil(this.time);
    var rel_time = this.time - Math.floor(this.time);
    console.log("CURR TIME: " + this.time + " Index: " + cur_index + " rel_time: " + rel_time);
    if(rel_time < 0 || rel_time > 1)
    {
      console.log("PANIC: rel_time out of range at time " + this.time + " rel_time = " + rel_time);
      return;
    }

    //
    var next_frame = this.keyframes[cur_index];
    var cur_frame = this.keyframes[cur_index - 1];

    console.log("********* CUR FRAME *********** ")
    cur_frame.print();
    console.log("********* NEXT FRAME *********** ")
    next_frame.print();
    
    var meshes = this.animation.getScene().meshes;
    for(var i = 0; i < meshes.length; i++)
    {
        var bone_forest = meshes[i].bones;
        let prev_forest = cur_frame.get_forest(i);
        for(var j = 0; j < bone_forest.length; j++)
        {
          var cur_bone = bone_forest[j];
          console.log("Animating Bone " + j);

          let prev_bone = cur_frame.get_bone(i, j).copy();
          let prev_pos = cur_frame.get_pos(i, j).copy();
          let prev_end = cur_frame.get_end(i, j).copy();
          let prev_rot = cur_frame.get_rot(i, j).copy();
          let prev_trans = cur_frame.get_trans(i, j).copy();
          let prev_orient = prev_bone.orientation.copy();   

          let next_bone = next_frame.get_bone(i, j).copy();
          let next_pos = next_frame.get_pos(i, j).copy();
          let next_end = next_frame.get_end(i, j).copy();
          let next_rot = cur_frame.get_rot(i, j).copy();
          let next_trans = next_frame.get_trans(i, j).copy();
          let next_orient = next_bone.orientation.copy();

          console.log("prev orient: " + prev_orient.xyzw);
          console.log("next orient: " + next_orient.xyzw)

          if(prev_orient.equals(next_orient)) 
          {
            console.log("Skip");
          }
          else 
          {
            let d_orient = Quat.slerp((new Quat).setIdentity(), prev_orient.inverse().multiply(next_orient), rel_time);
            this.rotateRecursive(prev_bone, bone_forest, cur_bone, d_orient.copy(), prev_bone, prev_forest);
          }
          
          let d_trans = Vec3.difference(next_frame.get_trans(i, j), prev_trans).scale(rel_time);
          this.translateHelper(prev_bone, d_trans);
        }
    }
  }

  /**
   * The callback function for a drag event.
   * This event happens after dragStart and
   * before dragEnd.
   * @param mouse
   */
  public drag(mouse: MouseEvent): void {
    let x = mouse.offsetX;
    let y = mouse.offsetY;
    //console.log("X: " + x + " Y: " + y);
    var ray = this.getRayFromScreen(x, y);
    this.hovered_bone =  this.intersectsBone(this.camera.pos(), ray);

    var ray_curr = this.getRayFromScreen(mouse.screenX, mouse.screenY);
    var ray_prev = this.getRayFromScreen(this.prevX, this.prevY);

    const dx = mouse.screenX - this.prevX;
    const dy = mouse.screenY - this.prevY;
    
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;

    /* Left button, or primary button */
    const mouseDir: Vec3 = this.camera.right();
    mouseDir.scale(-dx);
    mouseDir.add(this.camera.up().scale(dy));
    mouseDir.normalize();

    if (this.dragging && this.dragging_cam) {

      if (dx === 0 && dy === 0) {
        return;
      }

      switch (mouse.buttons) {
        case 1: {
          /* Left Button */
          if(this.selected_bone != null) break;

          let rotAxis: Vec3 = Vec3.cross(this.camera.forward(), mouseDir);
          rotAxis = rotAxis.normalize();

          if (this.fps) {
            this.camera.rotate(rotAxis, GUI.rotationSpeed);
          } else {
            this.camera.orbitTarget(rotAxis, GUI.rotationSpeed);
          }
          break;
        }
        case 2: {
          /* Right button, or secondary button */
          if(this.selected_bone != null) break;
          this.camera.offsetDist(Math.sign(mouseDir.y) * GUI.zoomSpeed);
          break;
        }
        default: {
          break;
        }
      }
      return;
    }
    
    // (dx, dy) -> some vector, angle b/w bone & vector is what we want

    // TODO
    // You will want logic here:
    if(this.hovered_bone != null || this.selected_bone != null)
    {
      // three cases: (don't need to worry about both being null due to || )
      // hovered, not selected
      // selected, but not hovered (dragged out)
      // hovered and selected 

      var to_highlight = (this.selected_bone == null) ? this.hovered_bone : this.selected_bone;
      this.animation.getScene().selectedBone = to_highlight;

      if(this.dragging)
      {
        // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.
        var joint_axis = Vec3.difference(to_highlight.position, this.camera.pos()); //axis = diff(joint start, eye)
        joint_axis = joint_axis.normalize(); // unit vector

        var bone_vec = Vec3.difference(to_highlight.endpoint, to_highlight.position);
        if(this.hovered_bone != null)
        {
          let isect = (new Cylinder(to_highlight)).intersectsBody(this.camera.pos(), ray);
          if(isect != -1)
          {
            let p_isect = Vec3.sum(this.camera.pos(), ray.scale(isect, new Vec3()));
            let height = Math.sqrt(Math.pow(Vec3.distance(this.hovered_bone.position, p_isect), 2) - RADIUS*RADIUS);
            bone_vec.scale(height/bone_vec.length());
          }
        }

        let projected_mouse = new Vec3();
        let projected_bone = new Vec3();
        // u = mouse_vec, n = axis

        // dot(n, p + vt - bone start) = 0
        // dot(n, v)*t = dot(bone start - p)
        // t = dot(n, bone start - p)/dot(n, v), recalculate p + vt
        let curr_t = Vec3.dot(joint_axis, Vec3.difference(to_highlight.position, this.camera.pos()))/Vec3.dot(joint_axis, ray_curr);
        let prev_t = Vec3.dot(joint_axis, Vec3.difference(to_highlight.position, this.camera.pos()))/Vec3.dot(joint_axis, ray_prev);
        let curr_p = Vec3.sum(this.camera.pos(), ray_curr.scale(curr_t));
        let prev_p = Vec3.sum(this.camera.pos(), ray_prev.scale(prev_t));
        let curr_v = Vec3.difference(curr_p, to_highlight.position);
        let prev_v = Vec3.difference(prev_p, to_highlight.position);        

        let mouse_dir = Vec3.difference(curr_p, prev_p);
        
        projected_bone = Vec3.difference(bone_vec, joint_axis.copy().scale(Vec3.dot(bone_vec, joint_axis)/(joint_axis.squaredLength()), projected_bone));
        projected_mouse = Vec3.sum(mouse_dir,projected_bone);
        // V1 = projected bone vector, V2 = projected mouse dir < v1,v2>
        // dot(V1, V2) = V1*V2 cos theta
        // cross(V1, V2).normalize() == joint_axis, sin(theta) > 0

        var theta = 0;

        //logic to flip the bone if the mouse moves under it. WIP and not necessary?
        let projected_endpoint = Vec3.sum(to_highlight.position, projected_mouse);
        var above = Vec3.dot(Vec3.difference(projected_endpoint, to_highlight.position), projected_mouse) >= 0;

        var cos_theta = Vec3.dot(projected_bone, projected_mouse)/(projected_bone.length()*projected_mouse.length());

        var crossed = Vec3.cross(projected_bone, projected_mouse);
        crossed.normalize();
        let alpha =  Math.acos(cos_theta);
        if(Vec3.distance(crossed, joint_axis) <= .01)
          theta = (above) ? alpha: PI - alpha
        else if (Vec3.distance(crossed.scale(-1), joint_axis) <= .01)
          theta = (above) ? -1*Math.acos(cos_theta): PI + alpha;

        switch (mouse.buttons) {
          case 1: {
            /* Left Button */
            this.topDownBoneRotate(to_highlight, joint_axis, theta);
            break;
          }
          case 2: {
            this.topDownBoneTranslate(to_highlight, mouse_dir);
            break;
          }
          default: {
            break;
          }
        }
      }
    }
    else 
    {
      this.animation.getScene().selectedBone = null;
    }
  }
  public getModeString(): string {
    switch (this.mode) {
      case Mode.edit: { return "edit: " + this.getNumKeyFrames() + " keyframes"; }
      case Mode.playback: { return "playback: " + this.getTime().toFixed(2) + " / " + this.getMaxTime().toFixed(2); }
    }
  }

  /**
   * Callback function for the end of a drag event
   * @param mouse
   */
  public dragEnd(mouse: MouseEvent): void {
    this.dragging = false;
    this.prevX = 0;
    this.prevY = 0;
    
    // TODO
    // Maybe your bone highlight/dragging logic needs to do stuff here too
    this.selected_bone = null;
    this.dragging_cam = false;
  }

  /**
   * Callback function for a key press event
   * @param key
   */
  public onKeydown(key: KeyboardEvent): void {
    switch (key.code) {
      case "Digit1": {
        this.animation.setScene("/static/assets/skinning/split_cube.dae");
        break;
      }
      case "Digit2": {
        this.animation.setScene("/static/assets/skinning/long_cubes.dae");
        break;
      }
      case "Digit3": {
        this.animation.setScene("/static/assets/skinning/simple_art.dae");
        break;
      }      
      case "Digit4": {
        this.animation.setScene("/static/assets/skinning/mapped_cube.dae");
        break;
      }
      case "Digit5": {
        this.animation.setScene("/static/assets/skinning/robot.dae");
        break;
      }
      case "Digit6": {
        this.animation.setScene("/static/assets/skinning/head.dae");
        break;
      }
      case "Digit7": {
        this.animation.setScene("/static/assets/skinning/wolf.dae");
        break;
      }
      case "KeyW": {
        this.camera.offset(
            this.camera.forward().negate(),
            GUI.zoomSpeed,
            true
          );
        break;
      }
      case "KeyA": {
        this.camera.offset(this.camera.right().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyS": {
        this.camera.offset(this.camera.forward(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyD": {
        this.camera.offset(this.camera.right(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyR": {
        this.animation.reset();
        break;
      }
      case "ArrowLeft": {
        if(this.hovered_bone != null || this.selected_bone != null)
        {
          var to_roll = (this.selected_bone == null) ? this.hovered_bone : this.selected_bone;
          let bone_axis = Vec3.difference(to_roll.position, to_roll.endpoint);
          bone_axis = bone_axis.normalize();
          this.topDownBoneRotate(to_roll, bone_axis, GUI.rollSpeed);
        }
        else
          this.camera.roll(GUI.rollSpeed, false);
        break;
      }
      case "ArrowRight": {
        if(this.hovered_bone != null || this.selected_bone != null)
        {
          var to_roll = (this.selected_bone == null) ? this.hovered_bone : this.selected_bone;
          let bone_axis = Vec3.difference(to_roll.endpoint, to_roll.position);
          bone_axis = bone_axis.normalize();
          this.topDownBoneRotate(to_roll, bone_axis, GUI.rollSpeed);
        }
        else
          this.camera.roll(GUI.rollSpeed, true);
        break;
      }
      case "ArrowUp": {
        this.camera.offset(this.camera.up(), GUI.zoomSpeed, true);
        break;
      }
      case "ArrowDown": {
        this.camera.offset(this.camera.up().negate(), GUI.zoomSpeed, true);
        break;
      }
      case "KeyK": {
        if (this.mode === Mode.edit) {
            // TODO
            // Add keyframe
            this.num_keyframes++;
            this.keyframes.push(new KeyFrame(this.animation.getScene()));
            for(var ki = 0; ki < this.keyframes.length; ki++)
            {
              console.log("******* KEYFRAME #" + ki + " *********");
              this.keyframes[ki].print();
            }
        }
        break;
      }      
      case "KeyP": {
        if (this.mode === Mode.edit && this.getNumKeyFrames() > 1)
        {
          this.mode = Mode.playback;
          this.time = 0;

          let meshes = this.animation.getScene().meshes;
          for(var m = 0; m < meshes.length; m++)
          {
            for(var b = 0; b < meshes[m].bones.length; b++)
            {
              var cur_bone = meshes[m].bones[b];
              cur_bone.position = this.keyframes[0].get_pos(m ,b).copy();
              cur_bone.endpoint = this.keyframes[0].get_end(m ,b).copy();
              cur_bone.rotation = this.keyframes[0].get_rot(m ,b).copy();
              cur_bone.orientation = this.keyframes[0].get_bone(m ,b).orientation.copy();
              cur_bone.translation = this.keyframes[0].get_trans(m ,b);
            }
          }
        } else if (this.mode === Mode.playback) {
          this.mode = Mode.edit;
        }
        break;
      }
      default: {
        console.log("Key : '", key.code, "' was pressed.");
        break;
      }
    }
  }

  /**
   * Registers all event listeners for the GUI
   * @param canvas The canvas being used
   */
  private registerEventListeners(canvas: HTMLCanvasElement): void {
    /* Event listener for key controls */
    window.addEventListener("keydown", (key: KeyboardEvent) =>
      this.onKeydown(key)
    );

    /* Event listener for mouse controls */
    canvas.addEventListener("mousedown", (mouse: MouseEvent) =>
      this.dragStart(mouse)
    );

    canvas.addEventListener("mousemove", (mouse: MouseEvent) =>
      this.drag(mouse)
    );

    canvas.addEventListener("mouseup", (mouse: MouseEvent) =>
      this.dragEnd(mouse)
    );

    /* Event listener to stop the right click menu */
    canvas.addEventListener("contextmenu", (event: any) =>
      event.preventDefault()
    );
  }
}
