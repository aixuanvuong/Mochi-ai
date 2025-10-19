import { Modality } from "@google/genai";
import { getAi } from './geminiService';
import { MochiState } from '../types';

interface Alarm {
    id: number;
    time: Date;
    label: string;
    timerId: number;
}

// --- Module-level state ---
const activeAlarms: Alarm[] = [];
let nextAlarmId = 1;

// --- Callbacks to communicate with the UI ---
type AlarmRingCallback = (label: string) => void;
type StateChangeCallback = (state: MochiState, status?: string) => void;

let onAlarmRing: AlarmRingCallback = () => {};
let onStateChange: StateChangeCallback = () => {};

export const registerCallbacks = (ringCb: AlarmRingCallback, stateCb: StateChangeCallback) => {
    onAlarmRing = ringCb;
    onStateChange = stateCb;
};

// --- Helper Functions (copied for independence) ---
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
  
async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
): Promise<AudioBuffer> {
    const sampleRate = 24000;
    const numChannels = 1;
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


const speakAlarm = async (text: string) => {
    onStateChange(MochiState.SPEAKING, `Nhắc nhở: ${text}`);
    try {
        const ai = getAi();
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: `Đã đến giờ ${text}` }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' }, // A different voice for alarms
                  },
              },
            },
        });
        
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext);
            const source = outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(outputAudioContext.destination);
            source.start();
            source.onended = () => {
                outputAudioContext.close();
                // After speaking, go back to idle.
                setTimeout(() => onStateChange(MochiState.IDLE, "Mochi đang nghỉ ngơi..."), 1000);
            };
        } else {
            // Fallback if audio generation fails
             onStateChange(MochiState.IDLE, "Mochi đang nghỉ ngơi...");
        }

    } catch (error) {
        console.error("Không thể phát âm thanh báo thức:", error);
        onStateChange(MochiState.IDLE, "Mochi đang nghỉ ngơi...");
    }
};

export const setAlarm = (time: Date, label: string) => {
    const now = Date.now();
    const delay = time.getTime() - now;

    if (delay < 0) {
        console.warn("Không thể đặt báo thức trong quá khứ.");
        return;
    }

    const id = nextAlarmId++;
    
    const timerId = window.setTimeout(() => {
        // When the timer fires, wake up Mochi and speak the label
        onAlarmRing(label);
        speakAlarm(label);

        // Remove from active list
        const index = activeAlarms.findIndex(a => a.id === id);
        if (index !== -1) {
            activeAlarms.splice(index, 1);
        }
    }, delay);

    const newAlarm: Alarm = { id, time, label, timerId };
    activeAlarms.push(newAlarm);
};

export const cancelAlarm = (id: number) => {
    const index = activeAlarms.findIndex(a => a.id === id);
    if (index !== -1) {
        clearTimeout(activeAlarms[index].timerId);
        activeAlarms.splice(index, 1);
    }
};

export const getActiveAlarms = (): Omit<Alarm, 'timerId'>[] => {
    return activeAlarms.map(({ timerId, ...rest }) => rest);
};
