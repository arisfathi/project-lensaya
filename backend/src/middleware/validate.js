export const validate = (schema, source = "body") => (req, _res, next) => {
  const rawInput = req[source];
  const normalizedInput =
    source === "body" && rawInput === undefined ? {} : rawInput;

  const result = schema.safeParse(normalizedInput);
  if (!result.success) {
    const message = result.error.issues?.[0]?.message || "Validation failed";
    return _res.status(400).json({
      success: false,
      data: null,
      error: message,
    });
  }

  req.validated = result.data;

  // NEVER overwrite req.query (Express getter)
  if (source === "query") {
    req.validatedQuery = result.data;
    return next();
  }

  req[source] = result.data;
  return next();
};
