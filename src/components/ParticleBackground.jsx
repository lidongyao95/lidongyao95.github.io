import { useCallback, useMemo } from 'react';
import Particles, { ParticlesProvider } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

export default function ParticleBackground() {
  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  const { fieldStars, milkyWayStars } = useMemo(() => {
    // Scattered field stars — more twinkling and bright stars
    // Coordinates extend beyond viewport (-15 to 115) so drift animation has seamless edges
    const field = [];
    for (let i = 0; i < 160; i++) {
      const x = -15 + Math.random() * 130;
      const y = -15 + Math.random() * 130;
      const isBright = Math.random() < 0.30;
      const size = isBright ? (Math.random() < 0.5 ? 2 : 3) : 1;
      const opacity = isBright ? 0.5 + Math.random() * 0.45 : 0.15 + Math.random() * 0.40;
      const twinkle = Math.random() < 0.55;
      const warm = size >= 2 && Math.random() < 0.45;
      const duration = 2 + Math.random() * 5;
      const delay = Math.random() * 6;
      field.push({ x, y, size, opacity, twinkle, warm, duration, delay, id: `f${i}` });
    }

    // Milky way band — concentrated along a diagonal from bottom-left to upper-right
    // Extended range for drift seamlessness
    const milky = [];
    for (let i = 0; i < 120; i++) {
      const x = -15 + Math.random() * 130;
      const bandCenter = -0.6 * x + 75;
      const spread = (Math.random() - 0.5) * 24;
      const y = Math.max(-15, Math.min(115, bandCenter + spread));
      const size = Math.random() < 0.82 ? 1 : 2;
      const opacity = 0.08 + Math.random() * 0.28;
      const twinkle = Math.random() < 0.25;
      const warm = Math.random() < 0.35;
      const duration = 3 + Math.random() * 6;
      const delay = Math.random() * 8;
      milky.push({ x, y, size, opacity, twinkle, warm, duration, delay, id: `m${i}` });
    }

    return { fieldStars: field, milkyWayStars: milky };
  }, []);

  const options = useMemo(() => ({
    fullScreen: false,
    fpsLimit: 30,
    particles: {
      color: { value: '#e2a045' },
      links: {
        color: '#e2a045',
        distance: 120,
        enable: true,
        opacity: 0.10,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.55,
        direction: 'none',
        outModes: { default: 'bounce' },
      },
      number: {
        density: { enable: true, area: 800 },
        value: 24,
      },
      opacity: { value: 0.3 },
      size: { value: { min: 1, max: 3 } },
    },
    interactivity: {
      events: {
        onClick: { enable: true, mode: ['push', 'bubble', 'repulse'] },
        onHover: { enable: true, mode: 'grab' },
      },
      modes: {
        bubble: { distance: 150, duration: 0.5, opacity: 0.65, size: 5 },
        grab: { distance: 150, links: { opacity: 0.20 } },
        push: { quantity: 3 },
        repulse: { distance: 100, duration: 0.4 },
      },
    },
    detectRetina: false,
  }), []);

  return (
    <>
      <ParticlesProvider init={particlesInit}>
        <Particles
          id="tsparticles"
          options={options}
          className="!absolute inset-0"
        />
      </ParticlesProvider>
      <div className="milky-way-band" aria-hidden="true" />
      <div className="star-field" aria-hidden="true">
        {milkyWayStars.map((s) => (
          <span
            key={s.id}
            className={`star star--milky${s.twinkle ? ' star--twinkle' : ''}${s.warm ? ' star--warm' : ''}`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              '--star-base-opacity': s.opacity,
              animationDuration: s.twinkle ? `${s.duration}s` : undefined,
              animationDelay: s.twinkle ? `${s.delay}s` : undefined,
            }}
          />
        ))}
        {fieldStars.map((s) => (
          <span
            key={s.id}
            className={`star${s.twinkle ? ' star--twinkle' : ''}${s.warm ? ' star--warm' : ''}`}
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              '--star-base-opacity': s.opacity,
              animationDuration: s.twinkle ? `${s.duration}s` : undefined,
              animationDelay: s.twinkle ? `${s.delay}s` : undefined,
            }}
          />
        ))}
      </div>
      <div className="aurora-field" aria-hidden="true">
        <span className="aurora-blob aurora-blob-1" />
        <span className="aurora-blob aurora-blob-2" />
        <span className="aurora-blob aurora-blob-3" />
      </div>
    </>
  );
}
