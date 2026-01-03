
import { AppUser, UserRole } from './types';

export const INITIAL_USERS: AppUser[] = [
  { id: 'u1', name: 'John Driver', username: 'driver', password: '123', role: UserRole.USER, email: 'john@example.com', blocked: false },
  { id: 'u2', name: 'Sarah PM', username: 'pm', password: '123', role: UserRole.PM, email: 'sarah@example.com', blocked: false },
  { id: 'u3', name: 'Mike Admin', username: 'admin', password: '123', role: UserRole.ADMIN, email: 'mike@example.com', blocked: false }
];

export const STORAGE_KEYS = {
  REQUESTS: 'fuelflow_requests_v2',
  NOTIFICATIONS: 'fuelflow_notifications_v2',
  CURRENT_USER: 'fuelflow_current_user',
  USERS: 'fuelflow_users_db',
  CHAT: 'fuelflow_chat_v1'
};
