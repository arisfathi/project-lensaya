import { getRequestHostContext } from "../utils/requestHost.js";

export const hostContext = (req, _res, next) => {
  req.hostContext = getRequestHostContext(req);
  next();
};
