import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Face, Move } from './moves';

export const FACE_COLORS: Record<Face, string> = {
  U: '#ffffff',
  D: '#ffd500',
  F: '#009b48',
  B: '#0046ad',
  R: '#b71234',
  L: '#ff5800',
};

type Axis = 'x' | 'y' | 'z';

/** Rotation axis, layer coordinate, and sign of a clockwise quarter turn for each face. */
const FACE_TURN: Record<Face, { axis: Axis; layer: number; sign: number }> = {
  R: { axis: 'x', layer: 1, sign: -1 },
  L: { axis: 'x', layer: -1, sign: 1 },
  U: { axis: 'y', layer: 1, sign: -1 },
  D: { axis: 'y', layer: -1, sign: 1 },
  F: { axis: 'z', layer: 1, sign: -1 },
  B: { axis: 'z', layer: -1, sign: 1 },
};

const STICKER_FACES: { face: Face; normal: THREE.Vector3 }[] = [
  { face: 'R', normal: new THREE.Vector3(1, 0, 0) },
  { face: 'L', normal: new THREE.Vector3(-1, 0, 0) },
  { face: 'U', normal: new THREE.Vector3(0, 1, 0) },
  { face: 'D', normal: new THREE.Vector3(0, -1, 0) },
  { face: 'F', normal: new THREE.Vector3(0, 0, 1) },
  { face: 'B', normal: new THREE.Vector3(0, 0, -1) },
];

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface ActiveTurn {
  pivot: THREE.Object3D;
  axis: Axis;
  angle: number;
  start: number;
  duration: number;
  resolve: () => void;
}

export class CubeView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private cubeGroup = new THREE.Group();
  private cubies: THREE.Object3D[] = [];
  private active: ActiveTurn | null = null;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(5.5, 4.5, 7);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 16;

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-6, -4, -5);
    this.scene.add(fill);

    this.scene.add(this.cubeGroup);
    this.buildCubies();

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop((time) => this.tick(time));
  }

  private buildCubies() {
    const bodyGeometry = new RoundedBoxGeometry(0.98, 0.98, 0.98, 3, 0.1);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const stickerGeometry = new THREE.PlaneGeometry(0.82, 0.82);
    const stickerMaterial = (face: Face) =>
      new THREE.MeshStandardMaterial({ color: FACE_COLORS[face], roughness: 0.35, side: THREE.DoubleSide });
    const stickerMaterials: Record<Face, THREE.Material> = {
      U: stickerMaterial('U'),
      D: stickerMaterial('D'),
      F: stickerMaterial('F'),
      B: stickerMaterial('B'),
      R: stickerMaterial('R'),
      L: stickerMaterial('L'),
    };

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const cubie = new THREE.Group();
          cubie.position.set(x, y, z);
          cubie.add(new THREE.Mesh(bodyGeometry, bodyMaterial));

          for (const { face, normal } of STICKER_FACES) {
            if (normal.x * x + normal.y * y + normal.z * z !== 1) continue;
            const sticker = new THREE.Mesh(stickerGeometry, stickerMaterials[face]);
            sticker.position.copy(normal).multiplyScalar(0.495);
            sticker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
            cubie.add(sticker);
          }

          this.cubeGroup.add(cubie);
          this.cubies.push(cubie);
        }
      }
    }
  }

  get isAnimating() {
    return this.active !== null;
  }

  /** Animate a single face turn. Resolves once the turn has visually finished. */
  turn(move: Move, duration: number): Promise<void> {
    if (this.active) throw new Error('A turn is already in progress');
    const { axis, layer, sign } = FACE_TURN[move.face];
    const angle = sign * move.turns * (Math.PI / 2);

    const pivot = new THREE.Object3D();
    this.cubeGroup.add(pivot);
    for (const cubie of this.cubies) {
      if (Math.round(cubie.position[axis]) === layer) pivot.attach(cubie);
    }

    return new Promise((resolve) => {
      this.active = { pivot, axis, angle, start: performance.now(), duration: Math.max(duration, 1), resolve };
      if (duration <= 0) this.finishTurn();
    });
  }

  /** Reset every cubie to its solved position and orientation. */
  reset() {
    if (this.active) this.finishTurn();
    let i = 0;
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const cubie = this.cubies[i++];
          cubie.position.set(x, y, z);
          cubie.quaternion.identity();
        }
  }

  private finishTurn() {
    const turn = this.active;
    if (!turn) return;
    turn.pivot.rotation[turn.axis] = turn.angle;
    turn.pivot.updateMatrixWorld();

    const snapped = new THREE.Matrix4();
    for (const cubie of [...turn.pivot.children]) {
      this.cubeGroup.attach(cubie);
      cubie.position.round();
      // Snap orientation to exact right angles so floating-point error never accumulates.
      snapped.makeRotationFromQuaternion(cubie.quaternion);
      snapped.elements.forEach((v, idx) => (snapped.elements[idx] = Math.round(v)));
      cubie.quaternion.setFromRotationMatrix(snapped);
    }
    this.cubeGroup.remove(turn.pivot);
    this.active = null;
    turn.resolve();
  }

  private tick(time: number) {
    const turn = this.active;
    if (turn) {
      const t = Math.min((time - turn.start) / turn.duration, 1);
      turn.pivot.rotation[turn.axis] = turn.angle * easeInOut(t);
      if (t >= 1) this.finishTurn();
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
