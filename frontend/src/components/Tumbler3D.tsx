/**
 * 3D preview: a white 20oz skinny tumbler with the wrap canvas used as its
 * texture. Drag to rotate, scroll to zoom. The seam (left/right edge of the
 * wrap) sits at the back, the centre of the wrap faces the camera.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WRAP } from '../recipe';

interface Props {
  source: HTMLCanvasElement;
  /** Bump this number whenever `source` has been redrawn. */
  version: number;
  autoRotate: boolean;
}

type EdgeMaterials = { top: THREE.MeshPhysicalMaterial[]; bottom: THREE.MeshPhysicalMaterial[] };

/** Average colour of one pixel row of the wrap. */
function rowColor(source: HTMLCanvasElement, y: number) {
  const d = source.getContext('2d')!.getImageData(0, y, source.width, 1).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  return new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace);
}

/** Colour the rim + lid like the top of the design, and the bottom ring like its bottom. */
function tintEdges(source: HTMLCanvasElement, mats: EdgeMaterials) {
  const top = rowColor(source, 3);
  const bottom = rowColor(source, source.height - 4);
  mats.top.forEach((m) => m.color.copy(top));
  mats.bottom.forEach((m) => m.color.copy(bottom));
}

export function Tumbler3D({ source, version, autoRotate }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const edgeMatsRef = useRef<EdgeMaterials | null>(null);
  const returningRef = useRef(false);

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;
    scene.environmentIntensity = 0.9;

    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(4, 6, 8);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.2, 25);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.minDistance = 13;
    controls.maxDistance = 38;
    controls.minPolarAngle = Math.PI * 0.2;
    controls.maxPolarAngle = Math.PI * 0.8;
    controls.autoRotateSpeed = 1.6;
    controls.target.set(0, 0.4, 0);
    controlsRef.current = controls;

    // --- tumbler, in inches. Circumference = wrap width.
    const R = WRAP.widthIn / (2 * Math.PI);
    const H = WRAP.heightIn;

    const texture = new THREE.CanvasTexture(source);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    textureRef.current = texture;

    const group = new THREE.Group();
    const disposables: { dispose(): void }[] = [texture, envMap, pmrem];
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = y;
      group.add(mesh);
      disposables.push(geo, mat);
      return mesh;
    };

    // thetaStart = π puts u=0 (the seam) at the back and u=0.5 at the front.
    add(
      new THREE.CylinderGeometry(R, R, H, 160, 1, true, Math.PI, Math.PI * 2),
      new THREE.MeshPhysicalMaterial({ map: texture, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 }),
    );
    // Rim, lid and bottom ring take their colour from the design's top/bottom edge (see tintEdges).
    const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 });
    const baseMat = rimMat.clone();
    add(new THREE.CylinderGeometry(R * 1.005, R * 1.005, 0.32, 96), rimMat, H / 2 + 0.16);
    add(new THREE.CylinderGeometry(R * 0.985, R * 0.95, 0.18, 96), baseMat, -H / 2 - 0.09);
    const lidMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, clearcoat: 0.4 });
    edgeMatsRef.current = { top: [rimMat, lidMat], bottom: [baseMat] };
    tintEdges(source, edgeMatsRef.current);
    add(new THREE.CylinderGeometry(R * 1.03, R * 1.03, 0.5, 96), lidMat, H / 2 + 0.57);
    add(new THREE.CylinderGeometry(R * 0.9, R * 1.03, 0.14, 96), lidMat, H / 2 + 0.89);
    const straw = add(
      new THREE.CylinderGeometry(0.13, 0.13, 3.6, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, transmission: 0.85, thickness: 0.2 }),
      H / 2 + 2.5,
    );
    straw.position.x = 0.35;
    straw.rotation.z = -0.08;
    group.position.y = -0.4;
    scene.add(group);

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      // Pull back on narrow (portrait) screens so the whole cup fits.
      camera.position.setLength(w / h < 0.75 ? 31 : 25);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // When spinning stops, glide back to the front of the design (unless the user grabs the cup).
    const offset = new THREE.Vector3();
    const spherical = new THREE.Spherical();
    controls.addEventListener('start', () => (returningRef.current = false));
    renderer.setAnimationLoop(() => {
      if (returningRef.current) {
        offset.copy(camera.position).sub(controls.target);
        spherical.setFromVector3(offset);
        const theta = Math.atan2(Math.sin(spherical.theta), Math.cos(spherical.theta)); // -π..π, 0 = front
        spherical.theta = Math.abs(theta) < 0.005 ? 0 : theta * 0.88;
        if (spherical.theta === 0) returningRef.current = false;
        camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
      }
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      host.removeChild(renderer.domElement);
      textureRef.current = null;
      controlsRef.current = null;
      edgeMatsRef.current = null;
    };
  }, [source]);

  useEffect(() => {
    if (textureRef.current) textureRef.current.needsUpdate = true;
    if (edgeMatsRef.current) tintEdges(source, edgeMatsRef.current);
  }, [version, source]);

  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = autoRotate;
    returningRef.current = !autoRotate;
  }, [autoRotate]);

  return <div className="tumbler-3d" ref={hostRef} />;
}
