import { useCallback } from 'react';
import Particles from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

export default function ParticleBackground() {
  const particlesInit = useCallback(async (engine) => {
    await loadSlim(engine);
  }, []);

  const options = {
    fullScreen: false,
    fpsLimit: 60,
    particles: {
      color: { value: '#00ff88' },
      links: {
        color: '#00ff88',
        distance: 150,
        enable: true,
        opacity: 0.12,
        width: 1,
      },
      move: {
        enable: true,
        speed: 0.8,
        direction: 'none',
        outModes: { default: 'bounce' },
      },
      number: {
        density: { enable: true, area: 800 },
        value: 50,
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
        grab: { distance: 180, links: { opacity: 0.28 } },
        push: { quantity: 3 },
        repulse: { distance: 100, duration: 0.4 },
      },
    },
    detectRetina: true,
  };

  return (
    <>
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={options}
        className="!absolute inset-0"
      />
      <div className="particle-signal-field" data-particle-signal aria-hidden="true">
        <span className="particle-signal particle-signal-a" />
        <span className="particle-signal particle-signal-b" />
        <span className="particle-signal particle-signal-c" />
      </div>
    </>
  );
}
