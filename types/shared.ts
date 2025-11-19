
/// <reference lib="dom" />
/// <reference lib="es2015" />

declare global {
  interface ImportMetaEnv {
      readonly VITE_FB_API_KEY: string | undefined;
      readonly VITE_FB_AUTH_DOMAIN: string | undefined;
      readonly VITE_FB_PROJECT_ID: string | undefined;
      readonly VITE_FB_STORAGE_BUCKET: string | undefined;
      readonly VITE_FB_MESSAGING_SENDER_ID: string | undefined;
      readonly VITE_FB_APP_ID: string | undefined;
      readonly VITE_FB_MEASUREMENT_ID?: string;
      readonly DEV: boolean;
      readonly PROD: boolean;
    }
    
    interface ImportMeta {
      readonly env: ImportMetaEnv;
    }

    interface EventTarget {
      addEventListener(type: string, listener: any): void;
      removeEventListener(type: string, listener: any): void;
      dispatchEvent(event: any): boolean;
    }

    interface WakeLockSentinel extends EventTarget {
      release(): Promise<void>;
      readonly released: boolean;
      readonly type: "screen";
    }
}

export interface Reaction {
  participantId: string;
  emoji: string;
  createdDate: string; // ISO string
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdDate: string; // ISO string
  reactions?: Reaction[]; // New for likes feature
}

export interface Notification {
  id: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  createdAt: Date;
  autoDismiss?: boolean;
}

export interface AnalyticsEvent {
    id: string;
    type: "BOOKING_CREATED" | "BOOKING_CANCELLED" | "CHECKIN" | "WAITLIST_PROMOTION";
    timestamp: any; // Firestore Timestamp
    orgId: string;
    [key: string]: any;
}
