import React, { useState, useEffect, useRef, useCallback } from 'react';

interface MochiProps {
  speed: number;
}

const MochiBase: React.FC<React.PropsWithChildren<MochiProps & { isIdle?: boolean }>> = ({ children, speed, isIdle }) => (
  <svg
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full transition-transform duration-300 transform hover:scale-105"
    style={{ '--animation-duration': `${speed}s` } as React.CSSProperties}
  >
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="2" dy="4" stdDeviation="2" floodColor="#000000" floodOpacity="0.2"/>
      </filter>
    </defs>
    <g filter="url(#shadow)" className={isIdle ? 'animate-sway' : ''}>
      <path
        d="M 50,95 C 20,95 10,75 10,50 C 10,25 20,5 50,5 C 80,5 90,25 90,50 C 90,75 80,95 50,95 Z"
        fill="white"
        stroke="#E5E7EB"
        strokeWidth="1"
        className="animate-squish"
      />
    </g>
    {children}
    <style>{`
      @keyframes squish {
        0%, 100% { transform: scale(1, 1) translateY(0); }
        50% { transform: scale(1.05, 0.95) translateY(2px); }
      }
      .animate-squish {
        animation: squish var(--animation-duration) ease-in-out infinite;
        transform-origin: bottom center;
      }
      @keyframes sway {
        0% { transform: rotate(-1.5deg); }
        100% { transform: rotate(1.5deg); }
      }
      .animate-sway {
        animation: sway calc(var(--animation-duration) * 1.5) ease-in-out infinite alternate;
        transform-origin: 50% 95%;
      }
    `}</style>
  </svg>
);

const Eyes: React.FC<{ leftPath: string; rightPath: string }> = ({ leftPath, rightPath }) => (
    <>
        <path d={leftPath} fill="black" />
        <path d={rightPath} fill="black" />
    </>
);

// --- Reusable Eye Components ---
const NormalEyes = () => <Eyes leftPath="M 35,45 a 5,5 0 1,1 0,0.1" rightPath="M 65,45 a 5,5 0 1,1 0,0.1" />;
const BlinkEyes = () => <Eyes leftPath="M 30,48 h 10" rightPath="M 60,48 h 10" />;
const HappyEyes = () => (
    <>
        <path d="M 32,45 Q 35,40 38,45" stroke="black" strokeWidth="2" fill="none" />
        <path d="M 62,45 Q 65,40 68,45" stroke="black" strokeWidth="2" fill="none" />
    </>
);
const LookLeftEyes = () => <Eyes leftPath="M 30,45 a 5,5 0 1,1 0,0.1" rightPath="M 60,45 a 5,5 0 1,1 0,0.1" />;
const LookRightEyes = () => <Eyes leftPath="M 40,45 a 5,5 0 1,1 0,0.1" rightPath="M 70,45 a 5,5 0 1,1 0,0.1" />;
const SquintEyes = () => (
    <>
        <path d="M 30,45 L 40,50 L 30,55" stroke="black" strokeWidth="2.5" fill="none" />
        <path d="M 70,45 L 60,50 L 70,55" stroke="black" strokeWidth="2.5" fill="none" />
    </>
);
const WinkLeftEyes = () => (
    <>
        <path d="M 30,48 h 10" stroke="black" strokeWidth="2.5" />
        <path d="M 65,45 a 5,5 0 1,1 0,0.1" fill="black" />
    </>
);

const weightedListeningEyePool = [
    NormalEyes, NormalEyes, NormalEyes, NormalEyes, NormalEyes, NormalEyes,
    BlinkEyes, BlinkEyes, BlinkEyes,
    LookLeftEyes,
    LookRightEyes,
    HappyEyes,
];
const speakingEyeComponents = [NormalEyes, BlinkEyes, HappyEyes, SquintEyes, WinkLeftEyes];


export const NormalMochi: React.FC<MochiProps> = (props) => (
  <MochiBase {...props}>
    <NormalEyes />
  </MochiBase>
);

export const BlinkMochi: React.FC<MochiProps> = (props) => (
  <MochiBase {...props}>
    <BlinkEyes />
  </MochiBase>
);

export const LookLeftMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <LookLeftEyes />
    </MochiBase>
);

export const LookRightMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <LookRightEyes />
    </MochiBase>
);

export const HappyMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <HappyEyes />
        <path d="M 40,65 Q 50,75 60,65" stroke="black" strokeWidth="2.5" fill="none" />
    </MochiBase>
);

export const SadMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <NormalEyes />
        <path d="M 40,70 Q 50,60 60,70" stroke="black" strokeWidth="2.5" fill="none" />
    </MochiBase>
);

export const SurprisedMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <circle cx="35" cy="45" r="6" fill="black"/>
        <circle cx="65" cy="45" r="6" fill="black"/>
        <circle cx="50" cy="70" r="7" fill="black"/>
    </MochiBase>
);

export const SquintMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <SquintEyes />
        <path d="M 40,65 Q 50,70 60,65" stroke="black" strokeWidth="2.5" fill="none" />
    </MochiBase>
);

export const WinkLeftMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <WinkLeftEyes />
        <path d="M 40,65 Q 50,75 60,65" stroke="black" strokeWidth="2.5" fill="none" />
    </MochiBase>
);

export const LoveMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <path d="M0 10 C-5 0, 5 0, 0 5 C5 10, -5 15, 0 10Z" transform="translate(35 40) scale(1.5)" fill="#FF4136" />
        <path d="M0 10 C-5 0, 5 0, 0 5 C5 10, -5 15, 0 10Z" transform="translate(65 40) scale(1.5)" fill="#FF4136" />
        <path d="M 40,70 Q 50,80 60,70" stroke="black" strokeWidth="2.5" fill="none" />
    </MochiBase>
);

export const DizzyMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <path d="M 35,45 C 40,40 40,50 35,55 C 30,50 30,40 35,45" stroke="black" strokeWidth="2" fill="none">
             <animateTransform attributeName="transform" type="rotate" from="0 35 47.5" to="360 35 47.5" dur="1s" repeatCount="indefinite" />
        </path>
        <path d="M 65,45 C 70,40 70,50 65,55 C 60,50 60,40 65,45" stroke="black" strokeWidth="2" fill="none">
             <animateTransform attributeName="transform" type="rotate" from="360 65 47.5" to="0 65 47.5" dur="1s" repeatCount="indefinite" />
        </path>
        <path d="M 45,68 h 10" stroke="black" strokeWidth="2.5" />
    </MochiBase>
);

export const AngryMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <path d="M 25,40 L 45,45" stroke="black" strokeWidth="2.5" />
        <path d="M 75,40 L 55,45" stroke="black" strokeWidth="2.5" />
        <Eyes leftPath="M 35,50 a 4,4 0 1,1 0,0.1" rightPath="M 65,50 a 4,4 0 1,1 0,0.1" />
        <path d="M 40,70 L 60,70" stroke="black" strokeWidth="2.5" fill="none" />
    </MochiBase>
);

export const ConfusedMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <path d="M 25,45 L 45,40" stroke="black" strokeWidth="2.5" />
        <path d="M 65,45 a 5,5 0 1,1 0,0.1" fill="black" />
        <path d="M 40,70 C 45,65 55,75 60,70" stroke="black" strokeWidth="2.5" fill="none" />
    </MochiBase>
);

export const SleepyMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <path d="M 30,50 Q 35,55 40,50" stroke="black" strokeWidth="2" fill="none" />
        <path d="M 60,50 Q 65,55 70,50" stroke="black" strokeWidth="2" fill="none" />
        <path d="M 45,68 h 10" stroke="black" strokeWidth="2.5" />
    </MochiBase>
);

export const SleepingMochi: React.FC<MochiProps> = (props) => (
  <MochiBase {...props}>
    {/* Closed, peaceful eyes */}
    <path d="M 30,50 Q 35,55 40,50" stroke="black" strokeWidth="2" fill="none" />
    <path d="M 60,50 Q 65,55 70,50" stroke="black" strokeWidth="2" fill="none" />
    
    {/* A subtle, sleeping mouth */}
    <path d="M 48,68 Q 50,70 52,68" stroke="black" strokeWidth="2" fill="none" />

    {/* Floating "Zzz" particles */}
    <g fill="#A0A0A0" opacity="0.8">
        <text x="75" y="45" fontSize="8" className="animate-zzz">z</text>
        <text x="80" y="35" fontSize="10" className="animate-zzz" style={{ animationDelay: '0.5s' }}>Z</text>
        <text x="83" y="25" fontSize="8" className="animate-zzz" style={{ animationDelay: '1s' }}>z</text>
    </g>
    
    <style>{`
        @keyframes zzz {
            0% { transform: translateY(0) translateX(0); opacity: 0.8; }
            100% { transform: translateY(-20px) translateX(5px); opacity: 0; }
        }
        .animate-zzz {
            animation: zzz 2.5s ease-out infinite;
        }
    `}</style>
  </MochiBase>
);


export const ProudMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <path d="M 30,48 h 10" stroke="black" strokeWidth="2.5" />
        <path d="M 60,48 h 10" stroke="black" strokeWidth="2.5" />
        <path d="M 40,65 C 45,70 55,70 60,65" stroke="black" strokeWidth="2.5" fill="none" />
    </MochiBase>
);

export const KawaiiMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <SquintEyes />
        <path d="M 45,65 Q 50,75 55,65" stroke="black" strokeWidth="2.5" fill="none" />
        <circle cx="28" cy="65" r="5" fill="#FFC0CB" opacity="0.8"/>
        <circle cx="72" cy="65" r="5" fill="#FFC0CB" opacity="0.8"/>
    </MochiBase>
);


export const ListeningMochi: React.FC<MochiProps> = (props) => {
    const [EyeComponent, setEyeComponent] = useState(() => NormalEyes);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() => {
        const changeExpression = () => {
            setEyeComponent(currentEye => {
                let nextEye = currentEye;
                // Ensure the new expression is different from the current one to feel more dynamic
                while (nextEye === currentEye) {
                    const randomIndex = Math.floor(Math.random() * weightedListeningEyePool.length);
                    nextEye = weightedListeningEyePool[randomIndex];
                }
                return nextEye;
            });
            // Schedule the next change with a random delay
            timeoutRef.current = window.setTimeout(changeExpression, Math.random() * 2000 + 500);
        };
        
        // Start the animation cycle
        timeoutRef.current = window.setTimeout(changeExpression, Math.random() * 2000 + 500);

        // Cleanup on unmount
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []); // Empty dependency array ensures this runs only once on mount

    return (
        <MochiBase {...props}>
            <EyeComponent />
            {/* Subtle listening mouth animation */}
            <path d="M 45,70 h 10" stroke="black" strokeWidth="2.5" fill="none" strokeLinecap="round">
                <animate 
                    attributeName="d"
                    dur="calc(var(--animation-duration) / 2)"
                    repeatCount="indefinite"
                    keyTimes="0; 0.5; 1"
                    values="M 45,70 h 10; M 45,70 Q 50,73 55,70; M 45,70 h 10;"
                />
            </path>
        </MochiBase>
    );
};

export const ThinkingMochi: React.FC<MochiProps> = (props) => {
    const [isThinkingHard, setIsThinkingHard] = useState(false);

    useEffect(() => {
        // Switch to a "thinking hard" animation after 3 seconds to show deep thought
        const timer = setTimeout(() => {
            setIsThinkingHard(true);
        }, 3000);

        // Clean up the timer when the component unmounts
        return () => clearTimeout(timer);
    }, []); // Run only on component mount

    return (
        <MochiBase {...props}>
            {/* Furrowed brows indicate concentration */}
            <path d="M 28,40 L 42,43" stroke="black" strokeWidth="2.5" fill="none" />
            <path d="M 72,40 L 58,43" stroke="black" strokeWidth="2.5" fill="none" />

            {isThinkingHard ? (
                <>
                    {/* Spinning, confused eyes for prolonged thinking */}
                    <path d="M 35,47.5 C 40,42.5 40,52.5 35,57.5 C 30,52.5 30,42.5 35,47.5" stroke="black" strokeWidth="2" fill="none">
                        <animateTransform attributeName="transform" type="rotate" from="0 35 50" to="360 35 50" dur="1.2s" repeatCount="indefinite" />
                    </path>
                    <path d="M 65,47.5 C 70,42.5 70,52.5 65,57.5 C 60,52.5 60,42.5 65,47.5" stroke="black" strokeWidth="2" fill="none">
                        <animateTransform attributeName="transform" type="rotate" from="360 65 50" to="0 65 50" dur="1.2s" repeatCount="indefinite" />
                    </path>
                </>
            ) : (
                // Standard thinking animation: eyes scanning side-to-side
                <g className="animate-think-eyes">
                    <circle cx="35" cy="50" r="4" fill="black" />
                    <circle cx="65" cy="50" r="4" fill="black" />
                </g>
            )}

            {/* A neutral, straight mouth */}
            <path d="M 45,68 h 10" stroke="black" strokeWidth="2.5" />

            <style>{`
                @keyframes think-eyes {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px); }
                    75% { transform: translateX(5px); }
                }
                .animate-think-eyes {
                    animation: think-eyes calc(var(--animation-duration) * 0.75) ease-in-out infinite;
                }
            `}</style>
        </MochiBase>
    );
};

export const SpeakingMochi: React.FC<MochiProps> = (props) => {
  const [EyeComponent, setEyeComponent] = useState(() => NormalEyes);

  useEffect(() => {
      const interval = setInterval(() => {
          const randomIndex = Math.floor(Math.random() * speakingEyeComponents.length);
          setEyeComponent(() => speakingEyeComponents[randomIndex]);
      }, 1000); // Change expression every 1 second while speaking

      return () => clearInterval(interval);
  }, []);
    
  return (
    <MochiBase {...props}>
      <EyeComponent />
      <path d="M 40,70 Q 50,70 60,70" stroke="black" strokeWidth="2.5" fill="none" strokeLinecap="round">
        <animate 
          attributeName="d"
          dur="0.35s"
          repeatCount="indefinite"
          keyTimes="0; 0.25; 0.5; 0.75; 1"
          values="
            M 40,70 Q 50,70 60,70; 
            M 40,70 Q 50,82 60,70; 
            M 42,72 Q 50,75 58,72; 
            M 40,70 Q 50,82 60,70; 
            M 40,70 Q 50,70 60,70;"
        />
      </path>
    </MochiBase>
  );
};

export const LoadingMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <circle cx="50" cy="50" r="20" fill="none" stroke="#9CA3AF" strokeWidth="4" strokeDasharray="80" strokeDashoffset="0" className="animate-spin-slow">
             <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="2s" repeatCount="indefinite" />
        </circle>
    </MochiBase>
);

export const ErrorMochi: React.FC<MochiProps> = (props) => (
    <MochiBase {...props}>
        <path d="M 30,40 L 40,50 M 40,40 L 30,50" stroke="black" strokeWidth="2.5" />
        <path d="M 60,40 L 70,50 M 70,40 L 60,50" stroke="black" strokeWidth="2.5" />
        <path d="M 40,70 Q 50,60 60,70" stroke="black" strokeWidth="2.5" fill="none" />
    </MochiBase>
);

export const DeepSleepMochi: React.FC<MochiProps> = (props) => (
    <div className="w-64 h-64 md:w-80 md:h-80">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <g className="animate-pulse-slow">
          {/* Dark gray body, mimicking the idle look but power-saving */}
          <path
            d="M 50,95 C 20,95 10,75 10,50 C 10,25 20,5 50,5 C 80,5 90,25 90,50 C 90,75 80,95 50,95 Z"
            fill="#1F2937" // Dark Gray
            stroke="#4B5563" // Lighter Gray for outline
            strokeWidth="1"
          />
          {/* Static, normal eyes */}
          <path d="M 35,45 a 5,5 0 1,1 0,0.1" fill="#4B5563" />
          <path d="M 65,45 a 5,5 0 1,1 0,0.1" fill="#4B5563" />
          {/* Simple neutral mouth */}
          <path d="M 45,68 h 10" stroke="#4B5563" strokeWidth="2.5" />
        </g>
        <style>{`
          @keyframes pulse-slow {
            0%, 100% { opacity: 0.9; }
            50% { opacity: 0.5; }
          }
          .animate-pulse-slow {
            animation: pulse-slow 8s ease-in-out infinite;
          }
        `}</style>
      </svg>
    </div>
  );