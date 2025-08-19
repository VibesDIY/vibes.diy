import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import SimpleAppLayout from './SimpleAppLayout';
import VibesDIYLogo from './VibesDIYLogo';
import Basic from './vibespace/Basic';
import Wild from './vibespace/Wild';
import ExplodingBrain from './vibespace/ExplodingBrain';
import Cyberpunk from './vibespace/Cyberpunk';
import type { ReactElement } from 'react';
import { toCloud, useFireproof } from 'use-fireproof';

// Define the structure of our vibe documents
interface VibeDocument {
  _id: string;
  title?: string;
  slug?: string;
  createdAt?: number;
  publishedUrl?: string;
  _attachments?: {
    screenshot?: {
      data: Blob;
    };
  };
}

interface VibespaceComponentProps {
  tildeId?: string;
  atId?: string;
}

function StarfieldEmpty({
  userId,
  prefix,
  userExists,
}: {
  userId: string;
  prefix: string;
  userExists: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);
  const starsRef = useRef<any[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize star field - 3000 stars with shapes
    const initStars = () => {
      starsRef.current = [];
      for (let i = 0; i < 3000; i++) {
        starsRef.current.push({
          x: (Math.random() - 0.5) * 3000,
          y: (Math.random() - 0.5) * 3000,
          z: Math.random() * 1500 + 1,
          prevX: 0,
          prevY: 0,
          color: Math.random() > 0.7 ? 'color' : 'white',
          hue: Math.random() * 360,
          shape: ['circle', 'triangle', 'star'][Math.floor(Math.random() * 3)],
          rotation: Math.random() * Math.PI * 2,
        });
      }
    };
    initStars();

    // Shape drawing functions
    const drawTriangle = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size * 0.866, y + size * 0.5);
      ctx.lineTo(x + size * 0.866, y + size * 0.5);
      ctx.closePath();
      ctx.fill();
    };

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
      const spikes = 5;
      const outerRadius = size;
      const innerRadius = size * 0.4;

      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes;
        const xPos = x + Math.cos(angle) * radius;
        const yPos = y + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(xPos, yPos);
        else ctx.lineTo(xPos, yPos);
      }
      ctx.closePath();
      ctx.fill();
    };

    // Hyperdrive animation loop
    const animate = () => {
      // Subtle color-tinted fade
      ctx.fillStyle = 'rgba(2, 2, 8, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      starsRef.current.forEach((star) => {
        star.prevX = (star.x / star.z) * canvas.width + centerX;
        star.prevY = (star.y / star.z) * canvas.height + centerY;

        // Variable speed - closer stars move faster
        const speed = 20 + (1000 - star.z) / 50;
        star.z -= speed;
        star.rotation += 0.1;

        if (star.z <= 1) {
          star.x = (Math.random() - 0.5) * 3000;
          star.y = (Math.random() - 0.5) * 3000;
          star.z = 1500;
          star.color = Math.random() > 0.7 ? 'color' : 'white';
          star.hue = Math.random() * 360;
          star.shape = ['circle', 'triangle', 'star'][Math.floor(Math.random() * 3)];
          star.rotation = Math.random() * Math.PI * 2;
        }

        const x = (star.x / star.z) * canvas.width + centerX;
        const y = (star.y / star.z) * canvas.height + centerY;

        // Dynamic sizing based on speed and distance
        const size = Math.max(0.1, ((1500 - star.z) / 300) * 4);
        const opacity = Math.min((1500 - star.z) / 1500, 1);
        const intensity = Math.min(speed / 40, 1);

        // Epic trail effects
        const trailLength = size * 2;
        const trailOpacity = opacity * intensity * 0.8;

        if (star.color === 'color') {
          // Very subtle colored star trails
          const trailColor = `hsla(${star.hue}, 8%, 85%, ${trailOpacity})`;
          ctx.strokeStyle = trailColor;
          ctx.lineWidth = Math.max(1, trailLength * 0.6);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(star.prevX, star.prevY);
          ctx.lineTo(x, y);
          ctx.stroke();

          // Subtle colored star core
          const starColor = `hsla(${star.hue}, 6%, 90%, ${opacity})`;
          ctx.fillStyle = starColor;
          ctx.shadowBlur = size * 2;
          ctx.shadowColor = starColor;
        } else {
          // White star trails
          ctx.strokeStyle = `rgba(200, 220, 255, ${trailOpacity})`;
          ctx.lineWidth = Math.max(1, trailLength * 0.4);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(star.prevX, star.prevY);
          ctx.lineTo(x, y);
          ctx.stroke();

          // White star core with subtle blue tint
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.shadowBlur = size * 1.5;
          ctx.shadowColor = `rgba(210, 220, 255, ${opacity * 0.8})`;
        }

        // Save ctx for rotation
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(star.rotation);
        ctx.translate(-x, -y);

        // Draw the star shape
        switch (star.shape) {
          case 'circle':
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'triangle':
            drawTriangle(ctx, x, y, size);
            break;
          case 'star':
            drawStar(ctx, x, y, size);
            break;
        }

        ctx.restore();
        ctx.shadowBlur = 0;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* White overlay that fades out */}
      <div className="absolute inset-0 z-10 animate-[fadeOut_0.5s_ease-out_forwards] bg-white"></div>

      {/* Full-screen clickable overlay */}
      <a href="/vibes/mine" className="absolute inset-0 z-20 block cursor-pointer"></a>

      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* EMPTY SPACE Text - Black with white shadow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="animate-[epicMarquee_24s_linear_infinite] whitespace-nowrap">
          <span
            className="transform-gpu font-black tracking-[0.4em] text-black [text-shadow:0_0_40px_rgba(255,255,255,1),0_0_80px_rgba(255,255,255,0.9),0_0_120px_rgba(255,255,255,0.8),0_0_200px_rgba(255,255,255,0.6)]"
            style={{
              fontSize: 'clamp(8rem, 20vw, 30rem)',
              filter: 'brightness(1.3) contrast(1.2)',
              WebkitTextStroke: '4px rgba(255,255,255,0.3)',
            }}
          >
            {userExists ? 'EMPTY SPACE' : 'SPACE NOT FOUND'}
          </span>
        </div>
      </div>

      {/* Instructions overlay */}
      {userExists && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-30 -translate-x-1/2 transform text-center">
          <div
            className="font-bold tracking-wider text-white"
            style={{
              fontSize: 'clamp(1.5rem, 4vw, 3rem)',
              textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px rgba(255, 255, 255, 0.5)',
              fontFamily: 'Impact, Arial Black, sans-serif',
            }}
          >
            STAR ANY PUBLISHED VIBE ON <span className="text-blue-200">/VIBES/MINE</span> TO LIST IT
            HERE
          </div>
        </div>
      )}

      {/* User ID display */}
      <div className="pointer-events-none absolute top-20 left-1/2 z-30 -translate-x-1/2 transform text-center">
        <div
          className="font-mono text-gray-300"
          style={{
            fontSize: 'clamp(1rem, 3vw, 2rem)',
            textShadow: '0 0 10px rgba(255, 255, 255, 0.3)',
          }}
        >
          {prefix}
          {userId}
        </div>
      </div>

      {/* Home link */}
      <div className="pointer-events-none absolute bottom-8 left-1/2 z-30 -translate-x-1/2 transform">
        <div
          className="font-mono tracking-wide text-gray-300"
          style={{
            textShadow: '0 0 10px rgba(255, 255, 255, 0.5)',
          }}
        >
          GO TO /VIBES/MINE
        </div>
      </div>

      {/* Epic marquee animation */}
      <style>{`
        @keyframes epicMarquee {
          0% {
            transform: translateX(100%) scale(1);
          }
          25% {
            transform: translateX(50%) scale(1.05);
          }
          50% {
            transform: translateX(0%) scale(1);
          }
          75% {
            transform: translateX(-50%) scale(1.05);
          }
          100% {
            transform: translateX(-100%) scale(1);
          }
        }

        @keyframes fadeOut {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default function VibespaceComponent({
  tildeId,
  atId,
}: VibespaceComponentProps): ReactElement {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const theme = searchParams.get('theme');
  const isWild = theme === 'wild';
  const isExplodingBrain = theme === 'exploding-brain';
  const isCyberpunk = theme === 'cyberpunk';

  // Determine the userId from either tildeId or atId
  const userId = tildeId || atId;
  const prefix = tildeId ? '~' : '@';

  if (!userId) {
    return <div>Invalid user space</div>;
  }

  // Use Fireproof with the user-specific database
  const { useAllDocs } = useFireproof(`vu-${userId}`, { attach: toCloud() });

  // Query all documents in the database
  const allDocsResult = useAllDocs() as { docs: VibeDocument[] };
  const docs = allDocsResult.docs || [];
  const isLoading = !allDocsResult.docs; // If docs is undefined, it's still loading

  // Type the documents properly
  const vibes = docs.sort((b, a) => (a.createdAt || 0) - (b.createdAt || 0)) as VibeDocument[];

  // If we have a userId from the path, assume the user exists
  // The database will be created when they first create a vibe
  const userExists = true;
  const hasVibes = vibes.length > 0;

  // If user has no vibes, show starfield
  if (!isLoading && !hasVibes) {
    return <StarfieldEmpty userId={userId} prefix={prefix} userExists={userExists} />;
  }

  // Create URL for theme switching
  const createThemeUrl = (themeParam: string | null) => {
    const newSearchParams = new URLSearchParams(location.search);
    if (themeParam) {
      newSearchParams.set('theme', themeParam);
    } else {
      newSearchParams.delete('theme');
    }
    return `/${prefix}${userId}?${newSearchParams.toString()}`;
  };

  return (
    <SimpleAppLayout
      headerLeft={
        <div className="flex w-full items-center justify-between">
          <a href="/" className="flex items-center px-2 py-1 hover:opacity-80" title="Home">
            <VibesDIYLogo width={100} className="pointer-events-none" />
          </a>
          <div className="mr-4 flex items-center space-x-2 text-sm">
            <span className="mr-1 text-gray-500">Theme:</span>
            <a
              href={createThemeUrl(null)}
              className={`rounded px-2 py-1 ${!theme ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-100'}`}
            >
              Basic
            </a>
            <a
              href={createThemeUrl('wild')}
              className={`rounded px-2 py-1 ${isWild ? 'bg-green-100 text-green-800' : 'hover:bg-gray-100'}`}
            >
              Wild
            </a>
            <a
              href={createThemeUrl('exploding-brain')}
              className={`rounded px-2 py-1 ${isExplodingBrain ? 'bg-purple-100 text-purple-800' : 'hover:bg-gray-100'}`}
            >
              Brain
            </a>
            <a
              href={createThemeUrl('cyberpunk')}
              className={`rounded px-2 py-1 ${isCyberpunk ? 'bg-pink-100 text-pink-800' : 'hover:bg-gray-100'}`}
            >
              Cyberpunk
            </a>
          </div>
          <div className="items-right mr-4 flex space-x-2 text-sm italic">
            Profiles will be public at the end of the tech preview.
          </div>
        </div>
      }
    >
      {isExplodingBrain ? (
        <ExplodingBrain userId={userId} vibes={vibes} isLoading={isLoading} />
      ) : isWild ? (
        <Wild userId={userId} vibes={vibes} isLoading={isLoading} />
      ) : isCyberpunk ? (
        <Cyberpunk userId={userId} vibes={vibes} isLoading={isLoading} />
      ) : (
        <Basic userId={userId} vibes={vibes} isLoading={isLoading} />
      )}
    </SimpleAppLayout>
  );
}
