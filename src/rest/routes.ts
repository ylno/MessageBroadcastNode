import Router from "koa-router";
import { Context } from "koa";
import { Message } from "../types";
import eventBus from "../EventBus";

const router = new Router();

router.options("/message", async (ctx: Context) => {
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Methods", "POST");
  ctx.set("Access-Control-Allow-Headers", "Content-Type");
  ctx.body = "ok";
});

router.post("/message", async (ctx: Context) => {
  const message: Message = ctx.request.body as Message;
  console.log(`API: post message to ${message.target}, message: ${message.message}`);
  await eventBus.emit("message", { target: message.target, message: message.message });
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set("Access-Control-Allow-Methods", "POST");
  ctx.set("Access-Control-Allow-Headers", "Content-Type");
  ctx.body = "ok";
});

router.get("/message/:target/:message", async (ctx: Context) => {
  const { target, message } = ctx.params;
  console.log(`get message to ${target}, message: ${message}`);
  await eventBus.emit("message", { target, message });

  ctx.body = "ok";
});

router.get("/message/ping", async (ctx: Context) => {
  ctx.body = "pong";
});

export default router;
