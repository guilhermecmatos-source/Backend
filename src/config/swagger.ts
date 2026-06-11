import swaggerJsdoc from "swagger-jsdoc";

const port = process.env.PORT || 3001;

const swaggerDefinition = {
  openapi: "3.0.3",
  info: {
    title: "Fleet Platform API",
    version: "1.0.0",
    description:
      "API REST da plataforma FleetAI — gestão de frotas, motoristas, viagens, combustível e manutenção.",
  },
  servers: [{ url: `http://localhost:${port}`, description: "Desenvolvimento local" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token obtido em POST /api/auth/login",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: { error: { type: "string" } },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "admin@fleetplatform.com" },
          password: { type: "string", example: "Admin@123" },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 6 },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
              role: { type: "string", enum: ["admin", "attendant", "client"] },
            },
          },
        },
      },
      Vehicle: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          plate: { type: "string" },
          brand: { type: "string" },
          model: { type: "string" },
          year: { type: "integer" },
          status: { type: "string", enum: ["active", "maintenance", "inactive"] },
          mileage: { type: "number" },
        },
      },
      VehicleInput: {
        type: "object",
        required: ["plate", "brand", "model", "year"],
        properties: {
          plate: { type: "string" },
          brand: { type: "string" },
          model: { type: "string" },
          year: { type: "integer" },
          status: { type: "string", enum: ["active", "maintenance", "inactive"] },
          mileage: { type: "number" },
        },
      },
      Driver: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          license_number: { type: "string" },
          phone: { type: "string" },
          score: { type: "number" },
          active: { type: "boolean" },
        },
      },
      DriverInput: {
        type: "object",
        required: ["name", "license_number"],
        properties: {
          name: { type: "string" },
          license_number: { type: "string" },
          phone: { type: "string" },
        },
      },
      Travel: {
        type: "object",
        properties: {
          id: { type: "string" },
          vehicle_id: { type: "string" },
          driver_id: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          distance_km: { type: "number" },
          fuel_consumption: { type: "number" },
          status: { type: "string", enum: ["scheduled", "in_progress", "completed", "cancelled"] },
        },
      },
      TravelInput: {
        type: "object",
        required: ["vehicle_id", "driver_id", "origin", "destination"],
        properties: {
          vehicle_id: { type: "string" },
          driver_id: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          distance_km: { type: "number" },
          fuel_consumption: { type: "number" },
        },
      },
      FuelRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          vehicle_id: { type: "string" },
          liters: { type: "number" },
          cost: { type: "number" },
          mileage_at_fill: { type: "number" },
          station: { type: "string" },
          filled_at: { type: "string", format: "date-time" },
        },
      },
      FuelInput: {
        type: "object",
        required: ["vehicle_id", "liters", "cost", "mileage_at_fill"],
        properties: {
          vehicle_id: { type: "string" },
          liters: { type: "number" },
          cost: { type: "number" },
          mileage_at_fill: { type: "number" },
          station: { type: "string" },
          filled_at: { type: "string", format: "date-time" },
        },
      },
      Maintenance: {
        type: "object",
        properties: {
          id: { type: "string" },
          vehicle_id: { type: "string" },
          type: { type: "string", enum: ["preventive", "corrective"] },
          description: { type: "string" },
          cost: { type: "number" },
          scheduled_at: { type: "string", format: "date-time" },
        },
      },
      MaintenanceInput: {
        type: "object",
        required: ["vehicle_id", "type", "description", "scheduled_at"],
        properties: {
          vehicle_id: { type: "string" },
          type: { type: "string", enum: ["preventive", "corrective"] },
          description: { type: "string" },
          cost: { type: "number" },
          scheduled_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        security: [],
        responses: {
          200: {
            description: "API online",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    service: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
        },
        responses: {
          200: { description: "JWT retornado", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
          401: { description: "Credenciais inválidas", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Cadastro de cliente",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } },
        },
        responses: {
          201: { description: "Conta criada", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } } },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Sessão encerrada" } },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Usuário autenticado",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Perfil do usuário" } },
      },
    },
    "/api/auth/attendants": {
      post: {
        tags: ["Auth"],
        summary: "Criar atendente (admin)",
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: "Atendente criado" } },
      },
    },
    "/api/vehicles": {
      get: {
        tags: ["Vehicles"],
        summary: "Listar veículos",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Lista de veículos",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Vehicle" } } } },
          },
        },
      },
      post: {
        tags: ["Vehicles"],
        summary: "Cadastrar veículo",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/VehicleInput" } } },
        },
        responses: { 201: { description: "Veículo criado", content: { "application/json": { schema: { $ref: "#/components/schemas/Vehicle" } } } } },
      },
    },
    "/api/vehicles/{id}": {
      get: {
        tags: ["Vehicles"],
        summary: "Obter veículo",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Veículo", content: { "application/json": { schema: { $ref: "#/components/schemas/Vehicle" } } } } },
      },
      put: {
        tags: ["Vehicles"],
        summary: "Atualizar veículo",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/VehicleInput" } } } },
        responses: { 200: { description: "Veículo atualizado" } },
      },
      delete: {
        tags: ["Vehicles"],
        summary: "Excluir veículo (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 204: { description: "Removido" } },
      },
    },
    "/api/drivers": {
      get: {
        tags: ["Drivers"],
        summary: "Listar motoristas",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Lista", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Driver" } } } } } },
      },
      post: {
        tags: ["Drivers"],
        summary: "Cadastrar motorista",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/DriverInput" } } } },
        responses: { 201: { description: "Motorista criado" } },
      },
    },
    "/api/drivers/{id}": {
      get: {
        tags: ["Drivers"],
        summary: "Obter motorista",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Motorista" } },
      },
      put: {
        tags: ["Drivers"],
        summary: "Atualizar motorista",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Atualizado" } },
      },
      delete: {
        tags: ["Drivers"],
        summary: "Excluir motorista",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 204: { description: "Removido" } },
      },
    },
    "/api/drivers/{id}/score": {
      get: {
        tags: ["Drivers"],
        summary: "Atualizar e obter score do motorista",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Score calculado" } },
      },
    },
    "/api/travels": {
      get: {
        tags: ["Travels"],
        summary: "Listar viagens",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Lista de viagens" } },
      },
      post: {
        tags: ["Travels"],
        summary: "Criar viagem / despacho",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/TravelInput" } } } },
        responses: { 201: { description: "Viagem criada" } },
      },
    },
    "/api/travels/{id}": {
      get: {
        tags: ["Travels"],
        summary: "Obter viagem",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Viagem" } },
      },
      put: {
        tags: ["Travels"],
        summary: "Atualizar viagem",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Atualizada" } },
      },
    },
    "/api/travels/{id}/cancel": {
      patch: {
        tags: ["Travels"],
        summary: "Cancelar viagem",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Cancelada" } },
      },
    },
    "/api/fuel": {
      get: {
        tags: ["Fuel"],
        summary: "Listar abastecimentos",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Lista" } },
      },
      post: {
        tags: ["Fuel"],
        summary: "Registrar abastecimento",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/FuelInput" } } } },
        responses: { 201: { description: "Registro criado" } },
      },
    },
    "/api/fuel/report": {
      get: {
        tags: ["Fuel"],
        summary: "Relatório de combustível",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "vehicleId", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Relatório" } },
      },
    },
    "/api/fuel/patterns/{vehicleId}": {
      get: {
        tags: ["Fuel"],
        summary: "Detectar padrões/anomalias",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "vehicleId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Alertas de padrão" } },
      },
    },
    "/api/maintenance": {
      get: {
        tags: ["Maintenance"],
        summary: "Listar manutenções",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Lista" } },
      },
      post: {
        tags: ["Maintenance"],
        summary: "Agendar manutenção",
        security: [{ bearerAuth: [] }],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/MaintenanceInput" } } } },
        responses: { 201: { description: "Manutenção criada" } },
      },
    },
    "/api/maintenance/alerts": {
      get: {
        tags: ["Maintenance"],
        summary: "Alertas preventivos IA",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Alertas" } },
      },
    },
    "/api/maintenance/{id}/complete": {
      patch: {
        tags: ["Maintenance"],
        summary: "Concluir manutenção",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Concluída" } },
      },
    },
    "/api/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "KPIs e alertas do painel",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Dados do dashboard" } },
      },
    },
  },
};

export const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: [],
});
