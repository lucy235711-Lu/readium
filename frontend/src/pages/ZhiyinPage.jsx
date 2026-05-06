import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRecentConcepts } from '../services/api';

const PHASE = { LOADING:'LOADING', JOURNAL:'JOURNAL', QUESTIONNAIRE:'QUESTIONNAIRE', SYNTHESIS:'SYNTHESIS', IDLE:'IDLE' };
const JOURNAL_KEY = 'zhiyin_journal_v3';
const TTL_MS = 20 * 24 * 60 * 60 * 1000;

function loadJournalCache() {
  try {
    const s = JSON.parse(localStorage.getItem(JOURNAL_KEY) || 'null');
    if (!s || Date.now() - s.savedAt > TTL_MS) { localStorage.removeItem(JOURNAL_KEY); return null; }
    return s;
  } catch { return null; }
}
function saveJournalCache(d) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
}

// ─── Three.js underwater scene ────────────────────────────────────────────────
// Deep ocean blue. GLB whale with AnimationMixer (plays Blender clips directly).
// No manual whale rotation overrides — only world-space position + facing yaw.
function OceanScene() {
  const mountRef = useRef(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[data-src="${src}"]`)) { res(); return; }
      const s = document.createElement('script');
      s.src = src; s.setAttribute('data-src', src);
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });

    const poll = (fn, label) => new Promise((res, rej) => {
      let n = 0;
      const t = setInterval(() => {
        if (fn()) { clearInterval(t); res(); }
        else if (++n > 150) { clearInterval(t); rej(new Error(label + ' timeout')); }
      }, 50);
    });

    let animId = null;
    let renderer = null;

    const init = async () => {
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
        await poll(() => !!window.THREE, 'THREE');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js');
        await poll(() => !!(window.THREE && window.THREE.GLTFLoader), 'GLTFLoader');

        const THREE = window.THREE;
        const W = el.clientWidth, H = el.clientHeight;

        // ── Renderer ──
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(W, H);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        el.appendChild(renderer.domElement);

        // ── Scene — deep ocean blue, layered fog ──
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x00111f);
        scene.fog = new THREE.FogExp2(0x001428, 0.0028);

        const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 3000);
        camera.position.set(0, 20, 380);
        camera.lookAt(0, -10, 0);

        // ── Lighting ──

        // 1. Dim ambient — scattered deep-water light
        scene.add(new THREE.AmbientLight(0x0a2040, 1.4));

        // 2. Sun shaft SpotLight — icy blue-white from directly above
        const sunLight = new THREE.SpotLight(0xb8deff, 4.5);
        sunLight.position.set(30, 900, 80);
        sunLight.target.position.set(0, 0, 0);
        sunLight.angle = Math.PI / 14;
        sunLight.penumbra = 0.55;
        sunLight.decay = 1.0;
        sunLight.distance = 1800;
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.setScalar(1024);
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 2000;
        scene.add(sunLight);
        scene.add(sunLight.target);

        // 3. Animated caustic fill — greenish teal front-below, flickers
        const causticLight = new THREE.PointLight(0x0d4a6e, 2.2, 700);
        causticLight.position.set(-80, -100, 250);
        scene.add(causticLight);

        // 4. Rim light — cool blue from behind to separate whale from bg
        const rimLight = new THREE.DirectionalLight(0x2060a0, 0.8);
        rimLight.position.set(0, 50, -400);
        rimLight.target.position.set(0, 0, 0);
        scene.add(rimLight); scene.add(rimLight.target);

        // 5. Underbelly bounce — subtle warm scatter from below
        const bellyLight = new THREE.PointLight(0x103060, 1.0, 400);
        bellyLight.position.set(0, -200, 150);
        scene.add(bellyLight);

      // 替换原来的 shaft / shaft2 创建部分

// 主光束 — 上窄下宽，居中
const shaftGeo = new THREE.CylinderGeometry(
  8,   // 顶部半径（窄）
  70,  // 底部半径（宽）
  800,  // 高度
  24, 1, true
);
const shaftMat = new THREE.MeshBasicMaterial({
  color: 0x90c8f0, transparent: true, opacity: 0.038,
  side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
});
const shaft = new THREE.Mesh(shaftGeo, shaftMat);
shaft.position.set(0, 220, 0);  // x=0 居中
scene.add(shaft);

// 外层更宽的柔和晕散
const shaft2Geo = new THREE.CylinderGeometry(
  30,   // 顶部
  220,  // 底部
  600, 16, 1, true
);
const shaft2Mat = new THREE.MeshBasicMaterial({
  color: 0x5090cc, transparent: true, opacity: 0.014,
  side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
});
const shaft2 = new THREE.Mesh(shaft2Geo, shaft2Mat);
shaft2.position.set(0, 180, 0);  // x=0 居中
scene.add(shaft2);


        // ── Caustic mote particles — drift upward continuously ──
        const pCount = 420;
        const pPos = new Float32Array(pCount * 3);
        const pSpeeds = new Float32Array(pCount);
        for (let i = 0; i < pCount; i++) {
          pPos[i*3]   = (Math.random()-0.5)*600;
          pPos[i*3+1] = (Math.random()-0.5)*500;
          pPos[i*3+2] = (Math.random()-0.5)*300 - 50;
          pSpeeds[i]  = 0.008 + Math.random()*0.018;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
        const pMat = new THREE.PointsMaterial({
          color: 0x5ab4e0, size: 1.1, transparent: true, opacity: 0.22,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        scene.add(new THREE.Points(pGeo, pMat));

        // ── Deep background haze planes for atmospheric depth ──
        [0.006, 0.004, 0.002].forEach((op, i) => {
          const pg = new THREE.PlaneGeometry(4000, 4000);
          const pm = new THREE.MeshBasicMaterial({ color: 0x001830, transparent: true, opacity: op, depthWrite: false });
          const p = new THREE.Mesh(pg, pm);
          p.position.z = -300 - i * 150;
          scene.add(p);
        });

        // ── Load GLB whale ──
        let mixer = null;
        let whaleRoot = null;

        // swimProxy wraps the whale so we can move it in world space
        // without interfering with the GLB's internal bone hierarchy
        const swimProxy = new THREE.Group();
        scene.add(swimProxy);

        const loader = new THREE.GLTFLoader();
        loader.load(
          '/whalemodel/whale.glb',
          (gltf) => {
            whaleRoot = gltf.scene;

            // Auto-scale
            const box = new THREE.Box3().setFromObject(whaleRoot);
            const sz = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(sz.x, sz.y, sz.z);
            whaleRoot.scale.setScalar(280 / maxDim);

            // Center pivot inside swimProxy
            const box2 = new THREE.Box3().setFromObject(whaleRoot);
            const ctr = box2.getCenter(new THREE.Vector3());
            whaleRoot.position.sub(ctr);

            // Material polish — keep PBR textures, tweak roughness/metalness
            whaleRoot.traverse((node) => {
              if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = false;
                const mats = Array.isArray(node.material) ? node.material : [node.material];
                mats.forEach(mat => {
                  mat.metalness    = Math.min(mat.metalness ?? 0, 0.12);
                  mat.roughness    = Math.max(mat.roughness ?? 0.6, 0.55);
                  mat.envMapIntensity = 0.4;
                  if (mat.map)       mat.map.encoding       = THREE.sRGBEncoding;
                  if (mat.normalMap) mat.normalMap.encoding  = THREE.LinearEncoding;
                  mat.needsUpdate = true;
                });
              }
            });

            swimProxy.add(whaleRoot);

            // ── AnimationMixer: play ALL Blender clips as-is ──
            if (gltf.animations && gltf.animations.length > 0) {
              mixer = new THREE.AnimationMixer(whaleRoot);
              gltf.animations.forEach(clip => {
                const action = mixer.clipAction(clip);
                action.setLoop(THREE.LoopRepeat, Infinity);
                action.play();
              });
            }
          },
          undefined,
          (err) => {
            console.warn('whale.glb not loaded, using fallback.', err);
            const fallback = buildFallbackWhale(THREE);
            swimProxy.add(fallback);
            whaleRoot = fallback;
          }
        );

        // ── Animation clock ──
        const clock = new THREE.Clock();
        let t = 0;

        const animate = () => {
          animId = requestAnimationFrame(animate);
          const delta = clock.getDelta();
          t += delta;

          // Tick Blender AnimationMixer — drives all GLB bone animations
          if (mixer) mixer.update(delta);

          // World-space swim path — moves the swimProxy only.
          // Does NOT touch internal bones or rotations of whaleRoot.
          const swimPeriod = 22; // seconds for one full sinusoidal sweep
          const angle = (t % swimPeriod) / swimPeriod * Math.PI * 2;
          swimProxy.position.x = Math.sin(angle) * 170;
          swimProxy.position.y = Math.sin(t * 0.28) * 22 - 15;
          swimProxy.position.z = Math.cos(angle * 0.5) * 28;

          // Face direction of travel (tangent of swim path)
          const dx = Math.cos(angle);
          const dz = -Math.sin(angle * 0.5) * 0.16;
          swimProxy.rotation.y = Math.atan2(-dz, dx) + Math.PI / 2;

          // Particle drift
          const positions = pGeo.attributes.position.array;
          for (let i = 0; i < pCount; i++) {
            positions[i*3+1] += pSpeeds[i];
            if (positions[i*3+1] > 260) positions[i*3+1] = -240;
          }
          pGeo.attributes.position.needsUpdate = true;

          // Shaft sway
          shaft.rotation.z  = Math.sin(t * 0.18) * 0.02;
          shaft2.rotation.z = Math.sin(t * 0.14) * 0.015;

          // Caustic light flicker — simulates water surface movement
          causticLight.intensity  = 2.2 + Math.sin(t*3.1)*0.4 + Math.sin(t*5.7)*0.2;
          causticLight.position.x = -80 + Math.sin(t*0.6)*40;
          causticLight.position.z = 250 + Math.cos(t*0.4)*30;

          renderer.render(scene, camera);
        };
        animate();

        // Resize
        const onResize = () => {
          const nW = el.clientWidth, nH = el.clientHeight;
          camera.aspect = nW / nH;
          camera.updateProjectionMatrix();
          renderer.setSize(nW, nH);
        };
        window.addEventListener('resize', onResize);

        el._cleanup = () => {
          cancelAnimationFrame(animId);
          window.removeEventListener('resize', onResize);
          if (mixer) mixer.stopAllAction();
          renderer.dispose();
          renderer.domElement.parentNode?.removeChild(renderer.domElement);
        };

      } catch (e) {
        console.error('OceanScene error:', e);
      }
    };

    init();
    return () => { if (el._cleanup) el._cleanup(); };
  }, []);

  return <div ref={mountRef} style={{ position:'fixed', inset:0, zIndex:0, width:'100vw', height:'100vh', overflow:'hidden' }} />;
}

// ── Procedural fallback whale ─────────────────────────────────────────────────
function buildFallbackWhale(THREE) {
  const group = new THREE.Group();
  const mat     = new THREE.MeshStandardMaterial({ color:0x1a3050, roughness:0.62, metalness:0.10 });
  const darkMat = new THREE.MeshStandardMaterial({ color:0x0e1f33, roughness:0.75, metalness:0.05 });

  const bodyG = new THREE.SphereGeometry(1, 32, 18);
  bodyG.scale(3.0, 0.92, 1.05);
  group.add(new THREE.Mesh(bodyG, mat));

  const headG = new THREE.SphereGeometry(0.78, 20, 14);
  const head  = new THREE.Mesh(headG, mat);
  head.position.set(2.6, 0.08, 0); head.scale.set(1.05, 0.98, 1.0);
  group.add(head);

  const tailG = new THREE.CylinderGeometry(0.18, 0.42, 1.8, 10);
  tailG.rotateZ(Math.PI/2);
  const tail  = new THREE.Mesh(tailG, darkMat);
  tail.position.set(-3.1, 0, 0); group.add(tail);

  [-1,1].forEach(s => {
    const fG = new THREE.CylinderGeometry(0.04,0.04,1.1,6);
    fG.rotateX(Math.PI/2);
    const f = new THREE.Mesh(fG, darkMat);
    f.position.set(-3.7,0,s*0.55); f.rotation.z=s*0.22; group.add(f);
  });

  const dorG = new THREE.ConeGeometry(0.18, 0.85, 6);
  const dor  = new THREE.Mesh(dorG, darkMat);
  dor.position.set(-0.5, 1.02, 0); dor.rotation.z=0.15; group.add(dor);

  [-1,1].forEach(s => {
    const fG = new THREE.CylinderGeometry(0.06,0.03,1.5,6);
    const f  = new THREE.Mesh(fG, darkMat);
    f.position.set(1.2,-0.35,s*0.9); f.rotation.x=s*0.55; f.rotation.z=-0.38; group.add(f);
  });

  group.scale.setScalar(120);
  return group;
}

// ─── Wet paper note ───────────────────────────────────────────────────────────
function WetPaperNote({ text, visible, crossInsight }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !text) return;
    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.min(canvas.offsetWidth || 420, 420);
    const cssH = Math.max(200, Math.ceil(text.length / 26) * 23 + 90);
    canvas.style.height = cssH + 'px';
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = cssW, H = cssH, pad = 22;

    const drawContent = (img) => {
      ctx.clearRect(0, 0, W, H);

      // ── Build paper clip path ──
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pad + 7, pad);
      ctx.bezierCurveTo(W*0.3, pad-2, W*0.68, pad+2, W-pad-3, pad+2);
      ctx.bezierCurveTo(W-pad+1, H*0.38, W-pad-2, H*0.7, W-pad, H-pad-3);
      ctx.bezierCurveTo(W*0.65, H-pad+2, W*0.3, H-pad-1, pad+2, H-pad+1);
      ctx.bezierCurveTo(pad-1, H*0.65, pad+2, H*0.34, pad+7, pad);
      ctx.closePath();

      // Drop shadow (fires before clip)
      ctx.shadowColor = 'rgba(0,10,40,0.55)';
      ctx.shadowBlur  = 36;
      ctx.shadowOffsetY = 16;
      ctx.fillStyle = 'rgba(248,244,232,0.01)';
      ctx.fill();
      ctx.shadowColor = 'transparent';

      // Clip to shape
      ctx.clip();

      // Texture or fallback
      if (img) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(img, 0, 0, W, H);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = 'rgba(248,244,232,0.88)';
        ctx.fillRect(0, 0, W, H);
      }

      // Edge vignette
      const vignette = ctx.createRadialGradient(
        W/2, H/2, Math.min(W,H)*0.15,
        W/2, H/2, Math.min(W,H)*0.78
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.13)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      ctx.restore(); // ← releases clip

      // ── Ruled lines (drawn after restore, on top of texture) ──
      ctx.strokeStyle = 'rgba(90,70,40,0.05)';
      ctx.lineWidth   = 0.6;
      for (let i = 0; i < 9; i++) {
        const y = pad + 16 + (H - pad*2 - 16) * (i / 8);
        ctx.beginPath();
        ctx.moveTo(pad, y + Math.sin(i*2.1)*1.8);
        ctx.bezierCurveTo(
          W*0.28, y + Math.sin(i*1.7)*3,
          W*0.65, y + Math.sin(i*2.8)*2.5,
          W-pad,  y + Math.sin(i*1.3)*1.8
        );
        ctx.stroke();
      }

      // ── Text ──
      ctx.font         = 'italic 14px "Georgia","Palatino Linotype",serif';
      ctx.fillStyle    = 'rgba(25,16,6,0.80)';
      ctx.textBaseline = 'top';
      const lineH = 23, tx = pad + 30, maxW = W - (pad + 30) * 2;
      wrapCJK(ctx, text, maxW).forEach((line, i) => {
        ctx.save();
        ctx.translate(0, Math.sin(i*1.9 + 0.4) * 0.45);
        ctx.fillText(line, tx, pad + 32 + i * lineH);
        ctx.restore();
      });
    };

    // Load texture; fallback if missing
    const img = new Image();
    img.onload  = () => drawContent(img);
    img.onerror = () => drawContent(null);
    img.src = '/textures/paper.png';
  }, [text, visible]);

  return (
    <div style={{
      width: '100%',
      maxWidth: 420,
      position: 'relative',
      opacity: visible ? 1 : 0,
      transform: visible
        ? 'translateY(0) rotate(-0.5deg)'
        : 'translateY(36px) rotate(-2.8deg)',
      transition: 'opacity 1.3s ease, transform 1.3s cubic-bezier(0.22,1,0.36,1)',
      filter: 'drop-shadow(0 22px 44px rgba(0,10,40,0.65))',
    }}>
      <canvas ref={canvasRef} style={{ width:'100%', display:'block' }} />
      {crossInsight && (
        <div style={{
          marginTop: 14,
          background: 'rgba(150,220,255,0.06)',
          backdropFilter: 'blur(14px)',
          border: '0.5px solid rgba(140,210,255,0.18)',
          borderRadius: 18,
          padding: '13px 20px',
          color: 'rgba(170,220,255,0.68)',
          fontFamily: '"Georgia",serif',
          fontStyle: 'italic',
          fontSize: 12.5,
          lineHeight: 1.8,
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}>
          ✦ {crossInsight}
        </div>
      )}
    </div>
  );
}

function wrapCJK(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(line); line = ''; continue; }
    const t = line + ch;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line); line = ch;
    } else {
      line = t;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ─── BubbleQuestion — layered glass + continuous float ───────────────────────
function BubbleQuestion({ question, visible, delay, answer, onAnswer, children }) {
  const floatRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    let raf, start = null;
    const tick = (ts) => {
      if (!start) start = ts;
      const y = Math.sin(((ts-start)/1000)*1.15 + delay*0.002) * 3.2;
      if (floatRef.current) floatRef.current.style.setProperty('--fy', `${y}px`);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, delay]);

  return (
    <div ref={floatRef} style={{
      opacity: visible?1:0,
      transform: visible?'translateY(var(--fy,0px)) scale(1)':'translateY(32px) scale(0.92)',
      transition:`opacity 0.7s ${delay}ms ease,transform 0.7s ${delay}ms cubic-bezier(0.34,1.28,0.64,1)`,
      display:'flex', flexDirection:'column', gap:10,
      pointerEvents:visible?'auto':'none',
      willChange:'transform',
    }}>
      {/* Glass bubble */}
      <div style={{
        position:'relative',
        background:'linear-gradient(140deg,rgba(255,255,255,0.10) 0%,rgba(80,160,255,0.05) 100%)',
        backdropFilter:'blur(26px)', WebkitBackdropFilter:'blur(26px)',
        border:'0.5px solid rgba(160,210,255,0.2)',
        borderTop:'0.5px solid rgba(255,255,255,0.24)',
        borderRadius:'22px 22px 22px 6px',
        padding:'17px 22px',
        fontFamily:'"Georgia","Palatino Linotype",serif',
        color:'rgba(215,235,255,0.92)', fontSize:14, lineHeight:1.72, letterSpacing:'0.025em',
        boxShadow:[
          'inset 0 1.5px 0 rgba(255,255,255,0.14)',
          'inset 0 -1px 0 rgba(0,0,0,0.1)',
          '0 10px 36px rgba(0,10,50,0.38)',
          '0 2px 8px rgba(0,0,0,0.22)',
        ].join(','),
      }}>
        {/* Iridescent specular highlight */}
        <div style={{
          position:'absolute', top:8, left:14, width:64, height:20,
          background:'radial-gradient(ellipse,rgba(255,255,255,0.2) 0%,transparent 80%)',
          borderRadius:14, pointerEvents:'none',
        }} />
        {question}
      </div>

      {answer===null && (
        <div style={{ display:'flex', gap:10, paddingLeft:8 }}>
          {['Yes','Skip'].map(opt=>(
            <BubbleBtn key={opt} label={opt} gold={opt==='Yes'} onClick={()=>onAnswer(opt==='Yes')} />
          ))}
        </div>
      )}
      {answer===true && (
        <div style={{ animation:'zhiyinSlideIn 0.45s cubic-bezier(0.34,1.2,0.64,1)' }}>
          {children}
        </div>
      )}
      {answer===false && (
        <div style={{ paddingLeft:10, color:'rgba(120,160,220,0.36)', fontFamily:'"Georgia",serif', fontStyle:'italic', fontSize:12, animation:'zhiyinFadeUp 0.4s ease' }}>
          Noted.
        </div>
      )}
    </div>
  );
}

function BubbleBtn({ label, gold, onClick }) {
  const [hov,setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{
      background: gold
        ? hov?'rgba(200,170,80,0.28)':'rgba(200,170,80,0.13)'
        : hov?'rgba(180,220,255,0.12)':'rgba(255,255,255,0.05)',
      border: gold
        ? `0.5px solid ${hov?'rgba(220,190,100,0.65)':'rgba(200,170,80,0.32)'}`
        : `0.5px solid ${hov?'rgba(160,210,255,0.32)':'rgba(255,255,255,0.12)'}`,
      borderRadius:50, padding:'8px 24px',
      color: gold
        ? hov?'rgba(240,210,130,1)':'rgba(225,195,115,0.88)'
        : hov?'rgba(190,220,255,0.72)':'rgba(150,180,220,0.52)',
      fontFamily:'"Georgia",serif', fontSize:13, cursor:'pointer',
      letterSpacing:'0.06em', transition:'all 0.2s ease',
      backdropFilter:'blur(12px)',
      boxShadow: hov&&gold?'0 4px 18px rgba(200,150,0,0.22)':'none',
    }}>{label}</button>
  );
}

function WaveInput({ placeholder, value, onChange }) {
  const [f,setF] = useState(false);
  return (
    <div style={{
      background:f?'rgba(100,180,255,0.08)':'rgba(255,255,255,0.04)',
      border:`0.5px solid ${f?'rgba(130,200,255,0.35)':'rgba(255,255,255,0.09)'}`,
      borderBottom:`1.5px solid ${f?'rgba(130,200,255,0.55)':'rgba(90,170,255,0.18)'}`,
      borderRadius:'14px 14px 4px 4px', padding:'11px 16px',
      transition:'all 0.22s', backdropFilter:'blur(12px)',
    }}>
      <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{ width:'100%', background:'none', border:'none', outline:'none', color:'rgba(205,228,255,0.88)', fontFamily:'"Georgia",serif', fontStyle:'italic', fontSize:13.5 }}
      />
    </div>
  );
}

// ─── Synthesis animation ──────────────────────────────────────────────────────
function SynthesisAnimation({ active, onDone, synthText }) {
  const st = useRef({ phase:0, pt:0, tt:0 });
  const rafRef = useRef(null);
  const canvasRef = useRef(null);
  const [show,setShow] = useState(false);
  const [textVis,setTextVis] = useState(false);
  const [flashOp,setFlashOp] = useState(0);

  useEffect(()=>{
    if(!active){st.current={phase:0,pt:0,tt:0};setShow(false);setTextVis(false);setFlashOp(0);return;}
    setShow(true);
    const s=st.current;
    const T = [
  setTimeout(()=>{s.phase=1;s.pt=0;},  280),
  setTimeout(()=>{s.phase=2;s.pt=0;},  3500),
  setTimeout(()=>{s.phase=3;s.pt=0;},  6500),
  setTimeout(()=>{s.phase=4;s.pt=0;},  7000),   // shimmering 开始
  setTimeout(()=>setTextVis(true),      7600),   // 文字出现
  setTimeout(()=>{s.phase=5;s.pt=0;},  19999),  // shimmering 开始消退
  setTimeout(()=>{setShow(false);setTextVis(false);setFlashOp(0);}, 20000),  // 动画完全消失
  setTimeout(()=>{onDone?.();},         21000),  // 跳回首页
];
    return()=>T.forEach(clearTimeout);
  },[active]);

  useEffect(()=>{
    if(!show){cancelAnimationFrame(rafRef.current);return;}
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const s=st.current;
    const bubDefs=[
      {hue:40,label:'📚',baseAngle:-Math.PI/2},
      {hue:8,label:'🎵',baseAngle:-Math.PI/2+(2*Math.PI/3)},
      {hue:160,label:'🎞️',baseAngle:-Math.PI/2+(4*Math.PI/3)},
    ];
 
    const draw=()=>{
      const W=canvas.width=canvas.offsetWidth||window.innerWidth;
      const H=canvas.height=canvas.offsetHeight||window.innerHeight;
      ctx.clearRect(0,0,W,H); s.pt+=0.016; s.tt+=0.016;
      const cx=W/2,cy=H/2;

      if(s.phase<=3){
        let converge=0,orbitSpeed=0,sz=44;
        if(s.phase===0){converge=0;orbitSpeed=0;}
        else if(s.phase===1){const p=Math.min(1,s.pt*0.28);converge=p*0.08;orbitSpeed=0.18+p*0.14;}
        else if(s.phase===2){const p=Math.min(1,s.pt*0.35);converge=0.08+p*0.88;orbitSpeed=0.32+p*0.9;sz=44*(1-p*0.55);}
        else{const p=Math.min(1,s.pt*1.8);converge=1;sz=44*0.45*(1-p);}
        const orbitR=Math.min(W,H)*0.3*(1-converge*0.96);
        const spin=s.tt*orbitSpeed;
        bubDefs.forEach(b => {
          const a = b.baseAngle + spin;
          const bx = cx + Math.cos(a) * orbitR;
          const by = cy + Math.sin(a) * orbitR * 0.7;
          if (sz < 1) return;
            // Outer glow — muted
          const gl = ctx.createRadialGradient(bx,by,0,bx,by,sz*2.0);
          gl.addColorStop(0, `hsla(${b.hue},38%,58%,0.18)`);
          gl.addColorStop(1, `hsla(${b.hue},38%,58%,0)`);
          

  // Body — desaturated, semi-transparent
          const bg = ctx.createRadialGradient(bx-sz*0.28,by-sz*0.25,sz*0.04,bx,by,sz);
          bg.addColorStop(0, `hsla(${b.hue},30%,78%,0.52)`);
          bg.addColorStop(0.55,`hsla(${b.hue},25%,65%,0.32)`);
          bg.addColorStop(1,   `hsla(${b.hue},20%,55%,0.04)`);
          ctx.fillStyle = bg;
          ctx.beginPath(); ctx.arc(bx,by,sz,0,Math.PI*2); ctx.fill();

  // NO rim stroke — removed
  // Small specular only
          ctx.fillStyle = 'rgba(255,255,255,0.30)';
          ctx.beginPath(); ctx.arc(bx-sz*0.28,by-sz*0.25,sz*0.16,0,Math.PI*2); ctx.fill();

          ctx.font = `${sz*0.54}px serif`;
          ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillText(b.label, bx, by+sz*0.04);
    });

        if(s.phase===3){
          const p=Math.min(1,s.pt*2);
          const mg=ctx.createRadialGradient(cx,cy,0,cx,cy,90*p);
          mg.addColorStop(0,`rgba(255,245,190,${p})`);mg.addColorStop(0.4,`rgba(255,215,100,${p*0.65})`);mg.addColorStop(1,'rgba(255,200,80,0)');
          ctx.fillStyle=mg;ctx.beginPath();ctx.arc(cx,cy,90*p,0,Math.PI*2);ctx.fill();
        }
     
       } else if (s.phase === 4) {
  const p = Math.min(1, s.pt * 0.55);  // 更慢展开
  const r = p * Math.sqrt(W*W+H*H) * 3.4;

  // Soft white-gold wash — no hard rays
  const flash = ctx.createRadialGradient(cx,cy,0,cx,cy,r);
  flash.addColorStop(0,    'rgba(255,252,230,0.38)');
  flash.addColorStop(0.25, 'rgba(245,238,200,0.22)');
  flash.addColorStop(0.6,  'rgba(230,218,170,0.10)');
  flash.addColorStop(1,    'rgba(210,195,140,0)');
  ctx.fillStyle = flash;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();


  setFlashOp(p * 0.18);  // 原 0.62，大幅降低叠加层透明度

} else if (s.phase === 5) {
  const fo = Math.max(0, 1 - s.pt * 0.7);  // 更缓慢消失
  ctx.globalAlpha = fo * 0.5;               // 整体更轻
  const ff = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*1.5);
  ff.addColorStop(0,'rgba(255,248,218,0.30)');
  ff.addColorStop(0.5,'rgba(240,228,185,0.12)');
  ff.addColorStop(1,'rgba(220,205,155,0)');
  ctx.fillStyle=ff; ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=1;
  setFlashOp(fo * 0.14);
}

      rafRef.current=requestAnimationFrame(draw);
    };
    rafRef.current=requestAnimationFrame(draw);
    return()=>cancelAnimationFrame(rafRef.current);
  },[show]);

  if(!show)return null;
  return (
    <>
      <div style={{ position:'fixed',inset:0,zIndex:700,background:'rgb(255, 253, 245)',opacity:flashOp,pointerEvents:'none',transition:'opacity 0.08s linear' }} />
      <div style={{ position:'fixed',inset:0,zIndex:650,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center' }}>
        <canvas ref={canvasRef} style={{ position:'absolute',inset:0,width:'100%',height:'100%' }} />
        {textVis&&synthText&&(
          <div style={{
            position:'relative',zIndex:10,maxWidth:360,textAlign:'center',
            color:'rgba(35,20,4,0.92)',fontFamily:'"Georgia",serif',fontStyle:'italic',
            fontSize:15.5,lineHeight:1.85,letterSpacing:'0.04em',
            padding:'20px 30px',background:'rgba(255,248,210,0.90)',
            border:'0.5px solid rgba(200,170,60,0.38)',borderRadius:26,
            boxShadow:'0 10px 40px rgba(180,130,0,0.22),inset 0 1px 0 rgba(255,255,255,0.5)',
            backdropFilter:'blur(24px)',animation:'zhiyinFadeUp 0.95s ease',
          }}>
            {synthText}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Loading indicator ────────────────────────────────────────────────────────
function LoadingIndicator() {
  return (
    <div style={{ height:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:28 }}>
      <div style={{ position:'relative',width:56,height:56 }}>
        <div style={{ position:'absolute',inset:0,borderRadius:'50%',border:'1.5px solid rgba(100,180,255,0.12)',borderTopColor:'rgba(100,180,255,0.65)',animation:'zhiyinSpin 1.8s linear infinite' }} />
        <div style={{ position:'absolute',inset:10,borderRadius:'50%',border:'1px solid rgba(180,230,255,0.08)',borderBottomColor:'rgba(180,230,255,0.4)',animation:'zhiyinSpin 2.8s linear infinite reverse' }} />
        <div style={{ position:'absolute',inset:20,borderRadius:'50%',background:'rgba(80,160,255,0.10)',animation:'zhiyinPulse 2.5s ease infinite' }} />
      </div>
      <div style={{ color:'rgba(130,190,240,0.42)',fontFamily:'"Georgia",serif',fontStyle:'italic',fontSize:13,letterSpacing:'0.12em',animation:'zhiyinPulse 3s ease infinite' }}>
        Tracing your reading journey…
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ZhiyinPage() {
  const navigate = useNavigate();
  const journalCache = loadJournalCache();

  const [phase,setPhase]               = useState(PHASE.LOADING);
  const [journalText,setJournalText]   = useState('');
  const [crossInsight,setCrossInsight] = useState(null);
  const [paperVisible,setPaperVisible] = useState(false);
  const [synthText,setSynthText]       = useState('');
  const [qBooks,setQBooks]             = useState(null);
  const [qMusic,setQMusic]             = useState(null);
  const [qFilm,setQFilm]               = useState(null);
  const [extraBooks,setExtraBooks]     = useState('');
  const [extraMusic,setExtraMusic]     = useState('');
  const [extraFilms,setExtraFilms]     = useState('');
  const [synthesisActive,setSynthesisActive] = useState(false);

  useEffect(()=>{
    if(journalCache&&Date.now()-journalCache.savedAt<30*60*1000){
      setJournalText(journalCache.journal||'');setCrossInsight(journalCache.crossInsight||null);
      setPhase(PHASE.JOURNAL);setTimeout(()=>setPaperVisible(true),200);return;
    }
    getRecentConcepts(30).then(async data=>{
      if(!data||data.totalConcepts===0){
        const fb='Your reading log is still quiet — like a beach after the tide. Start reading and marking passages, and Drifty Diary will trace your thoughts.';
        setJournalText(fb);saveJournalCache({journal:fb,crossInsight:null});
        setPhase(PHASE.JOURNAL);setTimeout(()=>setPaperVisible(true),200);return;
      }
      try{
        const resp=await fetch('/api/ai/digest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({concepts:data,extraBooks:[],extraMusic:[],extraFilms:[]})});
        if(!resp.ok)throw new Error('digest failed');
        const r=await resp.json();
        setJournalText(r.journal||'');setCrossInsight(r.crossInsight||null);
        saveJournalCache({journal:r.journal||'',crossInsight:r.crossInsight||null});
      }catch{
        const fb=`Over the past month, you left ${data.books?.length||0} books worth of thought traces — ${data.totalConcepts} impressions in total. The passages you marked are like shells on the seafloor, waiting to be rediscovered.`;
        setJournalText(fb);saveJournalCache({journal:fb,crossInsight:null});
      }
      setPhase(PHASE.JOURNAL);setTimeout(()=>setPaperVisible(true),220);
    }).catch(()=>{
      setJournalText('The waves took your reading records for now. Please try again later.');
      setPhase(PHASE.JOURNAL);setTimeout(()=>setPaperVisible(true),220);
    });
  },[]);

  const handleProceedToQuestionnaire=useCallback(()=>{
    setPaperVisible(false);setTimeout(()=>setPhase(PHASE.QUESTIONNAIRE),580);
  },[]);

  useEffect(()=>{
    const booksOk = qBooks === false || (qBooks === true && extraBooks.trim() !== '');
    const musicOk = qMusic === false || (qMusic === true && extraMusic.trim() !== '');
    const filmOk  = qFilm  === false || (qFilm  === true && extraFilms.trim() !== '');
    if(booksOk && musicOk && filmOk && qBooks!==null && qMusic!==null && qFilm!==null && phase===PHASE.QUESTIONNAIRE){
      const tmr=setTimeout(()=>{
        const parts=[];
        if(extraBooks)parts.push(`《${extraBooks}》`);
        if(extraMusic)parts.push(extraMusic);
        if(extraFilms)parts.push(extraFilms);
       const endings = [
        'Your reading traces have drifted into the deep, waiting for the next echo.',
        'The pages you turned are quietly glowing at the bottom of the sea.',
        'Every drift finds a shore. Every thought finds its place.',
        '每一次阅读，都Yes向自己内部的一次潜水。',
        'Pages, melodies, and images drift silently into the heart, becoming ripples, waiting for the next tide.',
        'Your words, sounds, and images slowly sink into memory — like a shipwreck on the ocean floor, waiting quietly for an echo.',
        'The traces of reading, the melodies in your ears, the images before your eyes — all drifting slowly into the deep, becoming whispers in the current.',
        'Books, music, and images — like driftwood settling on the seafloor, quietly still, yet waiting for the next surge.',
        'Words, melodies, and images quietly merge into the deep sea of memory — floating like faint light, waiting for the next touch.'
];

const randomEnding = endings[Math.floor(Math.random() * endings.length)];

setSynthText(endings[Math.floor(Math.random() * endings.length)]);
        // 累积存储每只蝴蝶，不覆盖历史
        const prevButterflies = (() => {
          try { return JSON.parse(localStorage.getItem('zhiyin_butterflies_v1') || '[]'); } catch { return []; }
        })();
        const newEntries = [];
        if (extraMusic) newEntries.push({ label: extraMusic, type: 'music', savedAt: Date.now() });
        if (extraFilms) newEntries.push({ label: extraFilms, type: 'film', savedAt: Date.now() });
        if (extraBooks) newEntries.push({ label: extraBooks, type: 'book', savedAt: Date.now() });
        localStorage.setItem('zhiyin_butterflies_v1', JSON.stringify([...prevButterflies, ...newEntries]));

        // ── 把含问卷答案的完整记录异步存入后端 DB ──────────────────────────
        // 先取当次 concepts，再带着问卷答案重新调 digest（不 await，不影响 UI）
        getRecentConcepts(30).then(concepts => {
          if (!concepts || concepts.totalConcepts === 0) return;
          fetch('/api/ai/digest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              concepts,
              extraBooks: extraBooks ? [extraBooks] : [],
              extraMusic: extraMusic ? [extraMusic] : [],
              extraFilms: extraFilms ? [extraFilms] : [],
            }),
          }).catch(() => {}); // 静默失败，不打扰用户
        }).catch(() => {});

        setPhase(PHASE.SYNTHESIS);setSynthesisActive(true);
      },900);
      return()=>clearTimeout(tmr);
    }
  },[qBooks,qMusic,qFilm,phase,extraBooks,extraMusic,extraFilms]);

  const handleSynthesisDone=useCallback(()=>{
    setSynthesisActive(false);setPhase(PHASE.IDLE);navigate('/');
  },[navigate]);

  const q1Vis=phase===PHASE.QUESTIONNAIRE||phase===PHASE.SYNTHESIS;
  const q2Vis=q1Vis&&qBooks!==null;
  const q3Vis=q2Vis&&qMusic!==null;

  return (
    <div style={{ width:'100vw',minHeight:'100vh',background:'#00111f',overflowX:'hidden',position:'relative' }}>
      <style>{`
        @keyframes zhiyinSpin    { to { transform: rotate(360deg); } }
        @keyframes zhiyinPulse   { 0%,100%{opacity:0.35;} 50%{opacity:1;} }
        @keyframes zhiyinFadeUp  { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
        @keyframes zhiyinDrift   { from{opacity:0;transform:translateY(40px) scale(0.95);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes zhiyinSlideIn { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
        * { box-sizing:border-box; }
        input::placeholder { color: rgba(120,170,230,0.26); }
      `}</style>

      <OceanScene />

      {/* Back button */}
      <button onClick={()=>navigate('/')} style={{
        position:'fixed',top:22,left:22,zIndex:300,
        background:'rgba(0,10,30,0.52)',backdropFilter:'blur(18px)',
        border:'0.5px solid rgba(130,200,255,0.18)',borderRadius:14,
        padding:'8px 20px',color:'rgba(150,210,255,0.62)',
        fontFamily:'"Georgia",serif',fontSize:13,cursor:'pointer',
        letterSpacing:'0.04em',transition:'all 0.22s',
      }}
        onMouseEnter={e=>{e.currentTarget.style.background='rgba(0,20,60,0.72)';e.currentTarget.style.color='rgba(200,230,255,0.9)';}}
        onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,10,30,0.52)';e.currentTarget.style.color='rgba(150,210,255,0.62)';}}
      >← Back</button>

      {/* Title */}
      <div style={{ position:'fixed',top:27,left:'50%',transform:'translateX(-50%)',zIndex:300,pointerEvents:'none',whiteSpace:'nowrap' }}>
        <span style={{ fontFamily:'"Georgia",serif',fontSize:12,letterSpacing:'0.26em',color:'rgba(130,190,255,0.26)',textTransform:'uppercase' }}>Drifty Diary</span>
      </div>

      {phase===PHASE.LOADING && <div style={{ position:'relative',zIndex:10 }}><LoadingIndicator /></div>}

      {phase===PHASE.JOURNAL && (
        <div style={{ position:'relative',zIndex:10,minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 24px 60px',animation:'zhiyinDrift 0.95s ease' }}>
          {journalText&&<WetPaperNote text={journalText} visible={paperVisible} crossInsight={crossInsight} />}
          <button onClick={handleProceedToQuestionnaire} style={{
            marginTop:34,opacity:paperVisible?1:0,
            transform:paperVisible?'translateY(0)':'translateY(20px)',
            transition:'opacity 0.9s 1.6s ease,transform 0.9s 1.6s ease,background 0.22s,border-color 0.22s',
            background:'rgba(0,15,40,0.55)',border:'0.5px solid rgba(130,200,255,0.28)',
            borderRadius:50,padding:'13px 38px',backdropFilter:'blur(18px)',
            color:'rgba(175,220,255,0.75)',fontFamily:'"Georgia",serif',
            fontStyle:'italic',fontSize:14,cursor:'pointer',
            letterSpacing:'0.06em',boxShadow:'0 4px 24px rgba(0,50,160,0.18)',
          }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(10,50,160,0.22)';e.currentTarget.style.borderColor='rgba(150,220,255,0.52)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(0,15,40,0.55)';e.currentTarget.style.borderColor='rgba(130,200,255,0.28)';}}
          >Tell me what else you've been experiencing →</button>
        </div>
      )}

      {(phase===PHASE.QUESTIONNAIRE||phase===PHASE.SYNTHESIS)&&(
        <div style={{ position:'relative',zIndex:10,minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'100px 24px 80px' }}>
          <div style={{ width:'100%',maxWidth:390,display:'flex',flexDirection:'column',gap:24 }}>
            <div style={{ textAlign:'center',color:'rgba(130,190,255,0.22)',fontFamily:'"Georgia",serif',fontStyle:'italic',fontSize:11,letterSpacing:'0.14em',marginBottom:2,animation:'zhiyinFadeUp 0.8s ease' }}>Drifting Objects</div>
            <BubbleQuestion question="Any books you read recently but didn't upload?" visible={q1Vis} delay={0} answer={qBooks} onAnswer={setQBooks}>
              <WaveInput placeholder="Title, author, or just a note…" value={extraBooks} onChange={setExtraBooks} />
            </BubbleQuestion>
            <BubbleQuestion question="Any music that's been on repeat in your mind?" visible={q2Vis} delay={110} answer={qMusic} onAnswer={setQMusic}>
              <WaveInput placeholder="Artist, album, or a song name…" value={extraMusic} onChange={setExtraMusic} />
            </BubbleQuestion>
            <BubbleQuestion question="Any films or shows that stayed with you lately?" visible={q3Vis} delay={130} answer={qFilm} onAnswer={setQFilm}>
              <WaveInput placeholder="Title, director, or a quick impression…" value={extraFilms} onChange={setExtraFilms} />
            </BubbleQuestion>
          </div>
        </div>
      )}

      <SynthesisAnimation active={synthesisActive} onDone={handleSynthesisDone} synthText={synthText} />
    </div>
  );
}
