"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("../src/app"));
// Exporta o Express app como serverless function para o Vercel.
// O @vercel/node runtime converte automaticamente o Express handler.
exports.default = app_1.default;
