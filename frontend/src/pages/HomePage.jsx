import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Upload, Trash2, Loader2, FileText, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import useBookStore from '../stores/useBookStore';
import NautilusAsset from '../assets/Nautilus.svg';
import ScallopAsset from '../assets/scallop.svg';

function InkDiffuse({ x, y, dark, onDone }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const color = dark ? '80,52,32' : '140,110,80';
    const blobs = Array.from({ length: 18 }, (_, i) => {
      const angle = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.8;
      const speed = 2.5 + Math.random() * 4;
      return {
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        r: 8 + Math.random() * 18, alpha: 0.85, grow: 0.8 + Math.random() * 1.4,
        wobble: Math.random() * Math.PI * 2, wobbleSpeed: 0.04 + Math.random() * 0.06,
        scaleX: 0.7 + Math.random() * 0.6, scaleY: 0.7 + Math.random() * 0.6,
      };
    });
    const secondaries = [];
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < blobs.length; i++)
        for (let j = i + 1; j < blobs.length; j++) {
          const dx = blobs[j].x - blobs[i].x, dy = blobs[j].y - blobs[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(${color},${(1 - dist / 120) * 0.25 * blobs[i].alpha})`;
            ctx.lineWidth = (1 - dist / 120) * 4;
            ctx.moveTo(blobs[i].x, blobs[i].y);
            ctx.quadraticCurveTo(
              (blobs[i].x + blobs[j].x) / 2 + (Math.random() - .5) * 20,
              (blobs[i].y + blobs[j].y) / 2 + (Math.random() - .5) * 20,
              blobs[j].x, blobs[j].y
            );
            ctx.stroke();
          }
        }
      for (const s of secondaries) {
        s.r += 0.3; s.alpha -= 0.008; if (s.alpha <= 0) continue;
        ctx.save(); ctx.translate(s.x, s.y); ctx.scale(s.scaleX, s.scaleY);
        ctx.beginPath(); ctx.arc(0, 0, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${s.alpha})`; ctx.fill(); ctx.restore();
      }
      for (const b of blobs) {
        b.wobble += b.wobbleSpeed; b.x += b.vx; b.y += b.vy;
        b.vx *= 0.985; b.vy *= 0.985; b.r += b.grow * 0.4; b.alpha -= 0.004;
        if (b.alpha <= 0) continue;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.wobble * 0.3); ctx.scale(b.scaleX, b.scaleY);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r);
        g.addColorStop(0, `rgba(${color},${b.alpha})`);
        g.addColorStop(0.6, `rgba(${color},${b.alpha * 0.7})`);
        g.addColorStop(1, `rgba(${color},0)`);
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill(); ctx.restore();
      }
      if (frame % 8 === 0) {
        const src = blobs[Math.floor(Math.random() * blobs.length)];
        if (src.alpha > 0.1) secondaries.push({
          x: src.x + (Math.random() - .5) * 30, y: src.y + (Math.random() - .5) * 30,
          r: 3 + Math.random() * 8, alpha: src.alpha * 0.5,
          scaleX: 0.6 + Math.random() * 0.8, scaleY: 0.6 + Math.random() * 0.8,
        });
      }
      frame++;
      if ((blobs.some(b => b.alpha > 0) || secondaries.some(s => s.alpha > 0)) && frame < 300)
        frameRef.current = requestAnimationFrame(draw);
      else onDone();
    };
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200 }} />;
}

function RippleCanvas() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const ripplesRef = useRef([]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    const spawn = () => {
      const W = canvas.width, H = canvas.height, zone = Math.random() < 0.5;
      ripplesRef.current.push({
        x: zone ? W * 0.06 + (Math.random() - .5) * 60 : W * 0.94 + (Math.random() - .5) * 60,
        y: zone ? H * 0.90 + (Math.random() - .5) * 60 : H * 0.10 + (Math.random() - .5) * 60,
        r: 0, maxR: 260 + Math.random() * 120, speed: 0.9 + Math.random() * 0.6,
        alpha: 0.32 + Math.random() * 0.16, rings: 4, spacing: 26,
      });
    };
    for (let i = 0; i < 3; i++) setTimeout(spawn, i * 700);
    const iv = setInterval(spawn, 1600 + Math.random() * 600);
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ripplesRef.current = ripplesRef.current.filter(r => r.r < r.maxR);
      for (const rip of ripplesRef.current) {
        rip.r += rip.speed;
        const base = rip.alpha * (1 - rip.r / rip.maxR);
        for (let ring = 0; ring < rip.rings; ring++) {
          const ringR = rip.r - ring * rip.spacing; if (ringR <= 0) continue;
          const a = base * (1 - Math.min(ringR / rip.maxR, 1) * 0.45);
          ctx.beginPath(); ctx.arc(rip.x, rip.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(35,28,20,${a * (ring % 2 === 0 ? 1.0 : 0.4)})`;
          ctx.lineWidth = ring % 2 === 0 ? 1.1 : 0.7; ctx.stroke();
          if (ringR > 2) {
            ctx.beginPath(); ctx.arc(rip.x, rip.y, ringR - 2, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(245,241,235,${a * (ring % 2 === 0 ? 0.55 : 0.2)})`;
            ctx.lineWidth = 0.6; ctx.stroke();
          }
          if (ring < rip.rings - 1 && ring % 2 === 0) {
            const ir = ringR - rip.spacing;
            if (ir > 0) {
              ctx.beginPath(); ctx.arc(rip.x, rip.y, ringR, 0, Math.PI * 2);
              ctx.arc(rip.x, rip.y, ir, 0, Math.PI * 2, true);
              ctx.fillStyle = `rgba(28,22,15,${a * 0.05})`; ctx.fill();
            }
          }
        }
      }
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frameRef.current); clearInterval(iv); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />;
}

function SparkleLayer() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    const make = () => {
      const W = canvas.width, H = canvas.height;
      return Array.from({ length: 780 }, (_, i) => {
        const near = i < 390, spread = 280;
        return {
          x: near ? W * 0.06 + (Math.random() - .5) * spread * 2 : W * 0.94 + (Math.random() - .5) * spread * 2,
          y: near ? H * 0.90 + (Math.random() - .5) * spread * 2 : H * 0.10 + (Math.random() - .5) * spread * 2,
          r: 0.7 + Math.random() * 2.1, phase: Math.random() * Math.PI * 2,
          speed: 0.006 + Math.random() * 0.012, maxAlpha: 0.5 + Math.random() * 0.45,
          hue: 36 + Math.random() * 22,
        };
      });
    };
    let sp = make();
    const onR = () => { sp = make(); };
    window.addEventListener('resize', onR);
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of sp) {
        s.phase += s.speed;
        const alpha = s.maxAlpha * (0.5 + 0.5 * Math.sin(s.phase));
        if (alpha < 0.04) continue;
        ctx.save(); ctx.globalAlpha = alpha; ctx.translate(s.x, s.y);
        ctx.fillStyle = `hsla(${s.hue},44%,88%,1)`;
        const r = s.r;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          ctx.lineTo(Math.cos(a) * r * 3.2, Math.sin(a) * r * 3.2);
          const ia = a + Math.PI / 4;
          ctx.lineTo(Math.cos(ia) * r * 0.7, Math.sin(ia) * r * 0.7);
        }
        ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,252,228,0.98)'; ctx.fill();
        ctx.restore();
      }
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frameRef.current); window.removeEventListener('resize', resize); window.removeEventListener('resize', onR); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1 }} />;
}

function ShellBubble({ containX, containY, radius, type, onClick }) {
  const SIZE = 72;
  const posRef = useRef({
    x: containX + (Math.random() - 0.5) * radius * 0.4,
    y: containY + (Math.random() - 0.5) * radius * 0.4,
    vx: (Math.random() - 0.5) * 0.65, vy: (Math.random() - 0.5) * 0.65,
    rotation: Math.random() * 360, angularVel: (Math.random() - 0.5) * 0.25,
  });
  const [pos, setPos] = useState({ x: posRef.current.x, y: posRef.current.y, rotation: posRef.current.rotation });
  const [hovered, setHovered] = useState(false);
  const animRef = useRef(null);
  const HIT_R = 36;

  useEffect(() => {
    const tick = () => {
      const p = posRef.current;
      p.x += p.vx; p.y += p.vy;
      const dx = p.x - containX, dy = p.y - containY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist + HIT_R > radius) {
        const nx = dx / dist, ny = dy / dist;
        const dot = p.vx * nx + p.vy * ny;
        p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny;
        p.x -= nx * (dist + HIT_R - radius); p.y -= ny * (dist + HIT_R - radius);
        const tangential = p.vx * (-ny) + p.vy * nx;
        p.angularVel += tangential * 0.18;
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 0.9) { p.vx = (p.vx / spd) * 0.9; p.vy = (p.vy / spd) * 0.9; }
      }
      p.vx += (Math.random() - 0.5) * 0.022; p.vy += (Math.random() - 0.5) * 0.022;
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > 0.85) { p.vx = (p.vx / spd) * 0.85; p.vy = (p.vy / spd) * 0.85; }
      if (spd < 0.18) { p.vx *= 1.06; p.vy *= 1.06; }
      p.angularVel *= 0.975; p.rotation += p.angularVel;
      setPos({ x: p.x, y: p.y, rotation: p.rotation });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [containX, containY, radius]);

  const DISPLAY = SIZE * 2;
  return (
    <div onClick={() => onClick(pos.x, pos.y)}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        position: 'fixed', left: pos.x - DISPLAY / 2, top: pos.y - DISPLAY / 2,
        width: DISPLAY, height: DISPLAY, cursor: 'pointer', zIndex: 50,
        transform: `scale(${hovered ? 1.1 : 1}) translateY(${hovered ? '-4px' : '0'})`,
        transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        filter: hovered ? 'drop-shadow(0 8px 18px rgba(100,60,20,0.4))' : 'drop-shadow(0 4px 10px rgba(100,60,20,0.22))',
        overflow: 'visible',
      }}>
      {type === 'nautilus'
        ? <img src={NautilusAsset} width={SIZE * 15} height={SIZE * 15} style={{ transform: `rotate(${pos.rotation}deg)`, display: 'block', pointerEvents: 'none' }} alt="" />
        : <img src={ScallopAsset} width={SIZE * 8} height={SIZE * 8} style={{ transform: `rotate(${pos.rotation}deg)`, display: 'block', pointerEvents: 'none' }} alt="" />
      }
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { books, fetchBooks, addBook, deleteBook } = useBookStore();
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [inkEffect, setInkEffect] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchBooks();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const h = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const handleOpen = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const book = await addBook(uploadFile, uploadTitle.trim());
      navigate(`/reader/${book.id}`);
    } catch (err) {
      console.error(err);
      alert('上传失败：' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (confirm('Delete this book and all its notes?')) await deleteBook(id);
  };

  const W = windowSize.w, H = windowSize.h;
  const disabled = uploading || !uploadFile || !uploadTitle.trim();

  const card = {
    background: 'rgba(250,248,244,0.58)',
    backdropFilter: 'blur(28px) saturate(180%) brightness(108%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%) brightness(108%)',
    borderRadius: '20px',
    border: '0.5px solid rgba(255,255,255,0.78)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.10),0 4px 12px rgba(0,0,0,0.07),inset 0 1px 0 rgba(255,255,255,0.92),inset 0 -1px 0 rgba(0,0,0,0.03)',
  };

  return (
    <div style={{
      minHeight: '100vh', position: 'relative',
      background: 'radial-gradient(ellipse at 8% 92%,rgba(48,40,30,0.12) 0%,transparent 50%),radial-gradient(ellipse at 92% 8%,rgba(65,56,42,0.09) 0%,transparent 48%),linear-gradient(155deg,#f5f3f0 0%,#f0ece6 40%,#ede9e4 100%)',
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <RippleCanvas />
      <SparkleLayer />

      <div className="min-h-screen">
        <main className="max-w-4xl mx-auto px-4 py-8">

          {/* Title + user */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '18px',
              background: 'rgba(250,248,244,0.68)',
              backdropFilter: 'blur(24px) saturate(160%)',
              WebkitBackdropFilter: 'blur(24px) saturate(160%)',
              borderRadius: '22px',
              border: '0.5px solid rgba(255,255,255,0.78)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.09),inset 0 1px 0 rgba(255,255,255,0.92)',
              padding: '30px 48px',
            }}>
              <BookOpen size={36} color="#5a3e28" />
              <div>
                <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700, color: '#1a1410', lineHeight: 1.2 }}>Readium</h1>
                <p style={{ margin: '5px 0 0', fontSize: '14px', color: '#7a6e62', lineHeight: 1.3 }}>Mind in Charge, Tech on Call</p>
              </div>
            </div>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', zIndex: 10 }}>
                <span style={{ fontSize: '13px', color: '#7a6e62' }}>{user.email}</span>
                <button onClick={() => supabase.auth.signOut()}
                  style={{ background: 'rgba(250,248,244,0.7)', border: '0.5px solid rgba(200,194,184,0.65)', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <LogOut size={15} color="#7a6e62" />
                </button>
              </div>
            )}
          </div>

          {/* Upload card */}
          <section style={{ marginBottom: '24px' }}>
            <div style={{ ...card, padding: '28px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#1c1916', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={15} color="#5a3e28" /> Upload PDF
              </h2>
              <form onSubmit={handleOpen} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)}
                  placeholder="Book title" required
                  style={{ width: '100%', padding: '10px 14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.6)', border: '0.5px solid rgba(200,194,184,0.65)', borderRadius: '12px', fontSize: '14px', color: '#1c1916', outline: 'none', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)' }}
                />
                <label style={{ display: 'block', cursor: 'pointer' }}>
                  <div style={{ border: '1.5px dashed rgba(160,152,140,0.5)', borderRadius: '12px', padding: '32px', textAlign: 'center', background: 'rgba(255,255,255,0.25)' }}>
                    {uploadFile
                      ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#4a4540' }}>
                          <FileText size={18} color="#8a8278" /><span style={{ fontSize: '14px' }}>{uploadFile.name}</span>
                        </div>
                      : <div style={{ color: '#8a8278' }}>
                          <p style={{ margin: 0, fontSize: '14px' }}>Click to select PDF file</p>
                          <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Saved to your account permanently</p>
                        </div>
                    }
                  </div>
                  <input type="file" accept=".pdf" onChange={e => {
                    setUploadFile(e.target.files[0]);
                    if (!uploadTitle && e.target.files[0]) setUploadTitle(e.target.files[0].name.replace(/\.pdf$/i, ''));
                  }} style={{ display: 'none' }} required />
                </label>
                <button type="submit" disabled={disabled}
                  style={{
                    padding: '11px', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 500,
                    background: disabled ? 'rgba(87, 53, 30, 0.3)' : '#63452f',
                    color: disabled ? 'rgba(250,245,238,0.45)' : '#ffffff',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    boxShadow: '0 2px 8px rgba(80,45,15,0.22),inset 0 1px 0 rgba(255,255,255,0.10)',
                    transition: 'background 0.2s',
                  }}>
                  {uploading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={15} />}
                  {uploading ? 'Uploading...' : 'Upload & Read'}
                </button>
              </form>
            </div>
          </section>

          {/* Books list */}
          <section>
            <div style={{ ...card, padding: '28px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: '#1c1916', margin: '0 0 16px' }}>Your Books</h2>
              {books.length === 0 && (
                <p style={{ textAlign: 'center', color: '#8a8278', fontSize: '14px', padding: '16px 0', margin: 0 }}>
                  No books yet. Upload a PDF to get started.
                </p>
              )}
              {books.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {books.map(book => (
                    <div key={book.id} onClick={() => navigate(`/reader/${book.id}`)}
                      style={{ background: 'rgba(255,255,255,0.42)', border: '0.5px solid rgba(255,255,255,0.72)', borderRadius: '14px', padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.05),inset 0 1px 0 rgba(255,255,255,0.8)', transition: 'background 0.15s,box-shadow 0.15s,transform 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.68)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.42)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: '38px', height: '48px', background: 'rgba(205,200,192,0.45)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileText size={16} color="#8a8278" />
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#1c1916' }}>{book.title}</p>
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8a8278' }}>
                            {book.current_page > 1 ? `Last read: page ${book.current_page}` : 'Not started'}
                          </p>
                        </div>
                      </div>
                      <button onClick={e => handleDelete(e, book.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#b5afa5', borderRadius: '8px', transition: 'color 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#b84040'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#b5afa5'; }}
                      ><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      <ShellBubble containX={W * 0.06} containY={H * 0.90} radius={65} type="nautilus"
        onClick={(x, y) => setInkEffect({ x, y, dark: true, dest: '/zhiyin' })} />
      <ShellBubble containX={W * 0.94} containY={H * 0.10} radius={65} type="scallop"
        onClick={(x, y) => setInkEffect({ x, y, dark: false, dest: '/universe' })} />

      {inkEffect && (
        <InkDiffuse x={inkEffect.x} y={inkEffect.y} dark={inkEffect.dark}
          onDone={() => { const d = inkEffect.dest; setInkEffect(null); navigate(d); }} />
      )}
    </div>
  );
}
