
export enum UserRole {
  USER = 'USER',
  PM = 'PROJECT_MANAGER',
  ADMIN = 'ADMIN'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  PM_APPROVED = 'PM_APPROVED',
  REJECTED = 'REJECTED',
  ADMIN_PROCESSED = 'ADMIN_PROCESSED', // Admin sent reply, waiting for user to fuel
  VERIFICATION_SUBMITTED = 'VERIFICATION_SUBMITTED', // User uploaded photos, waiting for admin review
  COMPLETED = 'COMPLETED' // Admin approved final photos
}

export interface FuelRequest {
  id: string;
  userId: string;
  userName: string;
  date: string;
  plateNumber: string;
  projectName: string;
  region: string;
  lastMileage: number;
  newMileage: number;
  lastRequestLiters: number;
  newRequestLiters: number;
  stationName: string;
  imageUrl?: string; // Initial mileage photo (BEFORE)
  postFuelingImages?: string[]; // Verification photos (AFTER: receipt, final mileage)
  status: RequestStatus;
  createdAt: number;
  updatedAt: number;
  pmNote?: string;
  pmSuggestedLiters?: number;
  pmReplyImage?: string; 
  adminNote?: string;
  adminReplyData?: string;
  adminReplyImage?: string; 
  chatMessages?: ChatMessage[]; 
  chatDisabled?: boolean; 
}

export interface Notification {
  id: string;
  toUserId: string;
  toRole: UserRole;
  message: string;
  requestId: string;
  read: boolean;
  timestamp: number;
  isChat?: boolean; 
}

export interface AppUser {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  email: string;
  blocked?: boolean;
  muted?: boolean; 
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  role: UserRole;
  text?: string;
  image?: string;
  timestamp: number;
}
