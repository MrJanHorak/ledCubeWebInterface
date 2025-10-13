import React, { useState } from 'react';
import CubeEditor from './components/CubeEditor';
import Cube3D from './components/Cube3D';

export default function AppClean() {
  const [dummy] = useState(new Array(64).fill(0));
  return (
    <div style={{ padding: 12, fontFamily: 'sans-serif' }}>
      <h1>LED Cube Designer (Clean)</h1>
      <p>This clean entrypoint avoids the corrupted App.jsx while we fix it.</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <CubeEditor frame={dummy} onChange={() => {}} />
        </div>
        <div style={{ width: 320 }}>
          <Cube3D frame={dummy} />
        </div>
      </div>
    </div>
  );
}
