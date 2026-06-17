import { GoogleGenAI } from "@google/genai";

export class AiService {
  async generateChatResponse(
    messages: { role: string; text: string }[],
    activeModule: string,
    vehicleContext?: {
      brand?: string;
      model?: string;
      plate?: string;
      km?: number;
      avgConsumption?: number;
    }
  ): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return this.getFallbackResponse(messages);
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      let systemInstruction = `Você é o "FleetAI", o assistente inteligente de controle operacional e diagnóstico de frotas. Responda em PORTUGUÊS de forma direta, técnica mas acessível, focando em ajudar o motorista ou gestor de frotas. Mantenha o tom profissional e corporativo.
Contexto operacional atual:
- Módulo ativo: ${activeModule || "Não especificado"}`;

      if (vehicleContext) {
        systemInstruction += `
- Dados do veículo selecionado:
  Marca: ${vehicleContext.brand || "N/A"}
  Modelo: ${vehicleContext.model || "N/A"}
  Placa: ${vehicleContext.plate || "N/A"}
  KM: ${vehicleContext.km || "N/A"}
  Consumo Médio: ${vehicleContext.avgConsumption || "N/A"} km/L`;
      }

      // Map messages: role needs to be 'user' or 'model'
      const contents = messages.map((m) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.text }],
      }));

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
        },
      });

      return response.text || "Sem resposta da IA.";
    } catch (err) {
      console.error("[AiService.generateChatResponse] Error calling Gemini API:", err);
      throw new Error("Erro na comunicação com a API do Gemini. Verifique a GEMINI_API_KEY no arquivo .env");
    }
  }

  private getFallbackResponse(messages: { role: string; text: string }[]): string {
    const lastMessage = messages[messages.length - 1]?.text || "";
    const query = lastMessage.toLowerCase();

    if (query.includes("receita") || query.includes("faturamento") || query.includes("gerador")) {
      return `📊 **Laudo de Maior Receita Operacional:**\nO veículo **Scania R 450 (Placa BRA-2E19)** é atualmente o maior gerador de receita da frota.\n- Preço de Venda: R$ 680.000,00\n- Locação Diária: R$ 1.800,00\n- Locação Semanal: R$ 11.000,00\n- Locação Mensal: R$ 38.000,00\n- Km atual: 125.430 km\n- Consumo médio: 2,8 km/L`;
    }

    if (query.includes("vencimento") || query.includes("contrato") || query.includes("vencem")) {
      return `⚠️ **Auditoria de Contratos Próximos ao Vencimento:**\n- Contrato LOC-2026-004 (Scania R 450 - BRA-2E19): Vence em 15 dias.\n- Contrato LOC-2026-009 (Volvo FH 540 - FLT-0130): Vence em 30 dias.\nPor favor, verifique a Central de Documentos para iniciar as renovações ou renegociações necessárias.`;
    }

    if (query.includes("viagens") || query.includes("motorista") || query.includes("desempenho")) {
      return `📊 **Boletim de Desempenho de Motoristas Destaque:**\nO condutor destaque do mês é **Carlos Eduardo Silva** com um score de condução de **94/100**.\n- Categoria CNH: AB (Vencimento: 15/06/2028)\n- Veículo vinculado: Toyota Hilux (ABC1D23)\n- Viagens concluídas sem ocorrências: 12 no período.\n- Média de consumo: Dentro do planejado.`;
    }

    if (query.includes("custo") || query.includes("operacional") || query.includes("unidade")) {
      return `📊 **Auditoria de Custos Operacionais por Unidade:**\n- **Matriz São Paulo:** R$ 125.400,00 (combustível, manutenção corretiva do Atego MEC-4D21 e despachos)\n- **Filial Campinas:** R$ 45.200,00 (manutenção preventiva e combustível)\nA maior parcela de custos do período está concentrada na manutenção corretiva e no consumo de combustível da frota pesada.`;
    }

    if (query.includes("óleo") || query.includes("oleo")) {
      return `🔧 **Protocolo de Verificação de Nível de Óleo:**\n1. Estacione o veículo em uma superfície plana e desligue o motor.\n2. Aguarde de 5 a 10 minutos para que o óleo retorne ao cárter.\n3. Retire a vareta de medição, limpe-a com um pano limpo e insira-a completamente novamente.\n4. Retire a vareta outra vez e verifique se o nível está entre as marcas MIN e MAX.\n⚠️ Caso o nível esteja abaixo do MIN, complete com o lubrificante recomendado pelo fabricante e agende uma manutenção formal de revisão na Oficina.`;
    }

    if (query.includes("freio") || query.includes("ruído") || query.includes("rangendo")) {
      return `⚠️ **Alerta de Desgaste das Pastilhas de Freio:**\n- Ruídos metálicos ou rangidos ao acionar o freio indicam desgaste acentuado das pastilhas de freio.\n- Recomendamos interromper a viagem com segurança se o ruído persistir.\n🔧 **Ação sugerida:** Acesse o módulo de **Oficina & OS** para realizar o agendamento de uma manutenção corretiva imediata para substituição das pastilhas do veículo.`;
    }

    if (query.includes("luz") || query.includes("painel") || query.includes("injeção")) {
      return `⚠️ **Protocolo de Alerta de Luz de Injeção Eletrônica:**\nA luz de injeção acesa indica uma anomalia no sistema de controle de emissões ou de combustão.\n1. Reduza a velocidade e evite acelerações bruscas.\n2. Verifique se há falhas perceptíveis no motor (perda de potência ou falhas na aceleração).\n3. Se a luz piscar intermitentemente, pare o veículo em local seguro imediatamente para evitar danos severos ao catalisador.\n🔧 **Ação sugerida:** Agende uma manutenção diagnóstica formal por meio do módulo de **Oficina & OS**.`;
    }

    return `Olá! Sou o **FleetAI**, seu assistente operacional de frotas. Estou operando em **Modo Demonstração** (sem chave de API ativa).\n\nVocê pode digitar perguntas contendo palavras-chave para obter diagnósticos simulados rápidos:\n- **receita** / **faturamento** / **gerador**: Laudo de receita da Scania R 450.\n- **vencimento** / **contrato**: Auditoria de contratos próximos ao vencimento.\n- **viagens** / **desempenho**: Boletim do motorista destaque.\n- **custo** / **unidade**: Custos operacionais por unidade de pátio.\n- **óleo** / **oleo**: Instruções de nível de óleo.\n- **freio** / **ruído**: Diagnóstico de desgaste de freios.\n- **luz** / **painel** / **injeção**: Protocolo para luz de injeção eletrônica.`;
  }
}

export const aiService = new AiService();
