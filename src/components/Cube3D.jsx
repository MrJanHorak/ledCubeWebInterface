import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Props: frame (64 bytes), size (spacing)
export default function Cube3D({
  frame,
  size = 1.2,
  onError = null,
  onReady = null,
}) {
  const mountRef = useRef();
  const objectsRef = useRef([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      const msg = 'Mount element not ready';
      setError(msg);
      if (onError) onError(msg);
      return;
    }

    // quick WebGL availability check
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        const msg = 'WebGL not available in this browser';
        setError(msg);
        if (onError) onError(msg);
        return;
      }
    } catch (e) {
      const msg = 'WebGL check failed: ' + String(e);
      setError(msg);
      if (onError) onError(msg);
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x20252a);

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(20, 24, 36);

    // Clear mount and create a fresh canvas to avoid conflicts with existing contexts
    try {
      // remove all children to ensure no prior canvas remains
      while (mount.firstChild) mount.removeChild(mount.firstChild);
    } catch (e) {}

    let renderer;
    try {
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      mount.appendChild(canvas);
      renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
      renderer.setSize(
        Math.max(1, mount.clientWidth),
        Math.max(1, mount.clientHeight)
      );
    } catch (e) {
      const msg = 'Failed to initialize WebGL renderer: ' + String(e);
      setError(msg);
      if (onError) onError(msg);
      return;
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(20, 30, 20);
    scene.add(dir);
    const back = new THREE.DirectionalLight(0xffffff, 0.25);
    back.position.set(-10, -10, -10);
    scene.add(back);

    // create 8x8x8 small spheres/boxes
    const group = new THREE.Group();
    const geo = new THREE.SphereGeometry(0.32 * size, 10, 10);
    const matOff = new THREE.MeshStandardMaterial({
      color: 0x111214,
      emissive: 0x000000,
      roughness: 0.9,
      metalness: 0.05,
    });
    const matOn = new THREE.MeshStandardMaterial({
      color: 0xffd25a,
      emissive: 0xff7a1a,
      emissiveIntensity: 1.2,
      roughness: 0.2,
      metalness: 0.1,
    });

    objectsRef.current = [];
    for (let z = 0; z < 8; z++) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const mesh = new THREE.Mesh(geo, matOff.clone());
          mesh.position.set(
            (x - 3.5) * size * 1.15,
            (z - 3.5) * size * 1.15,
            (y - 3.5) * size * 1.15
          );
          group.add(mesh);
          objectsRef.current.push(mesh);
        }
      }
    }
    scene.add(group);

    // add a subtle grid and axis helper to help orientation
    try {
      const grid = new THREE.GridHelper(20, 10, 0x333333, 0x222222);
      grid.position.y = -10;
      scene.add(grid);
    } catch (e) {}
    try {
      const axes = new THREE.AxesHelper(6);
      scene.add(axes);
    } catch (e) {}

    let requestAnimationId = null;
    function animate() {
      try {
        controls.update();
        renderer.render(scene, camera);
        requestAnimationId = requestAnimationFrame(animate);
      } catch (e) {
        // stop animation loop and surface error
        const msg = 'Rendering error: ' + String(e);
        setError(msg);
        if (onError) onError(msg);
      }
    }

    requestAnimationId = requestAnimationFrame(animate);
    // signal ready
    if (onReady) onReady();

    function handleResize() {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestAnimationId) cancelAnimationFrame(requestAnimationId);
      try {
        controls.dispose();
      } catch (e) {}
      try {
        if (renderer && renderer.forceContextLoss) renderer.forceContextLoss();
      } catch (e) {}
      try {
        renderer.dispose();
      } catch (e) {}
      try {
        if (
          renderer &&
          renderer.domElement &&
          mount.contains(renderer.domElement)
        )
          mount.removeChild(renderer.domElement);
      } catch (e) {}
    };
  }, [size]);

  // update lights based on frame
  useEffect(() => {
    if (!frame || !objectsRef.current.length) return;
    // objectsRef order: for z 0..7, y 0..7, x 0..7? We added order z,y,x
    // We can map index: idx = z*64 + y*8 + x but frame uses index = 8*y + x, per column. For each (x,y), bit z
    const objs = objectsRef.current;
    let i = 0;
    for (let z = 0; z < 8; z++) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const idx = 8 * y + x;
          const bit = (frame[idx] || 0) & (1 << z);
          const mesh = objs[i];
          if (mesh) {
            if (bit) {
              mesh.material.color.set(0xffcc00);
              mesh.material.emissive.set(0xff7700);
            } else {
              mesh.material.color.set(0x222222);
              mesh.material.emissive.set(0x000000);
            }
          }
          i++;
        }
      }
    }
  }, [frame]);

  // show error text if WebGL or rendering failed
  if (error) {
    return (
      <div
        className='cube3d'
        ref={mountRef}
        style={{
          width: '100%',
          height: 360,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ color: '#b33' }}>
          <strong>3D preview unavailable:</strong>
          <div style={{ marginTop: 6 }}>{error}</div>
          <div style={{ marginTop: 8, color: '#666' }}>
            Try a Chromium-based browser with WebGL enabled.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className='cube3d'
      ref={mountRef}
      style={{ width: '100%', height: 360 }}
    ></div>
  );
}
