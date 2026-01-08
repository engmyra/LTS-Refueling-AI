
export enum UserRole {
  USER = 'USER',
  PM = 'PROJECT_MANAGER',
  ADMIN = 'ADMIN'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  PENDING_EDIT = 'PENDING_EDIT', // Sent back to driver
  PM_APPROVED = 'PM_APPROVED',
  REJECTED = 'REJECTED',
  ADMIN_PROCESSED = 'ADMIN_PROCESSED', 
  VERIFICATION_SUBMITTED = 'VERIFICATION_SUBMITTED', 
  COMPLETED = 'COMPLETED',
  FLAGGED = 'FLAGGED' // Abnormal usage detected
}

export interface FuelRequest {
  id: string;
  userId: string;
  userName: string;
  date: string;
  plateNumber: string;
  vehicleModel?: string;
  fuelType?: string;
  projectName: string;
  region?: string;
  lastMileage: number;
  newMileage: number;
  lastRequestLiters: number;
  newRequestLiters: number;
  stationName: string;
  imageUrl?: string; 
  postFuelingImages?: string[]; 
  status: RequestStatus;
  createdAt: number;
  updatedAt: number;
  pmNote?: string;
  pmReplyImage?: string; 
  adminNote?: string;
  adminReplyData?: string;
  adminReplyImage?: string; 
  chatMessages?: ChatMessage[]; 
  chatDisabled?: boolean;
  isAbnormal?: boolean;
  location?: { lat: number; lng: number };
}

export interface AuditLog {
  id: string;
  requestId: string;
  plateNumber: string;
  actorName: string;
  actorRole: UserRole;
  action: string; 
  comment: string;
  timestamp: number;
  details?: any;
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
