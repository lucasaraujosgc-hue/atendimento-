import { makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { contacts, tickets, messages } from "../db/schema";
import { eq } from "drizzle-orm";

let sock: any = null;
let currentQr: string | null = null;
let connectionStatus: "connecting" | "qr" | "connected" | "disconnected" = "disconnected";

export async function initWhatsApp(io: any) {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }) as any,
  });

  sock.ev.on("connection.update", (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQr = qr;
      connectionStatus = "qr";
      io.emit("whatsapp:state", { state: "qr", qr: currentQr });
    }

    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed due to ", lastDisconnect?.error, ", reconnecting ", shouldReconnect);
      
      connectionStatus = "disconnected";
      io.emit("whatsapp:state", { state: "disconnected" });

      if (shouldReconnect) {
        initWhatsApp(io);
      } else {
        if (fs.existsSync("auth_info_baileys")) {
           fs.rmSync("auth_info_baileys", { recursive: true, force: true });
        }
      }
    } else if (connection === "open") {
      console.log("Opened connection");
      connectionStatus = "connected";
      currentQr = null;
      io.emit("whatsapp:state", { state: "connected" });
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async (m: any) => {
    if (m.type === "notify") {
      for (const msg of m.messages) {
        if (msg.key.remoteJid && msg.key.remoteJid.endsWith('@s.whatsapp.net')) {
           await handleIncomingMessage(msg, io);
        }
      }
    }
  });
}

async function handleIncomingMessage(msg: any, io: any) {
  try {
    const remoteJid = msg.key.remoteJid;
    const fromMe = msg.key.fromMe;
    const senderName = msg.pushName || remoteJid.split('@')[0];
    
    // Get or create contact
    let contact = await db.select().from(contacts).where(eq(contacts.number, remoteJid)).then(res => res[0]);
    if (!contact) {
      let profilePicUrl = undefined;
      try {
        profilePicUrl = await sock.profilePictureUrl(remoteJid, 'image');
      } catch (err) {
        // Ignore if no profile picture
      }
      const [newContact] = await db.insert(contacts).values({
        name: senderName,
        number: remoteJid,
        profilePicUrl
      }).returning();
      contact = newContact;
    }

    // Get or create open ticket
    let ticket = await db.select().from(tickets).where(eq(tickets.contactId, contact.id)).then(res => res.find(t => t.status !== 'closed'));
    if (!ticket) {
      const [newTicket] = await db.insert(tickets).values({
        contactId: contact.id,
        status: 'pending',
        lastMessage: getMessageText(msg)
      }).returning();
      ticket = newTicket;
    } else {
      await db.update(tickets).set({ lastMessage: getMessageText(msg), updatedAt: new Date().toISOString() }).where(eq(tickets.id, ticket.id));
    }

    // Download media if any
    let mediaUrl = undefined;
    let mediaType = "text";
    let fileName = undefined;
    
    const messageContent = msg.message;
    if (messageContent) {
      const mType = Object.keys(messageContent)[0];
      if (mType === 'imageMessage' || mType === 'videoMessage' || mType === 'audioMessage' || mType === 'documentMessage') {
        const buffer = await downloadMediaMessage(msg, 'buffer', { }, { 
          logger: pino({ level: 'silent' }) as any,
          reuploadRequest: sock.updateMediaMessage
        });
        
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const extension = getExtension(mType, messageContent[mType]);
        const name = `${msg.key.id}.${extension}`;
        fileName = messageContent[mType].fileName || name;
        mediaType = mType.replace('Message', '');
        
        fs.writeFileSync(path.join(uploadsDir, name), buffer as Buffer);
        mediaUrl = `/uploads/${name}`;
      }
    }

    // Save message
    const [savedMsg] = await db.insert(messages).values({
      id: msg.key.id,
      ticketId: ticket.id,
      contactId: contact.id,
      body: getMessageText(msg) || "",
      fromMe: fromMe,
      senderName: senderName,
      mediaType: mediaType !== "text" ? mediaType : undefined,
      mediaUrl,
      fileName,
    }).returning();

    // Broadcast to UI
    io.emit("whatsapp:message", {
      ticket,
      contact,
      message: savedMsg
    });

  } catch (error) {
    console.error("Error handling incoming message:", error);
  }
}

function getMessageText(msg: any) {
  if (!msg.message) return "";
  return msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";
}

function getExtension(type: string, content: any) {
  if (type === 'imageMessage') return 'jpeg';
  if (type === 'videoMessage') return 'mp4';
  if (type === 'audioMessage') return 'ogg';
  if (type === 'documentMessage') {
    const mimetype = content.mimetype || '';
    if (mimetype.includes('pdf')) return 'pdf';
    return 'bin';
  }
  return 'bin';
}

export async function sendWhatsAppMessage(to: string, message: any) {
  if (sock) {
    return await sock.sendMessage(to, message);
  }
  throw new Error("WhatsApp socket not connected");
}

export function getWhatsAppStatus() {
  return {
    state: connectionStatus,
    qr: currentQr
  };
}

export function resetWhatsAppConnection(io: any) {
  if (sock) {
    sock.logout();
  } else {
    if (fs.existsSync("auth_info_baileys")) {
      fs.rmSync("auth_info_baileys", { recursive: true, force: true });
    }
    initWhatsApp(io);
  }
}

