import React, { useState } from 'react';
import { UserProfile } from '../types';

interface UserInfoFormProps {
    onSubmit: (profile: UserProfile) => void;
}

export const UserInfoForm: React.FC<UserInfoFormProps> = ({ onSubmit }) => {
    const [name, setName] = useState('');
    const [gender, setGender] = useState('');
    const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
    const [location, setLocation] = useState<{ latitude: number, longitude: number } | null>(null);

    const handleLocationRequest = () => {
        if (!navigator.geolocation) {
            setLocationStatus('denied');
            return;
        }
        setLocationStatus('requesting');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                setLocationStatus('granted');
            },
            () => {
                setLocationStatus('denied');
            }
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && gender) {
            const profile: UserProfile = { name: name.trim(), gender };
            if (location) {
                profile.location = location;
            }
            onSubmit(profile);
        }
    };

    const isFormValid = name.trim() !== '' && gender !== '';

    const locationButtonContent = () => {
        switch (locationStatus) {
            case 'requesting':
                return (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang lấy vị trí...
                    </>
                );
            case 'granted':
                return '✅ Đã cấp quyền truy cập';
            case 'denied':
                return '❌ Không thể truy cập vị trí';
            case 'idle':
            default:
                return 'Chia sẻ vị trí';
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen font-sans bg-black p-4 text-white">
            <div className="w-full max-w-sm p-8 space-y-6 bg-gray-900 border border-gray-700 rounded-lg shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold">Chào mừng bạn đến với trợ lý Mochi</h1>
                    <p className="mt-2 text-gray-400">Vui lòng cho chúng tôi biết một chút về bạn để cá nhân hóa trải nghiệm.</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-300">
                            Tên của bạn
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 text-white bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Ví dụ: An"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-3 text-sm font-medium text-gray-300">Giới tính của bạn</label>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                           {['Nam', 'Nữ', 'Khác'].map((option) => (
                                <label key={option} className="flex-grow">
                                    <input
                                        type="radio"
                                        name="gender"
                                        value={option}
                                        checked={gender === option}
                                        onChange={(e) => setGender(e.target.value)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-full py-2 px-4 text-center text-gray-300 bg-gray-800 border-2 border-gray-700 rounded-lg cursor-pointer peer-checked:bg-blue-600 peer-checked:border-blue-500 peer-checked:text-white transition-colors">
                                        {option}
                                    </div>
                                </label>
                           ))}
                        </div>
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-300">Dự báo thời tiết (Tùy chọn)</label>
                        <p className="text-xs text-gray-400 mb-3">Chia sẻ vị trí để Mochi có thể cung cấp dự báo thời tiết chính xác khi ở chế độ chờ.</p>
                        <button 
                            type="button" 
                            onClick={handleLocationRequest} 
                            disabled={locationStatus === 'requesting' || locationStatus === 'granted'}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-white bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {locationButtonContent()}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={!isFormValid}
                        className={`w-full px-5 py-3 text-base font-medium text-center text-white rounded-lg focus:ring-4 focus:outline-none transition-all duration-300
                            ${!isFormValid
                                ? 'bg-gray-600 cursor-not-allowed'
                                : 'bg-blue-700 hover:bg-blue-800 focus:ring-blue-300'
                            }
                        `}
                    >
                        Bắt đầu trò chuyện
                    </button>
                </form>
            </div>
        </div>
    );
};