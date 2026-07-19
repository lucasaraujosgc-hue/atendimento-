import { pgTable, text, serial, boolean, json, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nickname: text("nickname"),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  profile: text("profile").notNull().default("Atendente"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#cccccc"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  number: text("number").notNull().unique(), // JID from WhatsApp
  profilePicUrl: text("profile_pic_url"),
  email: text("email"),
  extraInfo: json("extra_info"),
  departmentId: integer("department_id").references(() => departments.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contactTags = pgTable("contact_tags", {
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  tagId: integer("tag_id").references(() => tags.id).notNull(),
});

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  status: text("status").notNull().default("pending"), // pending, open, closed
  lastMessage: text("last_message"),
  contactId: integer("contact_id").references(() => contacts.id),
  userId: integer("user_id").references(() => users.id),
  slaDeadline: timestamp("sla_deadline"),
  slaStatus: text("sla_status").default("ok"), // ok, warning, breached
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(), // Using Baileys message ID
  body: text("body").notNull(),
  ack: integer("ack").default(0),
  read: boolean("read").default(false),
  mediaType: text("media_type"), // image, document, audio, video
  mediaUrl: text("media_url"), // Path or URL to the media file
  fileName: text("file_name"), // Original file name
  ticketId: integer("ticket_id").references(() => tickets.id).notNull(),
  fromMe: boolean("from_me").notNull().default(false),
  senderName: text("sender_name"), // Pushname from Baileys
  contactId: integer("contact_id").references(() => contacts.id),
  userId: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

