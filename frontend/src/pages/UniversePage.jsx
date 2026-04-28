import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { getConceptsByBook } from '../services/api';

const SkeletonUtils = {
  clone(source) {
    const clone = source.clone();
    const srcBones = [], clnBones = [];
    source.traverse(n => { if (n.isBone) srcBones.push(n); });
    clone.traverse(n => { if (n.isBone) clnBones.push(n); });
    clone.traverse(n => {
      if (!n.isSkinnedMesh) return;
      const newBones = n.skeleton.bones.map(b => {
        const i = srcBones.indexOf(b);
        return i !== -1 ? clnBones[i] : b;
      });
      n.bind(new THREE.Skeleton(newBones, n.skeleton.boneInverses), n.matrixWorld);
    });
    return clone;
  }
};

// ─── Static insight pool ─────────────────────────────────────────────────────
const INSIGHT_TEMPLATES = [
  (x,y)=>`You paused at the same hesitation in ${x} and ${y}.`,
  (x,y)=>`In ${x} and ${y}, your mind lingered on the same question.`,
  (x,y)=>`Both ${x} and ${y} stirred the same doubt within you.`,
  (x,y)=>`You felt the same sudden clarity while reading ${x} and ${y}.`,
  (x,y)=>`Both ${x} and ${y} left your attention suspended at the same moment.`,
  (x,y)=>`You traced the same flicker of understanding across ${x} and ${y}.`,
  (x,y)=>`In ${x} and ${y}, your curiosity pulled in the same direction.`,
  (x,y)=>`Both ${x} and ${y} nudged the same fragment of thought awake in you.`,
  (x,y)=>`You traced the same falling leaf in ${x} and ${y}.`,
  (x,y)=>`In ${x} and ${y}, the river bends the same way under light.`,
  (x,y)=>`The shadow of an old tree lingers in both ${x} and ${y}.`,
  (x,y)=>`${x} and ${y} both speak of rain on stone.`,
  (x,y)=>`You noticed the same drifting cloud in ${x} and ${y}.`,
  (x,y)=>`The horizon stretches alike in ${x} and ${y}.`,
  (x,y)=>`${x} and ${y} catch the same trembling of morning light.`,
  (x,y)=>`《${x}》和《${y}》让你的思绪同时微微颤动。`,
  (x,y)=>`你在《${x}》和《${y}》中都感受到了同样的静默。`,
  (x,y)=>`两本书都让你在某个瞬间屏息凝视。`,
  (x,y)=>`你在《${x}》和《${y}》中都抓住了同一丝模糊的念头。`,
  (x,y)=>`《${x}》和《${y}》让你的注意力停在同一个裂缝里。`,
  (x,y)=>`你在两本书中都尝到了同样的心灵回声。`,
  (x,y)=>`思绪在《${x}》和《${y}》中同步漂浮。`,
  (x,y)=>`你在《${x}》和《${y}》中都触及了同一片不可言说的空白。`,
  (x,y)=>`你在《${x}》和《${y}》中都听见了自己的思绪低声起舞。`,
  (x,y)=>`《${x}》和《${y}》让你的灵魂在同一瞬间屏住呼吸。`,
  (x,y)=>`在《${x}》和《${y}》中，你捕捉到了同一个未完成的念头。`,
  (x,y)=>`你的注意力在两本书之间跳动，如同光在裂缝里闪现。`,
  (x,y)=>`《${x}》和《${y}》让你看见了心底的某个影子。`,
  (x,y)=>`你在两本书里都感到同一瞬的微光滑过意识。`,
  (x,y)=>`阅读像水波，你在《${x}》和《${y}》中都触到了同一圈涟漪。`,
  (x,y)=>`你在《${x}》和《${y}》中都捕捉到了意识的悄悄呼吸。`,
  (x,y)=>`书页翻动，心里的某个角落同时亮了一下。`,
  (x,y)=>`你在两本书里都碰到了同一个未命名的惊讶。`,
  (x,y)=>`《${x}》和《${y}》让你的思绪在无声处共振。`,
  (x,y)=>`思绪穿过《${x}》和《${y}》，留下轻微的涟漪。`,
  (x,y)=>`文字从《${x}》飘向《${y}》，你的意识随之微微颤抖。`,
  (x,y)=>`你在《${x}》和《${y}》中都感受到同一瞬间的心底震动。`,
  (x,y)=>`两本书同时敲响你脑海里未被命名的门。`,
  (x,y)=>`你在《${x}》和《${y}》中都感受到同一片瞬息的清醒。`,
];
function pickInsight(titleA, titleB) {
  const t = INSIGHT_TEMPLATES[Math.floor(Math.random() * INSIGHT_TEMPLATES.length)];
  return t(titleA, titleB);
}

// ─── Ambient highlight ring ───────────────────────────────────────────────────
function QuoteCard({ data }) {
  if (!data) return null;
  const cx = data.jellyfishX, cy = data.jellyfishY;
  const R = 130;
  const chars = data.text ? data.text.slice(0, 120) : '';
  const total = chars.length;
  if (total === 0) return null;
  const angleStep = (Math.PI * 2) / Math.max(total, 40);
  return (
    <div style={{
      position: 'fixed', left: cx - R - 40, top: cy - R - 40,
      width: (R + 40) * 2, height: (R + 40) * 2,
      zIndex: 150, pointerEvents: 'none',
      animation: 'ringFadeIn 0.6s ease forwards',
    }}>
      {chars.split('').map((ch, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = R + 40 + Math.cos(angle) * R;
        const y = R + 40 + Math.sin(angle) * R;
        const rot = (angle * 180 / Math.PI) + 90;
        return (
          <span key={i} style={{
            position: 'absolute', left: x, top: y,
            transform: `translate(-50%,-50%) rotate(${rot}deg)`,
            fontSize: 11, fontFamily: '"Georgia", serif', fontStyle: 'italic',
            color: `rgba(230, 200, 120, ${0.55 + 0.35 * Math.sin(i * 0.4)})`,
            textShadow: '0 0 8px rgba(255,200,80,0.6)',
            letterSpacing: '0.02em', userSelect: 'none',
          }}>{ch === ' ' ? '\u00A0' : ch}</span>
        );
      })}
    </div>
  );
}

// ─── Cross-book AI insight bubble ─────────────────────────────────────────────
function InsightBubble({ data }) {
  if (!data) return null;
  return (
    <div style={{
      position: 'fixed', left: data.x, top: data.y,
      transform: 'translate(-50%,-50%)',
      zIndex: 180, pointerEvents: 'none',
      animation: 'insightReveal 5s cubic-bezier(0.16,1,0.3,1) forwards',
    }}>
      <div style={{
        background: 'linear-gradient(135deg,rgba(255,248,230,0.09) 0%,rgba(200,180,140,0.14) 100%)',
        backdropFilter: 'blur(22px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(22px) saturate(1.7)',
        border: '0.5px solid rgba(220,200,160,0.38)',
        borderRadius: 30, padding: '14px 24px',
        color: 'rgba(255,248,220,0.94)', fontFamily: '"Georgia", serif',
        fontStyle: 'italic', fontSize: 13, maxWidth: 260,
        textAlign: 'center', lineHeight: 1.75, letterSpacing: '0.03em',
        boxShadow: '0 0 44px rgba(200,180,100,0.2), inset 0 1px 0 rgba(255,255,255,0.10)',
        textShadow: '0 1px 12px rgba(200,160,80,0.4)',
      }}>
        {data.text}
      </div>
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ data }) {
  if (!data) return null;
  return (
    <div style={{
      position: 'fixed', left: data.x + 16, top: data.y - 20,
      zIndex: 200, pointerEvents: 'none', maxWidth: 240,
    }}>
      <div style={{
        background: 'rgba(12,10,8,0.84)', backdropFilter: 'blur(14px)',
        border: '0.5px solid rgba(255,255,255,0.13)',
        borderRadius: 16, padding: '10px 14px',
        color: '#f0ece4', fontFamily: '"Georgia", serif',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: data.glowColor }}>
          {data.title}
        </div>
        {data.concepts?.length > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(240,236,228,0.55)', lineHeight: 1.6 }}>
            {data.concepts.slice(0, 5).join(' · ')}
            {data.concepts.length > 5 && ` +${data.concepts.length - 5}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Gravity light beam ───────────────────────────────────────────────────────
function GravityBeam({ data }) {
  if (!data) return null;
  const { x1, y1, x2, y2, opacity, insight } = data;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  return (
    <>
      <div style={{
        position: 'fixed', left: x1, top: y1 - 3,
        width: len, height: 7, transformOrigin: '0 50%',
        transform: `rotate(${angle}deg)`,
        zIndex: 58, pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent 0%, rgba(100,200,255,0.18) 50%, transparent 100%)',
        opacity: opacity * 0.7, filter: 'blur(4px)',
      }} />
      <div style={{
        position: 'fixed', left: x1, top: y1 - 0.5,
        width: len, height: 1.5, transformOrigin: '0 50%',
        transform: `rotate(${angle}deg)`,
        zIndex: 60, pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent 0%, rgba(180,240,255,0.9) 50%, transparent 100%)',
        opacity, filter: 'blur(0.3px)', transition: 'opacity 0.2s',
      }} />
      {insight && opacity > 0.45 && (
        <div style={{
          position: 'fixed', left: mx, top: my - 28,
          transform: 'translateX(-50%)',
          zIndex: 62, pointerEvents: 'none',
          opacity: Math.min(1, (opacity - 0.45) * 5),
          transition: 'opacity 0.4s', maxWidth: 220, textAlign: 'center',
        }}>
          <div style={{
            color: 'rgba(220,190,100,0.92)', fontFamily: '"Georgia", serif',
            fontStyle: 'italic', fontSize: 11, letterSpacing: '0.04em',
            lineHeight: 1.5, textShadow: '0 0 12px rgba(255,200,80,0.7)',
          }}>{insight}</div>
        </div>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UniversePage() {
  const navigate = useNavigate();
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const frameRef = useRef(null);
  const clockStartRef = useRef(performance.now());
  const getT = () => (performance.now() - clockStartRef.current) / 1000;

  const jellyfishRef = useRef([]);

  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseNDCRef = useRef(new THREE.Vector2());
  const isDragging = useRef(false);
  const isOrbDragging = useRef(false);
  const draggedJellyRef = useRef(null);
  const draggingIdxRef = useRef(-1);
  const dragPlaneRef = useRef(null);
  const lastMouse = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ theta: 0, phi: Math.PI / 2.4, r: 14 });

  const hoveredTentacleRef = useRef(null);
  const tentacleMapRef = useRef(new Map());

  const gravityPairRef = useRef(null);
  const braidRef = useRef(null);
  const permanentBraidsRef = useRef([]);
  const insightTimerRef = useRef(null);
  const quoteCardTimerRef = useRef(null);
  const tentacleEntangledRef = useRef(false);
  const animLastTimeRef = useRef(null);

  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quoteCard, setQuoteCard] = useState(null);

  // 知音问卷数据 — 音乐+电影合并为蝴蝶标签
 // 读取累积的蝴蝶数据
  const butterflies = (() => {
    try { return JSON.parse(localStorage.getItem('zhiyin_butterflies_v1') || '[]'); } catch { return []; }
  })();

  // 每只蝴蝶独立的屏幕坐标和hover状态
  const [butterflyScreens, setButterflyScreens] = useState([]);
  const [hoveredButterflyIdx, setHoveredButterflyIdx] = useState(-1);
  const butterflyRefs = useRef([]);

  const driftersParamRef = useRef({
    butterflies: butterflies.map((_, i) => ({
      // 每只蝴蝶随机选一种行为模式
      mode: ['orbit', 'wander', 'drift'][Math.floor(Math.random() * 3)],
      // 绕圈参数
      orbitR: 2.5 + Math.random() * 4,
      orbitY: (Math.random() - 0.5) * 3,
      orbitZ: (Math.random() - 0.5) * 2,
      orbitSpeed: (0.08 + Math.random() * 0.06) * (Math.random() > 0.5 ? 1 : -1),
      orbitPhase: Math.random() * Math.PI * 2,
      // 漫游参数
      wanderX: (Math.random() - 0.5) * 10,
      wanderY: (Math.random() - 0.5) * 3,
      wanderZ: (Math.random() - 0.5) * 4,
      wanderSpeed: 0.05 + Math.random() * 0.04,
      wanderPhase: Math.random() * Math.PI * 2,
      // 抖动
      wobbleAmp: 0.15 + Math.random() * 0.2,
      wobbleFreq: 0.4 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
    })),
  });


  const [insightBubble, setInsightBubble] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [gravityBeam, setGravityBeam] = useState(null);

  // ── Load data ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchBooks = () =>
      getConceptsByBook().then(data => { setBooks(data); setLoading(false); });
    fetchBooks();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchBooks();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ── Build Three.js scene ──────────────────────────────────────────────────────
  useEffect(() => {
    if (loading || !mountRef.current || rendererRef.current) return;

    const W = mountRef.current.clientWidth;
    const H = mountRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x040608, 0.028);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 2, 14);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xb0d4f0, 1.6);
    dir.position.set(4, 10, 6); scene.add(dir);
    const rim = new THREE.DirectionalLight(0xf0c880, 0.6);
    rim.position.set(-6, -3, -4); scene.add(rim);
    [[6,4,3,0x40a0d8,2.2],[-5,-3,2,0x60c8a0,1.6],[0,7,-5,0xa080d8,1.2]].forEach(([x,y,z,c,i]) => {
      const pt = new THREE.PointLight(c, i, 30); pt.position.set(x,y,z); scene.add(pt);
    });

    const pCount = 500;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i*3] = (Math.random()-.5)*30; pPos[i*3+1] = (Math.random()-.5)*20; pPos[i*3+2] = (Math.random()-.5)*30;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color:0x80c0e0, size:0.05, transparent:true, opacity:0.3, sizeAttenuation:true }));
    scene.add(particles);

    const N = books.length;
    if (N === 0) {
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.2,24,24),
        new THREE.MeshBasicMaterial({ color:0x2a2a3a, wireframe:true, transparent:true, opacity:0.2 })));
    }

    const mixers = [];
    const tentacleMap = new Map();
    tentacleMapRef.current = tentacleMap;
    const jellyInstances = [];
    jellyfishRef.current = jellyInstances;

    const loader = new GLTFLoader();
    loader.load('/models/jellyfish-chrysaora-blue-ver-10.gltf', (gltf) => {
      books.forEach((book, idx) => {
        const MIN_DIST = 3.5;
        const RANGE_XZ = Math.max(5, N * 1.2);
        const RANGE_Y = Math.max(2, N * 0.5);
        let bx, by, bz, attempts = 0;
        const placed = jellyInstances.map(j => j.group?.position).filter(Boolean);
        do {
          bx = (Math.random() - 0.5) * RANGE_XZ * 2;
          by = (Math.random() - 0.5) * RANGE_Y * 2;
          bz = (Math.random() - 0.5) * RANGE_XZ * 2;
          attempts++;
        } while (
          attempts < 30 &&
          placed.some(p => Math.hypot(p.x - bx, p.y - by, p.z - bz) < MIN_DIST)
        );

        const colorSet = { tint: 0xffffff, emissive: 0x004444, glow: '#88eeff', css: 'rgba(136,238,255,' };
        const conceptCount = book.concepts?.length || 0;
        const sc = 0.030 + Math.min(conceptCount * 0.001, 0.006);

        const jellyfishScene = SkeletonUtils.clone(gltf.scene);
        jellyfishScene.scale.setScalar(sc);
        jellyfishScene.position.set(bx, by, bz);
        jellyfishScene.userData = { bookIdx: idx, isJellyfish: true };
        scene.add(jellyfishScene);

        const glowLight = new THREE.PointLight(0x88eeff, 0.8, 2.5);
        glowLight.position.set(0, 0, 0);
        jellyfishScene.add(glowLight);

        let headMesh = null;
        const antennaMeshes = [];
        const tentacleMeshes = [];

        jellyfishScene.traverse((obj) => {
          if (!obj.isMesh && !obj.isSkinnedMesh) return;
          const name = obj.name || '';
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map(m => applyTint(m.clone(), colorSet));
          } else if (obj.material) {
            obj.material = applyTint(obj.material.clone(), colorSet);
          }
          if (name.includes('innerBody')) {
            obj.visible = false;
          } else if (name.includes('head')) {
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach(m => {
                if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
                  m.emissiveIntensity = (m.emissiveIntensity || 0) + 0.6;
                  if (!m.emissive || m.emissive.getHex() === 0) {
                    m.emissive = m.color.clone().multiplyScalar(0.4);
                  }
                }
              });
            }
            headMesh = obj;
            obj.userData = { bookIdx: idx, isHead: true };
          } else if (name.includes('tendril')) {
            tentacleMeshes.push(obj);
          } else if (name.includes('antennae')) {
            antennaMeshes.push(obj);
          }
        });

        const allQuotes = book.concepts || [];
        const shuffled = [...allQuotes].sort(() => Math.random() - 0.5);
        tentacleMeshes.forEach((mesh, ti) => {
          const quote = shuffled[ti % Math.max(shuffled.length, 1)];
          const quoteText = quote?.sourceText || quote?.quote || quote?.concept || '';
          const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          tentacleMap.set(mesh.uuid, {
            jellyIdx: idx, tentIdx: ti, quote: quoteText,
            bookTitle: book.bookTitle || '',
            page: quote?.page || quote?.chapterTitle || '',
            glowColor: '#e8c87a', mesh,
            baseEmissiveIntensity: mat?.emissiveIntensity ?? 0,
          });
        });

        const mixer = new THREE.AnimationMixer(jellyfishScene);
        if (gltf.animations?.length) {
          const clip = gltf.animations[0];
          const action = mixer.clipAction(clip);
          action.time = Math.random() * clip.duration;
          action.play();
        }
        mixers.push(mixer);

        const bobPhase = Math.random() * Math.PI * 2;
        const bobPeriod = 3 + Math.random() * 3;

        jellyInstances.push({
          group: jellyfishScene, mixer, headMesh, tentacleMeshes, antennaMeshes,
          book, colorSet,
          baseX: bx, baseY: by, baseZ: bz,
          bobPhase, bobPeriod, sc, sphereR: 0.6,
        });
      });

      // ── Animation loop ────────────────────────────────────────────────────────
      const animate = () => {
        frameRef.current = requestAnimationFrame(animate);
        const t = getT();
        const now = performance.now();
        const delta = Math.min(0.05, (now - (animLastTimeRef.current || now)) / 1000);
        animLastTimeRef.current = now;

        jellyInstances.forEach(({ group, mixer, baseX, baseY, baseZ, bobPhase, bobPeriod }, i) => {
          if (!group) return;
          mixer.update(delta);
          if (i !== draggingIdxRef.current) {
            group.position.x = baseX + Math.sin(t * 0.13 + i * 1.3) * 0.06;
            group.position.z = baseZ + Math.cos(t * 0.10 + i * 1.1) * 0.06;
            const bobFreq = (Math.PI * 2) / bobPeriod;
            group.position.y = baseY + Math.sin(t * bobFreq + bobPhase) * 0.12;
          }
          group.rotation.y = t * 0.022 + i * 0.5;
          const glowL = group.children.find(ch => ch.isLight);
          if (glowL) {
            glowL.intensity = 0.6 + Math.sin(t * 1.8 + i * 2.1) * 0.3
                                  + Math.sin(t * 3.1 + i * 1.4) * 0.12;
          }
        });

        // 只 update 蝴蝶的 mixer（水母已在上方各自 update 过）
        for (let mi = jellyInstances.length; mi < mixers.length; mi++) {
          mixers[mi].update(delta);
        }

        const cam2 = cameraRef.current;
        const W2 = mountRef.current?.clientWidth  || window.innerWidth;
        const H2 = mountRef.current?.clientHeight || window.innerHeight;
        const dp = driftersParamRef.current;

        const newScreens = [];
        butterflyRefs.current.forEach((bRef, i) => {
          if (!bRef) return;
          const bp = dp.butterflies[i];
          if (!bp) return;

          let x, y, z;

          if (bp.mode === 'orbit') {
            // 绕圈模式 — 围绕场景中心椭圆轨道，有上下起伏
            const angle = t * bp.orbitSpeed + bp.orbitPhase;
            x = Math.cos(angle) * bp.orbitR;
            y = bp.orbitY + Math.sin(t * bp.wobbleFreq + bp.phase) * bp.wobbleAmp;
            z = Math.sin(angle) * bp.orbitR * 0.6 + bp.orbitZ;
            // 面朝飞行方向
            const dx = -Math.sin(angle) * bp.orbitSpeed;
            const dz = Math.cos(angle) * bp.orbitSpeed * 0.6;
            bRef.rotation.y = Math.atan2(dx, dz);

          } else if (bp.mode === 'wander') {
            // 漫游模式 — 用多个正弦叠加产生不规则路径，会自然掉头
            const tx = t * bp.wanderSpeed + bp.wanderPhase;
            x = bp.wanderX * Math.sin(tx * 0.7) + Math.sin(tx * 1.3) * 2;
            y = bp.wanderY + Math.sin(t * bp.wobbleFreq * 0.8 + bp.phase) * bp.wobbleAmp;
            z = bp.wanderZ * Math.cos(tx * 0.5) + Math.cos(tx * 1.1) * 1.5;
            // 面朝速度方向
            const vx = bp.wanderX * Math.cos(tx * 0.7) * 0.7 + Math.cos(tx * 1.3) * 2 * 1.3;
            const vz = -bp.wanderZ * Math.sin(tx * 0.5) * 0.5 - Math.sin(tx * 1.1) * 1.5 * 1.1;
            bRef.rotation.y = Math.atan2(vx, vz);

          } else {
            // 漂流模式 — 缓慢直行加轻微左右飘，到头自然掉头
            const rawProg = (t * bp.wanderSpeed) % 2;
            const prog = rawProg < 1 ? rawProg : 2 - rawProg;
            const dir = rawProg < 1 ? 1 : -1;
            x = -5 + prog * 10 + Math.sin(t * 0.3 + bp.phase) * 1.2;
            y = bp.wanderY + Math.sin(t * bp.wobbleFreq + bp.phase) * bp.wobbleAmp;
            z = bp.wanderZ + Math.cos(t * 0.25 + bp.phase) * 1.5;
            bRef.rotation.y = dir > 0 ? 0 : Math.PI;
          }

          bRef.position.set(x, y, z);

          if (cam2) {
            const sp = bRef.position.clone().project(cam2);
            newScreens.push({ x: (sp.x + 1) / 2 * W2, y: (1 - sp.y) / 2 * H2 });
          }
        });
        if (newScreens.length > 0) setButterflyScreens(newScreens);

        updateGravityPair(t);
        updateBraidAnim(t);

        particles.rotation.y = t * 0.007;
        renderer.render(scene, camera);
      };
      animate();
    },
    undefined,
    (err) => {
      console.error('GLTF load error:', err);
      buildFallbackJellyfish(books, scene, jellyInstances, tentacleMap);
    });

    // ── 加载蝴蝶模型 ──────────────────────────────────────────────────────────
    const butterflyLoader = new GLTFLoader();
    butterflyLoader.setPath('/models/butterfly/');
    butterflyLoader.load('butterfly.gltf', (gltf) => {
      butterflies.forEach((_, i) => {
        const group = SkeletonUtils.clone(gltf.scene);
        group.scale.setScalar(10.0);
        group.position.set(0, 0.5 + i * 0.5, 0);
        if (gltf.animations?.length) {
          const mixer = new THREE.AnimationMixer(group);
          mixer.clipAction(gltf.animations[0]).play();
          mixers.push(mixer);
        }
        scene.add(group);
        butterflyRefs.current[i] = group;
      });
    }, undefined, (e) => console.warn('Butterfly GLTF load failed:', e.message));
    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameRef.current);
      mixers.forEach(m => m.stopAllAction());
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current)
        mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
      rendererRef.current = null;
      butterflyRefs.current = [];
    };
  }, [loading, books]);

  // ── Tint helper ───────────────────────────────────────────────────────────────
  function applyTint(mat, colorSet) {
    const tintColor = new THREE.Color(colorSet.tint);
    if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
      mat.color.lerp(tintColor, 0.45);
      mat.emissive = new THREE.Color(colorSet.emissive);
      mat.emissiveIntensity = 0.35;
    } else if (mat.isMeshBasicMaterial) {
      mat.color.lerp(tintColor, 0.45);
    }
    mat.transparent = true;
    return mat;
  }

  // ── Gravity proximity + beam update ──────────────────────────────────────────
  const updateGravityPair = useCallback((t) => {
    const jellyfish = jellyfishRef.current;
    if (jellyfish.length < 2) return;
    const ATTRACT_DIST = isOrbDragging.current ? 4.0 : 2.5;
    let minDist = Infinity, pairA = -1, pairB = -1;
    for (let i = 0; i < jellyfish.length; i++) {
      for (let j = i + 1; j < jellyfish.length; j++) {
        const d = jellyfish[i].group.position.distanceTo(jellyfish[j].group.position);
        if (d < minDist) { minDist = d; pairA = i; pairB = j; }
      }
    }
    if (minDist < ATTRACT_DIST && pairA >= 0) {
      const jA = jellyfish[pairA], jB = jellyfish[pairB];
      const ratio = Math.max(0, 1 - minDist / ATTRACT_DIST);
      if (isOrbDragging.current && draggedJellyRef.current) {
        const dragIdx = draggedJellyRef.current.idx;
        const otherIdx = dragIdx === pairA ? pairB : pairA;
        if (otherIdx >= 0 && otherIdx < jellyfish.length) {
          const dragged = jellyfish[dragIdx].group;
          const other = jellyfish[otherIdx].group;
          dragged.position.lerp(other.position, ratio * ratio * 0.018);
        }
      }
      const cam = cameraRef.current;
      if (cam && mountRef.current) {
        const W = mountRef.current.clientWidth, H = mountRef.current.clientHeight;
        const posA2d = jA.group.position.clone().project(cam);
        const posB2d = jB.group.position.clone().project(cam);
        const sx1 = (posA2d.x + 1) / 2 * W, sy1 = (1 - posA2d.y) / 2 * H;
        const sx2 = (posB2d.x + 1) / 2 * W, sy2 = (1 - posB2d.y) / 2 * H;
        const insight = gravityPairRef.current?.insight || null;
        setGravityBeam({ x1: sx1, y1: sy1, x2: sx2, y2: sy2, opacity: ratio * 0.9, insight });
      }
      const prev = gravityPairRef.current;
      const sameKeys = prev?.idxA === pairA && prev?.idxB === pairB;
      if (ratio > 0.35 && (!sameKeys || !prev?.insight)) {
        const text = pickInsight(jA.book.bookTitle, jB.book.bookTitle);
        gravityPairRef.current = { ...(gravityPairRef.current || {}), insight: text };
      }
      const dir = new THREE.Vector3().subVectors(jB.group.position, jA.group.position).normalize();
      const strength = ratio * 0.12;
      if (jA.antennaMeshes && ratio > 0.2) {
        jA.antennaMeshes.forEach((mesh, ai) => {
          mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, Math.atan2(dir.x, dir.z) * strength * (ai % 3 === 0 ? 1.5 : 1), 0.03);
        });
        jB.antennaMeshes.forEach((mesh, ai) => {
          mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, Math.atan2(-dir.x, -dir.z) * strength * (ai % 3 === 0 ? 1.5 : 1), 0.03);
        });
      }
      gravityPairRef.current = { ...(gravityPairRef.current || {}), idxA: pairA, idxB: pairB, dist: minDist, ratio };
    } else {
      gravityPairRef.current = null;
      setGravityBeam(null);
    }
  }, []);

  // ── Braid animation tick ──────────────────────────────────────────────────────
  const updateBraidAnim = useCallback((t) => {
    const ba = braidRef.current;
    if (!ba || ba.complete) return;
    const prog = Math.min((t - ba.startTime) / 1.2, 1.0);
    if (ba.meshes) {
      ba.meshes.forEach((m, si) => {
        const sp = Math.max(0, Math.min(1, (prog - si * 0.08) / 0.9));
        m.material.opacity = sp * (si === 2 ? 0.45 : 0.65);
      });
    }
    if (ba.jewel) {
      const s = prog * (1 + Math.sin(t * 8) * 0.1 * prog);
      ba.jewel.scale.setScalar(s);
      ba.jewel.rotation.y = t * 2.0;
      ba.jewel.rotation.x = t * 1.2;
    }
    if (prog >= 1.0) { ba.complete = true; ba.onComplete?.(); }
  }, []);

  // ── Trigger braid + insight ───────────────────────────────────────────────────
  const triggerBraid = useCallback(async (idxA, idxB) => {
    const jellyfish = jellyfishRef.current;
    const jA = jellyfish[idxA], jB = jellyfish[idxB];
    if (!jA || !jB || !sceneRef.current) return;
    const mid = jA.group.position.clone().lerp(jB.group.position, 0.5);
    const cam = cameraRef.current;
    const W = mountRef.current?.clientWidth || window.innerWidth;
    const H = mountRef.current?.clientHeight || window.innerHeight;
    const sp = mid.clone().project(cam);
    const sx = (sp.x + 1) / 2 * W;
    const sy = (1 - sp.y) / 2 * H;
    const t0 = getT();
    braidRef.current = {
      meshes: [], jewel: null, startTime: t0, complete: false,
      onComplete: () => {
        setInsightBubble({ x: sx, y: sy - 80, text: pickInsight(jA.book.bookTitle, jB.book.bookTitle) });
        clearTimeout(insightTimerRef.current);
        insightTimerRef.current = setTimeout(() => setInsightBubble(null), 5000);
        jA.group.position.set(jA.baseX, jA.baseY, jA.baseZ);
        setGravityBeam(null);
      },
    };
    tentacleEntangledRef.current = true;
  }, []);

  // ── Pointer events ────────────────────────────────────────────────────────────
  const getNDC = useCallback((e) => {
    const rect = mountRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseNDCRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDCRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }, []);

  const getJellyfishHit = useCallback((clientX, clientY) => {
    if (!cameraRef.current || !mountRef.current) return -1;
    const W = mountRef.current.clientWidth, H = mountRef.current.clientHeight;
    const cam = cameraRef.current;
    let closest = -1, closestDist = Infinity;
    jellyfishRef.current.forEach((jf, i) => {
      if (!jf.group) return;
      const projected = jf.group.position.clone().project(cam);
      const sx = (projected.x + 1) / 2 * W;
      const sy = (1 - projected.y) / 2 * H;
      const d = Math.hypot(clientX - sx, clientY - sy);
      if (d < 80 && d < closestDist) { closestDist = d; closest = i; }
    });
    return closest;
  }, []);

  const getTentacleHit = useCallback((clientX, clientY) => {
    if (!cameraRef.current || !mountRef.current) return null;
    const W = mountRef.current.clientWidth, H = mountRef.current.clientHeight;
    const cam = cameraRef.current;
    let best = null, bestDist = Infinity;
    jellyfishRef.current.forEach((jf) => {
      if (!jf.tentacleMeshes?.length) return;
      jf.tentacleMeshes.forEach((mesh) => {
        const worldPos = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        const sp = worldPos.clone().project(cam);
        const sx = (sp.x + 1) / 2 * W;
        const sy = (1 - sp.y) / 2 * H;
        const d = Math.hypot(clientX - sx, clientY - sy);
        if (d < 60 && d < bestDist) {
          const info = tentacleMapRef.current.get(mesh.uuid);
          if (info) { bestDist = d; best = { mesh, info }; }
        }
      });
    });
    return best;
  }, []);

  const handlePointerDown = useCallback((e) => {
    getNDC(e);
    lastMouse.current = { x: e.clientX, y: e.clientY };
    const jIdx = getJellyfishHit(e.clientX, e.clientY);
    if (jIdx >= 0) {
      const jf = jellyfishRef.current[jIdx];
      isOrbDragging.current = true;
      draggingIdxRef.current = jIdx;
      draggedJellyRef.current = { idx: jIdx, group: jf.group };
      const cam = cameraRef.current;
      const normal = cam.position.clone().normalize();
      dragPlaneRef.current = new THREE.Plane(normal, -jf.group.position.dot(normal));
      return;
    }
    isDragging.current = true;
  }, [getNDC, getJellyfishHit]);

  const handlePointerMove = useCallback((e) => {
    getNDC(e);
    if (isOrbDragging.current && draggedJellyRef.current && dragPlaneRef.current) {
      raycasterRef.current.setFromCamera(mouseNDCRef.current, cameraRef.current);
      const worldPos = new THREE.Vector3();
      raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, worldPos);
      if (worldPos) draggedJellyRef.current.group.position.copy(worldPos);
      return;
    }
    if (!isDragging.current && !isOrbDragging.current) {
      const hit = getTentacleHit(e.clientX, e.clientY);
      const prevUUID = hoveredTentacleRef.current?.uuid;
      if (hit) {
        const { mesh, info } = hit;
        if (prevUUID && prevUUID !== mesh.uuid) restoreTentacle(prevUUID);
        if (prevUUID !== mesh.uuid) {
          brightenTentacle(mesh);
          hoveredTentacleRef.current = { uuid: mesh.uuid, mesh };
          clearTimeout(quoteCardTimerRef.current);
          const jf = jellyfishRef.current[info.jellyIdx];
          let jx = e.clientX, jy = e.clientY;
          if (jf && cameraRef.current && mountRef.current) {
            const W = mountRef.current.clientWidth, H = mountRef.current.clientHeight;
            const sp = jf.group.position.clone().project(cameraRef.current);
            jx = (sp.x + 1) / 2 * W;
            jy = (1 - sp.y) / 2 * H;
          }
          setQuoteCard({ jellyfishX: jx, jellyfishY: jy, text: info.quote, bookTitle: info.bookTitle, page: info.page, glowColor: info.glowColor });
        }
      } else {
        if (prevUUID) restoreTentacle(prevUUID);
        hoveredTentacleRef.current = null;
        quoteCardTimerRef.current = setTimeout(() => setQuoteCard(null), 350);
      }
    }
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    const s = sphericalRef.current;
    s.theta -= dx * 0.006;
    s.phi = Math.max(0.3, Math.min(Math.PI - 0.3, s.phi + dy * 0.005));
    const cam = cameraRef.current;
    if (cam) {
      cam.position.x = s.r * Math.sin(s.phi) * Math.sin(s.theta);
      cam.position.y = s.r * Math.cos(s.phi);
      cam.position.z = s.r * Math.sin(s.phi) * Math.cos(s.theta);
      cam.lookAt(0, 0, 0);
    }
  }, [getNDC, getTentacleHit]);

  const handlePointerUp = useCallback((e) => {
    if (isOrbDragging.current && draggedJellyRef.current) {
      isOrbDragging.current = false;
      const { idx } = draggedJellyRef.current;
      const jellyfish = jellyfishRef.current;
      const dragJf = jellyfish[idx];
      let closestIdx = -1, closestDist = Infinity;
      jellyfish.forEach((jf, i) => {
        if (i === idx) return;
        const d = dragJf.group.position.distanceTo(jf.group.position);
        const threshold = (dragJf.sphereR + jf.sphereR) * 2.5;
        if (d < threshold && d < closestDist) { closestDist = d; closestIdx = i; }
      });
      if (closestIdx >= 0) { triggerBraid(idx, closestIdx); }
      else { dragJf.group.position.set(dragJf.baseX, dragJf.baseY, dragJf.baseZ); }
      draggedJellyRef.current = null;
      draggingIdxRef.current = -1;
      return;
    }
    if (!isDragging.current) return;
    isDragging.current = false;
    const dx = Math.abs(e.clientX - lastMouse.current.x);
    const dy = Math.abs(e.clientY - lastMouse.current.y);
    if (dx + dy > 6) return;
    const jIdx = getJellyfishHit();
    if (jIdx >= 0) {
      const jf = jellyfishRef.current[jIdx];
      setTooltip({ x: e.clientX, y: e.clientY, title: jf.book.bookTitle, concepts: (jf.book.concepts || []).map(c => c.concept || c), glowColor: jf.colorSet.glow });
      setTimeout(() => setTooltip(null), 3500);
    }
  }, [triggerBraid, getJellyfishHit]);

  const handleWheel = useCallback((e) => {
    const s = sphericalRef.current;
    s.r = Math.max(5, Math.min(22, s.r + e.deltaY * 0.012));
    const cam = cameraRef.current;
    if (!cam) return;
    cam.position.x = s.r * Math.sin(s.phi) * Math.sin(s.theta);
    cam.position.y = s.r * Math.cos(s.phi);
    cam.position.z = s.r * Math.sin(s.phi) * Math.cos(s.theta);
    cam.lookAt(0, 0, 0);
  }, []);

  // ── Tentacle brightness helpers ───────────────────────────────────────────────
  function brightenTentacle(mesh) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(m => {
      if (!m) return;
      if (m._origColor === undefined && m.color) m._origColor = m.color.clone();
      m._origEmissive = m.emissiveIntensity ?? 0;
      m._origOpacity = m.opacity ?? 1;
      if (m.color && m._origColor) m.color.copy(m._origColor).multiplyScalar(1.5);
      if (m.emissive) {
        if (!m._origEmissiveColor) m._origEmissiveColor = m.emissive.clone();
        m.emissive.copy(m._origEmissiveColor).multiplyScalar(2.0);
        m.emissiveIntensity = Math.min(2, m._origEmissive + 0.8);
      }
      m.opacity = Math.min(1, (m._origOpacity || 0.85) * 1.3);
      m.needsUpdate = true;
    });
  }
  function restoreTentacle(uuid) {
    const info = tentacleMapRef.current.get(uuid);
    if (!info?.mesh) return;
    const mats = Array.isArray(info.mesh.material) ? info.mesh.material : [info.mesh.material];
    mats.forEach(m => {
      if (!m) return;
      if (m._origColor) m.color.copy(m._origColor);
      if (m._origEmissive !== undefined) m.emissiveIntensity = m._origEmissive;
      if (m._origEmissiveColor && m.emissive) m.emissive.copy(m._origEmissiveColor);
      if (m._origOpacity !== undefined) m.opacity = m._origOpacity;
      m.needsUpdate = true;
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: '100vw', height: '100vh', overflow: 'hidden',
      background: 'linear-gradient(160deg, #040810 0%, #060a10 40%, #040608 100%)',
      position: 'relative',
      cursor: isDragging.current ? 'grabbing' : (isOrbDragging.current ? 'grabbing' : 'grab'),
    }}>
      <style>{`
        @keyframes qcFloat {
          from { opacity: 0; transform: translateY(10px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes insightReveal {
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.88); filter: blur(4px); }
          12%  { opacity: 1; transform: translate(-50%,-50%) scale(1);    filter: blur(0px); }
          80%  { opacity: 1; transform: translate(-50%,-50%) scale(1);    filter: blur(0px); }
          100% { opacity: 0; transform: translate(-50%,-56%) scale(0.93); filter: blur(3px); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ringFadeIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div
        ref={mountRef}
        style={{ position: 'absolute', inset: 0 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      />

      <GravityBeam data={gravityBeam} />

      <button onClick={() => navigate('/')} style={{
        position: 'fixed', top: 20, left: 20, zIndex: 200,
        background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        borderRadius: 12, padding: '8px 16px',
        color: 'rgba(240,236,228,0.7)', fontFamily: '"Georgia", serif', fontSize: 13,
        cursor: 'pointer', transition: 'all 0.2s',
      }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.12)'}
         onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.06)'}>
        ← 返回
      </button>

      <div style={{
        position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
        zIndex: 200, pointerEvents: 'none', textAlign: 'center',
      }}>
        <div style={{ fontFamily: '"Georgia", serif', fontSize: 15, letterSpacing: '0.18em', color: 'rgba(200,180,140,0.6)', textTransform: 'uppercase' }}>
          颅内世界
        </div>
        {!loading && books.length > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(150,140,120,0.45)', marginTop: 4, letterSpacing: '0.08em' }}>
            {books.length} 本书 · {books.reduce((s,b) => s + (b.concepts?.length||0), 0)} 个标注
          </div>
        )}
      </div>

      <div style={{
        position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 200, pointerEvents: 'none', color: 'rgba(150,140,120,0.35)',
        fontFamily: '"Georgia", serif', fontSize: 11, letterSpacing: '0.1em', textAlign: 'center',
      }}>
        拖拽旋转 · 滚轮缩放 · 划过触须查看批注 · 拖拽水母靠近触发缠绕
      </div>

      {loading && (
        <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, flexDirection:'column', gap:16 }}>
          <div style={{ width:32, height:32, border:'1.5px solid rgba(200,180,140,0.2)', borderTopColor:'rgba(200,180,140,0.7)', borderRadius:'50%', animation:'spin 1s linear infinite' }} />
          <div style={{ color:'rgba(200,180,140,0.5)', fontFamily:'"Georgia", serif', fontSize:13 }}>构建宇宙中…</div>
        </div>
      )}

      {!loading && books.length === 0 && (
        <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, flexDirection:'column', gap:12, pointerEvents:'none' }}>
          <div style={{ color:'rgba(200,180,140,0.35)', fontFamily:'"Georgia", serif', fontSize:15 }}>宇宙尚为空</div>
          <div style={{ color:'rgba(150,140,120,0.3)', fontFamily:'"Georgia", serif', fontSize:12 }}>开始阅读并标记高亮，你的颅内世界将在此生长</div>
        </div>
      )}

      <QuoteCard data={quoteCard} />
      <InsightBubble data={insightBubble} />
      <Tooltip data={tooltip} />

      {/* 蝴蝶标签 — 音乐+电影，hover 才显现，字体颜色与页面一致 */}
      {butterflies.map((b, i) => butterflyScreens[i] && (
        <div
          key={i}
          onMouseEnter={() => setHoveredButterflyIdx(i)}
          onMouseLeave={() => setHoveredButterflyIdx(-1)}
          style={{
            position: 'fixed',
            left: butterflyScreens[i].x,
            top: butterflyScreens[i].y - 28,
            transform: 'translateX(-50%)',
            zIndex: 160,
            pointerEvents: 'auto',
            cursor: 'default',
            padding: '8px 12px',
            transition: 'left 0.1s linear, top 0.1s linear',
          }}
        >
          <div style={{
            color: 'rgba(200,180,140,0.6)',
            fontFamily: '"Georgia", serif',
            fontStyle: 'italic',
            fontSize: 12,
            letterSpacing: '0.18em',
            whiteSpace: 'nowrap',
            opacity: hoveredButterflyIdx === i ? 1 : 0,
            transition: 'opacity 0.4s ease',
          }}>
            {b.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Fallback ──────────────────────────────────────────────────────────────────
function buildFallbackJellyfish(books, scene, jellyInstances, tentacleMap) {
  const colorSet = { sphere: 0xb8c0cc, emissive: 0x202838, ribbon: 0xd0d8e4, glow: '#b8c0cc', tint: 0xb8c0cc };
  const N = books.length;
  books.forEach((book, idx) => {
    const angle = (idx / N) * Math.PI * 2;
    const radius = N === 1 ? 0 : Math.max(3.5, N * 0.8);
    const bx = Math.cos(angle) * radius;
    const by = (Math.random() - 0.5) * (N > 4 ? 1.8 : 1.0);
    const bz = Math.sin(angle) * radius;
    const conceptCount = book.concepts?.length || 0;
    const sphereR = 0.30 + Math.min(conceptCount * 0.018, 0.25);

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(sphereR, 32, 32),
      new THREE.MeshPhysicalMaterial({ color: colorSet.sphere, emissive: new THREE.Color(colorSet.sphere), emissiveIntensity: 0.5, transparent: true, opacity: 0.82 })
    );
    sphere.position.set(bx, by, bz);
    scene.add(sphere);

    const antennaMeshes = [];
    const quotes = book.concepts || [];
    const ribbonCount = Math.max(Math.min(quotes.length, 12), Math.min(3, quotes.length));

    for (let r = 0; r < ribbonCount; r++) {
      const quote = quotes[r];
      const quoteText = quote?.quote || quote?.concept || '';
      const charLen = Math.max(20, Math.min(quoteText.length, 200));
      const strandLength = 2.0 + (charLen / 200) * 4.0;
      const spreadAngle = (r / ribbonCount) * Math.PI * 2;
      const dropAngle = Math.PI * 0.55 + (Math.random() - 0.5) * 0.4;
      const phaseX = Math.random() * Math.PI * 2;
      const phaseZ = Math.random() * Math.PI * 2;
      const waveFreq = 0.3 + Math.random() * 0.4;
      const segments = 14;
      const baseDir = new THREE.Vector3(Math.cos(spreadAngle)*Math.sin(dropAngle), -Math.cos(dropAngle), Math.sin(spreadAngle)*Math.sin(dropAngle)).normalize();
      const right = new THREE.Vector3().crossVectors(baseDir, new THREE.Vector3(0,1,0)).normalize();
      if (right.lengthSq() < 0.01) right.set(1, 0, 0);
      const positions = [], indices = [];
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const swayAmp = u * u * 0.28;
        const center = new THREE.Vector3(
          baseDir.x*u*strandLength + right.x*Math.sin(waveFreq+phaseX+u*Math.PI*1.8)*swayAmp,
          baseDir.y*u*strandLength - u*u*0.08,
          baseDir.z*u*strandLength + Math.cos(waveFreq*0.7+phaseZ+u*Math.PI*1.4)*swayAmp*0.6
        ).addScaledVector(baseDir.clone().normalize(), sphereR);
        const hw = 0.16 * (1 - u * 0.45);
        positions.push(...center.clone().addScaledVector(right,-hw).toArray());
        positions.push(...center.clone().addScaledVector(right, hw).toArray());
      }
      for (let i = 0; i < segments; i++) { indices.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(indices); geo.computeVertexNormals();
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorSet.ribbon), transparent: true, opacity: 0.72+Math.random()*0.2, side: THREE.DoubleSide, depthWrite: false });
      const ribbonMesh = new THREE.Mesh(geo, mat);
      sphere.add(ribbonMesh);
      tentacleMap.set(ribbonMesh.uuid, { jellyIdx: idx, tentIdx: r, quote: quoteText, bookTitle: book.bookTitle||'', page: quote?.page||quote?.chapterTitle||'', glowColor: colorSet.glow, mesh: ribbonMesh, baseEmissiveIntensity: 0 });
      antennaMeshes.push(ribbonMesh);
    }

    jellyInstances.push({
      group: sphere, mixer: null, headMesh: sphere,
      tentacleMeshes: [], antennaMeshes, book,
      colorSet: { ...colorSet, tint: colorSet.sphere },
      baseX: bx, baseY: by, baseZ: bz,
      bobPhase: Math.random()*Math.PI*2, bobPeriod: 3+Math.random()*3,
      sc: sphereR, sphereR: sphereR*3,
    });
  });
}
