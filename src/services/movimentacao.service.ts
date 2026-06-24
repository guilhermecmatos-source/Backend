import { query } from "../database/connection";
import { Movimentacao } from "../models/types";

export class MovimentacaoService {
  async findById(id: string): Promise<Movimentacao | null> {
    const rows = await query<Movimentacao>(
      "SELECT * FROM movimentacoes WHERE id = $1",
      [id]
    );
    return rows[0] || null;
  }

  async findByRequisicaoId(requisicaoId: string): Promise<Movimentacao | null> {
    const rows = await query<Movimentacao>(
      "SELECT * FROM movimentacoes WHERE requisicao_id = $1",
      [requisicaoId]
    );
    return rows[0] || null;
  }

  async findAll(): Promise<Movimentacao[]> {
    return query<Movimentacao>("SELECT * FROM movimentacoes ORDER BY created_at DESC");
  }

  async registrarSaida(requisicaoId: string, kmInicial: number): Promise<Movimentacao> {
    const rows = await query<Movimentacao>(
      "INSERT INTO movimentacoes (requisicao_id, km_inicial) VALUES ($1, $2) RETURNING *",
      [requisicaoId, kmInicial]
    );
    return rows[0];
  }

  async registrarRetorno(id: string, kmFinal: number): Promise<Movimentacao | null> {
    await query(
      "UPDATE movimentacoes SET km_final = $2, data_retorno = NOW(), updated_at = NOW() WHERE id = $1",
      [id, kmFinal]
    );
    return this.findById(id);
  }
}

export const movimentacaoService = new MovimentacaoService();
