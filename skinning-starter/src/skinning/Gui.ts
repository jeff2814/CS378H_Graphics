 import { Camera } from "../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { SkinningAnimation } from "./App.js";
import { Mat4, Vec3, Vec4, Vec2, Mat2, Quat } from "../lib/TSM.js";
import { Bone } from "./Scene.js";
import { RenderPass } from "../lib/webglutils/RenderPass.js";
import { RGBA_ASTC_8x5_Format } from "../lib/threejs/src/constants.js";

const RADIUS = .5;
const RAY_EPSILON = 1.0e-8;

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
  public start: Vec4;
  public end: Vec4;
  public dir: Vec3;
  public bone: Bone;

  constructor(bone: Bone) 
  {
    
    this.bone = bone;
    this.radius = RADIUS;
    this.start = (new Vec4([bone.position.x, bone.position.y, bone.position.z, 1]));
    this.end = (new Vec4([bone.endpoint.x, bone.endpoint.y, bone.endpoint.z, 1]));
    var pq = Vec3.difference(new Vec3(this.end.xyz), new Vec3(this.start.xyz));
    this.dir = pq.normalize();
    this.height = pq.length();
  }

  private rayAtTime(start_pos: Vec3, dir: Vec3, time: number) : Vec3
  {
    var to_add = dir.scale(time);
    return start_pos.add(to_add);
  }

  public intersectsBody(pos: Vec3, dir: Vec3) : number
  {
    // var conv_pos = (new Vec4([pos.x, pos.y, pos.z, 1])).multiplyMat4(this.bone.worldToLocal());
    // var conv_dir = (new Vec4([dir.x, dir.y, dir.z, 0])).multiplyMat4(this.bone.worldToLocal());

    var position = new Vec3(pos.xyz);
    var direction = new Vec3(dir.xyz);

    console.log("Bone start: " + this.bone.position.xyz);
    console.log("Bone end: " + this.bone.endpoint.xyz);
    console.log("Local camera pos: " + position.xyz);
    console.log("Local ray: " + direction.xyz);

    // https://mrl.cs.nyu.edu/~dzorin/rend05/lecture2.pdf
    var v = direction;
    var v_a = this.dir;
    var dp = Vec3.difference(position, new Vec3(this.start.xyz));
    var r = this.radius;

    console.log("v: " + v.xyz);
    console.log("v_a: " + v_a.xyz);
    console.log("dp " + dp.xyz);

    var v_va = Vec3.difference(v, v_a.scale(Vec3.dot(v, v_a)));
    var p_va = Vec3.difference(dp, v_a.scale(Vec3.dot(dp, v_a)));

    var a = v_va.squaredLength();
    var b = 2.0*Vec3.dot(v_va, p_va);
    var c = p_va.squaredLength() - r*r;

    console.log("a: " + a);
    console.log("b: " + b);
    console.log("c: " + c);

    // This implies that x1 = 0.0 and y1 = 0.0, which further
		// implies that the ray is aligned with the body of the cylinder,
		// so no intersection.
    if(a == 0.0) {
      return -1;
    }

    var discriminant = b*b - 4.0*a*c;
    console.log("discriminant: " + discriminant);

    if(discriminant < 0) {
      return -1;
    }
    
    var t2 = (-b + Math.sqrt(discriminant)) / (2.0 * a);
    console.log("t2: " + t2);
    if( t2 <= RAY_EPSILON ) {
      return -1;
    }

    var t1 = (-b - Math.sqrt(discriminant)) / (2.0 * a);
    
    console.log("t1 " + t1);

    if(t1 > RAY_EPSILON) 
    {
      let p = this.rayAtTime(position, direction, t1);
      console.log("p_t1: " + p.xyz);
      let z = p.z;
      if(z >= 0.0 && z <= 1.0)
      {
        // It's okay.
        return t1;
      }
    }

    let p2 = this.rayAtTime(position,direction,t2);
    console.log("p_t2: " + p2.xyz);
    let z2 = p2.z;
    if(z2 >= 0.0 && z2 <= 1.0)
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

  private toVec4(vec: Vec3, flag: number) {return new Vec4([vec.x, vec.y, vec.z, flag])}

  private intersectsBone(camera_pos: Vec3, direction: Vec3) : Bone
  {
    var meshes = this.animation.getScene().meshes;
    for(var i = 0; i < meshes.length; i++)
    {
      var bone_forest = meshes[i].bones;
      for(var j = 0; j < bone_forest.length; j++)
      {
        var cur_bone = bone_forest[j];
        var cylinder = new Cylinder(cur_bone);
        var time = cylinder.intersectsBody(camera_pos, direction);
        console.log("Time: " + time);
        //points: 1, vectors: 0

      }
    }
    return null;
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
          this.camera.offsetDist(Math.sign(mouseDir.y) * GUI.zoomSpeed);
          break;
        }
        default: {
          break;
        }
      }
    } 
    
    // TODO
    // You will want logic here:
    // 1) To highlight a bone, if the mouse is hovering over a bone;

    console.log("X: " + x + " Y: " + y);
    var ray = this.getRayFromScreen(x, y);
    console.log("normalized dir" + ray.xyz);
    console.log("camera pos " + this.camera.pos().xyz);
  
    this.intersectsBone(this.camera.pos(), ray)

    //if(highlighted && this.dragging)
      // 2) To rotate a bone, if the mouse button is pressed and currently highlighting a bone.


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
        this.camera.roll(GUI.rollSpeed, false);
        break;
      }
      case "ArrowRight": {
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
