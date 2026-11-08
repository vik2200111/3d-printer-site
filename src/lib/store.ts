/**
 * Локальное хранилище вместо PostgreSQL из оригинального проекта.
 * Всё работает в браузере (localStorage) — не нужен сервер и БД,
 * поэтому сайт идеально ложится на статический хостинг Render.com.
 */
import type { FilamentMaterial, OrderStatusKey } from "./slicer-math";

export interface AuthUser {
  username: string;
}

interface StoredUser {
  username: string;
  passHash: string;
  createdAt: number;
}

export interface Order {
  id: number;
  orderCode: string;
  modelName: string;
  fileFormat: string;
  dimensionsMm: string;
  volumeCm3: number;
  heightMm: number;
  smoothingPercent: number;
  infillPercent: number;
  material: FilamentMaterial["id"];
  colorId: string;
  status: OrderStatusKey;
  progress: number; // 0..100, актуален для PRINTING
  printerNode: string;
  totalPriceRub: number;
  createdAt: number;
  updatedAt: number;
}

export interface NewOrderPayload {
  modelName: string;
  fileFormat: string;
  dimensionsMm: string;
  volumeCm3: number;
  heightMm: number;
  smoothingPercent: number;
  infillPercent: number;
  material: FilamentMaterial["id"];
  colorId: string;
  initialStatus: OrderStatusKey;
  totalPriceRub: number;
}

const USERS_KEY = "voxel_forge_users";
const SESSION_KEY = "voxel_forge_session";
const ordersKey = (u: string) => `voxel_forge_orders_${u}`;

/** Простой демо-хеш (НЕ криптография — только демо-режим в браузере) */
function demoHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(36)}`;
}

function readUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function registerUser(
  username: string,
  password: string
): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const u = username.trim();
  if (u.length < 3) return { ok: false, error: "Имя оператора минимум 3 символа." };
  if (password.length < 4) return { ok: false, error: "Пароль минимум 4 символа." };
  const users = readUsers();
  if (users.some((x) => x.username.toLowerCase() === u.toLowerCase())) {
    return { ok: false, error: "Оператор с таким именем уже зарегистрирован." };
  }
  const user: StoredUser = { username: u, passHash: demoHash(password), createdAt: Date.now() };
  users.push(user);
  writeUsers(users);
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username: u }));
  return { ok: true, user: { username: u } };
}

export function loginUser(
  username: string,
  password: string
): { ok: true; user: AuthUser } | { ok: false; error: string } {
  const u = username.trim();
  const users = readUsers();
  const found = users.find((x) => x.username.toLowerCase() === u.toLowerCase());
  if (!found || found.passHash !== demoHash(password)) {
    return { ok: false, error: "НЕВЕРНЫЙ ЛОГИН ИЛИ ПАРОЛЬ." };
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username: found.username }));
  return { ok: true, user: { username: found.username } };
}

export function getSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function logoutUser(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ---------- orders ----------
export function getOrders(username: string): Order[] {
  try {
    return JSON.parse(localStorage.getItem(ordersKey(username)) ?? "[]");
  } catch {
    return [];
  }
}

function saveOrders(username: string, orders: Order[]) {
  localStorage.setItem(ordersKey(username), JSON.stringify(orders));
}

function makeOrderCode(): string {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return `VF-${s}`;
}

export function createOrder(username: string, payload: NewOrderPayload): Order {
  const orders = getOrders(username);
  const order: Order = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    orderCode: makeOrderCode(),
    modelName: payload.modelName,
    fileFormat: payload.fileFormat,
    dimensionsMm: payload.dimensionsMm,
    volumeCm3: payload.volumeCm3,
    heightMm: payload.heightMm,
    smoothingPercent: payload.smoothingPercent,
    infillPercent: payload.infillPercent,
    material: payload.material,
    colorId: payload.colorId,
    status: payload.initialStatus,
    progress: 0,
    printerNode: `NODE-0${1 + Math.floor(Math.random() * 8)}`,
    totalPriceRub: payload.totalPriceRub,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  orders.unshift(order);
  saveOrders(username, orders);
  return order;
}

export type OrderAction = "SEND_TO_PAYMENT" | "PAY_ORDER" | "START_PRINTING" | "COMPLETE_NOW";

export function applyOrderAction(
  username: string,
  orderId: number,
  action: OrderAction
): Order | null {
  const orders = getOrders(username);
  const order = orders.find((o) => o.id === orderId);
  if (!order) return null;
  const now = Date.now();
  switch (action) {
    case "SEND_TO_PAYMENT":
      if (order.status !== "MODEL_SELECTED") return order;
      order.status = "AWAITING_PAYMENT";
      break;
    case "PAY_ORDER":
      if (order.status !== "AWAITING_PAYMENT") return order;
      order.status = "QUEUED_PRINTER";
      break;
    case "START_PRINTING":
      if (order.status !== "QUEUED_PRINTER") return order;
      order.status = "PRINTING";
      order.progress = 2;
      break;
    case "COMPLETE_NOW":
      if (order.status === "COMPLETED") return order;
      order.status = "COMPLETED";
      order.progress = 100;
      break;
  }
  order.updatedAt = now;
  saveOrders(username, orders);
  return order;
}

export function deleteOrder(username: string, orderId: number): void {
  const orders = getOrders(username).filter((o) => o.id !== orderId);
  saveOrders(username, orders);
}

/**
 * Один "тик" симуляции принтера (как /api/printer/tick в оригинале).
 * boost=true — ручное ускорение из кабинета.
 */
export function tickPrinter(username: string, boost = false): Order[] {
  const orders = getOrders(username);
  let changed = false;
  for (const o of orders) {
    if (o.status === "QUEUED_PRINTER") {
      o.status = "PRINTING";
      o.progress = 4 + Math.round(Math.random() * 4);
      o.updatedAt = Date.now();
      changed = true;
    } else if (o.status === "PRINTING") {
      const step = boost ? 8 + Math.round(Math.random() * 10) : 3 + Math.round(Math.random() * 5);
      o.progress = Math.min(100, o.progress + step);
      if (o.progress >= 100) {
        o.status = "COMPLETED";
      }
      o.updatedAt = Date.now();
      changed = true;
    }
  }
  if (changed) saveOrders(username, orders);
  return orders;
}
