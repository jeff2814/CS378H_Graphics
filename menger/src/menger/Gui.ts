import { Camera } from "../lib/webglutils/Camera.js";
import { CanvasAnimation } from "../lib/webglutils/CanvasAnimation.js";
import { MengerSponge } from "./MengerSponge.js";
import { Mat4, Vec3 } from "../lib/TSM.js";
import { faceHelper } from "./Utils.js";

var debug = true;
var initX = 0;
var initY = 0;

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
  private width: number;

  private sponge: MengerSponge;
  private animation: CanvasAnimation;

  private printViewMat() : void
  {
    var m = this.viewMatrix();
    console.log("View Matrix:\n");
    for(var i = 0; i < 4; i++)
      console.log("Row " + i + " :" + m.at(i) + ", " + m.at(4 + i) + ", " + m.at(8 + i) + ", " + m.at(12 + i) + "\n");
  }

  private screenToWorld(x: number, y: number):Vec3 
  {
    var m = this.viewMatrix();
    // row 0: tangent, row 1: up
    var _x = x*m.at(0) + y*m.at(1);
    var _y = x*m.at(4) + y*m.at(5);
    var _z = x*m.at(8) + y*m.at(9);
    return new Vec3([_x, _y, _z]);
  }
  /**
   *
   * @param canvas required to get the width and height of the canvas
   * @param animation required as a back pointer for some of the controls
   * @param sponge required for some of the controls
   */
  constructor(
    canvas: HTMLCanvasElement,
    animation: CanvasAnimation,
    sponge: MengerSponge
  ) {
    this.height = canvas.height;
    this.width = canvas.width;
    this.prevX = 0;
    this.prevY = 0;

    this.sponge = sponge;
    this.animation = animation;

	this.reset();

    this.registerEventListeners(canvas);
  }

  /**
   * Resets the state of the GUI
   */
  public reset(): void {
    this.fps = false;
    this.dragging = false;
    /* Create camera setup */
    this.camera = new Camera(
      new Vec3([0, 0, -6]),
      new Vec3([0, 0, 0]),
      new Vec3([0, 1, 0]),
      45,
      this.width / this.height,
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
    this.dragging = true;
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;

    if(debug)
    {
      initX = this.prevX;
      initY = this.prevY;
    }
  }

  /**
   * The callback function for a drag event.
   * This event happens after dragStart and
   * before dragEnd.
   * @param mouse
   */
  public drag(mouse: MouseEvent): void {
	  
	  // TODO: Your code here for left and right mouse drag
    if(this.dragging == false)
      return;

    var dx = mouse.screenX-this.prevX;
    var dy = mouse.screenY-this.prevY;
    if(dx == 0 || dy == 0)
      return;
    this.prevX = mouse.screenX;
    this.prevY = mouse.screenY;
    var vec = this.screenToWorld(dx, -dy);
    if(debug)
    {
      console.log("Vec X: " + dx + " Y: " + dy);
      this.printViewMat();
      console.log("Converted Vec X:" + vec.at(0) + "Y: " + vec.at(1) + "Z: " + vec.at(2) + "\n");
    }
    //this.camera.orbitTarget(vec, GUI.rotationSpeed);
    this.camera.rotate(Vec3.cross(vec, this.camera.forward()), GUI.rotationSpeed);
  }

  /**
   * Callback function for the end of a drag event
   * @param mouse
   */
  public dragEnd(mouse: MouseEvent): void {
    if(debug)
    {
      var dx = mouse.screenX-initX;
      var dy = mouse.screenY-initY;
      console.log("Total Vec X: " + dx + " Y: " + dy);
      this.printViewMat();
      var vec = this.screenToWorld(dx, dy);
      console.log("Converted Vec X:" + vec.at(0) + "Y: " + vec.at(1) + "Z: " + vec.at(2) + "\n");
    }
    this.drag(mouse);
    this.dragging = false;
    this.prevX = 0;
    this.prevY = 0;
  }

  /**
   * Callback function for a key press event
   * @param key
   */
  public onKeydown(key: KeyboardEvent): void {
    /*
       Note: key.code uses key positions, i.e a QWERTY user uses y where
             as a Dvorak user must press F for the same action.
       Note: arrow keys are only registered on a KeyDown event not a
       KeyPress event
       We can use KeyDown due to auto repeating.
     */

	// TOOD: Your code for key handling

    switch (key.code) {
      case "KeyW": {
        this.camera.offsetDist(-GUI.zoomSpeed);
        break;
      }
      case "KeyA": {
        this.camera.offset(this.camera.right(), -GUI.panSpeed, true);
        break;
      }
      case "KeyS": {
        this.camera.offsetDist(GUI.zoomSpeed);
        break;
      }
      case "KeyD": {
        this.camera.offset(this.camera.right(), GUI.panSpeed, true);
        break;
      }
      case "KeyR": {
        break;
      }
      case "ArrowLeft": {
        this.camera.roll(GUI.rollSpeed, false)
        break;
      }
      case "ArrowRight": {
        this.camera.roll(GUI.rollSpeed, true)
        break;
      }
      case "ArrowUp": {
        this.camera.offset(this.camera.up(), GUI.panSpeed, false);
        break;
      }
      case "ArrowDown": {
        this.camera.offset(this.camera.up(), -GUI.panSpeed, false);
        break;
      }
      case "Digit1": {
        this.sponge.setLevel(1);
        break;
      }
      case "Digit2": {
        this.sponge.setLevel(2);
        break;
      }
      case "Digit3": {
        this.sponge.setLevel(3);
        break;
      }
      case "Digit4": {
        this.sponge.setLevel(4);
        break;
      }
      //just for fun
      case "Digit5": {
        this.sponge.setLevel(5);
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
