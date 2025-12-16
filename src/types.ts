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
  data?: any; // For charts or diagrams (raw string)
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
  reason: string; // e.g., "Out of domain" or "Missing knowledge"
}

export interface AppState {
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  explanatoryMode: boolean;
  ragMode: boolean;
  activeAssetId: string | null;
}

// Chart Data Structure
export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: any;
}

// Global JSX Declaration to fix IntrinsicElements errors
declare global {
  namespace JSX {
    interface IntrinsicElements {
      primitive: any;
      mesh: any;
      ringGeometry: any;
      meshStandardMaterial: any;
      ambientLight: any;
      spotLight: any;
      pointLight: any;
      [elemName: string]: any;
    }
  }
}
