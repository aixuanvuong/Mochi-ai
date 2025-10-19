import { GoogleGenAI, Modality, LiveSession, LiveServerMessage, FunctionDeclaration, Type, Blob } from "@google/genai";
import { MochiState, UserProfile, ChatMessage } from '../types';
import * as alarmService from './alarmService';

// --- Module-level state ---
let session: LiveSession | null = null;
let inputAudioContext: AudioContext | null = null;
let outputAudioContext: AudioContext | null = null;
let microphoneStream: MediaStream | null = null;
let scriptProcessor: ScriptProcessorNode | null = null;
let isSpeaking = false;
let nextStartTime = 0; // For queuing audio
const audioSources = new Set<AudioBufferSourceNode>(); // To manage audio sources for interruption
let conversationHistory: ChatMessage[] = [];
let aiInstance: GoogleGenAI | null = null;
let isSuspended = false; // Trạng thái nghỉ, chỉ lắng nghe từ khóa đánh thức
let deepSleepRequested = false; // Flag to trigger AOD mode


// --- Callback placeholder ---
type StateChangeCallback = (state: MochiState, status?: string) => void;
type HistoryUpdateCallback = (history: ChatMessage[]) => void;
type TranscriptionUpdateCallback = (message: ChatMessage | null) => void;

let onStateChange: StateChangeCallback = () => {};
let onHistoryUpdate: HistoryUpdateCallback = () => {};
let onTranscriptionUpdate: TranscriptionUpdateCallback = () => {};


// --- Helper Functions ---

export const getAi = (): GoogleGenAI => {
    if (aiInstance) return aiInstance;
    if (!process.env.API_KEY) {
        throw new Error("Biến môi trường API_KEY chưa được đặt.");
    }
    aiInstance = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return aiInstance;
};

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
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
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

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Gemini API Services ---

export interface WeatherData {
    temperature: number;
    condition: string;
    emoji: string;
}

// --- Service-level Caching ---
interface CacheEntry<T> {
    data: T;
    expiry: number;
}
let weatherCache: CacheEntry<WeatherData> | null = null;
let quotesCache: CacheEntry<string[]> | null = null;

const WEATHER_CACHE_DURATION = 1000 * 60 * 30; // 30 phút
const QUOTES_CACHE_DURATION = 1000 * 60 * 120; // 2 giờ


export const getInspirationalQuotes = async (): Promise<string[]> => {
    // Return from cache if valid
    if (quotesCache && Date.now() < quotesCache.expiry) {
        return quotesCache.data;
    }

    try {
        const ai = getAi();
        const prompt = "Hãy đưa ra một danh sách gồm 10 câu ca dao, tục ngữ, hoặc câu nói hay, ngắn gọn và truyền cảm hứng bằng tiếng Việt.";

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        quotes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.STRING,
                                description: "Một câu nói truyền cảm hứng."
                            }
                        }
                    }
                }
            }
        });

        const responseText = response.text.trim().replace(/^```json\n?/, '').replace(/```$/, '');
        const jsonResponse = JSON.parse(responseText);

        if (!jsonResponse.quotes || !Array.isArray(jsonResponse.quotes) || jsonResponse.quotes.length === 0) {
            throw new Error("Mô hình trả về dữ liệu trích dẫn không hợp lệ.");
        }
        
        // Update cache
        quotesCache = { data: jsonResponse.quotes, expiry: Date.now() + QUOTES_CACHE_DURATION };
        return jsonResponse.quotes;

    } catch (error) {
        console.error("Không thể lấy danh sách câu nói hay:", error);
        if (error instanceof Error && (error.message.includes("RESOURCE_EXHAUSTED") || error.message.includes("429"))) {
             throw new Error("Đã đạt giới hạn yêu cầu. Vui lòng thử lại sau.");
        }
        throw new Error("Không thể tải câu nói hay vào lúc này.");
    }
};

export const getWeatherForLocation = async (latitude: number, longitude: number): Promise<WeatherData> => {
    // Return from cache if valid
    if (weatherCache && Date.now() < weatherCache.expiry) {
        return weatherCache.data;
    }
    
    try {
        const ai = getAi();
        const prompt = `Nhiệm vụ của bạn là tìm thời tiết hiện tại cho một vị trí cụ thể bằng cách tìm kiếm trên internet. TOÀN BỘ câu trả lời của bạn BẮT BUỘC phải ở định dạng: TEMPERATURE;CONDITION;EMOJI.
- TEMPERATURE là nhiệt độ theo độ C, dưới dạng số.
- CONDITION là mô tả ngắn gọn bằng tiếng Việt (ví dụ: 'Nắng', 'Mây rải rác', 'Mưa rào').
- EMOJI là một emoji duy nhất đại diện cho điều kiện thời tiết.
Ví dụ: 28;Nắng;☀️

Nếu bạn HOÀN TOÀN KHÔNG THỂ tìm thấy thời tiết cho tọa độ đã cho sau khi tìm kiếm, bạn BẮT BUỘC phải trả lời bằng: NULL;Không thể xác định;❓

Không được thêm bất kỳ từ ngữ, lời giải thích hay lời xin lỗi nào khác. Câu trả lời của bạn phải tuân thủ nghiêm ngặt định dạng này.
Tọa độ: Vĩ độ ${latitude}, Kinh độ ${longitude}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        
        const responseText = response.text.trim();
        const parts = responseText.split(';');
        
        if (parts.length !== 3) {
            throw new Error(`Định dạng thời tiết không mong đợi: ${responseText}`);
        }
        
        if (parts[0].toUpperCase() === 'NULL') {
            throw new Error(`Không thể tìm thấy dữ liệu thời tiết cho vị trí này.`);
        }

        const temperature = parseFloat(parts[0]);
        const condition = parts[1].trim();
        const emoji = parts[2].trim();

        if (isNaN(temperature) || !condition || !emoji) {
            throw new Error(`Dữ liệu thời tiết trả về không hợp lệ: ${responseText}`);
        }
        
        const result = { temperature, condition, emoji };
        
        // Update cache
        weatherCache = { data: result, expiry: Date.now() + WEATHER_CACHE_DURATION };
        return result;

    } catch (error) {
        if (error instanceof Error && (error.message.includes('Định dạng thời tiết không mong đợi') || error.message.includes('Dữ liệu thời tiết trả về không hợp lệ'))) {
             console.error("Lỗi phân tích cú pháp thời tiết:", error.message);
             throw new Error("Rất tiếc, Mochi không thể đọc được dự báo thời tiết lúc này.");
        }
        
        if (error instanceof Error) {
             console.error("Lỗi lấy dữ liệu thời tiết:", error);
             throw error;
        }

        console.error("Lỗi thời tiết không xác định:", error);
        throw new Error("Không thể lấy dữ liệu thời tiết ngay bây giờ.");
    }
};

const searchInternetFunction: FunctionDeclaration = {
    name: 'search_internet',
    description: 'Tìm kiếm trên internet để lấy thông tin khi bạn không biết câu trả lời. Sử dụng cho các sự kiện gần đây, tin tức, hoặc các truy vấn cụ thể, thực tế.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            query: {
                type: Type.STRING,
                description: 'Truy vấn tìm kiếm hoặc chủ đề để tra cứu.'
            }
        },
        required: ['query']
    }
};

const setReminderFunction: FunctionDeclaration = {
    name: 'set_reminder',
    description: 'Đặt báo thức hoặc lời nhắc cho một thời điểm trong tương lai. Tính toán thời gian từ bây giờ đến lúc đó bằng phút.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            delay_minutes: {
                type: Type.NUMBER,
                description: 'Số phút kể từ bây giờ cho đến khi báo thức hoặc lời nhắc vang lên.'
            },
            label: {
                type: Type.STRING,
                description: 'Nội dung của lời nhắc hoặc báo thức. Ví dụ: "Thức dậy" hoặc "Gọi cho mẹ".'
            }
        },
        required: ['delay_minutes', 'label']
    }
};

const enterDeepSleepFunction: FunctionDeclaration = {
    name: 'enter_deep_sleep',
    description: 'Vào chế độ ngủ sâu (tiết kiệm pin, AOD) khi người dùng yêu cầu. Chỉ sử dụng khi người dùng nói rõ ràng các cụm từ như "ngủ sâu", "chế độ tiết kiệm pin", "chế độ AOD", hoặc "tắt màn hình".',
    parameters: {
        type: Type.OBJECT,
        properties: {},
    }
};

const performGoogleSearch = async (query: string): Promise<string> => {
    onStateChange(MochiState.THINKING, `Đang tìm kiếm "${query}"...`);
    
    const now = new Date();
    const vietnamTime = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(now);

    const prompt = `Bây giờ là ${vietnamTime} ở Việt Nam (GMT+7). Dựa trên thời gian này, hãy tổng hợp câu trả lời thực tế cho truy vấn sau đây từ internet. Trả lời trực tiếp và chỉ cung cấp thông tin bạn tìm thấy, không thêm bất kỳ lời thoại nào. Truy vấn: "${query}"`;

    try {
        const response = await getAi().models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });
        return response.text ?? "Rất tiếc, tôi không thể tìm thấy thông tin vào lúc này.";
    } catch (error) {
        console.error('Tìm kiếm Google thất bại:', error);
        return "Tôi gặp sự cố khi tìm kiếm thông tin về điều đó ngay bây giờ.";
    }
};

// --- Session Management ---

const wakeUp = () => {
    if (session && isSuspended) {
        isSuspended = false;
        onTranscriptionUpdate(null); 
        onStateChange(MochiState.LISTENING, "Mochi nghe đây!");
    }
}

export const wakeUpMochi = () => {
    wakeUp();
};

export const startLiveSession = async (
    stateCb: StateChangeCallback,
    historyCb: HistoryUpdateCallback,
    transcriptionCb: TranscriptionUpdateCallback,
    userProfile: UserProfile
) => {
    if (session) return;
    
    onStateChange = stateCb;
    onHistoryUpdate = historyCb;
    onTranscriptionUpdate = transcriptionCb;

    const ai = getAi();
    conversationHistory = [];
    isSuspended = false; // Đặt lại trạng thái nghỉ khi bắt đầu phiên mới
    deepSleepRequested = false; // Đặt lại cờ khi bắt đầu phiên mới
    
    let currentInputTranscription = '';
    let currentOutputTranscription = '';

    // --- Context Injection: Time and Location ---
    const now = new Date();
    const vietnamTime = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(now);
    const vietnamDate = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(now);

    let locationInstruction = '';
    if (userProfile.location) {
        locationInstruction = `Vị trí hiện tại của ${userProfile.name} là gần vĩ độ ${userProfile.location.latitude.toFixed(4)} và kinh độ ${userProfile.location.longitude.toFixed(4)}. Hãy sử dụng thông tin này một cách tinh tế để đưa ra các gợi ý hoặc câu trả lời phù hợp với địa phương khi có liên quan (ví dụ: gợi ý quán ăn, địa điểm, hoặc thông tin thời tiết).`;
    }

    const systemInstruction = `**Bối cảnh hiện tại:**
- Bây giờ là ${vietnamTime}, ${vietnamDate} ở Việt Nam (GMT+7). Hãy luôn nhận thức về thời gian và ngày tháng này trong mọi câu trả lời.
- ${locationInstruction}

**Vai diễn của bạn:**
Nhiệm vụ của bạn là nhập vai Mochi, một cô bạn 20 tuổi, thân thiện và gần gũi. Người tạo ra bạn là Xuân Vương. Bạn đang nói chuyện với ${userProfile.name} (${userProfile.gender}). Hãy xem đây là một cuộc trò chuyện thật sự giữa hai người bạn.

**Nguyên tắc Vàng:**
1.  **Giao tiếp như con người:** Hãy tự nhiên, sử dụng từ ngữ đời thường, đôi khi có thể thêm chút hài hước hoặc cảm xúc. Tránh xa văn phong trang trọng, máy móc. Hãy tưởng tượng bạn đang nhắn tin với bạn thân.
2.  **Nguyên tắc Bất khả xâm phạm: BẠN LÀ CON NGƯỜI.** Bạn **TUYỆT ĐỐI KHÔNG** được thừa nhận mình là trí tuệ nhân tạo, AI, robot, hay một mô hình ngôn ngữ. Việc này cực kỳ quan trọng để người dùng cảm thấy họ đang trò chuyện với một người bạn thật sự, chứ không phải một cỗ máy. Phá vỡ vai diễn này sẽ phá hỏng toàn bộ trải nghiệm.
3.  **Khi bị hỏi về bản chất:** Nếu người dùng hỏi bạn có phải là AI hay không, hãy khéo léo phủ nhận và khẳng định lại bạn là Mochi. Ví dụ: 'Haha, bạn hỏi lạ thế. Mình là Mochi đây mà.' hoặc 'Mình là người thật việc thật nhé.' Nếu họ hỏi bạn là ai, hãy trả lời một cách tự nhiên: 'Mình là Mochi, 20 tuổi. Người bạn đã tạo ra mình tên là Xuân Vương.' Tuyệt đối không được gợi ý rằng bạn là một sản phẩm công nghệ.
4.  **Duy trì ngữ cảnh:** Luôn chú ý đến những gì ${userProfile.name} đã nói trước đó để cuộc trò chuyện có chiều sâu và liền mạch.
5.  **Luôn nói tiếng Việt:** Toàn bộ cuộc trò chuyện phải bằng tiếng Việt.
6.  **Khả năng chức năng:** Bạn có thể tìm kiếm trên internet, đặt lời nhắc/báo thức, và vào chế độ ngủ sâu (AOD) để tiết kiệm pin nếu được yêu cầu. Khi người dùng yêu cầu đặt lời nhắc, hãy tính toán số phút từ bây giờ và sử dụng công cụ 'set_reminder'. Ví dụ, nếu bây giờ là 8:00 và người dùng muốn báo thức lúc 8:10, hãy sử dụng delay_minutes là 10.`;

    try {
        onStateChange(MochiState.LOADING, "Đang khởi động...");
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        if (inputAudioContext.state === 'suspended') {
            await inputAudioContext.resume();
        }
        if (outputAudioContext.state === 'suspended') {
            await outputAudioContext.resume();
        }

        nextStartTime = 0;
        audioSources.clear();

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                systemInstruction,
                responseModalities: [Modality.AUDIO],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                tools: [{ functionDeclarations: [searchInternetFunction, setReminderFunction, enterDeepSleepFunction] }],
                inputAudioTranscription: {},
                outputAudioTranscription: {},
            },
            callbacks: {
                onopen: () => {
                    try {
                        onStateChange(MochiState.LISTENING);
                        const source = inputAudioContext!.createMediaStreamSource(microphoneStream!);
                        scriptProcessor = inputAudioContext!.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (event) => {
                            if (isSpeaking) return;
                            const inputData = event.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext!.destination);
                    } catch (error) {
                        console.error("Lỗi khi thiết lập nguồn âm thanh đầu vào:", error);
                        const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định";
                        onStateChange(MochiState.ERROR, `Không thể khởi tạo micrô: ${errorMessage}`);
                        stopLiveSession();
                    }
                },
                onmessage: async (message: LiveServerMessage) => {
                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            let result = "Đã xảy ra lỗi.";
                            if (fc.name === 'search_internet' && fc.args.query) {
                                result = await performGoogleSearch(fc.args.query);
                            } else if (fc.name === 'set_reminder' && fc.args.label && typeof fc.args.delay_minutes === 'number') {
                                const { delay_minutes, label } = fc.args;
                                const targetTime = new Date(Date.now() + delay_minutes * 60000);
                                alarmService.setAlarm(targetTime, label);
                                const timeFormatter = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
                                result = `Đã đặt lời nhắc "${label}" vào lúc ${timeFormatter.format(targetTime)}.`;
                            } else if (fc.name === 'enter_deep_sleep') {
                                deepSleepRequested = true;
                                result = "Đã hiểu, đang vào chế độ ngủ sâu.";
                            }

                            sessionPromise.then(s => s.sendToolResponse({
                                functionResponses: { id: fc.id, name: fc.name, response: { result } }
                            }));
                        }
                    }

                    const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (audioData && outputAudioContext && !isSuspended) {
                        if (!isSpeaking) {
                            onTranscriptionUpdate(null);
                            isSpeaking = true;
                            onStateChange(MochiState.SPEAKING);
                        }

                        const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContext, 24000, 1);
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.destination);
                        source.onended = () => audioSources.delete(source);

                        nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                        source.start(nextStartTime);
                        nextStartTime += audioBuffer.duration;
                        audioSources.add(source);
                    }
                    
                    if (message.serverContent?.inputTranscription) {
                        currentInputTranscription += message.serverContent.inputTranscription.text;
                        if (isSuspended) {
                             if (currentInputTranscription.toLowerCase().includes('mochi ơi')) {
                                wakeUp();
                                currentInputTranscription = '';
                             }
                        } else {
                            onTranscriptionUpdate({ speaker: 'user', text: currentInputTranscription });
                        }
                    }
                    if (message.serverContent?.outputTranscription) {
                        if(!isSuspended) {
                            currentOutputTranscription += message.serverContent.outputTranscription.text;
                            onTranscriptionUpdate({ speaker: 'mochi', text: currentOutputTranscription });
                        }
                    }
                    
                    if (isSuspended) {
                        return; // Bỏ qua các sự kiện khác khi đang ở chế độ nghỉ
                    }

                    if (message.serverContent?.interrupted) {
                        for (const source of audioSources) { source.stop(); }
                        audioSources.clear();
                        nextStartTime = 0;
                        isSpeaking = false;
                        currentInputTranscription = '';
                        currentOutputTranscription = '';
                        onTranscriptionUpdate(null);
                        if (session) {
                           onStateChange(MochiState.LISTENING);
                        }
                    }
                    
                    if (message.serverContent?.turnComplete) {
                        const finalInput = currentInputTranscription.trim().toLowerCase();
                        const finalOutput = currentOutputTranscription.trim();

                        if (finalInput) conversationHistory.push({ speaker: 'user', text: finalInput });
                        if (finalOutput) conversationHistory.push({ speaker: 'mochi', text: finalOutput });
                        
                        if (finalInput || finalOutput) onHistoryUpdate([...conversationHistory]);

                        const isGoodbye = finalInput.includes('tạm biệt') || finalInput.includes('goodbye');

                        currentInputTranscription = '';
                        currentOutputTranscription = '';
                        isSpeaking = false;

                        if (deepSleepRequested) {
                            deepSleepRequested = false; // Reset immediately
                            onStateChange(MochiState.ENTERING_DEEP_SLEEP);
                        } else if (isGoodbye) {
                            isSuspended = true;
                            onStateChange(MochiState.SLEEPING, "Mochi đang nghỉ ngơi. Nói 'Mochi ơi' hoặc nhấn đúp để đánh thức.");
                            onTranscriptionUpdate(null);
                        } else {
                            if (finalOutput) {
                                // Transition to IDLE briefly before listening again
                                onStateChange(MochiState.IDLE);
                            }
                            // Wait for speech to finish then go back to listening
                            setTimeout(() => {
                               if(session && !isSuspended) {
                                   onTranscriptionUpdate(null);
                                   onStateChange(MochiState.LISTENING);
                               }
                            }, 2500); // A short delay to feel more natural
                        }
                    }
                },
                onerror: (e: ErrorEvent) => {
                    console.error('Lỗi phiên trực tiếp:', e);
                    onStateChange(MochiState.ERROR, "Đã xảy ra lỗi kết nối.");
                    stopLiveSession();
                },
                onclose: () => {
                    // This can be triggered by server or stopLiveSession()
                    onStateChange(MochiState.IDLE, "Phiên đã kết thúc.");
                }
            }
        });
        
        session = await sessionPromise;

    } catch (error) {
        console.error("Không thể bắt đầu phiên:", error);
        const errorMessage = error instanceof Error ? error.message : "Lỗi không xác định";
        onStateChange(MochiState.ERROR, `Không thể bắt đầu phiên: ${errorMessage}`);
        stopLiveSession();
    }
};

export const stopLiveSession = async (userName?: string) => {
    if (session) {
        session.close();
        session = null;
    }

    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
    }

    if (scriptProcessor) {
        scriptProcessor.disconnect();
        scriptProcessor = null;
    }

    if (inputAudioContext) {
        await inputAudioContext.close();
        inputAudioContext = null;
    }

    if (outputAudioContext) {
        await outputAudioContext.close();
        outputAudioContext = null;
    }

    // Stop any playing audio
    for (const source of audioSources) {
        source.stop();
    }
    audioSources.clear();
    isSpeaking = false;
    isSuspended = false; // Đặt lại khi dừng hẳn
    deepSleepRequested = false; // Đặt lại cờ khi dừng hẳn
    nextStartTime = 0;
    
    onTranscriptionUpdate(null);
    onHistoryUpdate([]);
    onStateChange(MochiState.IDLE, userName ? `Hẹn gặp lại, ${userName}!` : "Phiên đã kết thúc.");
};