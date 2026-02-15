import { StyleOption, ToneOption, VoiceOption } from './types';

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: 'Zephyr', name: 'Zephyr', description: '밝은 여성 (High pitch)', gender: 'Female' },
  { id: 'Puck', name: 'Puck', description: '안정감있는 남성 (Middle pitch)', gender: 'Male' },
  { id: 'Charon', name: 'Charon', description: '전문적인 남성 (Low pitch)', gender: 'Male' },
  { id: 'Kore', name: 'Kore', description: '온화한 여성 (Middle pitch)', gender: 'Female' },
  { id: 'Fenrir', name: 'Fenrir', description: '중후한 남성 (Low-mid pitch)', gender: 'Male' },
  { id: 'Leda', name: 'Leda', description: '밝은 여성 (Youthful, High pitch)', gender: 'Female' },
  { id: 'Orus', name: 'Orus', description: '확고한 남성 (Low-mid pitch)', gender: 'Male' },
  { id: 'Aoede', name: 'Aoede', description: '안정감있는 여성 (Middle pitch)', gender: 'Female' },
];

export const STYLE_OPTIONS: StyleOption[] = [
  { 
    id: 'sermon', 
    label: '설교 해설 (Sermon)', 
    description: '깊이 있는 울림, 철학적이고 차분한 문체',
    prompt: '깊이 있는 울림과 묵직한 어휘를 사용합니다. 핵심 가치와 본질을 탐구하는 철학적이고 차분한 문체로 작성합니다.'
  },
  { 
    id: 'new_believer', 
    label: '새신자 (New Believer)', 
    description: '따뜻하고 포용적인 단어, 곁에 있음을 전하는 문체',
    prompt: '낯선 공간에서의 긴장을 풀어주는 따뜻하고 포용적인 단어를 선택합니다. 직접적인 환영 인사("환영합니다" 등 금지)보다는 곁에 있음을 전하는 문체로 작성합니다.'
  },
  { 
    id: 'announcement', 
    label: '교회 광고 (Announcement)', 
    description: '리듬감 있는 짧은 문장, 밝고 경쾌함',
    prompt: '리듬감 있는 짧은 문장을 사용하며, 함께할 때의 유익과 기쁨이 느껴지는 밝고 경쾌한 문체로 작성합니다. 딱딱한 말("공지합니다" 등)을 피하고 활기차게 전달합니다.'
  },
  { 
    id: 'kids', 
    label: '어린이 (Kids)', 
    description: '7-14세 눈높이, 쉬운 단어, ~요 체',
    prompt: '7-14세 어린이들에게 적합하도록 어려운 단어를 쉽게 풀어 설명합니다. 비속어는 사용하지 않으며 친근한 "~요"체를 사용합니다.'
  },
  { 
    id: 'youth', 
    label: '청년 (Youth)', 
    description: '18-30세 공감, 격려와 위로',
    prompt: '18-30세 청년들이 공감할 수 있는 문체입니다. 공감과 격려가 많이 담겨있도록 작성합니다.'
  },
  { 
    id: 'general', 
    label: '일반인 (General)', 
    description: '일상의 언어, 보편적인 위로',
    prompt: '일상의 언어로 공감을 건넵니다. 삶의 지친 마음을 보듬는 보편적인 위로의 문체로 작성하되, 기독교 핵심 고유명사는 훼손하지 않습니다.'
  },
];

export const TONE_OPTIONS: ToneOption[] = [
  { id: 'calm', label: '차분하고 신뢰감 있는', description: 'Calm and trustworthy' },
  { id: 'intellectual', label: '지적인 톤', description: 'Intellectual / Sophisticated' },
  { id: 'clear', label: '명확한 발음', description: 'Clear articulation' },
  { id: 'moderate', label: '적절한 속도', description: 'Moderate pacing' },
  { id: 'professional', label: '전문적인 느낌', description: 'Professional / Formal' },
];

export const SPEEDS = [0.8, 1.0, 1.2];