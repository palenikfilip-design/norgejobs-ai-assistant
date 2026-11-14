import { useEffect, useRef, useState } from 'react';
import { landingLandscapes as scenes } from '@/data/landingLandscapes';
import { landingPoster } from '@/data/landingPoster';

/** Poster paints first; only the current/next scene downloads, after page load. */
export default function LandingLandscape() {
  const [still, setStill] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [started, setStarted] = useState(false);
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0]));
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const transitioning = useRef(false);

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 767px)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setStill(mobile.matches || motion.matches); setReduced(motion.matches); };
    update();
    mobile.addEventListener('change', update);
    motion.addEventListener('change', update);
    let timer: ReturnType<typeof setTimeout>;
    const start = () => { timer = setTimeout(() => setStarted(true), 1200); };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      clearTimeout(timer); window.removeEventListener('load', start);
      mobile.removeEventListener('change', update); motion.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const next = (active + 1) % scenes.length;
    const preload = setTimeout(() => setLoaded(previous => new Set([...previous, next])), 2000);
    // Reduced-motion users get the same photos without pan/zoom.
    const advance = still ? setTimeout(() => {
      if (!document.hidden) setActive(next);
    }, reduced ? 16000 : 7000) : undefined;
    videos.current.forEach((video, index) => { if (index !== active) video?.pause(); });
    return () => { clearTimeout(preload); clearTimeout(advance); };
  }, [active, started, still, reduced]);

  async function advanceVideo(index: number) {
    const current = videos.current[index];
    const nextIndex = (index + 1) % scenes.length;
    const next = videos.current[nextIndex];
    if (index !== active || !current || current.currentTime < 6 || !next || next.readyState < 3 || transitioning.current || document.hidden) return;
    transitioning.current = true;
    next.currentTime = 0;
    try { await next.play(); setActive(nextIndex); }
    catch { setStill(true); }
    finally { transitioning.current = false; }
  }

  return (
    <div className="landing-landscape" aria-hidden="true" data-mode={still ? 'photos' : 'video'} data-scene={scenes[active]?.name}>
      {scenes.map((scene, index) => loaded.has(index) && (
        <div key={scene.name} className={`landing-landscape__scene ${active === index ? 'is-active' : ''}`}>
          <img src={index === 0 && !started ? landingPoster : scene.photo} alt="" width={1280} height={720}
            fetchPriority={index === 0 ? 'high' : 'low'} loading={index === 0 ? 'eager' : 'lazy'}
            className={`landing-landscape__media ${still && !reduced && active === index ? 'landing-landscape__pan' : ''}`} />
          {!still && started && <video ref={element => { videos.current[index] = element; }}
            className="landing-landscape__media" poster={index === 0 ? landingPoster : scene.photo}
            muted autoPlay={index === active} playsInline loop preload="auto"
            onTimeUpdate={() => { void advanceVideo(index); }}
            onError={() => setStill(true)}>
            <source src={scene.mp4} type="video/mp4" />
            <source src={scene.webm} type="video/webm" />
          </video>}
        </div>
      ))}
      <div className="landing-landscape__shade" />
    </div>
  );
}