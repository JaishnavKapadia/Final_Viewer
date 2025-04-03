import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Menu } from "lucide-react";
import * as THREE from 'three';
import components from './components.json';

interface ModelConfig {
  basePath: string;
  models: { health: number; file: string }[];
  thumbnail: string;
  label: string;
}

const MODEL_PATHS: Record<string, ModelConfig> = Object.fromEntries(
  Object.entries(components).map(([key, config]: [string, any]) => [
    key,
    {
      basePath: `/models/${config.folder}/`,
      models: [
        { health: 100, file: `${config.folder}_100.glb` },
        { health: 75, file: `${config.folder}_75.glb` },
        { health: 50, file: `${config.folder}_50.glb` },
        { health: 25, file: `${config.folder}_25.glb` },
        { health: 0, file: `${config.folder}_0.glb` }
      ],
      thumbnail: config.thumbnail,
      label: config.label
    }
  ])
);

function getModelFileForHealth(health: number, models: any[]) {
  if (health >= 90) return models[0];
  if (health >= 60) return models[1];
  if (health >= 40) return models[2];
  if (health >= 10) return models[3];
  return models[4];
}

function RBCModel({ url, opacity }: { url: string, opacity: number }) {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Object3D>(null);

  useFrame(() => {
    const obj = modelRef.current;
    if (obj) {
      obj.traverse((child: any) => {
        if (child.isMesh) {
          child.material.transparent = true;
          child.material.opacity = opacity;
        }
      });
    }
  });

  return <primitive object={scene} ref={modelRef} />;
}

export default function RBCViewer() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [health, setHealth] = useState(100);
  const [autoRotate, setAutoRotate] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const modelConfig = selectedModel ? MODEL_PATHS[selectedModel] : null;
  const currentModel = modelConfig ? getModelFileForHealth(health, modelConfig.models) : null;

  return (
    <div className="w-full h-screen flex overflow-hidden">
      <div className={`transition-all duration-300 ${menuOpen ? 'w-80' : 'w-0'} bg-white border-r shadow-md z-20`}>
        {menuOpen && (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-semibold">Model Viewer</h2>
            {!selectedModel ? (
              Object.entries(MODEL_PATHS).map(([key, model]) => (
                <div key={key}>
                  <img
                    src={model.thumbnail}
                    alt={model.label}
                    className="cursor-pointer border rounded"
                    onClick={() => setSelectedModel(key)}
                  />
                  <p className="text-sm text-center mt-1">{model.label}</p>
                </div>
              ))
            ) : (
              <>
                <Button variant="outline" onClick={() => setSelectedModel(null)}>
                  ← Back
                </Button>
                <h3 className="text-lg font-medium mt-4">Degradation</h3>
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[health]}
                  onValueChange={([v]) => setHealth(v)}
                />
                <p className="text-sm text-muted-foreground">
                  Health: {health}%
                </p>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={autoRotate}
                    onChange={(e) => setAutoRotate(e.target.checked)}
                  />
                  <label className="text-sm">Auto-Rotate</label>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className={`relative transition-all duration-300 ${menuOpen ? 'w-[calc(100%-20rem)]' : 'w-full'}`}>
        <div className="absolute top-4 left-4 z-10">
          <Button size="icon" onClick={() => setMenuOpen(!menuOpen)}>
            <Menu className="w-5 h-5" />
          </Button>
        </div>
        <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }}>
          <ambientLight intensity={1.5} />
          <directionalLight position={[3, 3, 3]} intensity={1} />
          <OrbitControls autoRotate={autoRotate} />
          {selectedModel && currentModel && modelConfig && (
            <RBCModel url={modelConfig.basePath + currentModel.file} opacity={1} />
          )}
        </Canvas>
      </div>
    </div>
  );
}

Object.values(MODEL_PATHS).forEach(model => {
  useGLTF.preload(model.basePath + model.models[0].file);
});
