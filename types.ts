export enum MochiState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  LOADING = 'LOADING',
  ERROR = 'ERROR',
  SLEEPING = 'SLEEPING',
  ENTERING_DEEP_SLEEP = 'ENTERING_DEEP_SLEEP',
}

export enum IdleExpression {
  NORMAL,
  BLINK,
  LOOK_LEFT,
  LOOK_RIGHT,
  HAPPY,
  SAD,
  SURPRISED,
  SQUINT,
  WINK_LEFT,
  LOVE,
  DIZZY,
  ANGRY,
  CONFUSED,
  SLEEPY,
  PROUD,
  KAWAII,
}

export interface UserProfile {
  name: string;
  gender: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface ChatMessage {
  speaker: 'user' | 'mochi';
  text: string;
}