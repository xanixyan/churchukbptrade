/**
 * Central User Account Management
 *
 * This is the source of truth for authentication credentials.
 * Users can have multiple roles (buyer, seller) with a single account.
 *
 * Data model:
 * - User: Central account with discordId, passwordHash, and roles array
 * - Seller: Profile data (inventory, status, etc.) - references userId
 * - Buyer: Profile data - references userId
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { safeWriteJson, safeReadJson, withFileLock } from "./safe-file";
import { User, UserRole, isValidDiscordId, DISCORD_ID_ERROR_MESSAGE } from "./types";

// Data directories
const DATA_DIR = path.join(process.cwd(), "data");
const USERS_DIR = path.join(DATA_DIR, "users");

// Password hashing configuration (same as sellers.ts)
const BCRYPT_SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

// ============================================
// DIRECTORY MANAGEMENT
// ============================================

function ensureDirectories(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
  }
}

function getUserFilePath(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9-_]/g, "_");
  return path.join(USERS_DIR, `${safeId}.json`);
}

// ============================================
// PASSWORD UTILITIES
// ============================================

/**
 * Validate password requirements
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Пароль обов'язковий" };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Пароль має містити щонайменше ${MIN_PASSWORD_LENGTH} символів` };
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return { valid: false, error: `Пароль занадто довгий (макс. ${MAX_PASSWORD_LENGTH} символів)` };
  }

  return { valid: true };
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// USER CRUD OPERATIONS
// ============================================

/**
 * Generate unique user ID
 */
export function generateUserId(): string {
  return crypto.randomUUID();
}

/**
 * Get user by ID
 */
export function getUserById(userId: string): User | null {
  ensureDirectories();
  const filePath = getUserFilePath(userId);
  return safeReadJson<User>(filePath);
}

/**
 * Get user by Discord ID (case-insensitive)
 */
export function getUserByDiscordId(discordId: string): User | null {
  ensureDirectories();
  const users = getAllUsers();
  return users.find((u) => u.discordId.toLowerCase() === discordId.toLowerCase()) || null;
}

/**
 * Get all users
 */
export function getAllUsers(): User[] {
  ensureDirectories();

  if (!fs.existsSync(USERS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(USERS_DIR).filter((f) => f.endsWith(".json"));
  const users: User[] = [];

  for (const file of files) {
    const filePath = path.join(USERS_DIR, file);
    const user = safeReadJson<User>(filePath);
    if (user && user.id && user.discordId) {
      // Ensure roles array exists
      if (!user.roles || !Array.isArray(user.roles)) {
        user.roles = [];
      }
      users.push(user);
    }
  }

  return users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Create a new user with initial roles
 */
export async function createUser(
  discordId: string,
  password: string,
  roles: UserRole[]
): Promise<{ success: boolean; user?: User; error?: string }> {
  ensureDirectories();

  // Validate Discord ID
  if (!isValidDiscordId(discordId)) {
    return { success: false, error: DISCORD_ID_ERROR_MESSAGE };
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.error };
  }

  // Check if user with this Discord ID already exists
  const existing = getUserByDiscordId(discordId);
  if (existing) {
    return { success: false, error: "Користувач з таким Discord ID вже існує" };
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  const now = new Date().toISOString();
  const user: User = {
    id: generateUserId(),
    discordId: discordId.trim(),
    passwordHash,
    roles: roles.filter((r) => r !== "admin"), // Never auto-assign admin role
    createdAt: now,
    updatedAt: now,
  };

  const filePath = getUserFilePath(user.id);
  safeWriteJson(filePath, user);

  return { success: true, user };
}

/**
 * Authenticate user by Discord ID and password
 * Returns user if credentials are valid
 */
export async function authenticateUser(
  discordId: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  if (!isValidDiscordId(discordId)) {
    // Use generic error to prevent user enumeration
    return { success: false, error: "Невірні облікові дані" };
  }

  const user = getUserByDiscordId(discordId);
  if (!user) {
    // Use generic error to prevent user enumeration
    return { success: false, error: "Невірні облікові дані" };
  }

  // Check if user has a password hash
  if (!user.passwordHash) {
    return { success: false, error: "Обліковий запис потребує оновлення. Зверніться до підтримки." };
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return { success: false, error: "Невірні облікові дані" };
  }

  return { success: true, user };
}

/**
 * Add a role to user
 */
export async function addRoleToUser(
  userId: string,
  role: UserRole
): Promise<{ success: boolean; error?: string }> {
  if (role === "admin") {
    return { success: false, error: "Неможливо додати роль адміністратора" };
  }

  const filePath = getUserFilePath(userId);

  return withFileLock(filePath, () => {
    const user = safeReadJson<User>(filePath);
    if (!user) {
      return { success: false, error: "Користувача не знайдено" };
    }

    // Ensure roles array exists
    if (!user.roles || !Array.isArray(user.roles)) {
      user.roles = [];
    }

    // Add role if not already present
    if (!user.roles.includes(role)) {
      user.roles.push(role);
      user.updatedAt = new Date().toISOString();
      safeWriteJson(filePath, user);
    }

    return { success: true };
  });
}

/**
 * Remove a role from user
 */
export async function removeRoleFromUser(
  userId: string,
  role: UserRole
): Promise<{ success: boolean; error?: string }> {
  const filePath = getUserFilePath(userId);

  return withFileLock(filePath, () => {
    const user = safeReadJson<User>(filePath);
    if (!user) {
      return { success: false, error: "Користувача не знайдено" };
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      return { success: true }; // No roles to remove
    }

    const index = user.roles.indexOf(role);
    if (index >= 0) {
      user.roles.splice(index, 1);
      user.updatedAt = new Date().toISOString();
      safeWriteJson(filePath, user);
    }

    return { success: true };
  });
}

/**
 * Check if user has a specific role
 */
export function userHasRole(user: User, role: UserRole): boolean {
  return user.roles && Array.isArray(user.roles) && user.roles.includes(role);
}

/**
 * Update user's password
 */
export async function updateUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  // Validate password
  const validation = validatePassword(newPassword);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Hash password outside lock
  const passwordHash = await hashPassword(newPassword);

  const filePath = getUserFilePath(userId);

  return withFileLock(filePath, () => {
    const user = safeReadJson<User>(filePath);
    if (!user) {
      return { success: false, error: "Користувача не знайдено" };
    }

    user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
    safeWriteJson(filePath, user);

    return { success: true };
  });
}

/**
 * Update user's Discord ID
 */
export async function updateUserDiscordId(
  userId: string,
  newDiscordId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isValidDiscordId(newDiscordId)) {
    return { success: false, error: DISCORD_ID_ERROR_MESSAGE };
  }

  // Check if new Discord ID is already taken
  const existing = getUserByDiscordId(newDiscordId);
  if (existing && existing.id !== userId) {
    return { success: false, error: "Цей Discord ID вже використовується" };
  }

  const filePath = getUserFilePath(userId);

  return withFileLock(filePath, () => {
    const user = safeReadJson<User>(filePath);
    if (!user) {
      return { success: false, error: "Користувача не знайдено" };
    }

    user.discordId = newDiscordId.trim();
    user.updatedAt = new Date().toISOString();
    safeWriteJson(filePath, user);

    return { success: true };
  });
}

// ============================================
// MIGRATION HELPERS
// ============================================

/**
 * Create or get user for migration from legacy seller/buyer records
 * Used during login/registration to ensure user record exists
 */
export async function ensureUserFromLegacy(
  discordId: string,
  passwordHash: string,
  role: UserRole
): Promise<User | null> {
  ensureDirectories();

  // Check if user already exists
  let user = getUserByDiscordId(discordId);

  if (user) {
    // User exists - add role if not present
    if (!userHasRole(user, role)) {
      await addRoleToUser(user.id, role);
      user = getUserById(user.id); // Refresh
    }
    return user;
  }

  // Create new user with the existing password hash
  const now = new Date().toISOString();
  const newUser: User = {
    id: generateUserId(),
    discordId: discordId.trim(),
    passwordHash: passwordHash,
    roles: role === "admin" ? [] : [role],
    createdAt: now,
    updatedAt: now,
  };

  const filePath = getUserFilePath(newUser.id);
  safeWriteJson(filePath, newUser);

  return newUser;
}

/**
 * Delete user (admin only)
 */
export function deleteUser(userId: string): boolean {
  const filePath = getUserFilePath(userId);
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}
