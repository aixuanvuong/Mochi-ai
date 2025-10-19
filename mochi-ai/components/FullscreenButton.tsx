import React from 'react';

interface FullscreenButtonProps {
    isFullscreen: boolean;
    onClick: () => void;
}

export const FullscreenButton: React.FC<FullscreenButtonProps> = ({ isFullscreen, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="p-2 rounded-full bg-gray-800 bg-opacity-50 text-white hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-opacity"
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Vào toàn màn hình"}
        >
            {isFullscreen ? (
                // Biểu tượng thu nhỏ
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6m0 0l-7 7M9 21H3v-6m0 0l7-7" />
                </svg>
            ) : (
                // Biểu tượng phóng to
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 0h-4m4 0l-5-5" />
                </svg>
            )}
        </button>
    );
};
