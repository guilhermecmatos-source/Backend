import { query } from "../database/connection";

export interface Contract {
  id: string;
  title: string;
  area: string;
  template_key: string;
  client_name: string;
  client_email?: string | null;
  client_cpf?: string | null;
  content: string;
  honorarios: number;
  status: string;
  signature_step: number;
  sent_at?: string | null;
  signed_at?: string | null;
  cancelled_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

const TEMPLATES: Record<string, { area: string; title: string; body: string }> = {
  locacao_veiculo: {
    area: "frota",
    title: "Contrato de Locação de Veículo",
    body: "CONTRATO DE LOCAÇÃO DE VEÍCULO\n\nLocador: FleetAI Logistics\nLocatário: {{client_name}}\nCPF: {{client_cpf}}\n\nHonorários: R$ {{honorarios}}\n",
  },
  prestacao_servicos: {
    area: "logistica",
    title: "Contrato de Prestação de Serviços",
    body: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS LOGÍSTICOS\n\nContratante: {{client_name}}\nE-mail: {{client_email}}\n\nValor: R$ {{honorarios}}\n",
  },
  manutencao_frota: {
    area: "manutencao",
    title: "Contrato de Manutenção de Frota",
    body: "CONTRATO DE MANUTENÇÃO PREVENTIVA E CORRETIVA\n\nCliente: {{client_name}}\n\nHonorários mensais: R$ {{honorarios}}\n",
  },
};

function fillTemplate(templateKey: string, data: Record<string, string | number>) {
  const tpl = TEMPLATES[templateKey] ?? TEMPLATES.prestacao_servicos;
  let content = tpl.body;
  for (const [key, value] of Object.entries(data)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return { ...tpl, content };
}

export class ContractService {
  async findAll() {
    return query<Contract>("SELECT * FROM contracts ORDER BY created_at DESC");
  }

  async findById(id: string) {
    const rows = await query<Contract>("SELECT * FROM contracts WHERE id = $1", [id]);
    return rows[0] || null;
  }

  getTemplates(area?: string) {
    const entries = Object.entries(TEMPLATES).map(([key, tpl]) => ({
      key,
      area: tpl.area,
      title: tpl.title,
    }));
    return area ? entries.filter((t) => t.area === area) : entries;
  }

  preview(data: {
    template_key: string;
    client_name: string;
    client_email?: string;
    client_cpf?: string;
    honorarios?: number;
  }) {
    const filled = fillTemplate(data.template_key, {
      client_name: data.client_name,
      client_email: data.client_email ?? "",
      client_cpf: data.client_cpf ?? "",
      honorarios: data.honorarios ?? 0,
    });
    return {
      title: filled.title,
      area: filled.area,
      content: filled.content,
    };
  }

  async create(data: {
    title: string;
    area: string;
    template_key: string;
    client_name: string;
    client_email?: string;
    client_cpf?: string;
    content: string;
    honorarios?: number;
    created_by?: string;
  }) {
    const rows = await query<Contract>(
      `INSERT INTO contracts (title, area, template_key, client_name, client_email, client_cpf, content, honorarios, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        data.title,
        data.area,
        data.template_key,
        data.client_name,
        data.client_email ?? null,
        data.client_cpf ?? null,
        data.content,
        data.honorarios ?? 0,
        data.created_by ?? null,
      ]
    );
    return rows[0];
  }

  async update(id: string, data: Partial<Contract>) {
    const current = await this.findById(id);
    if (!current) return null;
    const rows = await query<Contract>(
      `UPDATE contracts SET
        title = $2, area = $3, client_name = $4, client_email = $5, client_cpf = $6,
        content = $7, honorarios = $8, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [
        id,
        data.title ?? current.title,
        data.area ?? current.area,
        data.client_name ?? current.client_name,
        data.client_email ?? current.client_email,
        data.client_cpf ?? current.client_cpf,
        data.content ?? current.content,
        data.honorarios ?? current.honorarios,
      ]
    );
    return rows[0] || null;
  }

  async send(id: string) {
    const rows = await query<Contract>(
      `UPDATE contracts SET status = 'enviado', sent_at = NOW(), signature_step = 2, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows[0]) {
      await query(
        `INSERT INTO contract_notifications (contract_id, message) VALUES ($1, $2)`,
        [id, "Contrato enviado para assinatura do cliente."]
      );
    }
    return rows[0] || null;
  }

  async sign(id: string) {
    const rows = await query<Contract>(
      `UPDATE contracts SET status = 'assinado', signed_at = NOW(), signature_step = 3, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }

  async cancel(id: string) {
    const rows = await query<Contract>(
      `UPDATE contracts SET status = 'cancelado', cancelled_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  }
}

export const contractService = new ContractService();
