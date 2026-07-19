import { makeWASocket, DisconnectReason, useMultiFileAuthState, downloadMediaMessage, jidNormalizedUser } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { contacts, tickets, messages } from "../db/schema";
import { eq } from "drizzle-orm";

let sock: any = null;
let currentQr: string | null = null;
let connectionStatus: "connecting" | "qr" | "connected" | "disconnected" | "reconnecting" | "failed" = "disconnected";
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let isInitializing = false;

function isValidContact(jid: string) {
  if (!jid) return false;
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
}

export async function initWhatsApp(io: any) {
  if (isInitializing) return;
  isInitializing = true;
  connectionStatus = "connecting";
  io.emit("whatsapp:state", { state: connectionStatus });

  try {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "error" }) as any,
    });

    sock.ev.on("connection.update", (update: any) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        currentQr = qr;
        connectionStatus = "qr";
        io.emit("whatsapp:state", { state: "qr", qr: currentQr });
      }
      if (connection === "close") {
        currentQr = null;
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            connectionStatus = "reconnecting";
            io.emit("whatsapp:state", { state: "reconnecting" });
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 60000);
            reconnectAttempts++;
            console.log(`Reconnecting in ${delay}ms... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => {
              isInitializing = false;
              initWhatsApp(io);
            }, delay);
          } else {
            connectionStatus = "failed";
            io.emit("whatsapp:state", { state: "failed" });
            console.error("Max reconnect attempts reached.");
            isInitializing = false;
          }
        } else {
          connectionStatus = "disconnected";
          io.emit("whatsapp:state", { state: "disconnected" });
          if (fs.existsSync("auth_info_baileys")) {
             fs.rmSync("auth_info_baileys", { recursive: true, force: true });
          }
          isInitializing = false;
        }
      } else if (connection === "open") {
        reconnectAttempts = 0;
        connectionStatus = "connected";
        currentQr = null;
        isInitializing = false;
        io.emit("whatsapp:state", { state: "connected" });
      }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("contacts.upsert", async (contactsData: any) => {
      for (const contactData of contactsData) {
        try {
          if (isValidContact(contactData.id)) {
            const normalizedId = jidNormalizedUser(contactData.id);
            const senderName = contactData.name || contactData.pushname || contactData.notify || normalizedId.split('@')[0];
            let contact = await db.select().from(contacts).where(eq(contacts.number, normalizedId)).then(res => res[0]);
            if (!contact) {
              await db.insert(contacts).values({
                name: senderName,
                number: normalizedId,
              });
            }
          }
        } catch (err) {
          console.error("Error upserting contact", err);
        }
      }
    });

    sock.ev.on("messaging-history.set", async (history: any) => {
      console.log("Messaging history received but ignored as per configuration.");
    });

    sock.ev.on("messages.upsert", async (m: any) => {
      if (m.type === "notify" || m.type === "append") {
        for (const msg of m.messages) {
          if (msg.key.remoteJid && isValidContact(msg.key.remoteJid)) {
             await handleIncomingMessage(msg, io, false);
          }
        }
      }
    });
  } catch (err) {
    console.error("Error in initWhatsApp", err);
    isInitializing = false;
  }
}

async function handleIncomingMessage(msg: any, io: any, isHistory: boolean = false) {
  try {
    const remoteJid = msg.key.remoteJid;
    const normalizedJid = jidNormalizedUser(remoteJid);
    const fromMe = msg.key.fromMe;
    const senderName = msg.pushName || normalizedJid.split('@')[0];
    
    // Get or create contact
    let contact = await db.select().from(contacts).where(eq(contacts.number, normalizedJid)).then(res => res[0]);
    if (!contact) {
      let profilePicUrl = undefined;
      try {
        if (!isHistory) profilePicUrl = await sock.profilePictureUrl(normalizedJid, 'image');
      } catch (err) {
        // Ignore if no profile picture
      }
      const [newContact] = await db.insert(contacts).values({
        name: senderName,
        number: normalizedJid,
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
      if (!isHistory) {
        await db.update(tickets).set({ lastMessage: getMessageText(msg), updatedAt: new Date() }).where(eq(tickets.id, ticket.id));
      }
    }

    // Download media if any
    let mediaUrl = undefined;
    let mediaType = "text";
    let fileName = undefined;
    
    const messageContent = msg.message;
    if (messageContent && !isHistory) {
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
    const msgExists = await db.select().from(messages).where(eq(messages.id, msg.key.id)).then(res => res[0]);
    if (!msgExists) {
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
        createdAt: new Date(msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now()),
      }).returning();

      // Broadcast to UI
      if (!isHistory) {
        io.emit("whatsapp:message", {
          ticket,
          contact,
          message: savedMsg
        });
      }
    }
  } catch (error) {
    console.error("Error handling incoming message:", error);
  }
}

function getMessageText(msg: any) {
  if (!msg.message) return "";
  return msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "";}
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
    const normalizedTo = jidNormalizedUser(to);
    return await sock.sendMessage(normalizedTo, message);
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
    sock = null;
  }
  
  setTimeout(() => {
    if (fs.existsSync("auth_info_baileys")) {
      fs.rmSync("auth_info_baileys", { recursive: true, force: true });
    }
    reconnectAttempts = 0;
    isInitializing = false;
    initWhatsApp(io);
  }, 1000);
}
