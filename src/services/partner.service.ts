import { query } from "../database/connection";
import { validateCnpj, validateEmail } from "../utils/validators";

export interface Partner {
  id: string;
  name: string;
  city: string;
  type: string;
  email?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  score: number;
  status: string;
  created_at?: string;
}

export interface PartnerTicket {
  id: string;
  partner_id?: string | null;
  subject: string;
  partner_name: string;
  message: string;
  status: string;
  priority: string;
  created_at?: string;
}

const TYPE_LABEL: Record<string, string> = {
  workshop: "Oficina",
  distributor: "Distribuidora",
  dealer: "Revendedora",
};

export class PartnerService {
  async findById(id: string) {
    const rows = await query<Partner>("SELECT * FROM partners WHERE id = $1", [id]);
    return rows[0] || null;
  }

  async findImages(partnerId: string) {
    return query<{ id: string; path: string; filename: string; mime_type: string; created_at: string }>(
      `SELECT id, path, filename, mime_type, created_at FROM uploads
       WHERE entity_type = 'partner' AND entity_id = $1 ORDER BY created_at DESC`,
      [partnerId]
    );
  }

  async getMessages(partnerId: string) {
    return query<{ id: string; sender_name: string; sender_role: string; message: string; created_at: string }>(
      `SELECT * FROM partner_messages WHERE partner_id = $1 ORDER BY created_at ASC`,
      [partnerId]
    );
  }

  async sendMessage(partnerId: string, data: { sender_name: string; sender_role?: string; message: string }) {
    const partner = await this.findById(partnerId);
    if (!partner) throw new Error("Parceiro não encontrado.");
    if (!data.message?.trim()) throw new Error("Mensagem é obrigatória.");
    const rows = await query(
      `INSERT INTO partner_messages (partner_id, sender_name, sender_role, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [partnerId, data.sender_name.trim(), data.sender_role || "administrador", data.message.trim()]
    );
    return rows[0];
  }

  async findAll() {
    return query<Partner>("SELECT * FROM partners ORDER BY created_at DESC");
  }

  async findTickets() {
    return query<PartnerTicket & { partner_city?: string }>(
      `SELECT t.*, p.city as partner_city FROM partner_tickets t
       LEFT JOIN partners p ON p.id = t.partner_id
       ORDER BY t.created_at DESC`
    );
  }

  async getStats() {
    const [partners, tickets] = await Promise.all([
      query<{ total: string; active: string; avg_score: string }>(
        `SELECT CAST(COUNT(*) AS CHAR) as total,
         CAST(SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) AS CHAR) as active,
         CAST(COALESCE(AVG(score),0) AS CHAR) as avg_score FROM partners`
      ),
      query<{ open_count: string }>(
        `SELECT CAST(SUM(CASE WHEN status = 'aberto' THEN 1 ELSE 0 END) AS CHAR) as open_count FROM partner_tickets`
      ),
    ]);
    return {
      totalPartners: parseInt(partners[0]?.total ?? "0"),
      activePartners: parseInt(partners[0]?.active ?? "0"),
      averageScore: Math.round(parseFloat(partners[0]?.avg_score ?? "0") * 10) / 10,
      openTickets: parseInt(tickets[0]?.open_count ?? "0"),
      typeLabel: TYPE_LABEL,
    };
  }

  async create(data: {
    name: string;
    city: string;
    type: string;
    email?: string;
    cnpj?: string;
    phone?: string;
  }) {
    if (!data.name?.trim() || !data.city?.trim()) {
      throw new Error("Razão social e cidade são obrigatórios.");
    }
    if (data.cnpj) {
      const c = validateCnpj(data.cnpj);
      if (!c.valid) throw new Error(c.message ?? "CNPJ inválido.");
    }
    if (data.email) {
      const e = validateEmail(data.email);
      if (!e.valid) throw new Error(e.message ?? "E-mail inválido.");
    }
    const rows = await query<Partner>(
      `INSERT INTO partners (name, city, type, email, cnpj, phone, score, status)
       VALUES ($1, $2, $3, $4, $5, $6, 80, 'ativo') RETURNING *`,
      [
        data.name.trim(),
        data.city.trim(),
        data.type || "workshop",
        data.email?.trim() || null,
        data.cnpj ? data.cnpj.replace(/\D/g, "") : null,
        data.phone?.trim() || null,
      ]
    );
    return rows[0];
  }

  async createTicket(data: {
    subject: string;
    partner_name: string;
    message: string;
    partner_id?: string;
    priority?: string;
  }) {
    if (!data.subject?.trim() || !data.partner_name?.trim() || !data.message?.trim()) {
      throw new Error("Assunto, parceiro e descrição são obrigatórios.");
    }
    if (data.partner_id) {
      const p = await query<Partner>("SELECT id FROM partners WHERE id = $1", [data.partner_id]);
      if (!p.length) throw new Error("Parceiro não encontrado.");
    }
    const rows = await query<PartnerTicket>(
      `INSERT INTO partner_tickets (partner_id, subject, partner_name, message, status, priority)
       VALUES ($1, $2, $3, $4, 'aberto', $5) RETURNING *`,
      [
        data.partner_id || null,
        data.subject.trim(),
        data.partner_name.trim(),
        data.message.trim(),
        data.priority || "normal",
      ]
    );
    return rows[0];
  }
}

export const partnerService = new PartnerService();
