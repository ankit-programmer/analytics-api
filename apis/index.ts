import express, { Application } from "express";
import { authenticate } from "../middlewares/auth";
import options from "../middlewares/options";
import error from "../middlewares/error";

import homeRoutes from "./home";
import analyticRoutes from "./analytics";
import logRoutes from "./logs";
import downloadRoutes from "./downloads";
import profitRoutes from "./profits";

export default function (app: Application) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/", homeRoutes);
  app.use("/analytics", authenticate, analyticRoutes);
  app.use("/logs", authenticate, logRoutes);
  app.use("/exports", authenticate, downloadRoutes);
  app.use("/profits", authenticate, profitRoutes);
  app.use(options);
  app.use(error);
}
