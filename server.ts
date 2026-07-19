import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import { initWhatsApp, getWhatsAppStatus, resetWhatsAppConnection } from "./src/server/whatsapp";
import { apiRouter } from "./src/server/routes";
import { db } from "./src/db";
import { users } from "./src/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { migrate } from "drizzle-orm/node-postgres/migrator";

async function ensureAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL;
  
  try {
    console.log("Running database migrations...");
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
    console.log("Migrations applied successfully.");
  } catch (err) {
    console.error("Error applying migrations:", err);
  }

  if (!adminEmail) return;

  try {
    const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail));
    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || "admin", 10);
      await db.insert(users).values({
        name: process.env.ADMIN_NAME || "Administrador",
        email: adminEmail,
        password: hashedPassword,
        profile: "Administrador"
      });
      console.log("Admin user seeded successfully");
    }
  } catch (err) {
    console.error("Error seeding admin user:", err);
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  const PORT = 3000;

  app.use(express.json());
  
  // Security middlewares (conditional for local dev, mainly for prod)
  if (process.env.NODE_ENV === "production") {
    app.use(helmet({
      contentSecurityPolicy: false // Disabled for SPA static serving in some cases
    }));
  }
  app.use(cors());

  // Use API Router
  app.use("/api", apiRouter);

  // Serve uploads
  const uploadsPath = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsPath));

  // Initialize WhatsApp connection
  initWhatsApp(io);

  ensureAdminUser();

  // Socket.io setup
  io.on("connection", (socket) => {
    console.log("Client connected", socket.id);
    
    socket.on("whatsapp:status", () => {
      socket.emit("whatsapp:state", getWhatsAppStatus());
    });

    socket.on("whatsapp:reset", () => {
      resetWhatsAppConnection(io);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
