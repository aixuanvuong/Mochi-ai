import React from 'react';
import { ChatMessage } from '../types';

interface EphemeralDisplayProps {
    transcription: ChatMessage | null;
    statusText?: string | null;
    userName: string;
}

export const EphemeralDisplay: React.FC<EphemeralDisplayProps> = ({ transcription, statusText, userName }) => {
    const displayMessage = transcription?.text ? transcription : (statusText ? { speaker: 'mochi' as const, text: statusText } : null);

    if (!displayMessage || !displayMessage.text) {
        return null;
    }

    const { speaker, text } = displayMessage;

    const isStatusMessage = !transcription?.text && statusText;

    const speakerLabel = speaker === 'user' ? userName : 'Mochi';
    const speakerColor = speaker === 'user' ? 'text-blue-400' : 'text-purple-400';

    const key = `${speaker}-${text}`;

    return (
        <div key={key} className="w-full flex items-center justify-center landscape:justify-start p-3 overflow-hidden" aria-live="polite">
            <div className="w-full animate-fade-in">
                {isStatusMessage ? (
                     <p 
                        className="text-lg text-center landscape:text-left text-gray-300 italic"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
                     >
                        {text}
                    </p>
                ) : (
                    <p 
                        className="text-lg text-center landscape:text-left text-gray-200 break-words"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
                    >
                        <span className={`font-bold ${speakerColor}`}>{speakerLabel}: </span>
                        {text}
                    </p>
                )}
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};