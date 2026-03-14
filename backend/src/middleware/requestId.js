import { v4 as uuid } from "uuid";

export const requestId = (req, res, next) => {
  const incoming = req.headers["x-request-id"];
  const requestId = typeof incoming === "string" && incoming.trim() ? incoming.trim() : uuid();

  req.id = requestId;
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  next();
};
