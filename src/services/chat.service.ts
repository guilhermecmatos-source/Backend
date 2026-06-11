import { query } from "../database/connection";

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: Date;
  sender_name?: string;
  receiver_name?: string;
}

export class ChatService {
  async saveMessage(senderId: string, receiverId: string, message: string) {
    if (!message || !message.trim()) {
      throw new Error("A mensagem não pode ser vazia.");
    }
    const rows = await query<ChatMessage>(
      `INSERT INTO chat_messages (sender_id, receiver_id, message)
       VALUES ($1, $2, $3) RETURNING *`,
      [senderId, receiverId, message.trim()]
    );
    return rows[0];
  }

  async getMessagesBetween(userA: string, userB: string) {
    return query<ChatMessage>(
      `SELECT m.*, s.name as sender_name, r.name as receiver_name 
       FROM chat_messages m
       JOIN users s ON s.id = m.sender_id
       JOIN users r ON r.id = m.receiver_id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at ASC`,
      [userA, userB]
    );
  }

  async getChatPartners(userId: string) {
    const partners = await query<{ id: string; name: string; email: string; role: string }>(
      `SELECT DISTINCT u.id, u.name, u.email, u.role 
       FROM users u
       JOIN chat_messages m ON (m.sender_id = u.id AND m.receiver_id = $1)
                            OR (m.receiver_id = u.id AND m.sender_id = $1)
       WHERE u.id != $1`,
      [userId]
    );

    const userRole = await query<{ role: string }>(
      "SELECT role FROM users WHERE id = $1",
      [userId]
    );
    const isAdmin = userRole[0]?.role === "administrador" || userRole[0]?.role === "admin";

    if (!isAdmin) {
      const admins = await query<{ id: string; name: string; email: string; role: string }>(
        "SELECT id, name, email, role FROM users WHERE role = 'administrador' OR role = 'admin'"
      );
      for (const admin of admins) {
        if (!partners.some((p) => p.id === admin.id)) {
          partners.push(admin);
        }
      }
    } else {
      const allUsers = await query<{ id: string; name: string; email: string; role: string }>(
        "SELECT id, name, email, role FROM users WHERE id != $1",
        [userId]
      );
      for (const u of allUsers) {
        if (!partners.some((p) => p.id === u.id)) {
          partners.push(u);
        }
      }
    }

    return partners;
  }
}

export const chatService = new ChatService();
