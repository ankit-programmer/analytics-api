import express, { Application } from "express";
import home from "../routes/home";
import dummy from "../routes/dummy";
import analytics from "../routes/analytics";
import downloads from "../routes/downloads";
import campaign from '../routes/campaign';
import mailAnalytics from "../routes/mail/analytics";
import profits from '../routes/profits';
import options from "../middlewares/options";
import error from "../middlewares/error";
import { authenticate } from "../middlewares/auth";

export default function (app: Application) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/", home);
  app.use("/dummy", dummy);
  app.use("/analytics", analytics); // Temp for compatibility
  app.use("/analytics/sms", authenticate, analytics);
  app.use("/analytics/mail", mailAnalytics);
  app.use("/analytics/campaigns", authenticate, campaign);
  app.use("/exports", authenticate, downloads);
  app.use("/profits/sms", authenticate, profits);
  app.use(options);
  app.use(error);
}
