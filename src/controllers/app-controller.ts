import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { registry } from "../observability/metrics";

@Controller()
export class AppController {
  @Get("health")
  getHealth() {
    return { status: "ok" };
  }

  @Get("metrics")
  async getMetrics(@Res() res: Response) {
    res.set("Content-Type", registry.contentType);
    res.status(200).send(await registry.metrics());
  }
}