export const sendSuccess = (res, data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
  });
};

export const sendError = (res, error, statusCode = 400) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error,
  });
};