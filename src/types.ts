
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export enum AssetType {
  NONE = 'none',
  IMAGE = 'image',
  VIDEO = 'video',
  CHART = 'chart',
  DIAGRAM = 'diagram'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  relatedAssetId?: string;
}

export interface GeneratedAsset {
  id: string;
  type: AssetType;
  url?: string;
  data?: any; 
  description: string;
  createdAt: number;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  content: string;
  uploadedAt: number;
}

export interface SystemAlert {
  id: string;
  query: string;
  timestamp: number;
  reason: string; 
}

export interface AppState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  explanatoryMode: boolean;
  ragMode: boolean;
  activeAssetId: string | null;
  nightMode: boolean; // Added for Night Ops
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      primitive: any;
      mesh: any;
      group: any;
      ringGeometry: any;
      meshStandardMaterial: any;
      ambientLight: any;
      spotLight: any;
      pointLight: any;
      color: any;
      [elemName: string]: any;
    }
  }
}
