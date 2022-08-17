import express, { Application } from "express";
import { authenticate } from "../middlewares/auth";
import options from "../middlewares/options";
import error from "../middlewares/error";

import homeRoutes from "./home";
import analyticRoutes from "./analytics";
import downloadRoutes from "./downloads";
import profitRoutes from "./profits";

import mailAnalytics from "../routes/mail/analytics";

export default function (app: Application) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/", homeRoutes);
  app.use("/analytics", authenticate, analyticRoutes);
  app.use("/exports", authenticate, downloadRoutes);
  app.use("/profits", authenticate, profitRoutes);

  app.use("/analytics/mail", mailAnalytics);

  app.use(options);
  app.use(error);
}
