 import { Camera } from "../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { SkinningAnimation } from "./App.js";
import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat } from "../lib/TSM.js";
import { Bone } from "./Scene.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";
import { RGBA_ASTC_8x5_Format } from "../lib/threejs/src/constants.js";

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
  private fps: boolean;
  private prevX: number;
  private prevY: number;

  private height: number;
  private viewPortHeight: number;
  private width: number;

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
    this.prevX = 0;
    this.prevY = 0;
    this.selected_bone = null;
    this.hovered_bone = null;
    
    this.animation = animation;
    
    this.reset();
    
    this.registerEventListeners(canvas);
  }

  public getNumKeyFrames(): number {
    // TODO
    // Used in the status bar in the GUI
    return 0;
  }
  public getTime(): number { return this.time; }
  
  public getMaxTime(): number { 
    // TODO
    // The animation should stop after the last keyframe
    return 0;
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
    this.camera = new Camera(
      new Vec3([0, 0, -6]),
      new Vec3([0, 0, 0]),
      new Vec3([0, 1, 0]),
      45,
      this.width / this.viewPortHeight,
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
    if (mouse.offsetY > 600) {
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
    console.log("X: " + x + " Y: " + y);
    var ray = this.getRayFromScreen(x, y);
    console.log("ray: " + ray.xyz);
    console.log("camera pos: " + this.camera.pos().xyz);
    this.selected_bone = this.intersectsBone(this.camera.pos(), ray);
    if(this.selected_bone != null)
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


  private rotateHelper(root: Bone, curr: Bone, axis: Vec3, angle: number): void 
  {
    let root_pos = (new Vec4([curr.position.x - root.position.x, curr.position.y - root.position.y, curr.position.z - root.position.z, 1]));
    let root_end = (new Vec4([curr.endpoint.x - root.position.x, curr.endpoint.y - root.position.y, curr.endpoint.z - root.position.z, 1]));

    console.log("root pos: " +  root_pos.xyzw);
    console.log("root end: " +  root_end.xyzw);

    let rot_qat: Quat = Quat.fromAxisAngle(axis, angle);
    root_pos = rot_qat.toMat4().multiplyVec4(root_pos);
    root_end = rot_qat.toMat4().multiplyVec4(root_end);

    curr.rotation = rot_qat.multiply(curr.rotation);
    curr.position = (new Vec3(root_pos.xyz)).add(root.position);
    curr.endpoint = (new Vec3(root_end.xyz)).add(root.position);
  }

  private recursionHelper(root: Bone, bones: Bone[], curr: Bone, axis: Vec3, angle: number): void 
  {
    this.rotateHelper(root, curr, axis, angle) //do work: rotate me
    let children: number[] = curr.children;
    if(children.length != 0)
      for(var i = 0; i < children.length; i++)
      {
        console.log("Rotating Child ID: " + children[i]);
        this.recursionHelper(root, bones, bones[children[i]], axis, angle); // recursive step: do work on my children
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
          console.log("Root Roll Axis " + axis.xyz);
          console.log("Found Root ID: " + j);
          this.recursionHelper(cur_bone, bone_forest, bone, axis, angle);
          return; // found, so we're done here.
        }
      }
    }
  }

  private translateHelper(bones: Bone[], curr: Bone, trans: Vec3)
  {
    curr.position = Vec3.sum(curr.position, trans);
    curr.endpoint = Vec3.sum(curr.endpoint, trans);
    let children: number[] = curr.children;
    if(children.length != 0)
      for(var i = 0; i < children.length; i++)
        this.translateHelper(bones, bones[children[i]], trans)
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
          this.translateHelper(bone_forest, bone, trans);
          return; // found, so we're done here.
        }
      }
    }
  }



  private getRayFromScreen(x: number, y: number): Vec3
  {
    var halfx = this.width/2.0;
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
    // console.log("Min Bone \nStart:" + minBone.position.xyz + "\nEnd:" + minBone.endpoint.xyz);
    // console.log("AT Time: " + minTime);
    return minBone;
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
    console.log("X: " + x + " Y: " + y);
    var ray = this.getRayFromScreen(x, y);
    console.log("ray: " + ray.xyz);
    console.log("camera pos: " + this.camera.pos().xyz);
    this.hovered_bone =  this.intersectsBone(this.camera.pos(), ray);
    console.log("Hovering Bone? " + (this.hovered_bone != null));

    var ray_curr = this.getRayFromScreen(mouse.screenX, mouse.screenY);
    var ray_prev = this.getRayFromScreen(this.prevX, this.prevY);

    if (this.dragging) {

      const dx = mouse.screenX - this.prevX;
      const dy = mouse.screenY - this.prevY;
      
      this.prevX = mouse.screenX;
      this.prevY = mouse.screenY;

      /* Left button, or primary button */
      const mouseDir: Vec3 = this.camera.right();
      mouseDir.scale(-dx);
      mouseDir.add(this.camera.up().scale(dy));
      mouseDir.normalize();


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
    }
    
    // (dx, dy) -> some vector, angle b/w bone & vector is what we want

    // if(mouse_dir != null)
    // {
    //   mouse_dir.y *= -1;
    //   mouse_dir.z *= -1;
    // }
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

      console.log("Highlighted Bone Start: " + to_highlight.position.xyz)
      console.log("Highlighted Bone End: " + to_highlight.endpoint.xyz)
      if(this.dragging)
      {
        // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.
        console.log("Dragging curr bone. ");
        var joint_axis = Vec3.difference(to_highlight.position, this.camera.pos()); //axis = diff(joint start, eye)
        joint_axis = joint_axis.normalize(); // unit vector

        var bone_vec = Vec3.difference(to_highlight.endpoint, to_highlight.position);
        let projected_mouse = new Vec3();
        let projected_bone = new Vec3();
        // u = mouse_vec, n = axis

        // dot(n, p + vt - bone start) = 0
        // dot(n, v)*t = dot(bone start - p)
        // t = dot(n, bone start - p)/dot(n, v), recalculate p + vt
        console.log("Prev ray " + ray_prev.xyz);
        console.log("Curr ray " + ray_curr.xyz);
        let curr_t = Vec3.dot(joint_axis, Vec3.difference(to_highlight.position, this.camera.pos()))/Vec3.dot(joint_axis, ray_curr);
        let prev_t = Vec3.dot(joint_axis, Vec3.difference(to_highlight.position, this.camera.pos()))/Vec3.dot(joint_axis, ray_prev);
        let curr_p = Vec3.sum(this.camera.pos(), ray_curr.scale(curr_t));
        let prev_p = Vec3.sum(this.camera.pos(), ray_prev.scale(prev_t));
        

        console.log("Prev P " + prev_p.xyz);
        console.log("Curr P " + curr_p.xyz);

        let mouse_dir = Vec3.difference(curr_p, prev_p)
        
        projected_bone = Vec3.difference(bone_vec, joint_axis.copy().scale(Vec3.dot(bone_vec, joint_axis)/(joint_axis.squaredLength()), projected_bone));
        projected_mouse = Vec3.sum(mouse_dir,projected_bone);
        // V1 = projected bone vector, V2 = projected mouse dir < v1,v2>
        // dot(V1, V2) = V1*V2 cos theta
        // cross(V1, V2).normalize() == joint_axis, sin(theta) > 0

        console.log("Projected Mouse" + projected_mouse.xyz + " Projected Bone " + projected_bone.xyz);
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
        
        console.log("Calculated Angle: " + theta + " radians " + theta*180/PI + " degrees ");
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
        }
        break;
      }      
      case "KeyP": {
        if (this.mode === Mode.edit && this.getNumKeyFrames() > 1)
        {
          this.mode = Mode.playback;
          this.time = 0;
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
