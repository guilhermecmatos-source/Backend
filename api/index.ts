import app from "../src/app";

// Exporta o Express app como serverless function para o Vercel.
// O @vercel/node runtime converte automaticamente o Express handler.
export default app;
