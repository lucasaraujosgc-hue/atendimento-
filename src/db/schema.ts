import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nickname: text("nickname"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  profile: text("profile").notNull().default("Atendente"),
  active: integer("active", { mode: 'boolean' }).default(true),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#cccccc"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  number: text("number").notNull().unique(), // JID from WhatsApp
  profilePicUrl: text("profile_pic_url"),
  email: text("email"),
  extraInfo: text("extra_info", { mode: "json" }),
  departmentId: integer("department_id").references(() => departments.id),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const contactTags = sqliteTable("contact_tags", {
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  tagId: integer("tag_id").references(() => tags.id).notNull(),
});

export const tickets = sqliteTable("tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull().default("pending"), // pending, open, closed
  lastMessage: text("last_message"),
  contactId: integer("contact_id").references(() => contacts.id),
  userId: integer("user_id").references(() => users.id),
  slaDeadline: text("sla_deadline"),
  slaStatus: text("sla_status").default("ok"), // ok, warning, breached
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(), // Using Baileys message ID
  body: text("body").notNull(),
  ack: integer("ack").default(0),
  read: integer("read", { mode: 'boolean' }).default(false),
  mediaType: text("media_type"), // image, document, audio, video
  mediaUrl: text("media_url"), // Path or URL to the media file
  fileName: text("file_name"), // Original file name
  ticketId: integer("ticket_id").references(() => tickets.id).notNull(),
  fromMe: integer("from_me", { mode: 'boolean' }).notNull().default(false),
  senderName: text("sender_name"), // Pushname from Baileys
  contactId: integer("contact_id").references(() => contacts.id),
  userId: integer("user_id").references(() => users.id),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});
