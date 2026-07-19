import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { users, tickets, messages, contacts, departments, tags, contactTags } from "../db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { sendWhatsAppMessage } from "./whatsapp";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

export const apiRouter = Router();

import { execSync } from "child_process";

apiRouter.get("/debug/push-db", (req, res) => {
  try {
    const out = execSync("npx drizzle-kit push", { encoding: "utf-8", env: process.env });
    res.send(`<pre>${out}</pre>`);
  } catch (err: any) {
    res.status(500).send(`<pre>${err.message}\n${err.stdout}\n${err.stderr}</pre>`);
  }
});

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

apiRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await db.select().from(users).where(eq(users.email, email));
    const user = userResult[0];

    if (!user) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, profile: user.profile, nickname: user.nickname, name: user.name },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, profile: user.profile, nickname: user.nickname } });
  } catch (err) {
    res.status(500).json({ error: "Erro no servidor" });
  }
});

apiRouter.get("/users", async (req, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      profile: users.profile,
      nickname: users.nickname,
      active: users.active
    }).from(users);
    res.json(allUsers);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

apiRouter.post("/users", async (req, res) => {
  const { name, email, password, profile, nickname } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      profile,
      nickname
    }).returning({
      id: users.id,
      name: users.name,
      email: users.email,
      profile: users.profile,
      nickname: users.nickname,
      active: users.active
    });
    res.json(result[0]);
  } catch (err) {
    res.status(400).json({ error: "Erro ao criar usuário" });
  }
});

apiRouter.get("/stats", async (req, res) => {
  const [openTickets] = await db.select({ count: tickets.id }).from(tickets).where(eq(tickets.status, "open"));
  const [pendingTickets] = await db.select({ count: tickets.id }).from(tickets).where(eq(tickets.status, "pending"));
  
  res.json([
    { name: "Atendimentos Abertos", value: openTickets ? '1' : '0' },
    { name: "Atendimentos Pendentes", value: pendingTickets ? '1' : '0' },
    { name: "Tempo Médio (TMA)", value: "0m 0s" },
    { name: "SLA Violados", value: "0" },
  ]);
});

apiRouter.get("/tickets", async (req, res) => {
  try {
    const allTickets = await db.select({
      id: tickets.id,
      status: tickets.status,
      lastMessage: tickets.lastMessage,
      updatedAt: tickets.updatedAt,
      slaStatus: tickets.slaStatus,
      contactId: tickets.contactId,
      contactName: contacts.name,
      contactProfilePicUrl: contacts.profilePicUrl,
    })
    .from(tickets)
    .leftJoin(contacts, eq(tickets.contactId, contacts.id))
    .orderBy(desc(tickets.updatedAt));

    const formattedTickets = allTickets.map(t => ({
      id: t.id,
      name: t.contactName || "Desconhecido",
      lastMessage: t.lastMessage,
      time: new Date(t.updatedAt || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      unread: 0, // Calculate later based on messages
      status: t.status,
      slaStatus: t.slaStatus,
      profilePicUrl: t.contactProfilePicUrl
    }));
    
    res.json(formattedTickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar tickets" });
  }
});

apiRouter.get("/tickets/:id/messages", async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const msgs = await db.select().from(messages).where(eq(messages.ticketId, ticketId)).orderBy(messages.createdAt);
    
    const formattedMsgs = msgs.map(m => ({
      id: m.id,
      senderName: m.senderName,
      text: m.body,
      time: new Date(m.createdAt || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: m.fromMe,
      type: m.mediaType || "text",
      fileUrl: m.mediaUrl,
      fileName: m.fileName
    }));
    
    res.json(formattedMsgs);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
});

apiRouter.post("/tickets/:id/transfer", async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { userId } = req.body;
    const result = await db.update(tickets).set({ userId }).where(eq(tickets.id, ticketId)).returning();
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: "Erro ao transferir ticket" });
  }
});

apiRouter.post("/contacts/:id/tags", async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    const { tagId } = req.body;
    const result = await db.insert(contactTags).values({ contactId, tagId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Erro ao adicionar tag" });
  }
});

apiRouter.get("/tags", async (req, res) => {
  try {
    const allTags = await db.select().from(tags);
    res.json(allTags);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar tags" });
  }
});

apiRouter.get("/departments", async (req, res) => {
  try {
    const allDepartments = await db.select().from(departments);
    res.json(allDepartments);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar departamentos" });
  }
});
apiRouter.post("/tickets/:id/send", upload.array("files"), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { text, senderName } = req.body;
    const files = req.files as Express.Multer.File[];
    
    // Find ticket and contact
    const ticket = await db.select().from(tickets).where(eq(tickets.id, ticketId)).then(r => r[0]);
    if (!ticket) return res.status(404).json({ error: "Ticket não encontrado" });
    
    const contact = await db.select().from(contacts).where(eq(contacts.id, ticket.contactId || 0)).then(r => r[0]);
    if (!contact) return res.status(404).json({ error: "Contato não encontrado" });

    let mainMessageSaved = null;

    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isLast = i === files.length - 1;
        const caption = isLast && text ? text : undefined;

        let msgPayload: any = {};
        if (file.mimetype.startsWith('image/')) {
          msgPayload = { image: { url: file.path }, caption };
        } else if (file.mimetype.startsWith('video/')) {
          msgPayload = { video: { url: file.path }, caption };
        } else if (file.mimetype.startsWith('audio/')) {
          msgPayload = { audio: { url: file.path }, mimetype: file.mimetype, ptt: true };
          if (caption) {
            // Audio cannot have caption in Baileys, need to send text separately if there is caption
          }
        } else {
          msgPayload = { document: { url: file.path }, fileName: file.originalname, mimetype: file.mimetype, caption };
        }

        const sentMsg = await sendWhatsAppMessage(contact.number, msgPayload);
        
        let type = "file";
        if (file.mimetype.startsWith('image/')) type = "image";
        else if (file.mimetype.startsWith('audio/')) type = "audio";
        else if (file.mimetype === "application/pdf") type = "pdf";

        const [savedMsg] = await db.insert(messages).values({
          id: sentMsg?.key?.id || Date.now().toString(),
          ticketId: ticket.id,
          contactId: contact.id,
          body: caption || "",
          fromMe: true,
          senderName: senderName || "Você",
          mediaType: type,
          mediaUrl: `/uploads/${file.filename}`,
          fileName: file.originalname
        }).returning();
        
        mainMessageSaved = savedMsg;
      }
    } else if (text) {
      // Send WhatsApp Message Text only
      const sentMsg = await sendWhatsAppMessage(contact.number, { text: text || "" });

      // Save message
      const [savedMsg] = await db.insert(messages).values({
        id: sentMsg?.key?.id || Date.now().toString(),
        ticketId: ticket.id,
        contactId: contact.id,
        body: text || "",
        fromMe: true,
        senderName: senderName || "Você",
        mediaType: "text",
      }).returning();
      mainMessageSaved = savedMsg;
    }

    // Update ticket
    await db.update(tickets).set({ lastMessage: text || (files?.length ? "Mídia enviada" : ""), updatedAt: new Date() }).where(eq(tickets.id, ticket.id));

    res.json(mainMessageSaved || { success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao enviar mensagem" });
  }
});

