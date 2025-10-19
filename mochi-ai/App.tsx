import React, { useState, useEffect, useCallback, useRef } from 'react';
import MochiDisplay from './components/MochiDisplay';
import { UserInfoForm } from './components/UserInfoForm';
import { EphemeralDisplay } from './components/EphemeralDisplay';
import { MochiState, UserProfile, ChatMessage } from './types';
import * as geminiService from './services/geminiService';
import * as alarmService from './services/alarmService';
import Clock from './components/Clock';
import { FullscreenButton } from './components/FullscreenButton';
import { DeepSleepMochi } from './components/MochiExpressions';

const App: React.FC = () => {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [shouldStartSession, setShouldStartSession] = useState(false);
    
    const [mochiState, setMochiState] = useState<MochiState>(MochiState.IDLE);
    const [statusText, setStatusText] = useState<string>('');
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [currentTranscription, setCurrentTranscription] = useState<ChatMessage | null>(null);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [areControlsVisible, setAreControlsVisible] = useState(true);
    const controlsTimeoutRef = useRef<number | null>(null);
    
    const [pixelOffset, setPixelOffset] = useState({ x: 0, y: 0 });
    
    // --- Power Saving Mode State ---
    const [isPowerSaving, setIsPowerSaving] = useState(false);
    const inactivityTimerRef = useRef<number | null>(null);
    const mochiStateRef = useRef(mochiState);
    const INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 phút

    const speed = 2.5;
    const delay = 1800;

    // Keep a ref to the current mochi state to avoid stale closures in the timer callback
    useEffect(() => {
        mochiStateRef.current = mochiState;
    }, [mochiState]);

    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }
        setIsPowerSaving(false); // Ngay lập tức đánh thức màn hình

        inactivityTimerRef.current = window.setTimeout(() => {
            // Chỉ vào chế độ tiết kiệm pin nếu Mochi đang rảnh hoặc đang ngủ
            if (mochiStateRef.current === MochiState.IDLE || mochiStateRef.current === MochiState.SLEEPING) {
                setIsPowerSaving(true);
            }
        }, INACTIVITY_TIMEOUT);
    }, []);

    // Effect for anti-burn-in pixel shifting
    useEffect(() => {
        let intervalId: number | null = null;
        
        // Anti-burn-in is active in any static screen state (Idle, Sleeping, or Power Saving AOD)
        if (isPowerSaving || mochiState === MochiState.IDLE || mochiState === MochiState.SLEEPING) {
            const positions = [
                { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
                { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
                { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 0, y: 0 },
            ];
            let positionIndex = 0;

            intervalId = window.setInterval(() => {
                positionIndex = (positionIndex + 1) % positions.length;
                setPixelOffset(positions[positionIndex]);
            }, 60000); // Every 60 seconds
        }

        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
            // Reset position when state is no longer static
            setPixelOffset({ x: 0, y: 0 });
        };
    }, [mochiState, isPowerSaving]);

    useEffect(() => {
        const savedProfile = localStorage.getItem('mochiUserProfile');
        if (savedProfile) {
            setUserProfile(JSON.parse(savedProfile));
        }
    }, []);

    // Register alarm callbacks
    useEffect(() => {
        alarmService.registerCallbacks(
            (label) => { // onAlarmRing
                // Wake the screen up immediately when an alarm is triggered.
                resetInactivityTimer();
                setStatusText(`Nhắc nhở: ${label}`);
            },
            (newState) => { // onStateChange
                setMochiState(newState);
            }
        );
    }, [resetInactivityTimer]);

    const handleProfileSubmit = (profile: UserProfile) => {
        setUserProfile(profile);
        localStorage.setItem('mochiUserProfile', JSON.stringify(profile));
        setShouldStartSession(true);
    };

    const handleStateChange = useCallback((newState: MochiState, newStatus?: string) => {
      setMochiState(newState);
      setStatusText(newStatus || '');
    }, []);
  
    const handleHistoryUpdate = useCallback((newHistory: ChatMessage[]) => {
    }, []);
  
    const handleTranscriptionUpdate = useCallback((message: ChatMessage | null) => {
      setCurrentTranscription(message);
    }, []);
  
    const startSession = useCallback(async () => {
      if (isSessionActive || !userProfile) return;
  
      setIsSessionActive(true);
      setCurrentTranscription(null);
      await geminiService.startLiveSession(
        handleStateChange, 
        handleHistoryUpdate, 
        handleTranscriptionUpdate,
        userProfile
      );
    }, [isSessionActive, userProfile, handleStateChange, handleHistoryUpdate, handleTranscriptionUpdate]);
  
    const stopSession = useCallback(() => {
      if (!isSessionActive || !userProfile) return;
      geminiService.stopLiveSession(userProfile.name);
      setIsSessionActive(false);
    }, [isSessionActive, userProfile]);
  
    const handleMochiDoubleClick = useCallback(() => {
        resetInactivityTimer(); // Any interaction should wake Mochi
        if (!isSessionActive) {
            startSession();
        } else {
            if (mochiState === MochiState.SLEEPING) {
                geminiService.wakeUpMochi();
            } else {
                stopSession();
            }
        }
    }, [isSessionActive, mochiState, startSession, stopSession, resetInactivityTimer]);
    
    useEffect(() => {
      if (shouldStartSession) {
        startSession();
        setShouldStartSession(false); 
      }
    }, [shouldStartSession, startSession]);
  
    // Effect to reset inactivity timer when Mochi becomes active
    useEffect(() => {
        if (
            mochiState === MochiState.LISTENING ||
            mochiState === MochiState.THINKING ||
            mochiState === MochiState.SPEAKING
        ) {
            resetInactivityTimer();
        }
    }, [mochiState, resetInactivityTimer]);

    // Effect to handle entering deep sleep via voice command
    useEffect(() => {
        if (mochiState === MochiState.ENTERING_DEEP_SLEEP) {
            setIsPowerSaving(true);
            // After triggering power saving, Mochi is effectively sleeping.
            // This also ensures the burn-in effect gets activated correctly.
            setMochiState(MochiState.SLEEPING);
            setStatusText("Mochi đang ngủ sâu. Chạm hoặc gọi để đánh thức.");
        }
    }, [mochiState]);

    const handleUserActivity = useCallback(() => {
        resetInactivityTimer();

        if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
        }
        setAreControlsVisible(true);
        controlsTimeoutRef.current = window.setTimeout(() => {
            setAreControlsVisible(false);
        }, 3000);
    }, [resetInactivityTimer]);

    useEffect(() => {
        resetInactivityTimer();
        
        return () => {
            if (inactivityTimerRef.current) {
                clearTimeout(inactivityTimerRef.current);
            }
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [resetInactivityTimer]);

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    const toggleFullscreen = useCallback(() => {
        handleUserActivity(); 
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.error);
        } else {
            document.exitFullscreen().catch(console.error);
        }
    }, [handleUserActivity]);
    
    const isStatusState = mochiState === MochiState.IDLE || mochiState === MochiState.SLEEPING || mochiState === MochiState.ERROR || mochiState === MochiState.LOADING || mochiState === MochiState.SPEAKING;

    if (!userProfile) {
        return <UserInfoForm onSubmit={handleProfileSubmit} />;
    }

    return (
      <div 
        className="relative flex flex-col items-center justify-center min-h-screen font-sans bg-black p-4 text-white outline-none transition-all duration-1000"
        onMouseMove={handleUserActivity}
        onMouseDown={handleUserActivity}
        onTouchStart={handleUserActivity}
        onKeyDown={handleUserActivity}
        tabIndex={-1}
      >
        <div className={`absolute top-4 right-4 z-50 transition-opacity duration-500 ${areControlsVisible && !isPowerSaving ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <FullscreenButton isFullscreen={isFullscreen} onClick={toggleFullscreen} />
        </div>

        {isPowerSaving ? (
            <div
                className="flex flex-col items-center justify-center flex-1 animate-fade-in"
                style={{
                    transform: `translate(${pixelOffset.x}px, ${pixelOffset.y}px)`,
                    transition: 'transform 2s ease-in-out'
                }}
                onDoubleClick={handleMochiDoubleClick}
            >
                <DeepSleepMochi speed={speed} />
                <div className="mt-4">
                    <Clock variant="aod" />
                </div>
            </div>
        ) : (
            <>
                {mochiState !== MochiState.IDLE && mochiState !== MochiState.SLEEPING && (
                    <div className="absolute top-4 right-20 z-40 hidden landscape:block animate-fade-in-slow transition-opacity duration-500">
                        <Clock variant="chat" />
                    </div>
                )}

                <main 
                    className="flex flex-col landscape:flex-row items-center justify-center w-full max-w-screen-xl mx-auto gap-4 landscape:gap-8 flex-1"
                    style={{
                        transform: `translate(${pixelOffset.x}px, ${pixelOffset.y}px)`,
                        transition: 'transform 2s ease-in-out'
                    }}
                >
                    <div className="w-full landscape:w-1/2 flex flex-col items-center justify-center">
                        <div className="h-24 flex items-end pb-4 landscape:hidden">
                            {(mochiState === MochiState.IDLE || mochiState === MochiState.SLEEPING) && (
                                <Clock variant="idle" location={userProfile.location} />
                            )}
                        </div>
                        
                        <MochiDisplay 
                            state={mochiState} 
                            speed={speed} 
                            delay={delay}
                            onDoubleClick={handleMochiDoubleClick}
                        />
                    </div>

                    <div className="w-full landscape:w-1/2 flex items-center justify-center h-24 landscape:h-auto">
                        {mochiState === MochiState.IDLE || mochiState === MochiState.SLEEPING ? (
                            <div className="hidden landscape:flex w-full h-full items-center justify-center">
                                <Clock variant="idle" location={userProfile.location}/>
                            </div>
                        ) : (
                            <EphemeralDisplay 
                                transcription={currentTranscription} 
                                statusText={isStatusState ? statusText : null}
                                userName={userProfile.name} 
                            />
                        )}
                    </div>
                </main>
            </>
        )}
      </div>
    );
};

export default App;