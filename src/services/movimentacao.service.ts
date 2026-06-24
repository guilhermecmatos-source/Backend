import { query } from "../database/connection";
import { Movimentacao } from "../models/types";
import { ruvService } from "./ruv.service";

export class MovimentacaoService {
  /**
   * Busca uma movimentação por ID, incluindo dados da RUV atrelada.
   */
  async findById(id: string): Promise<Movimentacao | null> {
    const rows = await query<Movimentacao>(
      `SELECT m.*, r.origin as ruv_origin, r.destination as ruv_destination, r.status as ruv_status
       FROM movimentacoes m
       JOIN ruv_requests r ON r.id = m.requisicao_id
       WHERE m.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Busca todas as movimentações vinculadas a uma RUV específica.
   */
  async findByRequisicaoId(requisicaoId: string): Promise<Movimentacao[]> {
    return query<Movimentacao>(
      `SELECT m.*, r.origin as ruv_origin, r.destination as ruv_destination, r.status as ruv_status
       FROM movimentacoes m
       JOIN ruv_requests r ON r.id = m.requisicao_id
       WHERE m.requisicao_id = $1
       ORDER BY m.created_at DESC`,
      [requisicaoId]
    );
  }

  /**
   * Registra a saída do veículo:
   * 1. Verifica se a RUV existe e está aprovada.
   * 2. Cria o registro de movimentação.
   * 3. Atualiza o status da RUV para "Em Trânsito".
   */
  async registrarSaida(
    requisicaoId: string,
    kmInicial: number
  ): Promise<Movimentacao> {
    // 1. Verifica existência e status da RUV
    const ruv = await ruvService.findById(requisicaoId);
    if (!ruv) {
      throw new Error("RUV não encontrada.");
    }
    if (ruv.status !== "aprovado") {
      throw new Error(
        `A RUV não está aprovada. Status atual: "${ruv.status}". Apenas RUVs aprovadas podem gerar movimentação.`
      );
    }

    // 2. Insere o registro de movimentação
    const rows = await query<Movimentacao>(
      `INSERT INTO movimentacoes (requisicao_id, km_inicial, data_saida)
       VALUES ($1, $2, NOW()) RETURNING *`,
      [requisicaoId, kmInicial]
    );

    const movimentacao = rows[0];
    if (!movimentacao) {
      throw new Error("Falha ao criar registro de movimentação.");
    }

    // 3. Atualiza o status da RUV para "Em Trânsito"
    await query(
      `UPDATE ruv_requests SET status = 'Em Trânsito', updated_at = NOW() WHERE id = $1`,
      [requisicaoId]
    );

    // Retorna o registro completo com o JOIN
    return (await this.findById(movimentacao.id))!;
  }

  /**
   * Registra o retorno do veículo:
   * 1. Verifica se a movimentação existe.
   * 2. Valida que km_final é maior que km_inicial.
   * 3. Atualiza km_final e data_retorno.
   * 4. Atualiza o status da RUV para "Concluída".
   */
  async registrarRetorno(
    id: string,
    kmFinal: number
  ): Promise<Movimentacao> {
    // 1. Busca a movimentação existente
    const movimentacao = await this.findById(id);
    if (!movimentacao) {
      throw new Error("Movimentação não encontrada.");
    }

    // 2. Valida km_final > km_inicial
    if (kmFinal <= Number(movimentacao.km_inicial)) {
      throw new Error(
        `O km_final (${kmFinal}) deve ser maior que o km_inicial (${movimentacao.km_inicial}).`
      );
    }

    // 3. Atualiza a movimentação
    await query(
      `UPDATE movimentacoes
       SET km_final = $2, data_retorno = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, kmFinal]
    );

    // 4. Atualiza o status da RUV para "Concluída"
    await query(
      `UPDATE ruv_requests SET status = 'Concluída', updated_at = NOW() WHERE id = $1`,
      [movimentacao.requisicao_id]
    );

    return (await this.findById(id))!;
  }

  /**
   * Lista todas as movimentações com dados da RUV atrelada.
   */
  async findAll(): Promise<Movimentacao[]> {
    return query<Movimentacao>(
      `SELECT m.*, r.origin as ruv_origin, r.destination as ruv_destination, r.status as ruv_status
       FROM movimentacoes m
       JOIN ruv_requests r ON r.id = m.requisicao_id
       ORDER BY m.created_at DESC`
    );
  }
}

export const movimentacaoService = new MovimentacaoService();
