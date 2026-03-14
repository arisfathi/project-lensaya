export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    data: null,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};