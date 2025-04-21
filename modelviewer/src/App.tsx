import { useEffect, useRef, useState } from "react"; // Removed useMemo
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Environment } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Menu } from "lucide-react";
import * as THREE from 'three';
// Removed explicit import of GLTFLoader from jsm examples
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'; // <-- REMOVED
import components from './components.json';
// import { Checkbox } from "@/components/ui/checkbox"; // Commented out or remove Checkbox import

interface ModelConfig {
  basePath: string;
  models: { health: number; file: string }[];
  thumbnail: string;
  label: string;
}

// Assuming components.json structure is { "key": { "folder": "folderName", "thumbnail": "path/to/thumb", "label": "Model Label" } }
const MODEL_PATHS: Record<string, ModelConfig> = Object.fromEntries(
  Object.entries(components).map(([key, config]: [string, any]) => [
    key,
    {
      basePath: `/models/${config.folder}/`,
      models: [
        { health: 100, file: `${config.folder}_100.glb` },
        { health: 75,  file: `${config.folder}_75.glb` },
        { health: 50,  file: `${config.folder}_50.glb` },
        { health: 25,  file: `${config.folder}_25.glb` },
        { health: 0,   file: `${config.folder}_0.glb` }
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

// Standard model viewer component (Simplified opacity application)
function RBCModel({ url, opacity }: { url: string; opacity: number }) {
  const { scene } = useGLTF(url);
  const modelRef = useRef<THREE.Object3D>(null);
  const [isModelReady, setIsModelReady] = useState(false);


   useEffect(() => {
      setIsModelReady(false);

      const cleanupCurrentModel = () => {
          if (modelRef.current) {
              modelRef.current.traverse((child: any) => {
                  if (child.isMesh) {
                      child.geometry.dispose();
                      // Ensure material disposal handles both single and array materials
                      if (Array.isArray(child.material)) {
                           // Dispose cloned materials
                           child.material.forEach((mat: THREE.Material) => mat.dispose());
                       } else if (child.material) {
                            // Dispose cloned material
                           (child.material as THREE.Material).dispose();
                       }
                       // Note: Original materials from useGLTF cache are not disposed here
                       // which is usually desired for performance.
                  }
              });
          }
          modelRef.current = null;
      };

      cleanupCurrentModel();

     if (scene) {
        const clonedScene = scene.clone();
         clonedScene.traverse((child: any) => {
            if (child.isMesh) {
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    const clonedMaterials = materials.map((mat: THREE.Material) => {
                         const newMat = mat.clone();
                         newMat.transparent = true;
                         newMat.opacity = opacity;
                         newMat.needsUpdate = true;
                         // newMat.depthWrite = opacity < 1;
                         return newMat;
                    });
                    child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0];
                }
            }
        });
        modelRef.current = clonedScene;
         setIsModelReady(true);
     }

     return cleanupCurrentModel;


   }, [scene, opacity]);

  return isModelReady && modelRef.current ? <primitive object={modelRef.current} /> : null;
}


// Component to display and animate multiple instances of the test model
function TestAnimatedScene({ count, setMeshParts, visibleParts }: {
    count: number;
    setMeshParts: (parts: string[]) => void;
    visibleParts: Record<string, boolean>;
}) {
  const { scene: baseScene, animations } = useGLTF("/models/testing/Main.glb");
  const [areInstancesReady, setAreInstancesReady] = useState(false);

  const { invalidate } = useThree();

  const instancesRef = useRef<{ scene: THREE.Group; mixer: THREE.AnimationMixer }[]>([]);

   // Effect to find and report mesh parts when baseScene loads
   useEffect(() => {
       if (baseScene) {
           const parts: string[] = [];
           baseScene.traverse((child: any) => {
               if (child.isMesh) {
                   parts.push(child.name || `Unnamed_Mesh_${parts.length}`);
               }
           });
           const uniqueParts = Array.from(new Set(parts));
           setMeshParts(uniqueParts);
       } else {
           setMeshParts([]);
       }
   }, [baseScene, setMeshParts]);

  // Setup and cleanup effect for instances and initial visibility
  useEffect(() => {
    const oldInstances = instancesRef.current;
    oldInstances.forEach(({ mixer, scene }) => {
      mixer.stopAllAction();
       scene.traverse((child: any) => {
           if (child.isMesh) {
               child.geometry.dispose();
               if (Array.isArray(child.material)) {
                   child.material.forEach((mat: THREE.Material) => mat.dispose());
               } else if (child.material) {
                    (child.material as THREE.Material).dispose();
               }
           }
       });
    });
    instancesRef.current = [];
    setAreInstancesReady(false);


    const newInstances = [];
    const animationClip = animations?.length > 0 ? animations[0] : null;

    const minDistance = 0.8;
    const maxDistance = 2.5;
    const randomYRange = 0.1;

    // Proceed only if the base scene is loaded and count is valid
    // We no longer wait for visibleParts here, as visibility is updated later
    if (baseScene && count > 0) {
        for (let i = 0; i < count; i++) {
          const instanceScene = baseScene.clone();

          // Position the instance
          if (i === 0) {
            instanceScene.position.set(0, 0, 0);
          } else {
            const distance = minDistance + Math.random() * (maxDistance - minDistance);
            const angle = Math.random() * Math.PI * 2;
            const x = distance * Math.cos(angle);
            const z = distance * Math.sin(angle);
            const y = (Math.random() - 0.5) * randomYRange;

            instanceScene.position.set(x, y, z);
            instanceScene.rotation.y = Math.random() * Math.PI * 2;
          }

           // Set initial visibility based on visibleParts prop *available at this moment*
           // This handles the initial state when instances are first created
           instanceScene.traverse((child: any) => {
               if (child.isMesh) {
                   // Default to true if part name not found (e.g. before meshParts is fully populated)
                   // Use the state from the prop directly
                   child.visible = visibleParts[child.name] !== false;
               }
           });


          // Setup animation mixer
          const instanceMixer = new THREE.AnimationMixer(instanceScene);
          if (animationClip) {
            const action = instanceMixer.clipAction(animationClip);
            action.reset().play();
          }

          newInstances.push({ scene: instanceScene, mixer: instanceMixer });
        }

        instancesRef.current = newInstances;
        setAreInstancesReady(true);
        invalidate();
    }


     return () => {
         const instancesToCleanup = instancesRef.current;
         instancesToCleanup.forEach(({ mixer, scene }) => {
            mixer.stopAllAction();
            scene.traverse((child: any) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat: THREE.Material) => mat.dispose());
                    } else if (child.material) {
                         (child.material as THREE.Material).dispose();
                    }
                }
            });
         });
         instancesRef.current = [];
          setAreInstancesReady(false);
          invalidate();
     };

     // *** CORRECTED DEPENDENCY ARRAY ***
     // Only re-run when count, baseScene, or animations change.
     // visibleParts changes will be handled by the separate effect below.
  }, [count, baseScene, animations, invalidate]);


  // Effect to update visibility *after* instances are ready and visibleParts changes
  useEffect(() => {
      // Only run if instances exist and visibleParts is ready
      if (areInstancesReady && Object.keys(visibleParts).length > 0) {
          instancesRef.current.forEach(({ scene }) => {
              scene.traverse((child: any) => {
                  if (child.isMesh) {
                      child.visible = visibleParts[child.name] !== false;
                  }
              });
          });
          invalidate(); // Force render to show changes
      }
  }, [visibleParts, areInstancesReady, invalidate]); // Depends on visibleParts


  // Animation update loop
  useFrame((_, delta) => {
      if (areInstancesReady) {
        instancesRef.current.forEach(({ mixer }) => {
          mixer.update(delta);
        });
      }
  });

  return (
     <>
        {areInstancesReady && instancesRef.current.map((instance, index) => (
            <primitive key={index} object={instance.scene} />
        ))}
     </>
  );
}


export default function RBCViewer() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [health, setHealth]         = useState(100);
  const [autoRotate, setAutoRotate] = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);
  const [testMode, setTestMode]     = useState(false);
  const [count, setCount]           = useState(0);

  const [meshParts, setMeshParts] = useState<string[]>([]);
  const [visibleParts, setVisibleParts] = useState<Record<string, boolean>>({});

  // Effect to initialize visibleParts when meshParts are discovered by TestAnimatedScene
  useEffect(() => {
      // If meshParts is populated and visibleParts is empty, initialize it
      if (meshParts.length > 0 && Object.keys(visibleParts).length === 0) {
          const initialVisibility: Record<string, boolean> = {};
          meshParts.forEach(part => {
              initialVisibility[part] = true;
          });
          setVisibleParts(initialVisibility);
      } else if (meshParts.length === 0 && Object.keys(visibleParts).length > 0) {
           // If meshParts becomes empty (e.g., exiting test mode), clear visibleParts
           setVisibleParts({});
      }
      // Note: We *don't* want to reset visibleParts if meshParts is already populated
      // and visibleParts has been changed by the user.
  }, [meshParts]); // Only depends on meshParts here


  const handleTogglePart = (partName: string) => {
      setVisibleParts(prev => ({
          ...prev,
          [partName]: !prev[partName]
      }));
  };

  const modelConfig = selectedModel ? MODEL_PATHS[selectedModel] : null;
  const currentModel = modelConfig
    ? getModelFileForHealth(health, modelConfig.models)
    : null;

  return (
    <div className="w-full h-screen flex overflow-hidden relative">
      <div className={`transition-all duration-300 ${menuOpen ? 'w-80' : 'w-0'} bg-white border-r shadow-md z-20 overflow-y-auto`}>
        {menuOpen && (
          <div className="p-4 space-y-4">
            <h2 className="text-xl font-semibold">Model Viewer</h2>
            {!selectedModel ? (
              Object.entries(MODEL_PATHS).map(([key, model]) => (
                <div key={key} className="text-center">
                  <img
                    src={model.thumbnail}
                    alt={model.label}
                    className="cursor-pointer border rounded w-full h-auto object-cover"
                    onClick={() => {
                         setSelectedModel(key);
                         setTestMode(false);
                         setCount(0);
                         setAutoRotate(false);
                         setMeshParts([]); // Clear test mode parts state
                         setVisibleParts({}); // Clear test mode visibility state
                    }}
                  />
                  <p className="text-sm mt-1">{model.label}</p>
                </div>
              ))
            ) : (
              <>
                <Button variant="outline" onClick={() => {
                    setSelectedModel(null);
                     setHealth(100);
                     setAutoRotate(false);
                     setCount(0);
                }}>
                  ← Back
                </Button>

                <h3 className="text-lg font-medium mt-4">Degradation</h3>
                 <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[health]}
                  onValueChange={([v]: [number]) => setHealth(v)}
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

         {/* Checklist for Test Mode */}
         {testMode && meshParts.length > 0 && Object.keys(visibleParts).length > 0 && (
             <div className="absolute top-4 right-4 z-10 p-4 bg-white border rounded-md shadow-md max-h-[80%] overflow-y-auto">
                 <h3 className="text-md font-semibold mb-2">Model Parts</h3>
                 <div className="space-y-1 text-sm">
                     {meshParts.map(part => (
                         <div key={part} className="flex items-center space-x-2">
                             <input
                                 type="checkbox"
                                 id={`part-${part}`}
                                 checked={visibleParts[part] !== false}
                                 onChange={() => handleTogglePart(part)}
                                 className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                             />
                             <label
                                 htmlFor={`part-${part}`}
                                 className="text-sm font-medium text-gray-700"
                             >
                                 {part || "Unnamed Part"}
                             </label>
                         </div>
                     ))}
                 </div>
             </div>
         )}


        <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 3, 3]} intensity={1} />
          <OrbitControls autoRotate={autoRotate && !testMode} target={[0,0,0]} />

          <Environment background files="/hdr/mud_road_puresky_1k.hdr" path="" />

          {testMode ? (
            <TestAnimatedScene
                count={count}
                setMeshParts={setMeshParts}
                visibleParts={visibleParts} // Pass the state down
            />
          ) : (
            selectedModel && currentModel && modelConfig && (
              <RBCModel url={modelConfig.basePath + currentModel.file} opacity={1} />
            )
          )}
        </Canvas>

        <div className="absolute bottom-4 left-4 z-10 flex items-center space-x-2 bg-gray-800 p-2 rounded-md bg-opacity-70 text-white">

          {testMode && (
            <>
              <label htmlFor="count" className="text-sm">Count:</label>
              <input
                id="count"
                type="number"
                value={count} // This value is controlled by the parent state
                onChange={(e) => {
                    const val = Number(e.target.value);
                    // Ensure count is at least 1
                    setCount(val > 0 ? val : 0); // This updates the parent state
                 }}
                min={1}
                className="w-16 px-2 py-1 border rounded bg-gray-700 text-white text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              {/* Upload Button is commented out */}
              {/* <Button variant="secondary" onClick={handleUpload} size="sm"> Upload Image </Button> */}
            </>
          )}

          <Button variant="secondary" onClick={() => {
             const enteringTestMode = !testMode;
             setTestMode(enteringTestMode);

             if (enteringTestMode) {
                setCount(0); // Reset count
                setSelectedModel(null);
                setAutoRotate(false);
                // meshParts and visibleParts will be populated by TestAnimatedScene loading
             } else {
                setCount(0); // Reset count
                setMeshParts([]);
                setVisibleParts({});
             }
          }} size="sm">
            {testMode ? "Back to Viewer" : "Test Animation"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Preload models
Object.values(MODEL_PATHS).forEach(model => {
  model.models.forEach((m: { health: number; file: string }) => useGLTF.preload(model.basePath + m.file));
});
useGLTF.preload("/models/testing/Main.glb");