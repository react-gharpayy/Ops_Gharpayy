import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { signupUser, loginUser, signAccessToken } from "../auth/auth.js";

const SignupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(120),
  role: z.enum(["admin", "sales", "ops", "owner"]).optional(),
});
const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

export function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/signup", async (req, reply) => {
    const body = SignupBody.parse(req.body);
    try {
      const u = await signupUser(body);
      return reply.send({ ok: true, userId: u.userId });
    } catch (e) {
      const err = e as Error & { code?: string };
      return reply.code(409).send({ code: err.code ?? "CONFLICT", message: err.message });
    }
  });

  app.post("/api/auth/login", async (req, reply) => {
    const body = LoginBody.parse(req.body);
    try {
      const claims = await loginUser(body.email, body.password);
      const token = await signAccessToken(claims);
      reply.setCookie("access_token", token, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
        path: "/", maxAge: 60 * 15,
      });
      return reply.send({ token, user: claims });
    } catch (e) {
      const err = e as Error & { code?: string };
      return reply.code(401).send({ code: err.code ?? "UNAUTHENTICATED", message: err.message });
    }
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie("access_token", { path: "/" });
    return reply.send({ ok: true });
  });
}
